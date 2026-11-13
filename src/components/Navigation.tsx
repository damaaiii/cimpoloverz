import React from 'react';
import { Home, Radio, Sparkles } from 'lucide-react';
import { NavTab } from '../types';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  announcerName: string;
  onChangeAnnouncerName: (name: string) => void;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'programs', label: 'Programs', icon: Radio },
  { id: 'ai-studio', label: 'AI Studio', icon: Sparkles },
];

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  announcerName,
  onChangeAnnouncerName,
}) => {
  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden flex items-center justify-between px-4 pt-4 pb-3 bg-white border-b border-[#EDF1F5]">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2.5 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90D9] rounded-xl"
        >
          <span className="w-9 h-9 rounded-xl bg-[#2B6CB0] text-white flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4" />
          </span>
          <span className="flex flex-col">
            <span className="font-display font-bold text-base tracking-tight text-[#1F2428] leading-tight whitespace-nowrap">
              CIMPO LOVERZ
            </span>
            <span className="text-[11px] text-[#525C68] leading-tight whitespace-nowrap">
              Crew SIMFONI · 107,7 FM
            </span>
          </span>
        </button>

        {/* Compact Soft Blue Equalizer */}
        <div
          className="flex items-end gap-1 h-6 px-2.5 py-1.5 rounded-lg bg-[#EAF3FE]"
          aria-hidden="true"
        >
          <span className="w-1 h-3 rounded-full bg-[#3B82F6] eq-bar" />
          <span className="w-1 h-4 rounded-full bg-[#60A5FA] eq-bar eq-bar-2" />
          <span className="w-1 h-2.5 rounded-full bg-[#93C5FD] eq-bar eq-bar-3" />
          <span className="w-1 h-3.5 rounded-full bg-[#2563EB] eq-bar eq-bar-4" />
        </div>
      </header>

      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-68 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-[#F8FAFC] border-r border-[#E5E9F0] p-6 justify-between">
        <div className="space-y-8">
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="flex items-center gap-3 text-left w-full group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90D9] rounded-2xl p-1"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#2B6CB0] text-white flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-xs">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-lg tracking-tight text-[#1F2428] whitespace-nowrap">
                CIMPO LOVERZ
              </div>
              <div className="text-xs text-[#525C68] whitespace-nowrap">
                Create. Speak. Broadcast.
              </div>
            </div>
          </button>

          <nav className="space-y-1.5" aria-label="Navigasi Utama">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 min-h-[44px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90D9] ${
                    isActive
                      ? 'bg-[#2B6CB0] text-white shadow-xs'
                      : 'text-[#525C68] hover:bg-[#EAF3FE] hover:text-[#1F2428]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Announcer Quick Profile Saved in LocalStorage */}
        <div className="bg-white border border-[#E5E9F0] rounded-2xl p-4 space-y-2.5 shadow-xs">
          <label
            htmlFor="sidebar-announcer-name"
            className="block text-xs font-semibold text-[#525C68]"
          >
            Nama Penyiar Crew SIMFONI
          </label>
          <input
            id="sidebar-announcer-name"
            type="text"
            value={announcerName}
            onChange={(e) => onChangeAnnouncerName(e.target.value)}
            placeholder="Misal: Grace"
            className="w-full px-3 py-2 text-sm bg-[#F8FAFC] border border-[#DCE3EC] rounded-xl text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9] focus:bg-white"
          />
          <p className="text-[11px] text-[#525C68] leading-relaxed">
            Biar langsung keisi otomatis pas bikin highlight atau script siaran!
          </p>
        </div>
      </aside>

      {/* Mobile Fixed Bottom Navigation (Thumb-friendly, 3 equal tabs) */}
      <nav
        aria-label="Navigasi Bawah"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E9F0] pb-safe"
      >
        <div className="grid grid-cols-3 h-16 max-w-lg mx-auto px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90D9] ${
                  isActive ? 'text-[#2B6CB0]' : 'text-[#64748B] hover:text-[#1F2428]'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-12 h-7 rounded-xl transition-colors duration-150 ${
                    isActive ? 'bg-[#EAF3FE] text-[#2B6CB0]' : 'bg-transparent'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span
                  className={`text-[11px] leading-none whitespace-nowrap ${
                    isActive ? 'font-bold text-[#1E4E8C]' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
