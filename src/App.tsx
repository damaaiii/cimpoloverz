import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { AIStudioPage } from './components/AIStudioPage';
import { HomePage } from './components/HomePage';
import { Navigation } from './components/Navigation';
import { ProgramsPage } from './components/ProgramsPage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAUpdate } from './hooks/usePWAUpdate';
import { AIStudioMode, NavTab, SavedDraft } from './types';
import { copyTextToClipboard } from './utils/exportScript';
import {
  deleteDraftFromIndexedDB,
  loadDraftsFromIndexedDB,
  saveDraftToIndexedDB,
  syncProgramsSnapshotToIndexedDB,
} from './utils/offlineDb';
import {
  deleteDraftFromStorage,
  getSavedDrafts,
  getStoredAnnouncerName,
  saveDraftToStorage,
  setSavedDraftsInStorage,
  setStoredAnnouncerName,
} from './utils/storage';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [aiMode, setAiMode] = useState<AIStudioMode>('highlight');
  const [announcerName, setAnnouncerName] = useState<string>(() =>
    getStoredAnnouncerName()
  );
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>(() =>
    getSavedDrafts()
  );

  const isOnline = useOnlineStatus();
  const { needRefresh, isUpdating, updateNow, dismissUpdate } = usePWAUpdate();

  useEffect(() => {
    setStoredAnnouncerName(announcerName);
  }, [announcerName]);

  // Sync offline IndexedDB stores for programs/flowcharts and saved drafts cleanly
  useEffect(() => {
    void syncProgramsSnapshotToIndexedDB();
    void loadDraftsFromIndexedDB().then((idbDrafts) => {
      if (idbDrafts.length > 0 && getSavedDrafts().length === 0) {
        setSavedDrafts(idbDrafts);
        setSavedDraftsInStorage(idbDrafts);
      }
    });
  }, []);

  const handleNavigate = (tab: NavTab, targetAiMode?: AIStudioMode) => {
    if (targetAiMode) {
      setAiMode(targetAiMode);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDraft = (draft: SavedDraft) => {
    setSavedDrafts(saveDraftToStorage(draft));
    void saveDraftToIndexedDB(draft);
  };

  const handleDeleteDraft = (id: string) => {
    setSavedDrafts(deleteDraftFromStorage(id));
    void deleteDraftFromIndexedDB(id);
  };

  const handleCopyDraft = async (text: string) => {
    await copyTextToClipboard(text);
  };

  return (
    <div className="min-h-screen bg-white text-[#1F2428] flex flex-col lg:flex-row">
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => handleNavigate(tab)}
        announcerName={announcerName}
        onChangeAnnouncerName={setAnnouncerName}
      />

      <div className="flex-1 min-w-0 flex flex-col justify-between pb-20 lg:pb-6 bg-white">
        {/* Safe Offline & SW Update Banners in Clean White & Soft Blue */}
        {(!isOnline || needRefresh) && (
          <div className="px-4 sm:px-6 lg:px-10 pt-3">
            <div className="max-w-6xl mx-auto space-y-2">
              {!isOnline && (
                <div
                  role="status"
                  className="px-4 py-2.5 rounded-2xl bg-[#EAF3FE] border border-[#C7DDF6] flex items-center gap-2.5 text-xs sm:text-sm text-[#1E3A5F]"
                >
                  <WifiOff className="w-4 h-4 text-[#2B6CB0] shrink-0" />
                  <span>
                    <strong>Offline Mode</strong> — Programs, flowchart, dan naskah tersimpan tetap bisa diakses.
                  </span>
                </div>
              )}

              {needRefresh && (
                <div
                  role="status"
                  className="px-4 py-2.5 rounded-2xl bg-[#F6FAFF] border border-[#93C5FD] flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-[#1E3A5F]"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#2B6CB0] shrink-0" />
                    <span>
                      <strong>Update tersedia</strong> — Versi terbaru CIMPO LOVERZ siap digunakan tanpa menghapus naskah tersimpan.
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => void updateNow()}
                      disabled={isUpdating}
                      className="px-3.5 py-1.5 rounded-xl bg-[#2B6CB0] hover:bg-[#1E5494] text-white text-xs font-semibold min-h-[36px] disabled:opacity-60 whitespace-nowrap"
                    >
                      {isUpdating ? 'Memperbarui...' : 'Perbarui Sekarang'}
                    </button>
                    <button
                      type="button"
                      onClick={dismissUpdate}
                      aria-label="Tutup pemberitahuan update"
                      className="w-8 h-8 rounded-lg text-[#525C68] hover:bg-[#EAF3FE] flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <main className="px-4 sm:px-6 lg:px-10 pt-3 sm:pt-6 lg:pt-8">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeTab === 'home' && (
                  <HomePage
                    announcerName={announcerName}
                    onChangeAnnouncerName={setAnnouncerName}
                    onNavigate={handleNavigate}
                    savedDrafts={savedDrafts}
                    onCopyDraft={handleCopyDraft}
                    onDeleteDraft={handleDeleteDraft}
                  />
                )}

                {activeTab === 'programs' && <ProgramsPage />}

                {activeTab === 'ai-studio' && (
                  <AIStudioPage
                    mode={aiMode}
                    onChangeMode={setAiMode}
                    defaultAnnouncerName={announcerName}
                    onSaveDraft={handleSaveDraft}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Quiet Consistent Brand Footer */}
        <footer className="px-4 sm:px-6 lg:px-10 pt-6 pb-4">
          <div className="max-w-6xl mx-auto border-t border-[#E5E9F0] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#525C68]">
            <div className="font-semibold text-[#1F2428]">
              CIMPO LOVERZ · Create. Speak. Broadcast.
            </div>
            <div>Aplikasi Internal Crew SIMFONI · 107,7 SIMFONI FM</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
