import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { HighlightResult, SavedDraft } from '../types';
import { parseApiJsonResponse } from '../utils/apiResponse';
import { copyTextToClipboard, downloadTextFile } from '../utils/exportScript';
import {
  loadLatestHighlightFromIndexedDB,
  saveLatestHighlightToIndexedDB,
} from '../utils/offlineDb';
import { getStoredHighlightResult, setStoredHighlightResult } from '../utils/storage';

interface AIHighlightPanelProps {
  defaultAnnouncerName: string;
  onSaveDraft: (draft: SavedDraft) => void;
}

export const AIHighlightPanel: React.FC<AIHighlightPanelProps> = ({
  defaultAnnouncerName,
  onSaveDraft,
}) => {
  const isOnline = useOnlineStatus();

  const [newsUrl, setNewsUrl] = useState('');
  const [hasSecondNews, setHasSecondNews] = useState(false);
  const [newsUrl2, setNewsUrl2] = useState('');
  const [announcer1, setAnnouncer1] = useState(defaultAnnouncerName || '');
  const [hasSecondAnnouncer, setHasSecondAnnouncer] = useState(false);
  const [announcer2, setAnnouncer2] = useState('');
  const [showManualText, setShowManualText] = useState(false);
  const [articleText, setArticleText] = useState('');
  const [articleText2, setArticleText2] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<HighlightResult | null>(() =>
    getStoredHighlightResult()
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!announcer1 && defaultAnnouncerName) {
      setAnnouncer1(defaultAnnouncerName);
    }
  }, [defaultAnnouncerName, announcer1]);

  useEffect(() => {
    if (!result) {
      void loadLatestHighlightFromIndexedDB().then((cached) => {
        if (cached) {
          setResult(cached);
          setStoredHighlightResult(cached);
        }
      });
    }
  }, [result]);

  useEffect(() => {
    if (result) {
      setStoredHighlightResult(result);
      void saveLatestHighlightToIndexedDB(result);
    }
  }, [result]);

  const formatHighlightAsText = (data: HighlightResult): string => {
    const lines: string[] = [];

    // 1. Judul Berita 2 (jika ada berita ke-2)
    if (data.title2) {
      lines.push(data.title2);
      lines.push('');
    }

    // 2. Kalimat pembuka paten
    if (data.openerLine) {
      lines.push(data.openerLine);
      lines.push('');
    }

    // 3. Judul Berita 1
    lines.push(data.title);
    lines.push('');

    // 4. Isi Berita 1
    const showSpeaker1 = data.dialogue.length > 1;
    lines.push(
      ...data.dialogue.map((turn) =>
        showSpeaker1 ? `${turn.speaker.toUpperCase()}: ${turn.text.trim()}` : turn.text.trim()
      )
    );

    // 5 & 6. Jeda "---" dan Isi Berita 2 (jika ada)
    if (data.dialogue2 && data.dialogue2.length > 0) {
      lines.push('');
      lines.push('---');
      lines.push('');
      const showSpeaker2 = data.dialogue2.length > 1;
      lines.push(
        ...data.dialogue2.map((turn) =>
          showSpeaker2 ? `${turn.speaker.toUpperCase()}: ${turn.text.trim()}` : turn.text.trim()
        )
      );
    }

    // 7. Kalimat penutup paten
    if (data.closerLine) {
      lines.push('');
      lines.push(data.closerLine);
    }

    return lines.join('\n').trim();
  };

  const generateHighlight = async () => {
    if (!isOnline) {
      setErrorMsg(
        'Koneksi internet diperlukan untuk membuat AI Highlight baru. Naskah yang sudah tersimpan tetap bisa kamu baca dan salin.'
      );
      return;
    }

    const trimmedUrl = newsUrl.trim();
    const trimmedUrl2 = hasSecondNews ? newsUrl2.trim() : '';
    const p1 = announcer1.trim();
    const p2 = hasSecondAnnouncer ? announcer2.trim() : '';

    if (!trimmedUrl && articleText.trim().length < 40) {
      setErrorMsg('Tempel link beritanya atau isi teks berita 1 minimal 40 karakter dulu, ya!');
      return;
    }
    if (!p1) {
      setErrorMsg('Jangan lupa isi minimal 1 nama penyiar, ya!');
      return;
    }
    if (hasSecondAnnouncer && !p2) {
      setErrorMsg('Isi nama penyiar kedua atau hapus kolomnya kalau siaran solo.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/ai/highlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsUrl: trimmedUrl,
          announcers: p2 ? [p1, p2] : [p1],
          articleText: showManualText ? articleText.trim() : '',
          newsUrl2: trimmedUrl2,
          articleText2: hasSecondNews && showManualText ? articleText2.trim() : '',
        }),
      });

      const parsed = await parseApiJsonResponse<HighlightResult>(response);

      if (!parsed.ok || !parsed.data) {
        if (parsed.data?.code === 'URL_UNREACHABLE') {
          setShowManualText(true);
        }
        setErrorMsg(
          parsed.data?.error ||
            parsed.fallbackError ||
            'Waduh, gagal memproses beritanya. Klik Coba Lagi ya.'
        );
        return;
      }

      const payload = parsed.data;
      setResult(payload);
      setStoredHighlightResult(payload);
      void saveLatestHighlightToIndexedDB(payload);

      onSaveDraft({
        id: `hl-${Date.now()}`,
        type: 'highlight',
        title: payload.title,
        createdAt: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        content: formatHighlightAsText(payload),
      });
    } catch {
      setErrorMsg(
        'Koneksi ke server terganggu atau terputus. Cek internet kamu lalu klik Coba Lagi ya.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void generateHighlight();
  };

  const handleCopy = async () => {
    if (!result) return;
    const ok = await copyTextToClipboard(formatHighlightAsText(result));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadTextFile(`highlight-${result.title}`, formatHighlightAsText(result));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Highlight Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 rounded-3xl bg-[#EAF3FE] border border-[#C7DDF6] p-5 sm:p-6 space-y-5"
      >
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#2B6CB0]">
            Crew SIMFONI · Berita ke On-Air
          </div>
          <h2 className="font-display font-bold text-xl text-[#1F2428]">
            AI Highlight Berita
          </h2>
          <p className="text-xs sm:text-sm text-[#3B4C5E] leading-relaxed">
            Tempel link beritanya di sini, ya! AI bakal rangkumin fakta 5W+1H sepanjang 4–8 baris dengan format resmi Simfoni Highlight buat Sobat Muda.
          </p>
        </div>

        {!isOnline && (
          <div className="p-3 rounded-2xl bg-white border border-[#C7DDF6] flex items-start gap-2 text-xs text-[#1E3A5F]">
            <WifiOff className="w-4 h-4 text-[#2B6CB0] shrink-0 mt-0.5" />
            <span>
              Koneksi internet lagi offline. Hasil Highlight terakhir di samping masih bisa kamu baca &amp; salin, sementara generate baru butuh internet.
            </span>
          </div>
        )}

        {/* 1. Link Berita Utama */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="hl-news-url" className="block text-xs font-bold text-[#1F2428]">
              1. Link Berita 1 (Wajib)
            </label>
            {!hasSecondNews && (
              <button
                type="button"
                onClick={() => setHasSecondNews(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2B6CB0] hover:underline py-1 min-h-[36px] whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Berita 2</span>
              </button>
            )}
          </div>

          <div className="relative">
            <Link2 className="w-4 h-4 text-[#525C68] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="hl-news-url"
              type="url"
              inputMode="url"
              value={newsUrl}
              onChange={(e) => setNewsUrl(e.target.value)}
              placeholder="https://contoh-berita.com/artikel-1"
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
            />
            {newsUrl && (
              <button
                type="button"
                onClick={() => setNewsUrl('')}
                aria-label="Hapus link 1"
                className="w-8 h-8 rounded-lg text-[#525C68] hover:text-[#1F2428] absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {hasSecondNews && (
            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1 min-w-0">
                <Link2 className="w-4 h-4 text-[#525C68] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="url"
                  inputMode="url"
                  value={newsUrl2}
                  onChange={(e) => setNewsUrl2(e.target.value)}
                  placeholder="Link Berita 2 (opsional)"
                  aria-label="Link Berita 2"
                  className="w-full pl-10 pr-3 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setHasSecondNews(false);
                  setNewsUrl2('');
                  setArticleText2('');
                }}
                aria-label="Hapus berita kedua"
                className="w-11 h-11 rounded-2xl bg-white border border-[#C7DDF6] text-[#64748B] hover:text-[#B91C1C] flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* 2. Nama Penyiar (1 atau 2) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="hl-announcer-1" className="block text-xs font-bold text-[#1F2428]">
              2. Nama Penyiar (Wajib)
            </label>
            {!hasSecondAnnouncer && (
              <button
                type="button"
                onClick={() => setHasSecondAnnouncer(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2B6CB0] hover:underline py-1 min-h-[36px] whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Tambah Penyiar 2</span>
              </button>
            )}
          </div>

          <input
            id="hl-announcer-1"
            type="text"
            value={announcer1}
            onChange={(e) => setAnnouncer1(e.target.value)}
            placeholder="Nama Penyiar 1 (misal: Railey)"
            className="w-full px-4 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
          />

          {hasSecondAnnouncer && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={announcer2}
                onChange={(e) => setAnnouncer2(e.target.value)}
                placeholder="Nama Penyiar 2 (misal: Dimas)"
                aria-label="Nama Penyiar 2"
                className="flex-1 min-w-0 px-4 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
              />
              <button
                type="button"
                onClick={() => {
                  setHasSecondAnnouncer(false);
                  setAnnouncer2('');
                }}
                aria-label="Hapus penyiar kedua"
                className="w-11 h-11 rounded-2xl bg-white border border-[#C7DDF6] text-[#64748B] hover:text-[#B91C1C] flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Manual Paste Fallback */}
        {showManualText && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="hl-manual-text" className="text-xs font-bold text-[#1F2428]">
                Tempel Isi Berita 1 Manual
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowManualText(false);
                  setArticleText('');
                  setArticleText2('');
                }}
                className="text-xs text-[#525C68] hover:text-[#1F2428]"
              >
                Sembunyikan
              </button>
            </div>
            <textarea
              id="hl-manual-text"
              rows={4}
              value={articleText}
              onChange={(e) => setArticleText(e.target.value)}
              placeholder="Tempel paragraf isi berita 1 di sini supaya AI bisa merangkumnya secara akurat..."
              className="w-full px-3.5 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
            />
            {hasSecondNews && (
              <textarea
                rows={3}
                value={articleText2}
                onChange={(e) => setArticleText2(e.target.value)}
                placeholder="Tempel paragraf isi berita 2 (opsional)..."
                aria-label="Tempel isi berita 2 manual"
                className="w-full px-3.5 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
              />
            )}
          </div>
        )}

        {!showManualText && (
          <button
            type="button"
            onClick={() => setShowManualText(true)}
            className="text-xs font-medium text-[#3B4C5E] hover:text-[#1F2428] underline underline-offset-2"
          >
            Link nggak bisa dibuka? Tempel isi beritanya manual di sini
          </button>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-2xl bg-white border border-[#FCA5A5] space-y-2.5 text-xs sm:text-sm text-[#B91C1C]"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            {!loading && isOnline && (
              <button
                type="button"
                onClick={() => void generateHighlight()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-xs font-semibold text-[#991B1B] min-h-[36px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#2B6CB0] hover:bg-[#1E5494] text-white text-sm font-semibold disabled:opacity-60 active:scale-[0.99] transition-all min-h-[48px] shadow-xs"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Lagi nyiapin highlight buat kamu...</span>
            </>
          ) : (
            <>
              <Newspaper className="w-4 h-4 text-[#BFDBFE]" />
              <span>Generate Highlight</span>
            </>
          )}
        </button>
      </form>

      {/* Right: Highlight Result Card */}
      <div className="lg:col-span-7">
        {loading && (
          <div className="rounded-3xl bg-white border border-[#E5E9F0] shadow-xs p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-1 h-6" aria-hidden="true">
                <span className="w-1.5 h-3 rounded-full bg-[#3B82F6] eq-bar" />
                <span className="w-1.5 h-5 rounded-full bg-[#60A5FA] eq-bar eq-bar-2" />
                <span className="w-1.5 h-4 rounded-full bg-[#93C5FD] eq-bar eq-bar-3" />
              </div>
              <p className="font-display font-bold text-base text-[#1F2428]">
                Lagi nyiapin naskah Simfoni Highlight buat kamu... ✨
              </p>
            </div>
            <div className="space-y-3 animate-pulse">
              <div className="h-5 bg-[#F1F5F9] rounded-xl w-3/4" />
              <div className="h-4 bg-[#F1F5F9] rounded-xl w-1/2" />
              <div className="h-24 bg-[#F8FAFC] rounded-2xl w-full" />
              <div className="h-20 bg-[#F8FAFC] rounded-2xl w-full" />
            </div>
          </div>
        )}

        {!loading && !result && (
          <div className="rounded-3xl bg-white border border-[#E5E9F0] shadow-xs p-6 sm:p-10 flex flex-col items-center text-center space-y-5">
            <div className="relative w-24 h-24 rounded-3xl bg-[#EAF3FE] border border-[#C7DDF6] flex items-center justify-center">
              <Newspaper className="w-10 h-10 text-[#2B6CB0]" />
              <span className="absolute -bottom-2 -right-2 px-2 py-1 rounded-lg bg-[#2B6CB0] text-[10px] font-mono font-bold text-white">
                5W+1H
              </span>
            </div>

            <svg
              viewBox="0 0 220 26"
              className="w-48 h-6 text-[#93C5FD]"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 13 C18 3, 28 23, 44 13 C60 3, 70 23, 86 13 C102 2, 112 24, 128 13 C144 3, 154 23, 170 13 C186 5, 196 21, 218 13"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="space-y-1.5 max-w-md">
              <h3 className="font-display font-bold text-lg text-[#1F2428]">
                Hmm, belum ada highlight nih.
              </h3>
              <p className="text-sm text-[#525C68] leading-relaxed">
                Tempel link beritanya di sebelah ya, nanti naskah Simfoni Highlight 5W+1H buat Crew SIMFONI langsung muncul sesuai format resmi siaran!
              </p>
            </div>
          </div>
        )}

        {!loading && result && (
          <div className="rounded-3xl bg-white border border-[#E5E9F0] shadow-xs p-5 sm:p-7 space-y-5">
            {result.isDemo && (
              <div className="p-3.5 rounded-2xl bg-[#F6FAFF] border border-[#C7DDF6] flex items-start gap-2.5 text-xs sm:text-sm text-[#1E3A5F]">
                <AlertCircle className="w-4 h-4 text-[#2B6CB0] shrink-0 mt-0.5" />
                <span>
                  <strong>MODE DEMO:</strong> GEMINI_API_KEY belum terhubung di server. Konten di bawah memperlihatkan contoh struktur Simfoni Highlight.
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#2B6CB0]">
              <span>Yeay! Simfoni Highlight kamu udah siap baca on-air! 🎙️</span>
              <span className="text-[#525C68] font-medium">
                Sumber: {result.source}
                {newsUrl && (
                  <>
                    {' · '}
                    <a
                      href={newsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#2B6CB0] hover:underline"
                    >
                      <span>Buka Berita</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </span>
            </div>

            {/* 1. JUDUL BERITA 2 (Paling Atas sesuai format paten) */}
            {result.title2 && (
              <div className="p-4 rounded-2xl bg-[#F6FAFF] border border-[#C7DDF6] space-y-1">
                <div className="text-[11px] font-bold text-[#2B6CB0] uppercase tracking-wider">
                  Judul Berita 2
                </div>
                <p className="font-display font-bold text-base sm:text-lg text-[#1F2428] leading-snug">
                  {result.title2}
                </p>
              </div>
            )}

            {/* 2. Kalimat Pembuka Paten */}
            {result.openerLine && (
              <div className="p-4 rounded-2xl bg-[#EAF3FE] border border-[#C7DDF6]">
                <p className="text-sm sm:text-base font-semibold text-[#1E3A5F]">
                  {result.openerLine}
                </p>
              </div>
            )}

            {/* 3 & 4. JUDUL BERITA 1 + Isi Berita Pertama */}
            <section className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E5E9F0] space-y-3">
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#2B6CB0] uppercase tracking-wider">
                  Judul Berita 1
                </div>
                <h3 className="font-display font-bold text-lg sm:text-xl text-[#1F2428] leading-snug">
                  {result.title}
                </h3>
              </div>

              <div className="space-y-2.5 pt-1 text-sm sm:text-[15px] text-[#1F2428] leading-relaxed">
                {result.dialogue.map((turn, idx) => (
                  <p key={`${turn.speaker}-${idx}`}>
                    {result.dialogue.length > 1 && (
                      <strong className="font-bold text-[#1E4E8C] mr-1.5">
                        {turn.speaker.toUpperCase()}:
                      </strong>
                    )}
                    <span>{turn.text}</span>
                  </p>
                ))}
              </div>
            </section>

            {/* 5 & 6. Visual JEDA "---" dan Isi Berita Kedua */}
            {result.dialogue2 && result.dialogue2.length > 0 && (
              <>
                <div
                  className="flex items-center gap-3 py-1"
                  aria-label="Jeda antarberita"
                >
                  <div className="h-px flex-1 bg-[#C7DDF6]" />
                  <span className="font-mono text-xs font-bold tracking-widest text-[#2B6CB0] px-2">
                    ---
                  </span>
                  <div className="h-px flex-1 bg-[#C7DDF6]" />
                </div>

                <section className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E5E9F0] space-y-2.5 text-sm sm:text-[15px] text-[#1F2428] leading-relaxed">
                  {result.dialogue2.map((turn, idx) => (
                    <p key={`b2-${turn.speaker}-${idx}`}>
                      {result.dialogue2 && result.dialogue2.length > 1 && (
                        <strong className="font-bold text-[#1E4E8C] mr-1.5">
                          {turn.speaker.toUpperCase()}:
                        </strong>
                      )}
                      <span>{turn.text}</span>
                    </p>
                  ))}
                </section>
              </>
            )}

            {/* Info lembut jika baru 1 sumber berita (tidak mengarang berita ke-2) */}
            {result.needsSecondSource && !result.dialogue2?.length && (
              <div className="p-3.5 rounded-2xl bg-[#F6FAFF] border border-[#DCE8F6] text-xs text-[#3B4C5E]">
                Baru 1 sumber berita yang dimasukkan. Kalau ingin pakai format 2 berita lengkap dengan Judul Berita 2 dan jeda <code>---</code>, klik <strong>Tambah Berita 2</strong> lalu tempel link atau teks beritanya.
              </div>
            )}

            {/* 7. Kalimat Penutup Paten */}
            {result.closerLine && (
              <div className="p-4 rounded-2xl bg-[#EAF3FE] border border-[#C7DDF6]">
                <p className="text-sm sm:text-base font-semibold text-[#1E3A5F]">
                  {result.closerLine}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => void generateHighlight()}
                disabled={!isOnline}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] disabled:opacity-50 text-xs sm:text-sm font-semibold text-[#1F2428] min-h-[44px] whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4 text-[#2B6CB0]" />
                <span>Regenerate</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#EAF3FE] hover:bg-[#D4E6FA] text-xs sm:text-sm font-semibold text-[#1E4E8C] min-h-[44px] whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4 text-[#2B6CB0]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Tersalin!' : 'Copy Script'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2B6CB0] hover:bg-[#1E5494] text-xs sm:text-sm font-semibold text-white min-h-[44px] whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                <span>Download TXT</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
