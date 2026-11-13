export interface ParsedApiResponse<T> {
  ok: boolean;
  status: number;
  data: (T & { error?: string; code?: string }) | null;
  fallbackError?: string;
}

export async function parseApiJsonResponse<T>(
  response: Response
): Promise<ParsedApiResponse<T>> {
  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    return {
      ok: false,
      status: response.status,
      data: null,
      fallbackError: 'Gagal membaca respons dari server. Cek koneksi lalu klik Coba Lagi.',
    };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      ok: false,
      status: response.status,
      data: null,
      fallbackError:
        response.status >= 500
          ? 'Server mengembalikan respons kosong. Silakan klik Coba Lagi.'
          : 'Permintaan tidak menghasilkan data. Coba lagi sebentar ya.',
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as T & { error?: string; code?: string };
    return {
      ok: response.ok,
      status: response.status,
      data: parsed,
    };
  } catch {
    return {
      ok: false,
      status: response.status,
      data: null,
      fallbackError:
        response.status === 504 || response.status === 408
          ? 'Permintaan ke server AI melebihi batas waktu. Klik Coba Lagi ya.'
          : response.status >= 500
            ? `Gangguan sementara di server (${response.status}). Silakan klik Coba Lagi.`
            : 'Layanan AI belum merespons dalam format yang diharapkan. Coba lagi sebentar ya.',
    };
  }
}
