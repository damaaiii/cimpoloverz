import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-4-hydrogen';

export type AIErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_FOUND'
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
      status: 401,
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

  console.error(`[${featureLabel}]`, {
    status: rawStatus || undefined,
    code: explicitCode || undefined,
    name: errName || undefined,
    message: rawMsg.slice(0, 400),
  });

  if (explicitCode === 'MISSING_API_KEY') {
    return {
      httpStatus: 500,
      code: 'MISSING_API_KEY',
      message: 'API key AI belum terpasang di server. Hubungi admin untuk mengecek GEMINI_API_KEY.',
      retryable: false,
    };
  }

  if (explicitCode === 'EMPTY_RESPONSE') {
    return {
      httpStatus: 502,
      code: 'EMPTY_RESPONSE',
      message: 'AI mengembalikan hasil kosong. Klik Coba Lagi untuk memproses ulang.',
      retryable: true,
    };
  }

  if (explicitCode === 'PARSE_ERROR') {
    return {
      httpStatus: 502,
      code: 'PARSE_ERROR',
      message: 'Format jawaban AI sempat tidak sesuai struktur. Klik Coba Lagi ya.',
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
      message: 'Konfigurasi API key AI ditolak atau tidak memiliki izin. Periksa GEMINI_API_KEY di server.',
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
      message: 'Batas permintaan AI sementara penuh (rate limit / kuota). Tunggu sebentar lalu klik Coba Lagi ya.',
      retryable: true,
    };
  }

  if (
    rawStatus === 404 ||
    (lowerMsg.includes('model') && (lowerMsg.includes('not found') || lowerMsg.includes('not supported')))
  ) {
    return {
      httpStatus: 502,
      code: 'MODEL_NOT_FOUND',
      message: `Model AI (${GEMINI_MODEL}) belum tersedia atau tidak didukung endpoint.`,
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
      message: 'Proses ke layanan AI melebihi batas waktu. Coba lagi sebentar ya.',
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
      message: 'Layanan AI atau jaringan server sedang mengalami gangguan sementara. Silakan klik Coba Lagi.',
      retryable: true,
    };
  }

  return {
    httpStatus: 502,
    code: 'UNKNOWN_ERROR',
    message: 'Terjadi kendala saat memproses permintaan AI. Silakan klik Coba Lagi.',
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
      const waitMs = baseDelayMs * attempt;
      console.warn(
        `[${options.featureLabel}] Attempt ${attempt} (${classified.code}) retrying in ${waitMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}
