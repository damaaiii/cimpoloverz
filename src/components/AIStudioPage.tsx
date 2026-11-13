import React from 'react';
import { Mic, Newspaper } from 'lucide-react';
import { AIStudioMode, SavedDraft } from '../types';
import { AIHighlightPanel } from './AIHighlightPanel';
import { AIScriptPanel } from './AIScriptPanel';

interface AIStudioPageProps {
  mode: AIStudioMode;
  onChangeMode: (mode: AIStudioMode) => void;
  defaultAnnouncerName: string;
  onSaveDraft: (draft: SavedDraft) => void;
}

export const AIStudioPage: React.FC<AIStudioPageProps> = ({
  mode,
  onChangeMode,
  defaultAnnouncerName,
  onSaveDraft,
}) => {
  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-[#2B6CB0]">
            Asisten Naskah Crew SIMFONI
          </div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#1F2428]">
            AI Studio CIMPO LOVERZ
          </h1>
          <p className="text-sm sm:text-base text-[#525C68] max-w-xl">
            Yuk, pilih mode yang pas buat siaranmu: sulap berita jadi highlight atau racik script talk seru per segmen!
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="inline-grid grid-cols-2 p-1.5 rounded-2xl bg-[#F1F5F9] border border-[#E5E9F0] w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onChangeMode('highlight')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[44px] whitespace-nowrap ${
              mode === 'highlight'
                ? 'bg-white text-[#1E4E8C] shadow-xs'
                : 'text-[#525C68] hover:text-[#1F2428]'
            }`}
          >
            <Newspaper className="w-4 h-4 text-[#2B6CB0]" />
            <span>AI Highlight</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('script')}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[44px] whitespace-nowrap ${
              mode === 'script'
                ? 'bg-white text-[#1E4E8C] shadow-xs'
                : 'text-[#525C68] hover:text-[#1F2428]'
            }`}
          >
            <Mic className="w-4 h-4 text-[#2B6CB0]" />
            <span>AI Script</span>
          </button>
        </div>
      </div>

      {mode === 'highlight' ? (
        <AIHighlightPanel
          defaultAnnouncerName={defaultAnnouncerName}
          onSaveDraft={onSaveDraft}
        />
      ) : (
        <AIScriptPanel
          defaultAnnouncerName={defaultAnnouncerName}
          onSaveDraft={onSaveDraft}
        />
      )}
    </div>
  );
};
