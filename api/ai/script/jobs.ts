import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type ScriptRequestInput,
  executeScriptDirect,
} from '../../../server/scriptService.ts';
import { ensureMethod, readJsonBody, sendJson } from '../../../server/vercelHttp.ts';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (!ensureMethod(req, res, 'POST')) return;

  const parsed = await readJsonBody<ScriptRequestInput>(req);
  if (!parsed.ok) {
    sendJson(res, parsed.status, { code: parsed.code, error: parsed.error });
    return;
  }

  const result = await executeScriptDirect(parsed.data);
  sendJson(res, result.status, result.body);
}
