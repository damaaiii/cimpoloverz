import type { IncomingMessage, ServerResponse } from 'node:http';

export interface ParsedBodyResult<T> {
  ok: true;
  data: T;
}

export interface ParsedBodyError {
  ok: false;
  status: number;
  code: string;
  error: string;
}

export function sendJson(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function ensureMethod(
  req: IncomingMessage,
  res: ServerResponse,
  allowedMethod: 'GET' | 'POST'
): boolean {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', `${allowedMethod}, OPTIONS`);
    res.end();
    return false;
  }
  if (method !== allowedMethod) {
    res.setHeader('Allow', `${allowedMethod}, OPTIONS`);
    sendJson(res, 405, {
      code: 'METHOD_NOT_ALLOWED',
      error: `Metode ${method} tidak didukung untuk endpoint ini. Gunakan ${allowedMethod}.`,
    });
    return false;
  }
  return true;
}

export async function readJsonBody<T>(
  req: IncomingMessage & { body?: unknown }
): Promise<ParsedBodyResult<T> | ParsedBodyError> {
  if (req.body !== undefined) {
    if (typeof req.body === 'object' && req.body !== null) {
      return { ok: true, data: req.body as T };
    }
    if (typeof req.body === 'string') {
      const trimmed = req.body.trim();
      if (!trimmed) return { ok: true, data: {} as T };
      try {
        return { ok: true, data: JSON.parse(trimmed) as T };
      } catch {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_JSON',
          error: 'Body request bukan format JSON yang valid.',
        };
      }
    }
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const maxBytes = 1024 * 1024;

  try {
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        return {
          ok: false,
          status: 413,
          code: 'PAYLOAD_TOO_LARGE',
          error: 'Ukuran payload request melebihi batas maksimal 1 MB.',
        };
      }
      chunks.push(buf);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'BODY_READ_ERROR',
      error: 'Gagal membaca body request.',
    };
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return { ok: true, data: {} as T };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_JSON',
      error: 'Body request bukan format JSON yang valid.',
    };
  }
}
