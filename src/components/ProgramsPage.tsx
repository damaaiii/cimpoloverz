import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Link2,
  Mic,
  Radio,
} from 'lucide-react';
import {
  OFFICIAL_PROGRAMS,
  PROGRAM_CATEGORIES,
  PROGRAM_FLOWCHARTS,
} from '../data/programsData';
import { ProgramCategory, RadioProgram } from '../types';
import { FlowchartViewer } from './FlowchartViewer';

export const ProgramsPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'Semua' | ProgramCategory>('Semua');
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  const selectedProgram = OFFICIAL_PROGRAMS.find((p) => p.id === selectedProgramId) || null;

  if (selectedProgram) {
    const flowchart = PROGRAM_FLOWCHARTS[selectedProgram.flowchartId];

    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedProgramId(null)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-[#E5E9F0] hover:bg-[#F6FAFF] hover:border-[#C7DDF6] text-sm font-semibold text-[#1F2428] min-h-[44px] whitespace-nowrap transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-[#2B6CB0]" />
            <span>Kembali ke Daftar Program</span>
          </button>

          <span className="text-xs font-medium text-[#525C68]">
            {selectedProgram.category} · {flowchart?.hours.length || 0} Jam Siaran
          </span>
        </div>

        {/* Program Header Card */}
        <section className="rounded-3xl bg-[#F6FAFF] border border-[#D4E4F7] p-5 sm:p-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#525C68]">
            <span>{selectedProgram.scheduleDay}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#1E4E8C]">
              <Clock className="w-3.5 h-3.5 text-[#2B6CB0]" />
              {selectedProgram.scheduleTime}
            </span>
          </div>

          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#1F2428] [text-wrap:balance]">
            {selectedProgram.name}
          </h1>

          <p className="text-sm sm:text-base text-[#425466] leading-relaxed max-w-3xl">
            {selectedProgram.summary}
          </p>

          {/* Program Segments */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E9F0] space-y-1.5">
            <div className="text-xs font-bold text-[#1F2428]">Segmen Program:</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#525C68]">
              {selectedProgram.segmentsSummary.map((seg, i) => (
                <span key={i}>
                  {i > 0 && <span className="mr-3 text-[#CBD5E1]">·</span>}
                  {seg}
                </span>
              ))}
            </div>
          </div>

          {selectedProgram.sharedFlowchartNote && (
            <div className="p-3.5 rounded-2xl bg-[#EAF3FE] border border-[#C7DDF6] flex items-start gap-2.5 text-xs sm:text-sm text-[#1E3A5F]">
              <Link2 className="w-4 h-4 text-[#2B6CB0] shrink-0 mt-0.5" />
              <span>
                English Day dan Yaumul Arabi menggunakan alur flowchart siaran yang sama.
              </span>
            </div>
          )}

          {selectedProgram.tandemRuleNote && (
            <div className="p-3.5 rounded-2xl bg-white border border-[#D4E4F7] flex items-start gap-2.5 text-xs sm:text-sm text-[#1E3A5F]">
              <Mic className="w-4 h-4 text-[#2B6CB0] shrink-0 mt-0.5" />
              <span>Program Freeline dibawakan oleh 1 penyiar (solo).</span>
            </div>
          )}
        </section>

        {/* Visual Flowchart Viewer */}
        {flowchart ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-lg sm:text-xl text-[#1F2428]">
                Flowchart Alur Siaran
              </h2>
              <span className="text-xs text-[#525C68] tabular-nums">
                {flowchart.hours.reduce((acc, h) => acc + h.steps.length, 0)} tahapan ·{' '}
                {flowchart.headerTitle}
              </span>
            </div>

            <FlowchartViewer flowchart={flowchart} programName={selectedProgram.name} />
          </section>
        ) : (
          <div className="p-6 rounded-3xl bg-white border border-[#E5E9F0] text-sm text-[#525C68]">
            Hmm, data flowchart untuk program ini belum ditemukan.
          </div>
        )}
      </div>
    );
  }

  const visibleCategories =
    activeCategory === 'Semua' ? PROGRAM_CATEGORIES : [activeCategory];

  return (
    <div className="space-y-6 pb-8">
      <section className="space-y-2">
        <div className="text-xs font-semibold text-[#2B6CB0]">
          Panduan Siaran Crew SIMFONI · {OFFICIAL_PROGRAMS.length} Program
        </div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#1F2428]">
          Mau kepoin program apa nih? 📻
        </h1>
        <p className="text-sm sm:text-base text-[#525C68] max-w-2xl leading-relaxed">
          Ketuk salah satu program di bawah untuk cek jadwal segmen dan alur flowchart siaran yang bisa kamu zoom dan geser langsung di HP.
        </p>
      </section>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['Semua', ...PROGRAM_CATEGORIES] as const).map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors min-h-[44px] whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[#2B6CB0] text-white shadow-xs'
                  : 'bg-white border border-[#E5E9F0] text-[#525C68] hover:text-[#1F2428] hover:bg-[#F6FAFF]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Categorized Programs */}
      <div className="space-y-8">
        {visibleCategories.map((category, catIdx) => {
          const items: RadioProgram[] = OFFICIAL_PROGRAMS.filter(
            (p) => p.category === category
          );
          const prefixLetter =
            ['A', 'B', 'C'][PROGRAM_CATEGORIES.indexOf(category)] || String(catIdx + 1);

          return (
            <section key={category} className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E9F0] pb-2">
                <h2 className="font-display font-bold text-lg sm:text-xl text-[#1F2428]">
                  {prefixLetter}. {category}
                </h2>
                <span className="text-xs text-[#525C68] tabular-nums">
                  {items.length} program
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {items.map((program) => (
                  <button
                    key={program.id}
                    type="button"
                    onClick={() => setSelectedProgramId(program.id)}
                    className="group text-left p-5 rounded-3xl bg-white border border-[#E5E9F0] hover:border-[#6BA8E5] shadow-xs transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A90D9] flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#525C68]">
                        <span className="inline-flex items-center gap-1 font-medium text-[#1F2428]">
                          <Radio className="w-3.5 h-3.5 text-[#2B6CB0]" />
                          {program.scheduleDay}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{program.scheduleTime}</span>
                      </div>

                      <h3 className="font-display font-bold text-base sm:text-lg text-[#1F2428]">
                        {program.name}
                      </h3>

                      <p className="text-xs sm:text-sm text-[#525C68] line-clamp-2 leading-relaxed">
                        {program.summary}
                      </p>

                      {(program.sharedFlowchartNote || program.tandemRuleNote) && (
                        <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#2B6CB0]">
                          {program.sharedFlowchartNote && <span>Flowchart Bersama (ED / YA)</span>}
                          {program.tandemRuleNote && <span>Khusus 1 Penyiar</span>}
                        </div>
                      )}
                    </div>

                    <span className="w-10 h-10 rounded-2xl bg-[#F6FAFF] group-hover:bg-[#2B6CB0] group-hover:text-white text-[#2B6CB0] flex items-center justify-center shrink-0 transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
