import React, { useState } from 'react';
import { CheckCircle2, Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // When already installed / running standalone, display a clean subtle installed badge
  if (isInstalled) {
    return (
      <div className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#F6FAFF] border border-[#C7DDF6] text-xs sm:text-sm font-semibold text-[#1E4E8C] min-h-[46px] whitespace-nowrap">
        <CheckCircle2 className="w-4 h-4 text-[#2B6CB0] shrink-0" />
        <span>Sudah Terinstal</span>
      </div>
    );
  }

  // Chromium / Android / Desktop native install flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#EAF3FE] hover:bg-[#D4E6FA] border border-[#C7DDF6] text-[#1E4E8C] text-sm font-semibold active:scale-[0.98] transition-all min-h-[46px] whitespace-nowrap"
      >
        <Download className="w-4 h-4 text-[#2B6CB0]" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari guided Add to Home Screen flow (WebKit has no beforeinstallprompt)
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#EAF3FE] hover:bg-[#D4E6FA] border border-[#C7DDF6] text-[#1E4E8C] text-sm font-semibold active:scale-[0.98] transition-all min-h-[46px] whitespace-nowrap"
        >
          <Smartphone className="w-4 h-4 text-[#2B6CB0]" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2428]/45 backdrop-blur-xs p-4"
          >
            <div className="w-full max-w-sm rounded-3xl bg-white border border-[#E5E9F0] p-6 shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-[#2B6CB0]">
                    Panduan iPhone / iPad
                  </div>
                  <h3
                    id="ios-install-title"
                    className="font-display font-bold text-lg text-[#1F2428]"
                  >
                    Install CIMPO LOVERZ
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan instal"
                  className="w-9 h-9 rounded-xl bg-[#F8FAFC] hover:bg-[#EAF3FE] text-[#525C68] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <ol className="space-y-3 text-sm text-[#3B4C5E]">
                <li className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#F6FAFF] border border-[#DCE8F6]">
                  <Share className="w-4 h-4 text-[#2B6CB0] shrink-0 mt-0.5" />
                  <span>
                    1. Ketuk tombol <strong>Share</strong> di bar bawah Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5 p-3 rounded-2xl bg-[#F6FAFF] border border-[#DCE8F6]">
                  <PlusSquare className="w-4 h-4 text-[#2B6CB0] shrink-0 mt-0.5" />
                  <span>
                    2. Gulir ke bawah lalu ketuk <strong>Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 rounded-2xl bg-[#2B6CB0] hover:bg-[#1E5494] text-white text-sm font-semibold min-h-[44px]"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Unsupported desktop/webview environment without native prompt: never render a dead button
  return null;
};
