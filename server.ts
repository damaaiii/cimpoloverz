import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GEMINI_MODEL,
  classifyGeminiError,
  getGenAI,
  hasValidApiKey,
} from './server/aiClient.ts';
import {
  type HighlightRequestBody,
  executeHighlightRequest,
  tryFetchArticle,
} from './server/highlightService.ts';
import {
  type NormalizedSegmentInput,
  type ScriptRequestInput,
  type ScriptSegmentBuilt,
  buildScriptPrompts,
  executeScriptDirect,
  expandShortSegments,
  parseStreamedTalkBlocks,
  validateScriptInput,
} from './server/scriptService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

type ScriptJobStatus =
  | 'queued'
  | 'preparing'
  | 'generating'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

interface ScriptJob {
  jobId: string;
  clientSessionId: string;
  createdAt: number;
  updatedAt: number;
  status: ScriptJobStatus;
  statusLabel: string;
  isDemo: boolean;
  programName: string;
  programDuration?: string;
  theme: string;
  requestedSegments: NormalizedSegmentInput[];
  segments: ScriptSegmentBuilt[];
  completedCount: number;
  totalCount: number;
  urlWarning?: string;
  error?: string;
  errorCode?: string;
  cancelled: boolean;
  abortController: AbortController;
}

const scriptJobs = new Map<string, ScriptJob>();
const SCRIPT_JOB_TTL_MS = 30 * 60 * 1000;
const SCRIPT_JOB_TIMEOUT_MS = 120 * 1000;

function pruneOldScriptJobs() {
  const now = Date.now();
  for (const [id, job] of scriptJobs.entries()) {
    const isActive =
      job.status === 'queued' ||
      job.status === 'preparing' ||
      job.status === 'generating' ||
      job.status === 'finalizing';
    if (!isActive && now - job.updatedAt > SCRIPT_JOB_TTL_MS) {
      scriptJobs.delete(id);
    }
  }
}

function isJobActive(job: ScriptJob): boolean {
  return (
    !job.cancelled &&
    (job.status === 'queued' ||
      job.status === 'preparing' ||
      job.status === 'generating' ||
      job.status === 'finalizing')
  );
}

function serializeScriptJob(job: ScriptJob, alreadyRunning?: boolean) {
  return {
    jobId: job.jobId,
    alreadyRunning: alreadyRunning || undefined,
    status: job.status,
    statusLabel: job.statusLabel,
    isDemo: job.isDemo,
    programName: job.programName,
    programDuration: job.programDuration,
    theme: job.theme,
    segments: job.segments,
    completedCount: job.completedCount,
    totalCount: job.totalCount,
    urlWarning: job.urlWarning,
    error: job.error,
    code: job.errorCode,
  };
}

async function runScriptJob(
  job: ScriptJob,
  params: {
    cleanAnnouncers: string[];
    trimmedProgram: string;
    trimmedProgramDuration?: string;
    trimmedTheme: string;
    trimmedUrl: string;
    trimmedManualText: string;
    safeClosingType: 'segmen1' | 'segmen2';
  }
) {
  const startTime = Date.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  timeoutHandle = setTimeout(() => {
    if (!job.cancelled && isJobActive(job)) {
      timedOut = true;
      job.abortController.abort();
    }
  }, SCRIPT_JOB_TIMEOUT_MS);

  try {
    job.status = 'preparing';
    job.statusLabel = 'Menyiapkan script';
    job.updatedAt = Date.now();

    let newsReferenceText = params.trimmedManualText;

    if (!newsReferenceText && params.trimmedUrl) {
      const fetched = await tryFetchArticle(params.trimmedUrl);
      console.log('[AI Script] Reference URL fetch:', {
        jobId: job.jobId,
        ok: fetched.ok,
        httpStatus: fetched.httpStatus,
        textLength: fetched.text.length,
      });

      if (job.cancelled || timedOut) {
        throw new Error(timedOut ? 'TIMEOUT' : 'CANCELLED');
      }
      if (fetched.ok) {
        newsReferenceText = `Judul: ${fetched.title}\nSumber: ${fetched.source}\nIsi:\n${fetched.text}`;
      } else if (!params.trimmedTheme) {
        job.status = 'failed';
        job.statusLabel = 'Gagal menyiapkan script';
        job.errorCode = 'URL_UNREACHABLE';
        job.error =
          'Link berita referensi tidak dapat diakses otomatis. Tempel isi berita secara manual atau isi tema siaran.';
        job.updatedAt = Date.now();
        return;
      } else {
        job.urlWarning =
          'Link berita tidak dapat diakses otomatis, naskah disusun berdasarkan tema siaran yang kamu masukkan.';
      }
    }

    if (job.cancelled || timedOut) {
      throw new Error(timedOut ? 'TIMEOUT' : 'CANCELLED');
    }

    job.status = 'generating';
    job.statusLabel = 'Sedang menulis';
    job.updatedAt = Date.now();

    const { systemInstruction, userPrompt, allowedSpeakers } = buildScriptPrompts({
      cleanAnnouncers: params.cleanAnnouncers,
      trimmedProgram: params.trimmedProgram,
      trimmedProgramDuration: params.trimmedProgramDuration,
      trimmedTheme: params.trimmedTheme,
      requestedSegments: job.requestedSegments,
      safeClosingType: params.safeClosingType,
      newsReferenceText,
    });

    const ai = getGenAI();
    let fullText = '';
    let lastFinishReason: string | undefined;
    let lastBlockReason: string | undefined;
    let streamAttempt = 0;
    const maxStreamAttempts = 2;

    while (streamAttempt < maxStreamAttempts) {
      streamAttempt += 1;
      fullText = '';
      lastFinishReason = undefined;
      lastBlockReason = undefined;

      try {
        console.log('[AI Script] Calling Gemini generateContentStream:', {
          jobId: job.jobId,
          attempt: streamAttempt,
          model: GEMINI_MODEL,
        });

        const stream = await ai.models.generateContentStream({
          model: GEMINI_MODEL,
          contents: userPrompt,
          config: {
            systemInstruction,
            abortSignal: job.abortController.signal,
          },
        });

        for await (const chunk of stream) {
          if (job.cancelled || timedOut) {
            throw new Error(timedOut ? 'TIMEOUT' : 'CANCELLED');
          }
          if (chunk.promptFeedback?.blockReason) {
            lastBlockReason = String(chunk.promptFeedback.blockReason);
          }
          const chunkFinish = chunk.candidates?.[0]?.finishReason;
          if (chunkFinish) {
            lastFinishReason = String(chunkFinish);
          }

          const delta = typeof chunk.text === 'string' ? chunk.text : '';
          if (delta) {
            fullText += delta;
            const partial = parseStreamedTalkBlocks(
              fullText,
              job.requestedSegments,
              allowedSpeakers,
              false
            );
            if (partial.segments.length > 0) {
              job.segments = partial.segments;
              job.completedCount = partial.completedCount;
              job.updatedAt = Date.now();
            }
          }
        }

        console.log('[AI Script] Stream finished:', {
          jobId: job.jobId,
          attempt: streamAttempt,
          finishReason: lastFinishReason || 'UNKNOWN',
          blockReason: lastBlockReason || null,
          textLength: fullText.trim().length,
        });

        if (
          lastBlockReason ||
          lastFinishReason === 'SAFETY' ||
          lastFinishReason === 'PROHIBITED_CONTENT' ||
          lastFinishReason === 'BLOCKLIST' ||
          lastFinishReason === 'SPII'
        ) {
          throw Object.assign(
            new Error(`Konten diblokir oleh kebijakan keamanan AI (${lastBlockReason || lastFinishReason}).`),
            { aiCode: 'SAFETY_BLOCK' }
          );
        }

        if (!fullText.trim()) {
          throw Object.assign(new Error('Empty stream response from Gemini Script'), {
            aiCode: 'EMPTY_RESPONSE',
          });
        }
        break;
      } catch (streamErr) {
        if (job.cancelled || timedOut) {
          throw streamErr;
        }
        const classifiedStream = classifyGeminiError(streamErr, 'AI Script');
        const shouldRetry =
          streamAttempt < maxStreamAttempts &&
          classifiedStream.retryable &&
          (!fullText ||
            classifiedStream.code === 'QUOTA_EXCEEDED' ||
            classifiedStream.code === 'NETWORK_ERROR' ||
            classifiedStream.code === 'EMPTY_RESPONSE');
        if (!shouldRetry) {
          throw streamErr;
        }
        const waitMs = classifiedStream.code === 'QUOTA_EXCEEDED' ? 2500 : 1400;
        console.warn(
          `[AI Script] Stream attempt ${streamAttempt} (${classifiedStream.code}) retrying in ${waitMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    if (job.cancelled || timedOut) {
      throw new Error(timedOut ? 'TIMEOUT' : 'CANCELLED');
    }

    job.status = 'finalizing';
    job.statusLabel = 'Menyelesaikan hasil';
    job.updatedAt = Date.now();

    const finalized = parseStreamedTalkBlocks(
      fullText,
      job.requestedSegments,
      allowedSpeakers,
      true
    );

    if (finalized.segments.length === 0) {
      const isTokenCut = lastFinishReason === 'MAX_TOKENS';
      console.error('[AI Script] Talk block parse failure:', {
        jobId: job.jobId,
        finishReason: lastFinishReason,
        preview: fullText.trim().slice(0, 220),
      });
      throw Object.assign(
        new Error(
          isTokenCut
            ? 'Script AI terpotong sebelum segmen pertama selesai (MAX_TOKENS).'
            : 'Format blok ===TALK=== tidak ditemukan pada output AI.'
        ),
        { aiCode: isTokenCut ? 'TOKEN_LIMIT' : 'PARSE_ERROR' }
      );
    }

    if (finalized.segments.length < job.requestedSegments.length) {
      const isTokenCut = lastFinishReason === 'MAX_TOKENS';
      job.status = 'failed';
      job.statusLabel = 'Hasil belum lengkap';
      job.segments = [];
      job.completedCount = 0;
      job.errorCode = isTokenCut ? 'TOKEN_LIMIT' : 'PARSE_ERROR';
      job.error = isTokenCut
        ? `Respons AI terpotong batas panjang token pada talk ${finalized.segments.length} dari ${job.requestedSegments.length}. Kurangi jumlah/durasi talk atau klik Coba Lagi.`
        : `Susunan talk dari AI baru terbentuk ${finalized.segments.length} dari ${job.requestedSegments.length} talk. Silakan klik Coba Lagi ya.`;
      job.updatedAt = Date.now();
      return;
    }

    let finalSegments = finalized.segments;
    const underLength = finalSegments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => segment.wordCount < segment.durationMinutes * 100);

    if (underLength.length > 0 && Date.now() - startTime < SCRIPT_JOB_TIMEOUT_MS - 35000) {
      try {
        const expandedMap = await expandShortSegments({
          ai,
          shortSegments: underLength,
          systemInstruction,
          allowedSpeakers,
          trimmedProgram: params.trimmedProgram,
          trimmedTheme: params.trimmedTheme || 'Siaran SIMFONI FM',
          abortSignal: job.abortController.signal,
        });
        finalSegments = finalSegments.map((seg, idx) => {
          const expanded = expandedMap.get(idx);
          if (expanded && expanded.wordCount > seg.wordCount) {
            return expanded;
          }
          return seg;
        });
      } catch (expandError) {
        if (job.cancelled || timedOut) {
          throw expandError;
        }
        console.warn('[AI Script] Expansion pass skipped:', expandError);
      }
    }

    if (job.cancelled || timedOut) {
      throw new Error(timedOut ? 'TIMEOUT' : 'CANCELLED');
    }

    job.segments = finalSegments;
    job.completedCount = finalSegments.length;
    job.status = 'completed';
    job.statusLabel = 'Berhasil';
    job.updatedAt = Date.now();
    console.log('[AI Script] Completed successfully:', {
      jobId: job.jobId,
      segmentsCount: finalSegments.length,
    });
  } catch (error) {
    if (job.cancelled) {
      job.status = 'cancelled';
      job.statusLabel = 'Dibatalkan';
      job.segments = [];
      job.completedCount = 0;
      job.updatedAt = Date.now();
      return;
    }
    if (timedOut) {
      job.status = 'timed_out';
      job.statusLabel = 'Melebihi batas waktu';
      job.segments = [];
      job.completedCount = 0;
      job.errorCode = 'TIMEOUT';
      job.error =
        'Proses penyusunan script melebihi batas waktu server. Coba lagi atau kurangi jumlah/durasi talk.';
      job.updatedAt = Date.now();
      return;
    }
    const classified = classifyGeminiError(error, 'AI Script');
    job.status = 'failed';
    job.statusLabel = 'Gagal menyusun script';
    job.segments = [];
    job.completedCount = 0;
    job.errorCode = classified.code;
    job.error = classified.message;
    job.updatedAt = Date.now();
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Ensure JSON body parse errors on /api/* return structured JSON, never HTML
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      const errObj = err as { status?: number; type?: string; message?: string };
      const status = errObj?.status || 400;
      console.error('[API Middleware Error]', {
        path: req.path,
        status,
        type: errObj?.type,
        message: errObj?.message,
      });
      res.status(status).json({
        code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
        error:
          status === 413
            ? 'Ukuran data yang dikirim terlalu besar (maksimal 1 MB).'
            : 'Format request JSON ke API tidak valid.',
      });
      return;
    }
    next(err);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: hasValidApiKey(),
      runtime: 'express',
    });
  });

  app.post('/api/ai/highlight', async (req, res) => {
    const result = await executeHighlightRequest(req.body as HighlightRequestBody);
    res.status(result.status).json(result.body);
  });

  app.post('/api/ai/script/jobs', (req, res) => {
    try {
      pruneOldScriptJobs();

      const body = (req.body || {}) as ScriptRequestInput;
      const safeSessionId = (body.clientSessionId || '').trim() || 'default-session';

      for (const existing of scriptJobs.values()) {
        if (existing.clientSessionId === safeSessionId && isJobActive(existing)) {
          res.status(200).json(serializeScriptJob(existing, true));
          return;
        }
      }

      const validated = validateScriptInput(body);
      if (!validated.ok) {
        res.status(validated.status).json(validated.body);
        return;
      }

      if (!hasValidApiKey()) {
        console.error('[AI Script] Missing GEMINI_API_KEY configuration.');
        res.status(500).json({
          code: 'MISSING_API_KEY',
          error: 'API key AI (GEMINI_API_KEY) belum terkonfigurasi di environment server.',
        });
        return;
      }

      const v = validated.data;
      const jobId = randomUUID();
      const job: ScriptJob = {
        jobId,
        clientSessionId: safeSessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'preparing',
        statusLabel: 'Menyiapkan script',
        isDemo: false,
        programName: v.trimmedProgram,
        programDuration: v.trimmedProgramDuration,
        theme: v.trimmedTheme || 'Siaran SIMFONI FM',
        requestedSegments: v.requestedSegments,
        segments: [],
        completedCount: 0,
        totalCount: v.requestedSegments.length,
        cancelled: false,
        abortController: new AbortController(),
      };

      scriptJobs.set(jobId, job);
      console.log('[AI Script] Job queued:', {
        jobId,
        programName: v.trimmedProgram,
        segmentCount: v.requestedSegments.length,
      });

      void runScriptJob(job, {
        cleanAnnouncers: v.cleanAnnouncers,
        trimmedProgram: v.trimmedProgram,
        trimmedProgramDuration: v.trimmedProgramDuration,
        trimmedTheme: v.trimmedTheme,
        trimmedUrl: v.trimmedUrl,
        trimmedManualText: v.trimmedManualText,
        safeClosingType: v.safeClosingType,
      });

      res.status(202).json(serializeScriptJob(job));
    } catch (error) {
      const classified = classifyGeminiError(error, 'AI Script');
      res.status(classified.httpStatus).json({
        code: classified.code,
        error: classified.message,
      });
    }
  });

  app.get('/api/ai/script/jobs/:jobId', (req, res) => {
    const job = scriptJobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({
        code: 'JOB_NOT_FOUND',
        error: 'Sesi penyusunan script tidak ditemukan atau sudah kedaluwarsa.',
      });
      return;
    }
    res.json(serializeScriptJob(job));
  });

  app.post('/api/ai/script/jobs/:jobId/cancel', (req, res) => {
    const job = scriptJobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({
        code: 'JOB_NOT_FOUND',
        error: 'Sesi penyusunan script tidak ditemukan.',
      });
      return;
    }
    if (isJobActive(job)) {
      job.cancelled = true;
      job.status = 'cancelled';
      job.statusLabel = 'Dibatalkan';
      job.segments = [];
      job.completedCount = 0;
      job.updatedAt = Date.now();
      job.abortController.abort();
    }
    res.json(serializeScriptJob(job));
  });

  app.post('/api/ai/script', async (req, res) => {
    const result = await executeScriptDirect((req.body || {}) as ScriptRequestInput);
    res.status(result.status).json(result.body);
  });

  // Catch any unknown /api/* path and always return JSON 404 (never fall through to SPA HTML!)
  app.use('/api', (req, res) => {
    res.status(404).json({
      code: 'API_NOT_FOUND',
      error: `Endpoint API ${req.method} ${req.originalUrl} tidak ditemukan.`,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CIMPO LOVERZ server listening on http://localhost:${PORT}`);
  });
}

createServer();
