import { GoogleGenAI } from '@google/genai';
import {
  GEMINI_MODEL,
  classifyGeminiError,
  getGenAI,
  inspectGeminiResponse,
  withGeminiRetry,
} from './aiClient.ts';
import { isValidHttpUrl, tryFetchArticle } from './highlightService.ts';
import { SCRIPT_KNOWLEDGE_CONTEXT } from './knowledgeBase.ts';

export interface NormalizedSegmentInput {
  title: string;
  durationMinutes: number;
}

export interface DialogueTurn {
  speaker: string;
  text: string;
}

export interface ScriptSegmentBuilt {
  segmentTitle: string;
  durationMinutes: number;
  wordCount: number;
  estimatedDurationMinutes: number;
  dialogue: DialogueTurn[];
}

export interface ScriptRequestInput {
  announcers?: string[];
  programName?: string;
  programDuration?: string;
  segments?: Array<string | { title?: string; durationMinutes?: number }>;
  theme?: string;
  newsUrl?: string;
  articleText?: string;
  closingType?: 'segmen1' | 'segmen2';
  clientSessionId?: string;
}

export interface ValidatedScriptInput {
  cleanAnnouncers: string[];
  trimmedProgram: string;
  trimmedProgramDuration?: string;
  trimmedTheme: string;
  trimmedUrl: string;
  trimmedManualText: string;
  safeClosingType: 'segmen1' | 'segmen2';
  requestedSegments: NormalizedSegmentInput[];
  safeSessionId: string;
}

export function countDialogueWords(dialogue: DialogueTurn[]): number {
  return dialogue.reduce(
    (sum, line) => sum + line.text.trim().split(/\s+/).filter(Boolean).length,
    0
  );
}

export function estimateMinutesFromWords(wordCount: number): number {
  return Number((wordCount / 120).toFixed(1));
}

export function normalizeSegmentsInput(
  segmentsRaw?: Array<string | { title?: string; durationMinutes?: number }>
): NormalizedSegmentInput[] {
  const fallback: NormalizedSegmentInput[] = [
    { title: 'TOH (Opening)', durationMinutes: 2 },
    { title: 'Talk 1 — Bridging ke Tema', durationMinutes: 3 },
    { title: 'Talk 2 — Tema', durationMinutes: 3 },
    { title: 'Talk 3 — Tema dan Interaksi', durationMinutes: 2 },
    { title: 'Closing', durationMinutes: 1 },
  ];

  if (!Array.isArray(segmentsRaw) || segmentsRaw.length === 0) {
    return fallback;
  }

  const normalized: NormalizedSegmentInput[] = [];
  for (const item of segmentsRaw) {
    if (typeof item === 'string') {
      const title = item.trim();
      if (title) {
        normalized.push({ title, durationMinutes: 2 });
      }
    } else if (item && typeof item === 'object') {
      const title = (item.title || '').trim();
      if (title) {
        const rawMin = Number(item.durationMinutes);
        const durationMinutes = Number.isFinite(rawMin)
          ? Math.min(15, Math.max(1, Math.round(rawMin)))
          : 2;
        normalized.push({ title, durationMinutes });
      }
    }
  }

  return normalized.length > 0 ? normalized : fallback;
}

export function enforceScriptStyle(text: string): string {
  const parts = text.split(/("[^"]*")/g);
  return parts
    .map((part, idx) => {
      const withKita =
        idx % 2 === 1
          ? part
          : part.replace(/\bkami\b/gi, (matched) => {
              if (matched === 'KAMI') return 'KITA';
              if (matched[0] === 'K') return 'Kita';
              return 'kita';
            });
      return withKita.replace(/\bsobat\s+siar\b/gi, 'Sobat Muda');
    })
    .join('');
}

export function validateScriptInput(
  body: ScriptRequestInput
): { ok: true; data: ValidatedScriptInput } | { ok: false; status: number; body: Record<string, unknown> } {
  const cleanAnnouncers = (body.announcers || [])
    .map((a) => String(a || '').trim())
    .filter(Boolean)
    .slice(0, 2);

  if (cleanAnnouncers.length === 0) {
    return {
      ok: false,
      status: 400,
      body: { code: 'VALIDATION_ERROR', error: 'Minimal 1 nama penyiar wajib diisi.' },
    };
  }

  const requestedSegments = normalizeSegmentsInput(body.segments);
  const trimmedTheme = (body.theme || '').trim();
  const trimmedProgram = (body.programName || '').trim() || 'Program SIMFONI FM';
  const trimmedProgramDuration = (body.programDuration || '').trim() || undefined;
  const trimmedUrl = (body.newsUrl || '').trim();
  const trimmedManualText = (body.articleText || '').trim();
  const safeClosingType: 'segmen1' | 'segmen2' =
    body.closingType === 'segmen1' ? 'segmen1' : 'segmen2';
  const safeSessionId = (body.clientSessionId || '').trim() || 'default-session';

  if (!trimmedTheme && !trimmedUrl && !trimmedManualText && !body.programName?.trim()) {
    return {
      ok: false,
      status: 400,
      body: {
        code: 'VALIDATION_ERROR',
        error: 'Isi minimal nama program, tema siaran, atau link berita referensi.',
      },
    };
  }

  if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
    return {
      ok: false,
      status: 400,
      body: {
        code: 'VALIDATION_ERROR',
        error: 'Format link berita tidak valid. Gunakan URL diawali http:// atau https://.',
      },
    };
  }

  return {
    ok: true,
    data: {
      cleanAnnouncers,
      trimmedProgram,
      trimmedProgramDuration,
      trimmedTheme,
      trimmedUrl,
      trimmedManualText,
      safeClosingType,
      requestedSegments,
      safeSessionId,
    },
  };
}

export function parseStreamedTalkBlocks(
  rawText: string,
  requestedSegments: NormalizedSegmentInput[],
  allowedSpeakers: string[],
  isFinalPass: boolean
): { segments: ScriptSegmentBuilt[]; completedCount: number } {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const blocks: { headerTitle: string; closed: boolean; dialogue: DialogueTurn[] }[] = [];
  let current: { headerTitle: string; closed: boolean; dialogue: DialogueTurn[] } | null = null;

  const headerRegex = /^={2,}\s*TALK(?:\s+\d+)?(?:\s*[:\-—|]\s*(.*?))?\s*={2,}\s*$/i;
  const endRegex = /^={2,}\s*END(?:\s+TALK)?\s*={2,}\s*$/i;
  const speakerLineRegex =
    /^(?:\*\*|__)?([A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ._-]{0,28}?)(?:\*\*|__)?\s*:\s*(.+)$/;

  const normalizeSpeaker = (rawSpeaker: string): string | null => {
    const cleaned = rawSpeaker.replace(/[*_`]/g, '').trim();
    const upper = cleaned.toUpperCase();
    if (!cleaned) return null;
    const matched = allowedSpeakers.find(
      (sp) => sp.toUpperCase() === upper || upper.startsWith(`${sp.toUpperCase()} `)
    );
    if (matched) return matched;
    if (cleaned === upper && cleaned.length <= 24) {
      return cleaned;
    }
    return null;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(headerRegex);
    if (headerMatch) {
      if (current) {
        current.closed = true;
      }
      current = {
        headerTitle: (headerMatch[1] || '').trim(),
        closed: false,
        dialogue: [],
      };
      blocks.push(current);
      continue;
    }

    if (endRegex.test(trimmed)) {
      if (current) {
        current.closed = true;
      }
      continue;
    }

    if (!current) continue;

    const spMatch = trimmed.match(speakerLineRegex);
    if (spMatch) {
      const matchedSpeaker = normalizeSpeaker(spMatch[1]);
      if (matchedSpeaker) {
        const spokenText = enforceScriptStyle(spMatch[2].trim());
        if (spokenText) {
          current.dialogue.push({
            speaker: matchedSpeaker,
            text: spokenText,
          });
        }
        continue;
      }
    }

    if (current.dialogue.length > 0 && !trimmed.startsWith('===')) {
      const prev = current.dialogue[current.dialogue.length - 1];
      prev.text = enforceScriptStyle(`${prev.text} ${trimmed}`.trim());
    }
  }

  const segments: ScriptSegmentBuilt[] = [];
  let completedCount = 0;

  blocks.forEach((blk, idx) => {
    const reqSeg = requestedSegments[idx];
    if (!reqSeg && idx >= requestedSegments.length) return;
    if (blk.dialogue.length === 0) return;
    const segmentTitle = reqSeg?.title || blk.headerTitle || `Talk ${idx + 1}`;
    const durationMinutes = reqSeg?.durationMinutes ?? 2;
    const wordCount = countDialogueWords(blk.dialogue);
    segments.push({
      segmentTitle,
      durationMinutes,
      wordCount,
      estimatedDurationMinutes: estimateMinutesFromWords(wordCount),
      dialogue: blk.dialogue,
    });
    if (blk.closed || isFinalPass) {
      completedCount += 1;
    }
  });

  return { segments, completedCount };
}

export function buildScriptPrompts(params: {
  cleanAnnouncers: string[];
  trimmedProgram: string;
  trimmedProgramDuration?: string;
  trimmedTheme: string;
  requestedSegments: NormalizedSegmentInput[];
  safeClosingType: 'segmen1' | 'segmen2';
  newsReferenceText?: string;
}) {
  const {
    cleanAnnouncers,
    trimmedProgram,
    trimmedProgramDuration,
    trimmedTheme,
    requestedSegments,
    safeClosingType,
    newsReferenceText,
  } = params;

  const speaker1 = cleanAnnouncers[0].toUpperCase();
  const speaker2 = cleanAnnouncers[1]?.toUpperCase();
  const isFreeline = trimmedProgram.toLowerCase().includes('freeline');

  const dialogueGuide = speaker2
    ? `Gunakan DUA penyiar (Tandem): "${speaker1}" dan "${speaker2}". Kedua penyiar harus saling menanggapi secara spontan seperti sahabat di studio, pembagian bicara RATA, setiap giliran singkat (1-3 kalimat per giliran, dilarang monolog panjang), dan interaksi 3 arah melibatkan "Sobat Muda". Gunakan nama speaker PERSIS "${speaker1}" dan "${speaker2}".`
    : `Gunakan SATU penyiar: "${speaker1}"${isFreeline ? ' (sesuai pengecualian program Freeline yang memang 1 penyiar)' : ''}. Buat naskah hangat, mengalir, dan interaktif bersama "Sobat Muda". Gunakan nama speaker PERSIS "${speaker1}".`;

  const closingRuleInstruction =
    safeClosingType === 'segmen1'
      ? `CLOSING SEGMEN 1: Bagian penutup (Closing) berisi rangkuman singkat, pesan penutup, dan terima kasih kepada Sobat Muda, lalu jembatan ke lagu/segmen berikutnya (TIDAK PERLU salam pamit akhir).`
      : `CLOSING SEGMEN 2 / AKHIR: Bagian penutup (Closing) berisi rangkuman singkat, pesan penutup, dan ucapan terima kasih kepada Sobat Muda, lalu ditutup dengan format wajib berikut:\n${speaker1}: [Ucapan pamit untuk Sobat Muda]\n${speaker2 ? `${speaker2}: [Ucapan pamit untuk Sobat Muda]\n` : ''}(Baris terakhir penutup wajib diakhiri salam resmi: "Wassalamualaikum warahmatullahi wabarakatuh, salam peace dan kreasi.")`;

  const segmentPlanLines = requestedSegments
    .map((seg, i) => {
      const minWords = seg.durationMinutes * 110;
      const maxWords = seg.durationMinutes * 130;
      const minTurns = Math.max(5, Math.round(seg.durationMinutes * 5));
      const maxTurns = Math.max(7, Math.round(seg.durationMinutes * 7));
      const roleNote =
        i === 0
          ? ' [OPENING: Wajib diawali salam misalnya "Assalamualaikum warahmatullahi wabarakatuh", sapa "Sobat Muda", kenalkan penyiar, nama program, tema' +
            (trimmedProgramDuration ? `, durasi program "${trimmedProgramDuration}"` : '') +
            ', tagline "107,7 SIMFONI FM The Power Hits Station, dengerin lagu enak pilihanmu.", lalu pengantar tema]'
          : i === requestedSegments.length - 1 || seg.title.toLowerCase().includes('closing')
            ? ' [CLOSING: Rangkuman singkat, pesan penutup, terima kasih ke Sobat Muda, dan salam penutup sesuai jenis segmen]'
            : ' [ISI: Kembangkan tema secara mendalam—pendapat tiap penyiar, tanggapan ke rekan, pertanyaan ringan, contoh keseharian dekat dengan Sobat Muda, dan transisi natural; hindari pengulangan ide]';

      return `${i + 1}. "${seg.title}" — WAJIB ${seg.durationMinutes} menit (${minWords}–${maxWords} kata total dalam talk ini, sekitar ${minTurns}–${maxTurns} giliran dialog singkat).${roleNote}`;
    })
    .join('\n');

  const systemInstruction = `${SCRIPT_KNOWLEDGE_CONTEXT}

INSTRUKSI EKSEKUSI SERVER:
- ${dialogueGuide}
- ${closingRuleInstruction}
- PANGGILAN PENDENGAR WAJIB: Selalu gunakan "Sobat Muda". JANGAN PERNAH memakai kata "Sobat Siar" di script ini.
- PRONOUN WAJIB: Gunakan "kita" (JANGAN PERNAH memakai kata "kami") saat menyebut penyiar bersama-sama atau pihak SIMFONI FM. Gunakan "aku"/"kamu" (DILARANG "lo"/"gue").
- DURASI & KEDALAMAN WAJIB: Hitung jumlah kata per talk (110–130 kata per menit). Jangan pernah menulis talk yang jauh lebih pendek dari targetnya, tapi tetap jaga tiap giliran bicara pendek (1–3 kalimat) dan bermakna tanpa basa-basi berulang.
- Jika ada referensi berita, jaga fakta tetap akurat tanpa mengarang angka atau kutipan.`;

  const exampleBlock = requestedSegments
    .slice(0, 2)
    .map((seg, idx) => {
      const lines = speaker2
        ? [
            `${speaker1}: ${idx === 0 ? 'Assalamualaikum warahmatullahi wabarakatuh, Sobat Muda! 107,7 SIMFONI FM The Power Hits Station, dengerin lagu enak pilihanmu...' : 'Pembahasan mendalam sesuai tema...'}`,
            `${speaker2}: Tanggapan langsung dan contoh nyata ${speaker2}...`,
          ]
        : [
            `${speaker1}: ${idx === 0 ? 'Assalamualaikum warahmatullahi wabarakatuh, Sobat Muda! 107,7 SIMFONI FM The Power Hits Station, dengerin lagu enak pilihanmu...' : 'Bahasan hangat untuk Sobat Muda...'}`,
          ];
      return `===TALK ${idx + 1}: ${seg.title}===\n${lines.join('\n')}\n===END TALK===`;
    })
    .join('\n\n');

  const userPrompt = `Susun naskah siaran radio lengkap untuk:
- Nama Program: ${trimmedProgram}
${trimmedProgramDuration ? `- Informasi Durasi Program: ${trimmedProgramDuration}` : ''}
- Tema Siaran: ${trimmedTheme || '(sesuaikan dengan referensi berita dan karakter program)'}
- Jenis Penutup: ${safeClosingType === 'segmen1' ? 'Closing Segmen 1 (Tanpa Salam Pamit Akhir)' : 'Closing Segmen 2 / Akhir (Pakai Salam Resmi)'}
- Daftar Talk & Target Durasi WAJIB (${requestedSegments.length} talk berurutan):
${segmentPlanLines}
${newsReferenceText ? `\nReferensi Berita:\n${newsReferenceText}` : ''}

ATURAN FORMAT OUTPUT (WAJIB PERSIS TANPA JSON, TANPA MARKDOWN CODE FENCE, TANPA PENJELASAN TAMBAHAN):
- Tulis tepat ${requestedSegments.length} blok talk berurutan menggunakan pembatas persis:
  ===TALK <nomor>: <Nama Talk>===
  ${speaker1}: <kalimat dialog>
  ${speaker2 ? `${speaker2}: <kalimat dialog>\n  ...` : '...'}
  ===END TALK===
- Setiap baris dialog HARUS diawali nama speaker persis (${speaker2 ? `${speaker1}: atau ${speaker2}:` : `${speaker1}:`}).
- Pastikan SETIAP talk benar-benar memenuhi rentang kata target durasinya (110–130 kata per menit) dengan giliran dialog singkat (1–3 kalimat per baris), pembahasan berkembang, contoh nyata, dan saling menanggapi antarpenyiar.
- WAJIB pakai sapaan "Sobat Muda" (jangan "Sobat Siar") dan kata "kita" (jangan "kami").

Contoh format awal:
${exampleBlock}`;

  return {
    systemInstruction,
    userPrompt,
    allowedSpeakers: speaker2 ? [speaker1, speaker2] : [speaker1],
  };
}

export async function expandShortSegments(params: {
  ai: GoogleGenAI;
  shortSegments: Array<{ index: number; segment: ScriptSegmentBuilt }>;
  systemInstruction: string;
  allowedSpeakers: string[];
  trimmedProgram: string;
  trimmedTheme: string;
  abortSignal: AbortSignal;
}): Promise<Map<number, ScriptSegmentBuilt>> {
  const {
    ai,
    shortSegments,
    systemInstruction,
    allowedSpeakers,
    trimmedProgram,
    trimmedTheme,
    abortSignal,
  } = params;

  const targetListText = shortSegments
    .map(({ index, segment }) => {
      const minW = segment.durationMinutes * 115;
      const maxW = segment.durationMinutes * 130;
      const existingDialogue = segment.dialogue
        .map((d) => `${d.speaker}: ${d.text}`)
        .join('\n');
      return `TALK ${index + 1}: "${segment.segmentTitle}"
- Panjang saat ini: ${segment.wordCount} kata (TERLALU PENDEK untuk target ${segment.durationMinutes} menit)
- Target BARU WAJIB: ${minW}–${maxW} kata total (${Math.max(6, segment.durationMinutes * 6)} giliran bicara singkat)
- Draft awal:\n${existingDialogue}`;
    })
    .join('\n\n---\n\n');

  const expandPrompt = `Perbaiki dan kembangkan talk berikut untuk program "${trimmedProgram}" (Tema: ${trimmedTheme}) karena jumlah katanya masih jauh di bawah target durasi.

${targetListText}

INSTRUKSI PENGEMBANGAN:
- Tulis ulang HANYA talk yang tercantum di atas dengan urutan nomor yang sama menggunakan format pembatas persis:
  ===TALK <nomor>: <Nama Talk>===
  ...
  ===END TALK===
- Kembangkan pembahasan agar lebih berisi dengan sudut pandang baru, tanggapan langsung antarpenyiar, pertanyaan ringan, atau contoh kejadian sehari-hari yang dekat dengan "Sobat Muda".
- JANGAN mengulang gagasan yang sama dan JANGAN membuat monolog panjang (tetap 1–3 kalimat per giliran bicara).
- WAJIB memakai "Sobat Muda" (bukan "Sobat Siar") dan "kita" (bukan "kami").
- Pastikan total kata setiap talk memenuhi rentang target barunya (${shortSegments.map((s) => `TALK ${s.index + 1}: ${s.segment.durationMinutes * 115}–${s.segment.durationMinutes * 130} kata`).join(', ')}).`;

  const response = await withGeminiRetry(
    () =>
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: expandPrompt,
        config: {
          systemInstruction,
          abortSignal,
        },
      }),
    { featureLabel: 'AI Script', maxAttempts: 2, baseDelayMs: 1200, externalSignal: abortSignal }
  );

  const inspected = inspectGeminiResponse(response, 'AI Script');
  const expandedText = inspected.text;
  const lines = expandedText.replace(/\r\n/g, '\n').split('\n');
  const results = new Map<number, ScriptSegmentBuilt>();

  const headerRegex = /^={2,}\s*TALK(?:\s+(\d+))?(?:\s*[:\-—|]\s*(.*?))?\s*={2,}\s*$/i;
  const endRegex = /^={2,}\s*END(?:\s+TALK)?\s*={2,}\s*$/i;
  const speakerLineRegex =
    /^(?:\*\*|__)?([A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ._-]{0,28}?)(?:\*\*|__)?\s*:\s*(.+)$/;

  let activeIdx: number | null = null;
  let activeDialogue: DialogueTurn[] = [];
  let fallbackCursor = 0;

  const flush = () => {
    if (activeIdx === null || activeDialogue.length === 0) return;
    const orig = shortSegments.find((s) => s.index === activeIdx);
    if (!orig) return;
    const wordCount = countDialogueWords(activeDialogue);
    results.set(activeIdx, {
      segmentTitle: orig.segment.segmentTitle,
      durationMinutes: orig.segment.durationMinutes,
      wordCount,
      estimatedDurationMinutes: estimateMinutesFromWords(wordCount),
      dialogue: activeDialogue,
    });
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const hMatch = trimmed.match(headerRegex);
    if (hMatch) {
      flush();
      const explicitNum = hMatch[1] ? Number(hMatch[1]) - 1 : null;
      if (explicitNum !== null && shortSegments.some((s) => s.index === explicitNum)) {
        activeIdx = explicitNum;
      } else if (fallbackCursor < shortSegments.length) {
        activeIdx = shortSegments[fallbackCursor].index;
        fallbackCursor += 1;
      } else {
        activeIdx = null;
      }
      activeDialogue = [];
      continue;
    }

    if (endRegex.test(trimmed)) {
      flush();
      activeIdx = null;
      activeDialogue = [];
      continue;
    }

    if (activeIdx === null) continue;
    const spMatch = trimmed.match(speakerLineRegex);
    if (spMatch) {
      const cleanedSp = spMatch[1].replace(/[*_`]/g, '').trim().toUpperCase();
      const matchedSpeaker =
        allowedSpeakers.find(
          (sp) => sp.toUpperCase() === cleanedSp || cleanedSp.startsWith(`${sp.toUpperCase()} `)
        ) || (cleanedSp.length <= 24 ? cleanedSp : null);
      if (matchedSpeaker) {
        const text = enforceScriptStyle(spMatch[2].trim());
        if (text) {
          activeDialogue.push({ speaker: matchedSpeaker, text });
        }
        continue;
      }
    }
    if (activeDialogue.length > 0 && !trimmed.startsWith('===')) {
      const prev = activeDialogue[activeDialogue.length - 1];
      prev.text = enforceScriptStyle(`${prev.text} ${trimmed}`.trim());
    }
  }
  flush();

  return results;
}

/**
 * Synchronous single-request Script generator used by stateless serverless endpoints (e.g. Vercel)
 * and /api/ai/script direct fallback.
 */
export async function executeScriptDirect(
  rawBody: ScriptRequestInput
): Promise<{ status: number; body: Record<string, unknown> }> {
  const validated = validateScriptInput(rawBody || {});
  if (!validated.ok) {
    return { status: validated.status, body: validated.body };
  }

  const v = validated.data;
  console.log('[AI Script][Direct] Request started:', {
    programName: v.trimmedProgram,
    segmentCount: v.requestedSegments.length,
    announcerCount: v.cleanAnnouncers.length,
  });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 55_000);

  try {
    let newsReferenceText = v.trimmedManualText;
    let urlWarning: string | undefined;

    if (!newsReferenceText && v.trimmedUrl) {
      const fetched = await tryFetchArticle(v.trimmedUrl);
      if (fetched.ok) {
        newsReferenceText = `Judul: ${fetched.title}\nSumber: ${fetched.source}\nIsi:\n${fetched.text}`;
      } else if (!v.trimmedTheme) {
        return {
          status: 422,
          body: {
            code: 'URL_UNREACHABLE',
            error:
              'Link berita referensi tidak dapat diakses otomatis. Tempel isi berita secara manual atau isi tema siaran.',
          },
        };
      } else {
        urlWarning =
          'Link berita tidak dapat diakses otomatis, naskah disusun berdasarkan tema siaran yang kamu masukkan.';
      }
    }

    const { systemInstruction, userPrompt, allowedSpeakers } = buildScriptPrompts({
      cleanAnnouncers: v.cleanAnnouncers,
      trimmedProgram: v.trimmedProgram,
      trimmedProgramDuration: v.trimmedProgramDuration,
      trimmedTheme: v.trimmedTheme,
      requestedSegments: v.requestedSegments,
      safeClosingType: v.safeClosingType,
      newsReferenceText,
    });

    const ai = getGenAI();
    const response = await withGeminiRetry(
      async (attempt) => {
        console.log('[AI Script][Direct] Calling Gemini generateContent, attempt:', attempt);
        const res = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: userPrompt,
          config: {
            systemInstruction,
            abortSignal: controller.signal,
          },
        });
        const inspected = inspectGeminiResponse(res, 'AI Script');
        if (!inspected.text) {
          throw Object.assign(new Error('Empty response from Gemini Script'), {
            aiCode: 'EMPTY_RESPONSE',
          });
        }
        return inspected;
      },
      { featureLabel: 'AI Script', maxAttempts: 2, baseDelayMs: 1200, externalSignal: controller.signal }
    );

    const finalized = parseStreamedTalkBlocks(
      response.text,
      v.requestedSegments,
      allowedSpeakers,
      true
    );

    if (finalized.segments.length === 0) {
      throw Object.assign(
        new Error(
          response.isTruncated
            ? 'Script response truncated before first talk finished'
            : 'Talk block markers missing in AI Script output'
        ),
        { aiCode: response.isTruncated ? 'TOKEN_LIMIT' : 'PARSE_ERROR' }
      );
    }

    let finalSegments = finalized.segments;
    const underLength = finalSegments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => segment.wordCount < segment.durationMinutes * 100);

    if (underLength.length > 0) {
      try {
        const expandedMap = await expandShortSegments({
          ai,
          shortSegments: underLength,
          systemInstruction,
          allowedSpeakers,
          trimmedProgram: v.trimmedProgram,
          trimmedTheme: v.trimmedTheme || 'Siaran SIMFONI FM',
          abortSignal: controller.signal,
        });
        finalSegments = finalSegments.map((seg, idx) => {
          const expanded = expandedMap.get(idx);
          return expanded && expanded.wordCount > seg.wordCount ? expanded : seg;
        });
      } catch (expandErr) {
        console.warn('[AI Script][Direct] Expansion pass skipped:', expandErr);
      }
    }

    console.log('[AI Script][Direct] Completed successfully (HTTP 200).', {
      segmentsCount: finalSegments.length,
    });

    return {
      status: 200,
      body: {
        jobId: `sync-${Date.now()}`,
        status: 'completed',
        statusLabel: 'Berhasil',
        isDemo: false,
        programName: v.trimmedProgram,
        programDuration: v.trimmedProgramDuration,
        theme: v.trimmedTheme || 'Siaran SIMFONI FM',
        segments: finalSegments,
        completedCount: finalSegments.length,
        totalCount: v.requestedSegments.length,
        urlWarning,
      },
    };
  } catch (error) {
    const classified = classifyGeminiError(error, 'AI Script');
    return {
      status: classified.httpStatus,
      body: {
        code: classified.code,
        error: classified.message,
      },
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
