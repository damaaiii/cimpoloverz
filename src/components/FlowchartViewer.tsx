import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Disc3,
  FileText,
  GitBranch,
  Hand,
  Megaphone,
  Mic,
  Music,
  Newspaper,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FlowchartHourBlock, FlowchartSlotKind, FlowchartStep, ProgramFlowchart } from '../types';

interface FlowchartViewerProps {
  flowchart: ProgramFlowchart;
  programName: string;
}

const SLOT_STYLE: Record<
  FlowchartSlotKind,
  {
    container: string;
    iconBox: string;
    accentText: string;
  }
> = {
  start: {
    container: 'rounded-full bg-[#DCEBFB] border-[#7FB3E8]',
    iconBox: 'bg-[#2B6CB0] text-white rounded-full',
    accentText: 'text-[#1E4E8C]',
  },
  toh: {
    container: 'rounded-2xl bg-[#EAF3FE] border-[#6BA8E5]',
    iconBox: 'bg-[#2B6CB0] text-white rounded-xl',
    accentText: 'text-[#1E4E8C]',
  },
  talkset: {
    container: 'rounded-2xl bg-[#F4F8FD] border-[#9EC5ED]',
    iconBox: 'bg-[#3B82F6] text-white rounded-xl',
    accentText: 'text-[#1D5FA7]',
  },
  news: {
    container: 'rounded-2xl bg-[#E6F0FC] border-[#82B5E8]',
    iconBox: 'bg-[#1E5494] text-white rounded-xl',
    accentText: 'text-[#1E3A5F]',
  },
  song: {
    container: 'rounded-2xl bg-white border-[#E5E9F0]',
    iconBox: 'bg-[#F1F5F9] text-[#2B6CB0] rounded-xl',
    accentText: 'text-[#525C68]',
  },
  break: {
    container: 'rounded-xl bg-[#F8FAFC] border-[#E5E9F0]',
    iconBox: 'bg-[#64748B] text-white rounded-lg',
    accentText: 'text-[#475569]',
  },
  sweeper: {
    container: 'rounded-xl bg-[#F1F6FC] border-[#CBDFF4]',
    iconBox: 'bg-[#4A90D9] text-white rounded-lg',
    accentText: 'text-[#2B6CB0]',
  },
  adlibs: {
    container: 'rounded-xl bg-[#F6FAFF] border-[#D5E3F3]',
    iconBox: 'bg-[#3B82F6] text-white rounded-lg',
    accentText: 'text-[#1E4E8C]',
  },
  decision: {
    container: 'rounded-2xl bg-[#F4F8FD] border-dashed border-[#4A90D9]',
    iconBox: 'bg-[#2B6CB0] text-white rounded-lg rotate-45',
    accentText: 'text-[#1E4E8C]',
  },
};

function renderSlotIcon(kind: FlowchartSlotKind) {
  switch (kind) {
    case 'start':
      return <Play className="w-4 h-4" />;
    case 'toh':
      return <Radio className="w-4 h-4" />;
    case 'talkset':
      return <Mic className="w-4 h-4" />;
    case 'news':
      return <Newspaper className="w-4 h-4" />;
    case 'song':
      return <Disc3 className="w-4 h-4" />;
    case 'sweeper':
      return <Sparkles className="w-4 h-4" />;
    case 'adlibs':
      return <Megaphone className="w-4 h-4" />;
    case 'decision':
      return <GitBranch className="w-4 h-4 -rotate-45" />;
    case 'break':
    default:
      return <Clock className="w-4 h-4" />;
  }
}

export const FlowchartViewer: React.FC<FlowchartViewerProps> = ({ flowchart, programName }) => {
  const [zoom, setZoom] = useState<number>(100);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeHourId, setActiveHourId] = useState<string>('all');
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    flowchart.hours[0]?.steps[0]?.id || null
  );

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
    setActiveHourId('all');
    setSelectedStepId(flowchart.hours[0]?.steps[0]?.id || null);
  }, [flowchart.id]);

  const handleZoomIn = () => setZoom((z) => Math.min(175, z + 15));
  const handleZoomOut = () => setZoom((z) => Math.max(55, z - 15));
  const handleReset = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragStartRef.current.moved = true;
    }
    setPan({
      x: dragStartRef.current.startPanX + dx,
      y: dragStartRef.current.startPanY + dy,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    window.setTimeout(() => {
      dragStartRef.current = null;
    }, 0);
  };

  const handleStepClick = (stepId: string) => {
    if (dragStartRef.current?.moved) return;
    setSelectedStepId(stepId);
  };

  const visibleHours: FlowchartHourBlock[] =
    activeHourId === 'all'
      ? flowchart.hours
      : flowchart.hours.filter((h) => h.id === activeHourId);

  const allSteps = flowchart.hours.flatMap((h) => h.steps);
  const selectedStep: FlowchartStep | undefined =
    allSteps.find((s) => s.id === selectedStepId) || allSteps[0];

  return (
    <div className="space-y-5">
      {/* Program Rundown Metadata Summary Cards (Vibes & Reminders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#EAF3FE] border border-[#C7DDF6] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1E4E8C]">
            <Music className="w-4 h-4 text-[#2B6CB0]" />
            <span>Vibes Lagu</span>
          </div>
          <p className="text-sm font-medium text-[#1F2428] leading-relaxed">
            {flowchart.vibesLagu}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5E9F0] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1E4E8C]">
            <CheckCircle2 className="w-4 h-4 text-[#2B6CB0]" />
            <span>Checklist / Reminders On-Air</span>
          </div>
          <ul className="text-xs sm:text-sm text-[#1F2428] space-y-1 leading-relaxed">
            {flowchart.reminders.map((rem, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-mono text-xs text-[#2B6CB0] mt-0.5">•</span>
                <span>{rem}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Controls Toolbar: Zoom, Reset & Hour Quick-Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white border border-[#E5E9F0] shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 55}
            aria-label="Perkecil flowchart"
            className="w-11 h-11 rounded-xl bg-[#F8FAFC] border border-[#E5E9F0] hover:bg-[#EAF3FE] disabled:opacity-40 flex items-center justify-center text-[#1F2428] transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="px-3 py-2 rounded-xl bg-[#F6FAFF] text-xs font-mono font-semibold text-[#1E4E8C] tabular-nums min-w-[58px] text-center">
            {zoom}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 175}
            aria-label="Perbesar flowchart"
            className="w-11 h-11 rounded-xl bg-[#F8FAFC] border border-[#E5E9F0] hover:bg-[#EAF3FE] disabled:opacity-40 flex items-center justify-center text-[#1F2428] transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E9F0] hover:bg-[#EAF3FE] text-xs font-semibold text-[#1F2428] min-h-[44px] whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#2B6CB0]" />
            <span>Reset</span>
          </button>
        </div>

        {flowchart.hours.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveHourId('all');
                setPan({ x: 0, y: 0 });
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold min-h-[40px] whitespace-nowrap shrink-0 transition-colors ${
                activeHourId === 'all'
                  ? 'bg-[#2B6CB0] text-white'
                  : 'bg-[#F8FAFC] text-[#525C68] hover:text-[#1F2428]'
              }`}
            >
              Semua Jam ({flowchart.hours.length})
            </button>
            {flowchart.hours.map((hour, idx) => (
              <button
                key={hour.id}
                type="button"
                onClick={() => {
                  setActiveHourId(hour.id);
                  setPan({ x: 0, y: 0 });
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold min-h-[40px] whitespace-nowrap shrink-0 transition-colors ${
                  activeHourId === hour.id
                    ? 'bg-[#2B6CB0] text-white'
                    : 'bg-[#F8FAFC] text-[#525C68] hover:text-[#1F2428]'
                }`}
              >
                Jam {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Drag-to-Pan & Zoomable Diagram Canvas */}
      <div className="rounded-3xl bg-white border border-[#E5E9F0] shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E5E9F0] flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-[#525C68]">
          <span className="inline-flex items-center gap-1.5">
            <Hand className="w-3.5 h-3.5 text-[#2B6CB0]" />
            <span>
              Geser / drag kanvas untuk menelusuri alur <strong>{programName}</strong>
            </span>
          </span>
          {(pan.x !== 0 || pan.y !== 0 || zoom !== 100) && (
            <button
              type="button"
              onClick={handleReset}
              className="font-semibold text-[#2B6CB0] hover:underline whitespace-nowrap"
            >
              Kembalikan posisi
            </button>
          )}
        </div>

        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative h-[64vh] min-h-[420px] max-h-[720px] overflow-hidden touch-none select-none p-4 sm:p-6 bg-[radial-gradient(#DCE4EE_1px,transparent_1px)] [background-size:18px_18px] ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            className="origin-top mx-auto"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: isDragging ? 'none' : 'transform 150ms ease-out',
            }}
          >
            <div
              className={`mx-auto flex flex-col lg:flex-row items-start justify-center gap-8 pb-16 ${
                visibleHours.length === 1 ? 'max-w-lg' : 'w-max min-w-full'
              }`}
            >
              {visibleHours.map((hour, hourIdx) => (
                <div
                  key={hour.id}
                  className="w-full max-w-md lg:w-[370px] shrink-0 flex flex-col items-center"
                >
                  {/* Hour Header Block */}
                  <div className="w-full rounded-2xl bg-[#1E3A5F] text-white p-4 mb-4 space-y-1 shadow-xs">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#93C5FD] font-mono">
                      <span>{hour.hourTitle}</span>
                      <span>{hour.timeRange}</span>
                    </div>
                    <div className="font-display font-bold text-sm sm:text-base">
                      {hour.segmentLabel}
                    </div>
                  </div>

                  {/* Step Nodes + SVG Directional Arrows */}
                  {hour.steps.map((step, stepIdx) => {
                    const style = SLOT_STYLE[step.kind] || SLOT_STYLE.break;
                    const isSelected = selectedStep?.id === step.id;
                    const isDecision = step.kind === 'decision' || step.isConditional;

                    return (
                      <React.Fragment key={step.id}>
                        <button
                          type="button"
                          onClick={() => handleStepClick(step.id)}
                          className={`w-full text-left border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B6CB0] ${
                            step.kind === 'start' ? 'px-5 py-3.5' : 'p-3.5 sm:p-4'
                          } ${style.container} ${
                            isSelected ? 'ring-2 ring-[#2B6CB0] shadow-sm' : 'hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`w-8 h-8 flex items-center justify-center shrink-0 mt-0.5 ${style.iconBox}`}
                            >
                              {renderSlotIcon(step.kind)}
                            </span>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#525C68]">
                                <span className={`font-bold ${style.accentText}`}>
                                  {step.slot}
                                </span>
                                {step.time && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono font-semibold text-[#1F2428] tabular-nums">
                                      {step.time}
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="font-display font-bold text-sm sm:text-base text-[#1F2428] leading-snug">
                                {step.content}
                              </div>

                              {step.description && (
                                <p className="text-xs text-[#525C68] leading-relaxed">
                                  {step.description}
                                </p>
                              )}

                              {isDecision && (step.branchYesLabel || step.branchNoLabel) && (
                                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {step.branchYesLabel && (
                                    <div className="p-2 rounded-xl bg-white border border-[#9EC5ED] text-[11px] text-[#1E4E8C]">
                                      <span className="font-bold">Ya: </span>
                                      {step.branchYesLabel}
                                    </div>
                                  )}
                                  {step.branchNoLabel && (
                                    <div className="p-2 rounded-xl bg-white border border-[#E5E9F0] text-[11px] text-[#525C68]">
                                      <span className="font-bold">Tidak: </span>
                                      {step.branchNoLabel}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* SVG Connector Arrow */}
                        {stepIdx < hour.steps.length - 1 && (
                          <div className="flex flex-col items-center py-0.5" aria-hidden="true">
                            {isDecision ? (
                              <svg width="64" height="24" viewBox="0 0 64 24" fill="none">
                                <path
                                  d="M18 0 V10 H32 M46 0 V10 H32 M32 10 V21"
                                  stroke="#6BA8E5"
                                  strokeWidth="1.75"
                                  strokeDasharray="3 2"
                                />
                                <path
                                  d="M28 17 L32 22 L36 17"
                                  stroke="#6BA8E5"
                                  strokeWidth="1.75"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
                                <line
                                  x1="10"
                                  y1="0"
                                  x2="10"
                                  y2="18"
                                  stroke="#94A3B8"
                                  strokeWidth="1.75"
                                />
                                <path
                                  d="M6 14 L10 19 L14 14"
                                  stroke="#94A3B8"
                                  strokeWidth="1.75"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {hourIdx < visibleHours.length - 1 && (
                    <div className="mt-4 px-3 py-1.5 rounded-xl bg-[#EAF3FE] border border-[#C7DDF6] text-[11px] font-semibold text-[#1E4E8C] lg:hidden">
                      Lanjut ke {visibleHours[hourIdx + 1].hourTitle} ↓
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Step Inspector + Additional Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {selectedStep && (
          <div className="lg:col-span-6 p-4 rounded-2xl bg-[#F6FAFF] border border-[#D4E4F7] space-y-1">
            <div className="text-xs font-semibold text-[#2B6CB0]">
              Tahap Dipilih · {selectedStep.slot}
              {selectedStep.time ? ` · ${selectedStep.time}` : ''}
            </div>
            <div className="font-display font-bold text-base text-[#1F2428]">
              {selectedStep.content}
            </div>
            {selectedStep.description && (
              <p className="text-xs sm:text-sm text-[#425466] leading-relaxed">
                {selectedStep.description}
              </p>
            )}
          </div>
        )}

        <div className="lg:col-span-6 p-4 rounded-2xl bg-white border border-[#E5E9F0] space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F2428]">
            <FileText className="w-4 h-4 text-[#2B6CB0]" />
            <span>Catatan Siaran Tambahan</span>
          </div>
          <ul className="text-xs text-[#525C68] space-y-1 leading-relaxed">
            {flowchart.additionalNotes.map((note, idx) => (
              <li key={idx}>• {note}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
