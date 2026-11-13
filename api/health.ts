import type { IncomingMessage, ServerResponse } from 'node:http';
import { hasValidApiKey } from '../server/aiClient.ts';
import { ensureMethod, sendJson } from '../server/vercelHttp.ts';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!ensureMethod(req, res, 'GET')) return;
  sendJson(res, 200, {
    ok: true,
    aiConfigured: hasValidApiKey(),
    runtime: 'vercel',
  });
}
