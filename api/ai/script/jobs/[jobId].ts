import type { IncomingMessage, ServerResponse } from 'node:http';
import { ensureMethod, sendJson } from '../../../../server/vercelHttp.ts';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (!ensureMethod(req, res, 'GET')) return;
  sendJson(res, 404, {
    code: 'SERVERLESS_JOB_EXPIRED',
    error:
      'Sesi penyusunan script sebelumnya sudah selesai atau berakhir di serverless. Tekan Coba Lagi untuk membuat naskah baru.',
  });
}
