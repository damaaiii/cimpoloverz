import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import {
  GEMINI_MODEL,
  classifyGeminiError,
  getGenAI,
  hasValidApiKey,
  withGeminiRetry,
} from './server/aiClient.ts';
import {
  HIGHLIGHT_KNOWLEDGE_CONTEXT,
  SCRIPT_KNOWLEDGE_CONTEXT,
} from './server/knowledgeBase.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function isValidHttpUrl(rawUrl: string): boolean {
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

async function tryFetchArticle(url: string): Promise<{
  ok: boolean;
  title: string;
  source: string;
  text: string;
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
      return { ok: false, title: '', source: hostname, text: '' };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { ok: false, title: '', source: hostname, text: '' };
    }

    const html = await response.text();
    const extracted = extractArticleFromHtml(html, url);
    if (extracted.text.length < 180) {
      return {
        ok: false,
        title: extracted.title,
        source: extracted.source,
        text: extracted.text,
      };
    }
    return { ok: true, ...extracted };
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

const OFFICIAL_HIGHLIGHT_CLOSER =
  'Itu tadi Simfoni Highlight buat kamu, saatnya kita move ke lalu lalang.';

function enforceHighlightStyle(text: string): string {
  return text.replace(/\bsobat\s+siar\b/gi, 'Sobat Muda').trim();
}

function buildDemoHighlight(
  newsUrl: string,
  announcers: string[],
  articleText?: string,
  newsUrl2?: string,
  articleText2?: string
) {
  const p1 = (announcers[0] || 'PENYIAR 1').trim().toUpperCase();
  const p2 = announcers[1]?.trim().toUpperCase();
  let sourceHost = 'Sumber Berita Online';
  try {
    if (newsUrl && isValidHttpUrl(newsUrl)) {
      sourceHost = new URL(newsUrl).hostname.replace(/^www\./, '');
    }
  } catch {
    // ignore
  }

  const snippet = articleText?.trim()
    ? articleText.trim().slice(0, 140) + (articleText.trim().length > 140 ? '...' : '')
    : `Konten contoh Mode Demo untuk tautan ${newsUrl || 'berita utama'} dengan format resmi 5W+1H sepanjang 4-8 baris.`;

  const openerLine = buildOfficialOpener(announcers);

  const dialogue = p2
    ? [
        {
          speaker: p1,
          text: `Sobat Muda, ada kabar terbaru yang lagi ramai dibahas di ${sourceHost}. Saat GEMINI_API_KEY aktif, di bagian ini bakal tersaji inti berita unsur 5W+1H dalam gaya semiformal santai sepanjang 4 sampai 8 baris sesuai artikel asli.`,
        },
        {
          speaker: p2,
          text: `Betul banget, ${p1}. Semua fakta, nama tokoh, waktu, lokasi, dan konteksnya langsung diambil dari sumber berita tanpa mengarang informasi tambahan buat Sobat Muda.`,
        },
      ]
    : [
        {
          speaker: p1,
          text: `Sobat Muda, di Simfoni Highlight kali ini ada rangkuman kabar terbaru dari ${sourceHost}. Bagian ini mengikuti aturan resmi Highlight sepanjang 4 sampai 8 baris dengan unsur 5W+1H lengkap dan bahasa semiformal non-baku yang enak dibacakan saat on-air.`,
        },
      ];

  const hasSecond = Boolean(newsUrl2?.trim() || articleText2?.trim());
  const dialogue2 = hasSecond
    ? [
        {
          speaker: p2 || p1,
          text: `Masih di Simfoni Highlight, kabar kedua dari sumber pendamping juga dirangkum padat 4 sampai 8 baris sesuai pedoman resmi 5W+1H supaya Sobat Muda langsung dapat intinya sebelum masuk lalu lalang.`,
        },
      ]
    : undefined;

  return {
    isDemo: true,
    title: `[DEMO] Highlight Berita dari ${sourceHost}`,
    source: sourceHost,
    summary: snippet,
    title2: hasSecond ? '[DEMO] Judul Berita Kedua (Teaser Highlight)' : undefined,
    openerLine,
    closerLine: OFFICIAL_HIGHLIGHT_CLOSER,
    dialogue,
    dialogue2,
    needsSecondSource: !hasSecond,
  };
}

interface NormalizedSegmentInput {
  title: string;
  durationMinutes: number;
}

interface DialogueTurn {
  speaker: string;
  text: string;
}

interface ScriptSegmentBuilt {
  segmentTitle: string;
  durationMinutes: number;
  wordCount: number;
  estimatedDurationMinutes: number;
  dialogue: DialogueTurn[];
}

function countDialogueWords(dialogue: DialogueTurn[]): number {
  return dialogue.reduce(
    (sum, line) => sum + line.text.trim().split(/\s+/).filter(Boolean).length,
    0
  );
}

function estimateMinutesFromWords(wordCount: number): number {
  // Midpoint of 110–130 wpm radio speech rate = 120 wpm
  return Number((wordCount / 120).toFixed(1));
}

function normalizeSegmentsInput(
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

function enforceScriptStyle(text: string): string {
  // 1. Replace standalone "kami" outside double-quoted spans with "kita"/"Kita"
  // 2. Enforce "Sobat Muda" instead of "Sobat Siar" inside AI Script
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

function buildDemoScript(
  announcers: string[],
  programName: string,
  segmentsInput: Array<string | { title?: string; durationMinutes?: number }>,
  theme: string,
  closingType: 'segmen1' | 'segmen2' = 'segmen2',
  programDuration?: string
) {
  const p1 = (announcers[0] || 'PENYIAR 1').trim().toUpperCase();
  const p2 = announcers[1]?.trim().toUpperCase();
  const safeProgram = programName.trim() || 'Program SIMFONI FM';
  const safeTheme = theme.trim() || 'Topik Harian Mahasiswa';
  const safeProgDuration = (programDuration || '').trim();
  const durationClause = safeProgDuration
    ? ` selama ${safeProgDuration} ke depan`
    : '';
  const safeSegments = normalizeSegmentsInput(segmentsInput);

  const builtSegments: ScriptSegmentBuilt[] = safeSegments.map((segItem, idx) => {
    const segName = segItem.title;
    const durationMinutes = segItem.durationMinutes;
    const lower = segName.toLowerCase();
    const isToh = idx === 0 || lower.includes('toh') || lower.includes('opening');
    const isClosing = idx === safeSegments.length - 1 || lower.includes('closing');

    const turns: DialogueTurn[] = [];
    const targetWordCount = durationMinutes * 120;

    if (isToh) {
      if (p2) {
        turns.push(
          {
            speaker: p1,
            text: `Assalamualaikum warahmatullahi wabarakatuh, Sobat Muda! 107,7 SIMFONI FM The Power Hits Station, dengerin lagu enak pilihanmu. Aku ${p1} siap nemenin kamu di ${safeProgram}${durationClause}.`,
          },
          {
            speaker: p2,
            text: `Waalaikumsalam, dan aku ${p2}! Gimana nih kabar kamu hari ini, Sobat Muda? Semoga kuliah, kerjaan, atau aktivitas kamu tetep lancar ya.`,
          },
          {
            speaker: p1,
            text: `Di edisi ${safeProgram} kali ini, kita bakal ngobrolin tema yang deket banget sama keseharian anak muda, yaitu soal ${safeTheme}.`,
          },
          {
            speaker: p2,
            text: `Seru banget sih topiknya! Kita pengin suasana siaran hari ini berasa kayak nongkrong bareng sahabat di studio sambil dengerin lagu favorit. (Mode Demo aktif karena GEMINI_API_KEY belum terpasang).`,
          }
        );
      } else {
        turns.push(
          {
            speaker: p1,
            text: `Assalamualaikum warahmatullahi wabarakatuh, Sobat Muda! 107,7 SIMFONI FM The Power Hits Station, dengerin lagu enak pilihanmu.`,
          },
          {
            speaker: p1,
            text: `Aku ${p1} bakal nemenin kamu di ${safeProgram}${durationClause} buat bahas seru soal ${safeTheme}. Jangan ke mana-mana ya, Sobat Muda! (Mode Demo aktif).`,
          }
        );
      }
    } else if (isClosing) {
      if (closingType === 'segmen1') {
        if (p2) {
          turns.push(
            {
              speaker: p1,
              text: `Nggak kerasa banget obrolan kita tentang ${safeTheme} di ${safeProgram} udah masuk penghujung segmen 1 nih, Sobat Muda.`,
            },
            {
              speaker: p2,
              text: `Makasih banget ya udah nemenin kita di segmen pertama ${safeProgram}. Tetep stay tune, kita bakal balik lagi di segmen 2 habis lagu pilihan berikut!`,
            }
          );
        } else {
          turns.push({
            speaker: p1,
            text: `Makasih banget ya Sobat Muda udah nemenin kita di segmen pertama ${safeProgram}. Tetep stay tune, kita balik lagi habis lagu berikut!`,
          });
        }
      } else if (p2) {
        turns.push(
          {
            speaker: p1,
            text: `Nggak kerasa banget obrolan kita tentang ${safeTheme} di ${safeProgram} udah sampai penghujung acara, Sobat Muda. Makasih banyak udah setia dengerin, aku ${p1} pamit.`,
          },
          {
            speaker: p2,
            text: `Aku ${p2} juga pamit ya, Sobat Muda, sampai ketemu di siaran berikutnya! Wassalamualaikum warahmatullahi wabarakatuh, salam peace dan kreasi.`,
          }
        );
      } else {
        turns.push({
          speaker: p1,
          text: `Makasih banyak ya Sobat Muda udah dengerin ${safeProgram} sampai selesai! Aku ${p1} pamit. Wassalamualaikum warahmatullahi wabarakatuh, salam peace dan kreasi.`,
        });
      }
    } else {
      const fillerExchanges = p2
        ? [
            {
              speaker: p1,
              text: `Masuk ke ${segName}, menurut kamu bagian mana sih dari ${safeTheme} yang paling sering bikin anak muda ngerasa relate di keseharian?`,
            },
            {
              speaker: p2,
              text: `Menurutku justru di momen-momen kecil sehari-hari, sih. Misalnya pas jadwal lagi padat banget, kita sering lupa ngecek kondisi diri sendiri sebelum lanjut ngerjain target berikutnya.`,
            },
            {
              speaker: p1,
              text: `Bener banget! Contoh nyatanya tuh kalau lagi ngerjain tugas atau kerjaan numpuk di kosan, rasanya pengin semua beres dalam semalam, padahal energi kita juga ada batasnya.`,
            },
            {
              speaker: p2,
              text: `Setuju! Makanya buat Sobat Muda yang lagi dengerin di jalan atau di kampus, penting banget buat nemuin ritme yang pas versi kamu sendiri biar nggak gampang keteteran.`,
            },
          ]
        : [
            {
              speaker: p1,
              text: `Sekarang kita masuk ke ${segName} buat ngulik lebih dalam soal ${safeTheme} bareng kamu, Sobat Muda.`,
            },
            {
              speaker: p1,
              text: `Kalau dilihat dari situasi sehari-hari, banyak dari kita yang sebenernya udah berusaha keras, cuma kadang belum sempet ngatur ulang prioritas dengan tenang.`,
            },
          ];
      turns.push(...fillerExchanges);
    }

    // Distinct non-repetitive depth exchanges to match target duration cleanly in demo mode
    const extraPool = p2
      ? [
          {
            speaker: p1,
            text: `Ngomong-ngomong soal kebiasaan harian, biasanya hal sederhana apa yang paling kerasa ngebantu waktu kamu ngadepin situasi kayak ${safeTheme} ini?`,
          },
          {
            speaker: p2,
            text: `Kalau dari pengalamanku, ngebiasain jeda sebentar dan cerita ke temen terdekat itu ngebantu banget, Sobat Muda. Kepala jadi lebih enteng sebelum ambil keputusan.`,
          },
          {
            speaker: p1,
            text: `Iya sih, kadang kita cuma butuh sudut pandang dari luar biar nggak muter di pikiran yang sama terus. Gimana nih kalau versi Sobat Muda yang lagi dengerin?`,
          },
          {
            speaker: p2,
            text: `Buat kamu yang punya cerita atau pengalaman serupa, bisa banget refleksiin sambil tetep nikmatin playlist pilihan kita di 107,7 SIMFONI FM.`,
          },
          {
            speaker: p1,
            text: `Satu hal lagi yang menarik, lingkungan sekitar ternyata juga punya peran besar buat ngejaga konsistensi kita tiap minggu.`,
          },
          {
            speaker: p2,
            text: `Betul, punya circle atau teman diskusi yang suportif bikin proses belajar dan bertumbuh jadi kerasa jauh lebih ringan bareng-bareng.`,
          },
          {
            speaker: p1,
            text: `Dari situ kita bisa lihat kalau langkah kecil yang dijalanin rutin bakal kerasa dampaknya dibanding nunggu momen sempurna.`,
          },
          {
            speaker: p2,
            text: `Setuju banget! Yuk kita bawa semangat itu terus sepanjang hari ini bareng Sobat Muda di mana pun kamu berada.`,
          },
        ]
      : [
          {
            speaker: p1,
            text: `Coba bayangin deh, Sobat Muda, sering kali kita terlalu fokus sama hasil akhir sampai lupa ngasih apresiasi ke progres kecil yang udah berhasil dilewati.`,
          },
          {
            speaker: p1,
            text: `Dari obrolan soal ${safeTheme} ini, kita bisa belajar buat ngatur langkah lebih realistis tiap harinya sesuai kapasitas masing-masing.`,
          },
          {
            speaker: p1,
            text: `Apalagi kalau kamu lagi banyak kegiatan di kampus atau kerjaan, menjaga ritme komunikasi sama temen sekitar bikin beban terasa jauh lebih ringan.`,
          },
          {
            speaker: p1,
            text: `Tetep semangat ya, Sobat Muda! Masih banyak lagu enak dan obrolan seru yang udah kita siapin buat nemenin hari kamu di 107,7 SIMFONI FM.`,
          },
        ];

    let round = 0;
    while (countDialogueWords(turns) < targetWordCount * 0.92 && round < 16) {
      const nextTurn = extraPool[round % extraPool.length];
      if (isClosing && turns.length >= 2) {
        turns.splice(turns.length - 1, 0, nextTurn);
      } else {
        turns.push(nextTurn);
      }
      round += 1;
    }

    const wordCount = countDialogueWords(turns);
    return {
      segmentTitle: segName,
      durationMinutes,
      wordCount,
      estimatedDurationMinutes: estimateMinutesFromWords(wordCount),
      dialogue: turns,
    };
  });

  return {
    isDemo: true,
    programName: safeProgram,
    programDuration: safeProgDuration || undefined,
    theme: safeTheme,
    segments: builtSegments,
  };
}

function parseJsonSafely<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim()) as T;
      } catch {
        return null;
      }
    }
    const braceStart = raw.indexOf('{');
    const braceEnd = raw.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(raw.slice(braceStart, braceEnd + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: hasValidApiKey(),
    });
  });

  app.post('/api/ai/highlight', async (req, res) => {
    try {
      const { newsUrl, announcers, articleText, newsUrl2, articleText2 } = req.body as {
        newsUrl?: string;
        announcers?: string[];
        articleText?: string;
        newsUrl2?: string;
        articleText2?: string;
      };

      const cleanAnnouncers = (announcers || [])
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 2);

      if (cleanAnnouncers.length === 0) {
        res.status(400).json({ error: 'Minimal 1 nama penyiar wajib diisi.' });
        return;
      }

      const trimmedUrl = (newsUrl || '').trim();
      const trimmedManualText = (articleText || '').trim();
      const trimmedUrl2 = (newsUrl2 || '').trim();
      const trimmedManualText2 = (articleText2 || '').trim();

      if (!trimmedUrl && trimmedManualText.length < 40) {
        res.status(400).json({ error: 'Link berita utama wajib diisi.' });
        return;
      }

      if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
        res.status(400).json({
          error: 'Format link berita 1 tidak valid. Gunakan URL diawali http:// atau https://.',
        });
        return;
      }

      if (trimmedUrl2 && !isValidHttpUrl(trimmedUrl2)) {
        res.status(400).json({
          error: 'Format link berita 2 tidak valid. Gunakan URL diawali http:// atau https://.',
        });
        return;
      }

      if (!hasValidApiKey()) {
        res.json(
          buildDemoHighlight(
            trimmedUrl,
            cleanAnnouncers,
            trimmedManualText,
            trimmedUrl2,
            trimmedManualText2
          )
        );
        return;
      }

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
   - ${trimmedUrl2 || trimmedManualText2 ? 'Ada berita ke-2 dari pengguna: isi title2 (judul berita 2) dan dialogue2 (isi berita 2, tetap ringkas 4-8 baris).' : 'TIDAK ADA berita ke-2: kosongkan title2 ("") dan dialogue2 ([]). JANGAN mengarang berita ke-2.'}
   - JANGAN menambah pembuka, penutup, atau komentar ekstra di luar struktur JSON.`;

      let extractedSource1 = trimmedManualText;
      let fallbackTitle1 = '';
      let fallbackSource1 = '';

      if (!extractedSource1 && trimmedUrl) {
        const fetched1 = await tryFetchArticle(trimmedUrl);
        if (fetched1.ok) {
          extractedSource1 = fetched1.text;
          fallbackTitle1 = fetched1.title;
          fallbackSource1 = fetched1.source;
        }
      }

      let extractedSource2 = trimmedManualText2;
      let fallbackTitle2 = '';
      let fallbackSource2 = '';
      const hasSecondNews = Boolean(trimmedUrl2 || trimmedManualText2);

      if (hasSecondNews && !extractedSource2 && trimmedUrl2) {
        const fetched2 = await tryFetchArticle(trimmedUrl2);
        if (fetched2.ok) {
          extractedSource2 = fetched2.text;
          fallbackTitle2 = fetched2.title;
          fallbackSource2 = fetched2.source;
        }
      }

      const normalizeDialogueArray = (
        rawDialogue: unknown,
        defaultSpeaker: string
      ): DialogueTurn[] => {
        if (typeof rawDialogue === 'string') {
          const clean = enforceHighlightStyle(rawDialogue);
          return clean ? [{ speaker: defaultSpeaker, text: clean }] : [];
        }
        if (!Array.isArray(rawDialogue)) return [];
        const turns: DialogueTurn[] = [];
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
          async () => {
            const response = await ai.models.generateContent({
              model: GEMINI_MODEL,
              contents: userContent,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                abortSignal: AbortSignal.timeout(55_000),
              },
            });

            const rawText = (response.text || '').trim();
            if (!rawText) {
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
            }>(rawText);

            const normalizedD1 = decoded
              ? normalizeDialogueArray(decoded.dialogue, speaker1)
              : [];

            if (!decoded || normalizedD1.length === 0) {
              throw Object.assign(new Error('Malformed Highlight JSON'), {
                aiCode: 'PARSE_ERROR',
              });
            }

            return { decoded, normalizedD1 };
          },
          { featureLabel: 'AI Highlight', maxAttempts: 2, baseDelayMs: 1100 }
        );

        const d2 = hasSecondNews
          ? normalizeDialogueArray(parsed.decoded.dialogue2, speaker2 || speaker1)
          : [];

        res.json({
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
        });
        return;
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
        async () => {
          const urlContextResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: urlPrompt,
            config: {
              systemInstruction,
              tools: [{ urlContext: {} }],
              abortSignal: AbortSignal.timeout(55_000),
            },
          });

          const rawText = (urlContextResponse.text || '').trim();
          if (!rawText) {
            throw Object.assign(new Error('Empty urlContext response'), {
              aiCode: 'EMPTY_RESPONSE',
            });
          }

          return parseJsonSafely<{
            accessible?: boolean;
            title?: string;
            source?: string;
            summary?: string;
            title2?: string;
            dialogue?: unknown;
            dialogue2?: unknown;
          }>(rawText);
        },
        { featureLabel: 'AI Highlight', maxAttempts: 2, baseDelayMs: 1100 }
      );

      const urlDialogue1 = parsedUrlResult
        ? normalizeDialogueArray(parsedUrlResult.dialogue, speaker1)
        : [];

      if (
        !parsedUrlResult ||
        parsedUrlResult.accessible === false ||
        urlDialogue1.length === 0
      ) {
        res.status(422).json({
          code: 'URL_UNREACHABLE',
          error:
            'Link berita tidak dapat diakses otomatis (kemungkinan diblokir, butuh login, atau halaman dinamis). Tempel isi beritanya secara manual di kolom bawah agar faktanya tetap akurat.',
        });
        return;
      }

      const urlDialogue2 = hasSecondNews
        ? normalizeDialogueArray(parsedUrlResult.dialogue2, speaker2 || speaker1)
        : [];

      res.json({
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
      });
    } catch (error) {
      const classified = classifyGeminiError(error, 'AI Highlight');
      res.status(classified.httpStatus).json({
        code: classified.code,
        error: classified.message,
      });
    }
  });

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
    };
  }

  function parseStreamedTalkBlocks(
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

  function buildScriptPrompts(params: {
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

  async function expandShortSegments(params: {
    ai: GoogleGenAI;
    shortSegments: Array<{ index: number; segment: ScriptSegmentBuilt }>;
    allSegments: ScriptSegmentBuilt[];
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
      { featureLabel: 'AI Script', maxAttempts: 2, baseDelayMs: 1100, externalSignal: abortSignal }
    );

    const expandedText = response.text || '';
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
          allowedSpeakers.find((sp) => sp.toUpperCase() === cleanedSp || cleanedSp.startsWith(`${sp.toUpperCase()} `)) ||
          (cleanedSp.length <= 24 ? cleanedSp : null);
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
        if (job.cancelled || timedOut) {
          throw new Error(timedOut ? 'TIMEOUT' : 'CANCELLED');
        }
        if (fetched.ok) {
          newsReferenceText = `Judul: ${fetched.title}\nSumber: ${fetched.source}\nIsi:\n${fetched.text}`;
        } else if (!params.trimmedTheme) {
          job.status = 'failed';
          job.statusLabel = 'Gagal menyiapkan script';
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
      let streamAttempt = 0;
      const maxStreamAttempts = 2;

      while (streamAttempt < maxStreamAttempts) {
        streamAttempt += 1;
        fullText = '';
        try {
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
            const delta = chunk.text || '';
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
            (!fullText || classifiedStream.code === 'QUOTA_EXCEEDED' || classifiedStream.code === 'NETWORK_ERROR' || classifiedStream.code === 'EMPTY_RESPONSE');
          if (!shouldRetry) {
            throw streamErr;
          }
          console.warn(
            `[AI Script] Stream attempt ${streamAttempt} (${classifiedStream.code}) retrying in 1500ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, 1500));
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

      if (finalized.segments.length < job.requestedSegments.length) {
        job.status = 'failed';
        job.statusLabel = 'Hasil belum lengkap';
        job.segments = [];
        job.completedCount = 0;
        job.error =
          'Susunan talk dari AI sempat terhenti sebelum semua talk selesai. Silakan klik Coba Lagi ya.';
        job.updatedAt = Date.now();
        return;
      }

      // Validate word counts per talk against 110–130 wpm target; auto-expand any talk below 100 wpm
      let finalSegments = finalized.segments;
      const underLength = finalSegments
        .map((segment, index) => ({ segment, index }))
        .filter(({ segment }) => segment.wordCount < segment.durationMinutes * 100);

      if (underLength.length > 0 && Date.now() - startTime < SCRIPT_JOB_TIMEOUT_MS - 35000) {
        try {
          const expandedMap = await expandShortSegments({
            ai,
            shortSegments: underLength,
            allSegments: finalSegments,
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
          console.warn('Expansion pass skipped due to transient error:', expandError);
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
      job.error = classified.message;
      job.updatedAt = Date.now();
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  app.post('/api/ai/script/jobs', (req, res) => {
    try {
      pruneOldScriptJobs();

      const {
        announcers,
        programName,
        programDuration,
        segments,
        theme,
        newsUrl,
        articleText,
        closingType,
        clientSessionId,
      } = req.body as {
        announcers?: string[];
        programName?: string;
        programDuration?: string;
        segments?: Array<string | { title?: string; durationMinutes?: number }>;
        theme?: string;
        newsUrl?: string;
        articleText?: string;
        closingType?: 'segmen1' | 'segmen2';
        clientSessionId?: string;
      };

      const safeSessionId = (clientSessionId || '').trim() || 'default-session';

      for (const existing of scriptJobs.values()) {
        if (existing.clientSessionId === safeSessionId && isJobActive(existing)) {
          res.status(200).json(serializeScriptJob(existing, true));
          return;
        }
      }

      const cleanAnnouncers = (announcers || [])
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 2);

      if (cleanAnnouncers.length === 0) {
        res.status(400).json({ error: 'Minimal 1 nama penyiar wajib diisi.' });
        return;
      }

      const requestedSegments = normalizeSegmentsInput(segments);
      const trimmedTheme = (theme || '').trim();
      const trimmedProgram = (programName || '').trim() || 'Program SIMFONI FM';
      const trimmedProgramDuration = (programDuration || '').trim() || undefined;
      const trimmedUrl = (newsUrl || '').trim();
      const trimmedManualText = (articleText || '').trim();
      const safeClosingType: 'segmen1' | 'segmen2' =
        closingType === 'segmen1' ? 'segmen1' : 'segmen2';

      if (!trimmedTheme && !trimmedUrl && !trimmedManualText && !programName?.trim()) {
        res.status(400).json({
          error: 'Isi minimal nama program, tema siaran, atau link berita referensi.',
        });
        return;
      }

      if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
        res.status(400).json({
          error: 'Format link berita tidak valid. Gunakan URL diawali http:// atau https://.',
        });
        return;
      }

      const jobId = randomUUID();
      if (!hasValidApiKey()) {
        const demo = buildDemoScript(
          cleanAnnouncers,
          trimmedProgram,
          requestedSegments,
          trimmedTheme,
          safeClosingType,
          trimmedProgramDuration
        );
        const demoJob: ScriptJob = {
          jobId,
          clientSessionId: safeSessionId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'completed',
          statusLabel: 'Berhasil',
          isDemo: true,
          programName: demo.programName,
          programDuration: demo.programDuration,
          theme: demo.theme,
          requestedSegments,
          segments: demo.segments,
          completedCount: demo.segments.length,
          totalCount: demo.segments.length,
          cancelled: false,
          abortController: new AbortController(),
        };
        scriptJobs.set(jobId, demoJob);
        res.status(202).json(serializeScriptJob(demoJob));
        return;
      }

      const job: ScriptJob = {
        jobId,
        clientSessionId: safeSessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'preparing',
        statusLabel: 'Menyiapkan script',
        isDemo: false,
        programName: trimmedProgram,
        programDuration: trimmedProgramDuration,
        theme: trimmedTheme || 'Siaran SIMFONI FM',
        requestedSegments,
        segments: [],
        completedCount: 0,
        totalCount: requestedSegments.length,
        cancelled: false,
        abortController: new AbortController(),
      };

      scriptJobs.set(jobId, job);

      // Run independently of HTTP connection
      void runScriptJob(job, {
        cleanAnnouncers,
        trimmedProgram,
        trimmedProgramDuration,
        trimmedTheme,
        trimmedUrl,
        trimmedManualText,
        safeClosingType,
      });

      res.status(202).json(serializeScriptJob(job));
    } catch (error) {
      console.error('Create AI Script Job Error:', error);
      res.status(500).json({
        error: 'Gagal memulai penyusunan script. Silakan coba lagi.',
      });
    }
  });

  app.get('/api/ai/script/jobs/:jobId', (req, res) => {
    const job = scriptJobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({
        error: 'Sesi penyusunan script tidak ditemukan atau sudah kedaluwarsa.',
      });
      return;
    }
    res.json(serializeScriptJob(job));
  });

  app.post('/api/ai/script/jobs/:jobId/cancel', (req, res) => {
    const job = scriptJobs.get(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'Sesi penyusunan script tidak ditemukan.' });
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

  // Backward-compatible synchronous endpoint delegating to the same generator pipeline
  app.post('/api/ai/script', async (req, res) => {
    try {
      const {
        announcers,
        programName,
        programDuration,
        segments,
        theme,
        newsUrl,
        articleText,
        closingType,
      } = req.body as {
        announcers?: string[];
        programName?: string;
        programDuration?: string;
        segments?: Array<string | { title?: string; durationMinutes?: number }>;
        theme?: string;
        newsUrl?: string;
        articleText?: string;
        closingType?: 'segmen1' | 'segmen2';
      };

      const cleanAnnouncers = (announcers || [])
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 2);

      if (cleanAnnouncers.length === 0) {
        res.status(400).json({ error: 'Minimal 1 nama penyiar wajib diisi.' });
        return;
      }

      const requestedSegments = normalizeSegmentsInput(segments);
      const trimmedTheme = (theme || '').trim();
      const trimmedProgram = (programName || '').trim() || 'Program SIMFONI FM';
      const trimmedProgramDuration = (programDuration || '').trim() || undefined;
      const trimmedUrl = (newsUrl || '').trim();
      const trimmedManualText = (articleText || '').trim();
      const safeClosingType: 'segmen1' | 'segmen2' =
        closingType === 'segmen1' ? 'segmen1' : 'segmen2';

      if (!trimmedTheme && !trimmedUrl && !trimmedManualText && !programName?.trim()) {
        res.status(400).json({
          error: 'Isi minimal nama program, tema siaran, atau link berita referensi.',
        });
        return;
      }

      if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
        res.status(400).json({
          error: 'Format link berita tidak valid. Gunakan URL diawali http:// atau https://.',
        });
        return;
      }

      if (!hasValidApiKey()) {
        res.json(
          buildDemoScript(
            cleanAnnouncers,
            trimmedProgram,
            requestedSegments,
            trimmedTheme,
            safeClosingType,
            trimmedProgramDuration
          )
        );
        return;
      }

      const job: ScriptJob = {
        jobId: randomUUID(),
        clientSessionId: 'sync-direct',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'preparing',
        statusLabel: 'Menyiapkan script',
        isDemo: false,
        programName: trimmedProgram,
        programDuration: trimmedProgramDuration,
        theme: trimmedTheme || 'Siaran SIMFONI FM',
        requestedSegments,
        segments: [],
        completedCount: 0,
        totalCount: requestedSegments.length,
        cancelled: false,
        abortController: new AbortController(),
      };

      await runScriptJob(job, {
        cleanAnnouncers,
        trimmedProgram,
        trimmedProgramDuration,
        trimmedTheme,
        trimmedUrl,
        trimmedManualText,
        safeClosingType,
      });

      if (job.status !== 'completed') {
        res.status(job.status === 'timed_out' ? 504 : 502).json({
          error: job.error || 'Gagal menyusun script siaran. Coba lagi ya.',
        });
        return;
      }

      res.json({
        isDemo: false,
        programName: job.programName,
        programDuration: job.programDuration,
        theme: job.theme,
        segments: job.segments,
        urlWarning: job.urlWarning,
      });
    } catch (error) {
      console.error('AI Script Error:', error);
      res.status(500).json({
        error: 'Terjadi gangguan saat menyusun naskah AI. Silakan coba beberapa saat lagi.',
      });
    }
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
