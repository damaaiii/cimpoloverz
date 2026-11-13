import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AIStudioPage } from './components/AIStudioPage';
import { HomePage } from './components/HomePage';
import { Navigation } from './components/Navigation';
import { ProgramsPage } from './components/ProgramsPage';
import { AIStudioMode, NavTab, SavedDraft } from './types';
import { copyTextToClipboard } from './utils/exportScript';
import {
  deleteDraftFromStorage,
  getSavedDrafts,
  getStoredAnnouncerName,
  saveDraftToStorage,
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

  useEffect(() => {
    setStoredAnnouncerName(announcerName);
  }, [announcerName]);

  const handleNavigate = (tab: NavTab, targetAiMode?: AIStudioMode) => {
    if (targetAiMode) {
      setAiMode(targetAiMode);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDraft = (draft: SavedDraft) => {
    setSavedDrafts(saveDraftToStorage(draft));
  };

  const handleDeleteDraft = (id: string) => {
    setSavedDrafts(deleteDraftFromStorage(id));
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
