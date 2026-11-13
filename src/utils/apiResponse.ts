export interface ParsedApiResponse<T> {
  ok: boolean;
  status: number;
  data: (T & { error?: string; code?: string }) | null;
  fallbackError?: string;
}

export async function parseApiJsonResponse<T>(
  response: Response
): Promise<ParsedApiResponse<T>> {
  const contentType = response.headers.get('content-type') || 'unknown';
  let rawText = '';

  try {
    rawText = await response.text();
  } catch (err) {
    console.error('[API Client] Failed reading HTTP response body:', {
      status: response.status,
      contentType,
      err,
    });
    return {
      ok: false,
      status: response.status,
      data: null,
      fallbackError: 'Gagal membaca respons dari server. Cek koneksi lalu klik Coba Lagi.',
    };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    console.error('[API Client] Empty HTTP response body:', {
      status: response.status,
      contentType,
    });
    return {
      ok: false,
      status: response.status,
      data: null,
      fallbackError:
        response.status >= 500
          ? `Server mengembalikan respons kosong (HTTP ${response.status}). Silakan klik Coba Lagi.`
          : `Permintaan tidak menghasilkan data (HTTP ${response.status}). Coba lagi sebentar ya.`,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as T & { error?: string; code?: string };
    return {
      ok: response.ok,
      status: response.status,
      data: parsed,
    };
  } catch (parseErr) {
    const isHtml = /<!doctype|<html/i.test(trimmed);
    console.error('[API Client] Non-JSON API response received:', {
      status: response.status,
      contentType,
      isHtml,
      snippet: trimmed.slice(0, 180),
      parseErr,
    });

    if (response.status === 504 || response.status === 408) {
      return {
        ok: false,
        status: response.status,
        data: null,
        fallbackError: `Permintaan ke server AI melebihi batas waktu (HTTP ${response.status}). Silakan klik Coba Lagi.`,
      };
    }

    if (response.status === 405) {
      return {
        ok: false,
        status: response.status,
        data: null,
        fallbackError:
          'Server hosting menolak metode request ke API (HTTP 405). Pastikan endpoint backend /api aktif.',
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        data: null,
        fallbackError: `Akses ke endpoint API ditolak oleh server atau proxy (HTTP ${response.status}).`,
      };
    }

    if (isHtml && (response.status === 200 || response.status === 404)) {
      return {
        ok: false,
        status: response.status,
        data: null,
        fallbackError: `Endpoint API mengembalikan halaman HTML (HTTP ${response.status}), menandakan backend /api belum aktif atau tertimpa routing SPA.`,
      };
    }

    if (response.status >= 500) {
      return {
        ok: false,
        status: response.status,
        data: null,
        fallbackError: `Gangguan server API (HTTP ${response.status}, tipe: ${contentType}). Silakan klik Coba Lagi.`,
      };
    }

    return {
      ok: false,
      status: response.status,
      data: null,
      fallbackError: `Format respons server bukan JSON valid (HTTP ${response.status}, tipe: ${contentType}). Silakan klik Coba Lagi.`,
    };
  }
}
