import React, { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Mic,
  Newspaper,
  Radio,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { OFFICIAL_PROGRAMS } from '../data/programsData';
import { AIStudioMode, NavTab, SavedDraft } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HomePageProps {
  announcerName: string;
  onChangeAnnouncerName: (name: string) => void;
  onNavigate: (tab: NavTab, aiMode?: AIStudioMode) => void;
  savedDrafts: SavedDraft[];
  onCopyDraft: (text: string) => Promise<void>;
  onDeleteDraft: (id: string) => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export const HomePage: React.FC<HomePageProps> = ({
  announcerName,
  onChangeAnnouncerName,
  onNavigate,
  savedDrafts,
  onCopyDraft,
  onDeleteDraft,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftNameInput, setDraftNameInput] = useState(announcerName);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const greeting = getTimeGreeting();
  const displayName = announcerName.trim() || 'Crew SIMFONI';

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeAnnouncerName(draftNameInput.trim());
    setEditingName(false);
  };

  const handleCopy = async (draft: SavedDraft) => {
    await onCopyDraft(draft.content);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-8 pb-6">
      {/* Clean White & Soft Blue Modern Radio Hero */}
      <section className="rounded-3xl bg-white border border-[#E5E9F0] shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-[#525C68]">
                <span className="text-[#2B6CB0] font-semibold">Crew SIMFONI FM</span>
                <span aria-hidden="true">·</span>
                <span>107,7 The Power Hits Station</span>
                <span aria-hidden="true">·</span>
                <span>{greeting}</span>
              </div>

              <div className="space-y-2">
                <h1 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-[2.75rem] tracking-tight text-[#1F2428] leading-[1.12] [text-wrap:balance]">
                  CIMPO LOVERZ
                </h1>
                <p className="font-display font-semibold text-lg sm:text-xl text-[#2B6CB0]">
                  Create. Speak. Broadcast.
                </p>
              </div>

              <div className="space-y-2 max-w-xl">
                <p className="text-base sm:text-lg font-semibold text-[#1F2428]">
                  Haii {displayName}, siap siaran hari ini? 🎙️
                </p>
                <p className="text-sm sm:text-base text-[#525C68] leading-relaxed">
                  Teman setia Crew SIMFONI sebelum masuk ruang siar! Kepoin flowchart{' '}
                  {OFFICIAL_PROGRAMS.length} program, sulap link berita jadi highlight, atau bikin
                  script seru buat menyapa Sobat Muda bareng AI Studio.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('ai-studio', 'script')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#2B6CB0] hover:bg-[#1E5494] text-white text-sm font-semibold active:scale-[0.98] transition-all min-h-[46px] whitespace-nowrap shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-[#BFDBFE]" />
                <span>Yuk, bikin script!</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('programs')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#F6FAFF] border border-[#C7DDF6] text-[#1E4E8C] text-sm font-semibold hover:bg-[#EAF3FE] active:scale-[0.98] transition-all min-h-[46px] whitespace-nowrap"
              >
                <Radio className="w-4 h-4 text-[#2B6CB0]" />
                <span>Cek Program &amp; Flowchart</span>
              </button>

              <PWAInstallButton />

              {!editingName ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraftNameInput(announcerName);
                    setEditingName(true);
                  }}
                  className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-[#525C68] hover:bg-[#F1F5F9] min-h-[44px] whitespace-nowrap"
                >
                  <UserCheck className="w-4 h-4 text-[#2B6CB0]" />
                  <span>{announcerName ? `Penyiar: ${announcerName}` : 'Set Nama Kamu'}</span>
                </button>
              ) : (
                <form
                  onSubmit={handleSaveName}
                  className="lg:hidden flex items-center gap-2 w-full sm:w-auto"
                >
                  <input
                    type="text"
                    value={draftNameInput}
                    onChange={(e) => setDraftNameInput(e.target.value)}
                    placeholder="Nama penyiar kamu..."
                    autoFocus
                    className="flex-1 min-w-0 px-3.5 py-2.5 text-sm bg-[#F8FAFC] border border-[#DCE3EC] rounded-xl text-[#1F2428] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-[#2B6CB0] text-white text-xs font-semibold min-h-[44px] whitespace-nowrap"
                  >
                    Simpan
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right: Clean White & Soft Blue Brand Panel (Zero non-functional icon buttons) */}
          <div className="lg:col-span-5 relative bg-[#EAF3FE] border-t lg:border-t-0 lg:border-l border-[#E5E9F0] p-6 sm:p-8 flex flex-col justify-between gap-6 overflow-hidden">
            {/* Soft Blue Geometric Ornaments */}
            <div
              className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-[#D2E6FC]/80 pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-14 -left-10 w-36 h-36 rounded-3xl rotate-12 bg-white/55 pointer-events-none"
              aria-hidden="true"
            />

            {/* Top Editorial Line */}
            <div className="relative z-10 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold tracking-wide text-[#2B6CB0]">
                ON-AIR COMPANION
              </span>
              <span className="font-mono text-xs font-bold text-[#1E3A5F]">107,7 FM</span>
            </div>

            {/* Center: Official SIMFONI FM Logo Card */}
            <div className="relative z-10 rounded-2xl bg-white border border-[#D4E4F7] p-6 flex flex-col items-center justify-center text-center gap-4 shadow-xs">
              {!logoFailed ? (
                <img
                  src="/assets/aistudio/LOGO_SIMFONI_7c8bb047.png"
                  alt="Logo Resmi 107,7 SIMFONI FM The Power Hits Station"
                  onError={() => setLogoFailed(true)}
                  className="h-24 sm:h-28 w-auto object-contain"
                />
              ) : (
                <div className="py-3 flex flex-col items-center gap-2">
                  <Radio className="w-10 h-10 text-[#2B6CB0]" />
                  <span className="font-display font-extrabold text-xl text-[#1F2428]">
                    107,7 SIMFONI FM
                  </span>
                </div>
              )}

              {/* Clean SVG Waveform & Soft Blue Equalizer */}
              <div className="w-full pt-3 border-t border-[#EDF2F7] flex items-center justify-between gap-4">
                <svg
                  viewBox="0 0 180 28"
                  className="w-full h-7 text-[#6BA8E5]"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 14 C14 4, 22 24, 34 14 C46 4, 54 24, 66 14 C78 2, 88 26, 100 14 C112 4, 120 24, 132 14 C144 5, 152 23, 164 14 L178 14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="flex items-end gap-1 h-6 shrink-0" aria-hidden="true">
                  <span className="w-1.5 h-3 rounded-full bg-[#3B82F6] eq-bar" />
                  <span className="w-1.5 h-5 rounded-full bg-[#60A5FA] eq-bar eq-bar-2" />
                  <span className="w-1.5 h-2.5 rounded-full bg-[#93C5FD] eq-bar eq-bar-3" />
                  <span className="w-1.5 h-4 rounded-full bg-[#2563EB] eq-bar eq-bar-4" />
                  <span className="w-1.5 h-3 rounded-full bg-[#60A5FA] eq-bar eq-bar-5" />
                </div>
              </div>
            </div>

            {/* Bottom Station Metadata */}
            <div className="relative z-10 flex items-center justify-between text-xs font-medium text-[#3B5570]">
              <span>Dengerin lagu enak pilihanmu</span>
              <span className="font-semibold text-[#1E3A5F]">
                {OFFICIAL_PROGRAMS.length} Program Siaran
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Quick Access Feature Cards (Programs, AI Highlight, AI Script) */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-[#1F2428]">
            Mau Ngapain Sebelum On-Air? 🎧
          </h2>
          <p className="text-sm text-[#525C68] mt-0.5">
            Pilih langsung fitur andalan Crew SIMFONI di bawah ini.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Card 1: Programs (Full-height featured Light Blue card) */}
          <button
            type="button"
            onClick={() => onNavigate('programs')}
            className="md:col-span-4 group text-left p-6 rounded-3xl bg-[#EAF3FE] border border-[#C7DDF6] hover:border-[#4A90D9] shadow-xs transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90D9] flex flex-col justify-between gap-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#C7DDF6] flex items-center justify-center text-[#2B6CB0] shrink-0">
                <Radio className="w-6 h-6" />
              </div>
              <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#2B6CB0] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#2B6CB0]">
                {OFFICIAL_PROGRAMS.length} Program · Daily · Weekend · Ramadan
              </div>
              <h3 className="font-display font-bold text-xl text-[#1F2428]">
                Programs & Flowchart
              </h3>
              <p className="text-sm text-[#3B4C5E] leading-relaxed">
                Mau kepoin program apa nih? Cek alur siaran lewat flowchart lengkap yang bisa di-zoom & digeser di HP.
              </p>
            </div>
          </button>

          {/* Right Column Split: AI Highlight & AI Script */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 2: AI Highlight (Pure White card with subtle shadow & Soft Blue accent) */}
            <button
              type="button"
              onClick={() => onNavigate('ai-studio', 'highlight')}
              className="group text-left p-6 rounded-[2rem] bg-white border border-[#E5E9F0] hover:border-[#6BA8E5] shadow-xs transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90D9] flex flex-col justify-between gap-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#EAF3FE] border border-[#D4E6FA] flex items-center justify-center text-[#2B6CB0] shrink-0">
                  <Newspaper className="w-6 h-6" />
                </div>
                <span className="w-9 h-9 rounded-full bg-[#F6FAFF] flex items-center justify-center text-[#2B6CB0] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#2B6CB0]">
                  AI Studio · Berita ke On-Air
                </div>
                <h3 className="font-display font-bold text-xl text-[#1F2428]">
                  AI Highlight
                </h3>
                <p className="text-sm text-[#525C68] leading-relaxed">
                  Tempel link berita (bisa 1 atau 2 berita), langsung jadi Simfoni Highlight 5W+1H yang siap dibacain!
                </p>
              </div>
            </button>

            {/* Card 3: AI Script (Ice Blue tinted card) */}
            <button
              type="button"
              onClick={() => onNavigate('ai-studio', 'script')}
              className="group text-left p-6 rounded-[2rem] bg-[#F6FAFF] border border-[#D4E4F7] hover:border-[#4A90D9] shadow-xs transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90D9] flex flex-col justify-between gap-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#D4E4F7] flex items-center justify-center text-[#2B6CB0] shrink-0">
                  <Mic className="w-6 h-6" />
                </div>
                <span className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#2B6CB0] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#2B6CB0]">
                  AI Studio · Naskah Talk & Segmen
                </div>
                <h3 className="font-display font-bold text-xl text-[#1F2428]">
                  AI Script
                </h3>
                <p className="text-sm text-[#425466] leading-relaxed">
                  Bikin script talk santai buat menyapa Sobat Muda lengkap per segmen dan bisa langsung kamu edit.
                </p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Saved Local Drafts */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-[#1F2428]">
            Draf Naskah Terakhir
          </h2>
          {savedDrafts.length > 0 && (
            <span className="text-xs text-[#525C68] tabular-nums">
              {savedDrafts.length} tersimpan di perangkat
            </span>
          )}
        </div>

        {savedDrafts.length === 0 ? (
          <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E5E9F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-[#525C68]">
              Hmm, belum ada draf naskah nih. Yuk, coba bikin highlight atau script siaran pertamamu!
            </p>
            <button
              type="button"
              onClick={() => onNavigate('ai-studio', 'highlight')}
              className="px-4 py-2.5 rounded-xl bg-[#EAF3FE] border border-[#C7DDF6] text-xs font-semibold text-[#1E4E8C] hover:bg-[#DCEBFB] min-h-[42px] whitespace-nowrap self-start sm:self-center transition-colors"
            >
              Coba AI Studio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedDrafts.slice(0, 4).map((draft) => (
              <div
                key={draft.id}
                className="p-4 rounded-2xl bg-white border border-[#E5E9F0] shadow-xs flex items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-xs text-[#525C68] flex items-center gap-1.5">
                    <span className="text-[#2B6CB0] font-semibold">
                      {draft.type === 'highlight' ? 'AI Highlight' : 'AI Script'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{draft.createdAt}</span>
                  </div>
                  <p className="font-semibold text-sm text-[#1F2428] truncate">
                    {draft.title}
                  </p>
                  <p className="text-xs text-[#525C68] line-clamp-2 leading-relaxed">
                    {draft.content}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(draft)}
                    aria-label="Salin naskah tersimpan"
                    className="w-10 h-10 rounded-xl bg-[#F8FAFC] hover:bg-[#EAF3FE] text-[#1F2428] flex items-center justify-center transition-colors"
                  >
                    {copiedId === draft.id ? (
                      <Check className="w-4 h-4 text-[#2B6CB0]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(draft.id)}
                    aria-label="Hapus draf tersimpan"
                    className="w-10 h-10 rounded-xl bg-[#F8FAFC] hover:bg-[#FEE2E2] text-[#64748B] hover:text-[#B91C1C] flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
