import { type GenerateContentResponse, GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-4-hydrogen';

export type AIErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'SAFETY_BLOCK'
  | 'TOKEN_LIMIT'
  | 'TIMEOUT'
  | 'EMPTY_RESPONSE'
  | 'PARSE_ERROR'
  | 'NETWORK_ERROR'
  | 'URL_UNREACHABLE'
  | 'UNKNOWN_ERROR';

export interface ClassifiedAIError {
  httpStatus: number;
  code: AIErrorCode;
  message: string;
  retryable: boolean;
}

export function getRawApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

export function hasValidApiKey(): boolean {
  const key = getRawApiKey();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

export function getGenAI(): GoogleGenAI {
  const apiKey = getRawApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw Object.assign(new Error('GEMINI_API_KEY belum terkonfigurasi di server.'), {
      status: 500,
      aiCode: 'MISSING_API_KEY' as AIErrorCode,
    });
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function inspectGeminiResponse(
  response: GenerateContentResponse,
  featureLabel: 'AI Highlight' | 'AI Script'
): {
  text: string;
  finishReason: string | undefined;
  blockReason: string | undefined;
  isTruncated: boolean;
} {
  const candidate = response.candidates?.[0];
  const finishReason = candidate?.finishReason ? String(candidate.finishReason) : undefined;
  const blockReason = response.promptFeedback?.blockReason
    ? String(response.promptFeedback.blockReason)
    : undefined;
  const text = typeof response.text === 'string' ? response.text.trim() : '';

  console.log(`[${featureLabel}] AI Response status:`, {
    finishReason: finishReason || 'UNKNOWN',
    blockReason: blockReason || null,
    responseType: typeof response.text,
    textLength: text.length,
    candidateCount: response.candidates?.length || 0,
  });

  if (
    blockReason ||
    finishReason === 'SAFETY' ||
    finishReason === 'PROHIBITED_CONTENT' ||
    finishReason === 'BLOCKLIST' ||
    finishReason === 'SPII'
  ) {
    throw Object.assign(
      new Error(`Konten diblokir oleh kebijakan keamanan AI (${blockReason || finishReason}).`),
      {
        status: 422,
        aiCode: 'SAFETY_BLOCK' as AIErrorCode,
      }
    );
  }

  return {
    text,
    finishReason,
    blockReason,
    isTruncated: finishReason === 'MAX_TOKENS',
  };
}

export function classifyGeminiError(
  err: unknown,
  featureLabel: 'AI Highlight' | 'AI Script'
): ClassifiedAIError {
  const errObj =
    typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {};
  const rawStatus = Number(errObj.status || errObj.statusCode || 0);
  const explicitCode =
    typeof errObj.aiCode === 'string' ? (errObj.aiCode as AIErrorCode) : undefined;
  const errName = err instanceof Error ? err.name : String(errObj.name || '');
  const rawMsg =
    err instanceof Error ? err.message : String(errObj.message || err || 'Unknown error');
  const lowerMsg = rawMsg.toLowerCase();

  console.error(`[${featureLabel}] Provider/Execution Error:`, {
    status: rawStatus || undefined,
    code: explicitCode || undefined,
    name: errName || undefined,
    message: rawMsg.slice(0, 400),
  });

  if (explicitCode === 'MISSING_API_KEY') {
    return {
      httpStatus: 500,
      code: 'MISSING_API_KEY',
      message:
        'API key AI (GEMINI_API_KEY) belum terkonfigurasi di environment server.',
      retryable: false,
    };
  }

  if (explicitCode === 'SAFETY_BLOCK') {
    return {
      httpStatus: 422,
      code: 'SAFETY_BLOCK',
      message:
        'Permintaan atau sumber berita terkena filter keamanan AI. Coba gunakan teks atau topik yang berbeda.',
      retryable: false,
    };
  }

  if (explicitCode === 'TOKEN_LIMIT') {
    return {
      httpStatus: 502,
      code: 'TOKEN_LIMIT',
      message:
        'Respons AI terpotong karena melewati batas panjang token. Coba ringkas input atau kurangi jumlah/durasi talk.',
      retryable: false,
    };
  }

  if (explicitCode === 'EMPTY_RESPONSE') {
    return {
      httpStatus: 502,
      code: 'EMPTY_RESPONSE',
      message: 'Model AI mengembalikan respons kosong. Silakan klik Coba Lagi.',
      retryable: true,
    };
  }

  if (explicitCode === 'PARSE_ERROR') {
    return {
      httpStatus: 502,
      code: 'PARSE_ERROR',
      message:
        'Format output dari model AI tidak dapat diparsing menjadi struktur naskah. Silakan klik Coba Lagi.',
      retryable: true,
    };
  }

  if (
    rawStatus === 401 ||
    rawStatus === 403 ||
    lowerMsg.includes('api key not valid') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('invalid api key')
  ) {
    return {
      httpStatus: 502,
      code: 'INVALID_API_KEY',
      message:
        'API key AI ditolak oleh provider (tidak valid atau tidak memiliki izin akses). Periksa GEMINI_API_KEY di server.',
      retryable: false,
    };
  }

  if (
    rawStatus === 429 ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('too many requests')
  ) {
    return {
      httpStatus: 429,
      code: 'QUOTA_EXCEEDED',
      message:
        'Batas penggunaan / kuota permintaan AI sementara penuh (429 Rate Limit). Tunggu beberapa detik lalu klik Coba Lagi.',
      retryable: true,
    };
  }

  if (
    rawStatus === 404 ||
    (lowerMsg.includes('model') &&
      (lowerMsg.includes('not found') || lowerMsg.includes('not supported')))
  ) {
    return {
      httpStatus: 502,
      code: 'MODEL_NOT_FOUND',
      message: `Model AI (${GEMINI_MODEL}) tidak ditemukan atau tidak didukung oleh endpoint API.`,
      retryable: false,
    };
  }

  if (
    errName === 'TimeoutError' ||
    errName === 'AbortError' ||
    rawMsg === 'TIMEOUT' ||
    lowerMsg.includes('timed out') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('aborted')
  ) {
    return {
      httpStatus: 504,
      code: 'TIMEOUT',
      message: 'Permintaan ke provider AI melebihi batas waktu. Silakan klik Coba Lagi.',
      retryable: true,
    };
  }

  if (
    rawStatus >= 500 ||
    lowerMsg.includes('econnreset') ||
    lowerMsg.includes('enotfound') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('unavailable')
  ) {
    return {
      httpStatus: 503,
      code: 'NETWORK_ERROR',
      message:
        'Terjadi gangguan koneksi sementara ke server provider AI. Silakan klik Coba Lagi.',
      retryable: true,
    };
  }

  return {
    httpStatus: 502,
    code: 'UNKNOWN_ERROR',
    message: `Gagal memproses permintaan AI: ${rawMsg.slice(0, 140)}`,
    retryable: true,
  };
}

export async function withGeminiRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    featureLabel: 'AI Highlight' | 'AI Script';
    maxAttempts?: number;
    baseDelayMs?: number;
    externalSignal?: AbortSignal;
  }
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 1200;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.externalSignal?.aborted) {
      throw lastError || new Error('ABORTED');
    }
    try {
      return await operation(attempt);
    } catch (err) {
      lastError = err;
      if (options.externalSignal?.aborted) {
        throw err;
      }
      const classified = classifyGeminiError(err, options.featureLabel);
      if (!classified.retryable || attempt >= maxAttempts) {
        throw err;
      }
      const waitMs =
        classified.code === 'QUOTA_EXCEEDED'
          ? Math.max(2500, baseDelayMs * attempt)
          : baseDelayMs * attempt;
      console.warn(
        `[${options.featureLabel}] Attempt ${attempt} (${classified.code}) retrying in ${waitMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

export function parseJsonSafely<T>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Strip markdown code fences if present before attempting full or brace-sliced parse
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    if (fenced) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // continue to brace extraction
      }
    }
    const braceStart = candidate.indexOf('{');
    const braceEnd = candidate.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(candidate.slice(braceStart, braceEnd + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
