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
  X,
} from 'lucide-react';
import { HighlightResult, SavedDraft } from '../types';
import { copyTextToClipboard, downloadTextFile } from '../utils/exportScript';

interface AIHighlightPanelProps {
  defaultAnnouncerName: string;
  onSaveDraft: (draft: SavedDraft) => void;
}

export const AIHighlightPanel: React.FC<AIHighlightPanelProps> = ({
  defaultAnnouncerName,
  onSaveDraft,
}) => {
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
  const [result, setResult] = useState<HighlightResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!announcer1 && defaultAnnouncerName) {
      setAnnouncer1(defaultAnnouncerName);
    }
  }, [defaultAnnouncerName, announcer1]);

  const formatHighlightAsText = (data: HighlightResult): string => {
    const lines: string[] = [];

    if (data.title2) {
      lines.push(`[TEASER BERITA 2] ${data.title2}`);
    }
    if (data.openerLine) {
      lines.push(data.openerLine);
      lines.push('');
    }
    lines.push(`JUDUL BERITA 1: ${data.title}`);
    lines.push(`SUMBER: ${data.source}`);
    lines.push('');
    lines.push(
      ...data.dialogue.map((turn) => `${turn.speaker.toUpperCase()}:\n${turn.text}\n`)
    );

    if (data.dialogue2 && data.dialogue2.length > 0) {
      lines.push('—');
      if (data.title2) {
        lines.push(`JUDUL BERITA 2: ${data.title2}`);
      }
      lines.push(
        ...data.dialogue2.map((turn) => `${turn.speaker.toUpperCase()}:\n${turn.text}\n`)
      );
    }

    if (data.closerLine) {
      lines.push(data.closerLine);
    }

    return lines.join('\n').trim();
  };

  const generateHighlight = async () => {
    const trimmedUrl = newsUrl.trim();
    const trimmedUrl2 = hasSecondNews ? newsUrl2.trim() : '';
    const p1 = announcer1.trim();
    const p2 = hasSecondAnnouncer ? announcer2.trim() : '';

    if (!trimmedUrl && articleText.trim().length < 40) {
      setErrorMsg('Tempel link beritanya dulu di sini, ya!');
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

      const payload = (await response.json()) as HighlightResult & {
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        if (payload.code === 'URL_UNREACHABLE') {
          setShowManualText(true);
        }
        setErrorMsg(payload.error || 'Waduh, gagal memproses beritanya. Coba lagi ya.');
        return;
      }

      setResult(payload);
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
      setErrorMsg('Koneksi ke server lagi terganggu nih. Cek jaringan kamu lalu coba lagi, ya.');
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
            Tempel link beritanya di sini, ya! AI bakal rangkumin unsur 5W+1H sepanjang 4–8 baris dengan format siaran SIMFONI.
          </p>
        </div>

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
            className="p-3.5 rounded-2xl bg-white border border-[#FCA5A5] flex items-start gap-2.5 text-xs sm:text-sm text-[#B91C1C]"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
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
              <span>Lagi nyiapin script buat kamu...</span>
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
                Lagi nyiapin script highlight buat kamu... ✨
              </p>
            </div>
            <div className="space-y-3 animate-pulse">
              <div className="h-5 bg-[#F1F5F9] rounded-xl w-3/4" />
              <div className="h-4 bg-[#F1F5F9] rounded-xl w-1/3" />
              <div className="h-20 bg-[#F8FAFC] rounded-2xl w-full" />
              <div className="h-28 bg-[#F8FAFC] rounded-2xl w-full" />
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
                Tempel link beritanya di sebelah ya, nanti ringkasan fakta 5W+1H dan naskah Simfoni Highlight buat Crew SIMFONI langsung muncul di sini!
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

            <div className="text-xs font-semibold text-[#2B6CB0]">
              Yeay! Highlight berita kamu udah siap dibaca! 🎙️
            </div>

            {/* Teaser Berita 2 if present */}
            {result.title2 && (
              <div className="p-3 rounded-2xl bg-[#F6FAFF] border border-[#C7DDF6] text-xs sm:text-sm text-[#1F2428]">
                <span className="font-bold text-[#2B6CB0]">Teaser Berita 2: </span>
                {result.title2}
              </div>
            )}

            {/* Opener */}
            {result.openerLine && (
              <div className="p-3.5 rounded-2xl bg-[#EAF3FE] border border-[#C7DDF6] space-y-0.5">
                <div className="text-[11px] font-bold text-[#2B6CB0]">Pembuka:</div>
                <p className="text-sm sm:text-base font-semibold text-[#1F2428]">
                  {result.openerLine}
                </p>
              </div>
            )}

            {/* News 1 Metadata */}
            <div className="space-y-2 pb-4 border-b border-[#EDF1F5]">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2B6CB0]">
                <span>Sumber: {result.source}</span>
                {newsUrl && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={newsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <span>Buka Berita Asli</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </div>
              <h3 className="font-display font-bold text-xl text-[#1F2428] leading-snug">
                {result.title}
              </h3>
              <p className="text-sm text-[#425466] leading-relaxed bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E5E9F0]">
                <strong className="text-[#1F2428]">Inti Berita (5W+1H): </strong>
                {result.summary}
              </p>
            </div>

            {/* Dialogue Output 1 */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#525C68] tracking-wide">
                Isi Berita 1 (Siap Baca 4–8 Baris)
              </div>
              <div className="space-y-3">
                {result.dialogue.map((turn, idx) => (
                  <div
                    key={`${turn.speaker}-${idx}`}
                    className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E9F0] space-y-1"
                  >
                    <div className="text-xs font-bold text-[#2B6CB0] tracking-wide">
                      {turn.speaker.toUpperCase()}:
                    </div>
                    <p className="text-sm sm:text-base text-[#1F2428] leading-relaxed">
                      {turn.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Dialogue Output 2 (if Berita 2 provided) */}
            {result.dialogue2 && result.dialogue2.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-[#EDF1F5]">
                <div className="text-xs font-bold text-[#525C68] tracking-wide">
                  Jeda (—) · Isi Berita 2{result.title2 ? `: ${result.title2}` : ''}
                </div>
                <div className="space-y-3">
                  {result.dialogue2.map((turn, idx) => (
                    <div
                      key={`b2-${turn.speaker}-${idx}`}
                      className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E9F0] space-y-1"
                    >
                      <div className="text-xs font-bold text-[#2B6CB0] tracking-wide">
                        {turn.speaker.toUpperCase()}:
                      </div>
                      <p className="text-sm sm:text-base text-[#1F2428] leading-relaxed">
                        {turn.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Closer */}
            {result.closerLine && (
              <div className="p-3.5 rounded-2xl bg-[#EAF3FE] border border-[#C7DDF6] space-y-0.5">
                <div className="text-[11px] font-bold text-[#2B6CB0]">Penutup:</div>
                <p className="text-sm sm:text-base font-semibold text-[#1F2428]">
                  {result.closerLine}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => void generateHighlight()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs sm:text-sm font-semibold text-[#1F2428] min-h-[44px] whitespace-nowrap"
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
