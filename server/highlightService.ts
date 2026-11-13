import {
  GEMINI_MODEL,
  classifyGeminiError,
  getGenAI,
  inspectGeminiResponse,
  parseJsonSafely,
  withGeminiRetry,
} from './aiClient.ts';
import { HIGHLIGHT_KNOWLEDGE_CONTEXT } from './knowledgeBase.ts';

export interface HighlightDialogueTurn {
  speaker: string;
  text: string;
}

export interface HighlightRequestBody {
  newsUrl?: string;
  announcers?: string[];
  articleText?: string;
  newsUrl2?: string;
  articleText2?: string;
}

export interface HighlightServiceResult {
  status: number;
  body: Record<string, unknown>;
}

const OFFICIAL_HIGHLIGHT_CLOSER =
  'Itu tadi Simfoni Highlight buat kamu, saatnya kita move ke lalu lalang.';

export function isValidHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractArticleFromHtml(
  html: string,
  url: string
): {
  title: string;
  source: string;
  text: string;
} {
  const titleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  const siteMatch =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);

  const hostname = new URL(url).hostname.replace(/^www\./, '');
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';
  const source = siteMatch ? decodeHtmlEntities(siteMatch[1].trim()) : hostname;

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ');

  const paragraphs: string[] = [];
  const pRegex = /<(?:p|h1|h2|h3|li)\b[^>]*>([\s\S]*?)<\/(?:p|h1|h2|h3|li)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pRegex.exec(cleaned)) !== null) {
    const plain = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (plain.length >= 35) {
      paragraphs.push(plain);
    }
  }

  const text = paragraphs.join('\n\n').slice(0, 12000);
  return { title, source, text };
}

export async function tryFetchArticle(url: string): Promise<{
  ok: boolean;
  title: string;
  source: string;
  text: string;
  httpStatus?: number;
}> {
  const hostname = new URL(url).hostname.replace(/^www\./, '');
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      return { ok: false, title: '', source: hostname, text: '', httpStatus: response.status };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { ok: false, title: '', source: hostname, text: '', httpStatus: response.status };
    }

    const html = await response.text();
    const extracted = extractArticleFromHtml(html, url);
    if (extracted.text.length < 180) {
      return {
        ok: false,
        title: extracted.title,
        source: extracted.source,
        text: extracted.text,
        httpStatus: response.status,
      };
    }
    return { ok: true, httpStatus: response.status, ...extracted };
  } catch {
    return { ok: false, title: '', source: hostname, text: '' };
  }
}

function buildOfficialOpener(announcers: string[]): string {
  const joined =
    announcers.length >= 2
      ? `${announcers[0]} dan ${announcers[1]}`
      : announcers[0] || 'Crew SIMFONI';
  return `Selengkapnya hanya di Simfoni Highlight barengan ${joined}.`;
}

function enforceHighlightStyle(text: string): string {
  return text.replace(/\bsobat\s+siar\b/gi, 'Sobat Muda').trim();
}

export async function executeHighlightRequest(
  rawBody: HighlightRequestBody
): Promise<HighlightServiceResult> {
  try {
    const { newsUrl, announcers, articleText, newsUrl2, articleText2 } = rawBody || {};

    const cleanAnnouncers = (announcers || [])
      .map((a) => String(a || '').trim())
      .filter(Boolean)
      .slice(0, 2);

    if (cleanAnnouncers.length === 0) {
      return {
        status: 400,
        body: { code: 'VALIDATION_ERROR', error: 'Minimal 1 nama penyiar wajib diisi.' },
      };
    }

    const trimmedUrl = (newsUrl || '').trim();
    const trimmedManualText = (articleText || '').trim();
    const trimmedUrl2 = (newsUrl2 || '').trim();
    const trimmedManualText2 = (articleText2 || '').trim();

    if (!trimmedUrl && trimmedManualText.length < 40) {
      return {
        status: 400,
        body: {
          code: 'VALIDATION_ERROR',
          error: 'Link berita utama atau teks berita minimal 40 karakter wajib diisi.',
        },
      };
    }

    if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
      return {
        status: 400,
        body: {
          code: 'VALIDATION_ERROR',
          error: 'Format link berita 1 tidak valid. Gunakan URL diawali http:// atau https://.',
        },
      };
    }

    if (trimmedUrl2 && !isValidHttpUrl(trimmedUrl2)) {
      return {
        status: 400,
        body: {
          code: 'VALIDATION_ERROR',
          error: 'Format link berita 2 tidak valid. Gunakan URL diawali http:// atau https://.',
        },
      };
    }

    const hasSecondNews = Boolean(trimmedUrl2 || trimmedManualText2);
    console.log('[AI Highlight] Request started:', {
      announcerCount: cleanAnnouncers.length,
      hasUrl1: Boolean(trimmedUrl),
      hasManual1: Boolean(trimmedManualText),
      hasSecondNews,
    });

    const ai = getGenAI();
    const speaker1 = cleanAnnouncers[0].toUpperCase();
    const speaker2 = cleanAnnouncers[1]?.toUpperCase();
    const speakerInstruction = speaker2
      ? `Jika membacakan 2 penyiar, bagi teks berita secara ringkas dan mengalir antara "${speaker1}" dan "${speaker2}" (tanpa basa-basi tambahan di luar berita). Gunakan label speaker persis "${speaker1}" dan "${speaker2}".`
      : `Buat narasi highlight siap baca untuk penyiar "${speaker1}". Gunakan label speaker persis "${speaker1}".`;

    const officialOpener = buildOfficialOpener(cleanAnnouncers);

    const systemInstruction = `${HIGHLIGHT_KNOWLEDGE_CONTEXT}

INSTRUKSI EKSEKUSI SERVER:
1. FAKTUAL KETAT: DILARANG mengarang fakta, angka, nama, kutipan, tanggal, sumber berita, atau berita ke-2 jika hanya ada 1 sumber.
2. PENYIAR: ${speakerInstruction}
3. SAPAAN PENDENGAR: Gunakan "Sobat Muda" (JANGAN pakai "Sobat Siar").
4. WAJIB MENGIKUTI FORMAT PATEN SIMFONI HIGHLIGHT:
   - openerLine persis: "${officialOpener}"
   - closerLine persis: "${OFFICIAL_HIGHLIGHT_CLOSER}"
   - dialogue (Isi berita 1): ringkas setara 4-8 baris Word font 12 (±55-115 kata), dimulai menyapa "Sobat Muda", mencakup 5W+1H, bahasa Indonesia semiformal tidak baku yang enak didengar.
   - ${hasSecondNews ? 'Ada berita ke-2 dari pengguna: isi title2 (judul berita 2) dan dialogue2 (isi berita 2, tetap ringkas 4-8 baris).' : 'TIDAK ADA berita ke-2: kosongkan title2 ("") dan dialogue2 ([]). JANGAN mengarang berita ke-2.'}
   - JANGAN menambah pembuka, penutup, atau komentar ekstra di luar struktur JSON.`;

    let extractedSource1 = trimmedManualText;
    let fallbackTitle1 = '';
    let fallbackSource1 = '';

    if (!extractedSource1 && trimmedUrl) {
      const fetched1 = await tryFetchArticle(trimmedUrl);
      console.log('[AI Highlight] Direct fetch URL 1:', {
        ok: fetched1.ok,
        httpStatus: fetched1.httpStatus,
        textLength: fetched1.text.length,
      });
      if (fetched1.ok) {
        extractedSource1 = fetched1.text;
        fallbackTitle1 = fetched1.title;
        fallbackSource1 = fetched1.source;
      }
    }

    let extractedSource2 = trimmedManualText2;
    let fallbackTitle2 = '';
    let fallbackSource2 = '';

    if (hasSecondNews && !extractedSource2 && trimmedUrl2) {
      const fetched2 = await tryFetchArticle(trimmedUrl2);
      console.log('[AI Highlight] Direct fetch URL 2:', {
        ok: fetched2.ok,
        httpStatus: fetched2.httpStatus,
        textLength: fetched2.text.length,
      });
      if (fetched2.ok) {
        extractedSource2 = fetched2.text;
        fallbackTitle2 = fetched2.title;
        fallbackSource2 = fetched2.source;
      }
    }

    const normalizeDialogueArray = (
      rawDialogue: unknown,
      defaultSpeaker: string
    ): HighlightDialogueTurn[] => {
      if (typeof rawDialogue === 'string') {
        const clean = enforceHighlightStyle(rawDialogue);
        return clean ? [{ speaker: defaultSpeaker, text: clean }] : [];
      }
      if (!Array.isArray(rawDialogue)) return [];
      const turns: HighlightDialogueTurn[] = [];
      for (const item of rawDialogue) {
        if (typeof item === 'string') {
          const clean = enforceHighlightStyle(item);
          if (clean) turns.push({ speaker: defaultSpeaker, text: clean });
        } else if (item && typeof item === 'object') {
          const rec = item as { speaker?: unknown; text?: unknown };
          const text = enforceHighlightStyle(String(rec.text || ''));
          if (text) {
            const rawSp = String(rec.speaker || defaultSpeaker)
              .trim()
              .toUpperCase();
            const sp = rawSp === speaker1 || rawSp === speaker2 ? rawSp : defaultSpeaker;
            turns.push({ speaker: sp, text });
          }
        }
      }
      return turns;
    };

    if (extractedSource1 && (!hasSecondNews || extractedSource2)) {
      const jsonTemplate = `{
  "title": "Judul berita 1 akurat sesuai artikel",
  "source": "Nama media/sumber berita 1",
  "summary": "Ringkasan fakta inti 5W+1H 2 kalimat",
  "title2": ${hasSecondNews ? '"Judul berita 2 akurat sesuai artikel ke-2"' : '""'},
  "dialogue": [
    { "speaker": "${speaker1}", "text": "Sobat Muda, ... (narasi 4-8 baris 5W+1H semiformal non-baku)" }
  ],
  "dialogue2": ${hasSecondNews ? `[{ "speaker": "${speaker2 || speaker1}", "text": "... (narasi berita 2 sepanjang 4-8 baris 5W+1H)" }]` : '[]'}
}`;

      const userContent = [
        `BERITA 1 (WAJIB):`,
        `Link Referensi: ${trimmedUrl || '-'}`,
        `Judul Awal: ${fallbackTitle1 || '-'}`,
        `Sumber Awal: ${fallbackSource1 || '-'}`,
        `Isi Berita 1:\n${extractedSource1}`,
        hasSecondNews
          ? `\n---\nBERITA 2 (PENDAMPING):\nLink Referensi 2: ${trimmedUrl2 || '-'}\nJudul Awal 2: ${fallbackTitle2 || '-'}\nSumber Awal 2: ${fallbackSource2 || '-'}\nIsi Berita 2:\n${extractedSource2}`
          : '\n(TIDAK ADA BERITA KE-2. Set title2="" dan dialogue2=[].)',
        `\nBalas HANYA dengan 1 objek JSON valid mengikuti struktur persis berikut:\n${jsonTemplate}`,
      ].join('\n');

      const parsed = await withGeminiRetry(
        async (attempt) => {
          console.log('[AI Highlight] Calling Gemini generateContent (direct source), attempt:', attempt);
          const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: userContent,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              abortSignal: AbortSignal.timeout(50_000),
            },
          });

          const inspected = inspectGeminiResponse(response, 'AI Highlight');
          if (!inspected.text) {
            throw Object.assign(new Error('Empty response from Gemini Highlight'), {
              aiCode: 'EMPTY_RESPONSE',
            });
          }

          const decoded = parseJsonSafely<{
            title?: string;
            source?: string;
            summary?: string;
            title2?: string;
            dialogue?: unknown;
            dialogue2?: unknown;
          }>(inspected.text);

          const normalizedD1 = decoded
            ? normalizeDialogueArray(decoded.dialogue, speaker1)
            : [];

          if (!decoded || normalizedD1.length === 0) {
            console.error('[AI Highlight] JSON Parse failure:', {
              isTruncated: inspected.isTruncated,
              preview: inspected.text.slice(0, 200),
            });
            throw Object.assign(
              new Error(
                inspected.isTruncated
                  ? 'Highlight JSON truncated due to MAX_TOKENS'
                  : 'Malformed Highlight JSON'
              ),
              {
                aiCode: inspected.isTruncated ? 'TOKEN_LIMIT' : 'PARSE_ERROR',
              }
            );
          }

          return { decoded, normalizedD1 };
        },
        { featureLabel: 'AI Highlight', maxAttempts: 2, baseDelayMs: 1200 }
      );

      const d2 = hasSecondNews
        ? normalizeDialogueArray(parsed.decoded.dialogue2, speaker2 || speaker1)
        : [];

      console.log('[AI Highlight] Completed successfully (HTTP 200).');
      return {
        status: 200,
        body: {
          isDemo: false,
          title: (parsed.decoded.title || fallbackTitle1 || 'Berita Terkini').trim(),
          source:
            (parsed.decoded.source || fallbackSource1 || '').trim() ||
            (trimmedUrl ? new URL(trimmedUrl).hostname.replace(/^www\./, '') : 'Media Online'),
          summary: enforceHighlightStyle(parsed.decoded.summary || ''),
          title2:
            hasSecondNews && parsed.decoded.title2?.trim()
              ? parsed.decoded.title2.trim()
              : undefined,
          openerLine: officialOpener,
          closerLine: OFFICIAL_HIGHLIGHT_CLOSER,
          dialogue: parsed.normalizedD1,
          dialogue2: hasSecondNews && d2.length > 0 ? d2 : undefined,
          needsSecondSource: !hasSecondNews,
        },
      };
    }

    // Fallback: use Gemini urlContext when direct fetch could not read URL 1 or URL 2
    const urlPrompt = `Baca dan pahami isi berita dari URL/teks berikut:
- URL Berita 1: ${trimmedUrl || '(lihat teks manual di bawah)'}
${extractedSource1 ? `Teks Berita 1:\n${extractedSource1}\n` : ''}
${hasSecondNews ? `- URL Berita 2: ${trimmedUrl2 || '(lihat teks manual di bawah)'}\n${extractedSource2 ? `Teks Berita 2:\n${extractedSource2}\n` : ''}` : '(TIDAK ADA berita ke-2. Jangan membuat title2 atau dialogue2.)'}

Jika berita utama TIDAK DAPAT diakses, berbayar, diblokir, atau isinya tidak tersedia, balas PERSIS dengan JSON:
{"accessible": false}

Jika DAPAT diakses, balas HANYA dengan JSON valid sesuai struktur ini (tanpa teks tambahan di luar JSON):
{
  "accessible": true,
  "title": "judul berita 1 sesuai artikel",
  "source": "nama media/sumber berita",
  "summary": "ringkasan inti berita 2 kalimat faktual 5W+1H",
  "title2": "${hasSecondNews ? 'judul berita 2 sesuai artikel ke-2' : ''}",
  "dialogue": [
    { "speaker": "${speaker1}", "text": "Sobat Muda, ... (4-8 baris semiformal non-baku)" }
  ],
  "dialogue2": ${hasSecondNews ? `[{ "speaker": "${speaker2 || speaker1}", "text": "..." }]` : '[]'}
}`;

    const parsedUrlResult = await withGeminiRetry(
      async (attempt) => {
        console.log('[AI Highlight] Calling Gemini generateContent (urlContext fallback), attempt:', attempt);
        const urlContextResponse = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: urlPrompt,
          config: {
            systemInstruction,
            tools: [{ urlContext: {} }],
            abortSignal: AbortSignal.timeout(50_000),
          },
        });

        const inspected = inspectGeminiResponse(urlContextResponse, 'AI Highlight');
        if (!inspected.text) {
          throw Object.assign(new Error('Empty urlContext response'), {
            aiCode: 'EMPTY_RESPONSE',
          });
        }

        const parsed = parseJsonSafely<{
          accessible?: boolean;
          title?: string;
          source?: string;
          summary?: string;
          title2?: string;
          dialogue?: unknown;
          dialogue2?: unknown;
        }>(inspected.text);

        if (!parsed) {
          console.error('[AI Highlight] urlContext JSON parse failure:', {
            isTruncated: inspected.isTruncated,
            preview: inspected.text.slice(0, 200),
          });
          if (inspected.isTruncated) {
            throw Object.assign(new Error('urlContext response truncated'), {
              aiCode: 'TOKEN_LIMIT',
            });
          }
        }
        return parsed;
      },
      { featureLabel: 'AI Highlight', maxAttempts: 2, baseDelayMs: 1200 }
    );

    const urlDialogue1 = parsedUrlResult
      ? normalizeDialogueArray(parsedUrlResult.dialogue, speaker1)
      : [];

    if (!parsedUrlResult || parsedUrlResult.accessible === false || urlDialogue1.length === 0) {
      console.warn('[AI Highlight] URL unreachable (HTTP 422).');
      return {
        status: 422,
        body: {
          code: 'URL_UNREACHABLE',
          error:
            'Link berita tidak dapat diakses otomatis (kemungkinan diblokir, butuh login, atau halaman dinamis). Tempel isi beritanya secara manual di kolom bawah agar faktanya tetap akurat.',
        },
      };
    }

    const urlDialogue2 = hasSecondNews
      ? normalizeDialogueArray(parsedUrlResult.dialogue2, speaker2 || speaker1)
      : [];

    console.log('[AI Highlight] Completed successfully via urlContext (HTTP 200).');
    return {
      status: 200,
      body: {
        isDemo: false,
        title: (parsedUrlResult.title || 'Berita Terkini').trim(),
        source:
          (parsedUrlResult.source || '').trim() ||
          (trimmedUrl ? new URL(trimmedUrl).hostname.replace(/^www\./, '') : 'Media Online'),
        summary: enforceHighlightStyle(parsedUrlResult.summary || ''),
        title2:
          hasSecondNews && parsedUrlResult.title2?.trim()
            ? parsedUrlResult.title2.trim()
            : undefined,
        openerLine: officialOpener,
        closerLine: OFFICIAL_HIGHLIGHT_CLOSER,
        dialogue: urlDialogue1,
        dialogue2: hasSecondNews && urlDialogue2.length > 0 ? urlDialogue2 : undefined,
        needsSecondSource: !hasSecondNews,
      },
    };
  } catch (error) {
    const classified = classifyGeminiError(error, 'AI Highlight');
    return {
      status: classified.httpStatus,
      body: {
        code: classified.code,
        error: classified.message,
      },
    };
  }
}
