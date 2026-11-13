import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Download,
  Link2,
  Loader2,
  Mic,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react';
import { OFFICIAL_PROGRAMS } from '../data/programsData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  SavedDraft,
  ScriptJobResponse,
  ScriptJobStatus,
  ScriptResult,
  ScriptSegmentInput,
  ScriptSegmentOutput,
} from '../types';
import { parseApiJsonResponse } from '../utils/apiResponse';
import { copyTextToClipboard, downloadTextFile } from '../utils/exportScript';
import {
  loadLatestScriptFromIndexedDB,
  saveLatestScriptToIndexedDB,
} from '../utils/offlineDb';
import {
  getActiveScriptJobId,
  getClientSessionId,
  getStoredScriptForm,
  getStoredScriptResult,
  setActiveScriptJobId,
  setStoredScriptForm,
  setStoredScriptResult,
} from '../utils/storage';

interface AIScriptPanelProps {
  defaultAnnouncerName: string;
  onSaveDraft: (draft: SavedDraft) => void;
}

const OFFICIAL_FIVE_TALKS: ScriptSegmentInput[] = [
  { title: 'TOH (Opening)', durationMinutes: 2 },
  { title: 'Talk 1 — Bridging ke Tema', durationMinutes: 3 },
  { title: 'Talk 2 — Tema', durationMinutes: 3 },
  { title: 'Talk 3 — Tema dan Interaksi', durationMinutes: 2 },
  { title: 'Closing', durationMinutes: 1 },
];

const ACTIVE_JOB_STATUSES: ScriptJobStatus[] = [
  'queued',
  'preparing',
  'generating',
  'finalizing',
];

function isJobStatusActive(status?: ScriptJobStatus | null): boolean {
  return Boolean(status && ACTIVE_JOB_STATUSES.includes(status));
}

function formatSpeakerDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Penyiar';
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
      .join(' ');
  }
  return trimmed;
}

function countSegmentWords(seg: ScriptSegmentOutput): number {
  return seg.dialogue.reduce(
    (total, line) => total + line.text.trim().split(/\s+/).filter(Boolean).length,
    0
  );
}

function estimateSegmentMinutes(wordCount: number): number {
  return Number((wordCount / 120).toFixed(1));
}

function formatSingleTalkAsText(seg: ScriptSegmentOutput, index: number): string {
  const header = `TALK ${index + 1} — ${seg.segmentTitle.toUpperCase()}`;
  const lines = seg.dialogue.map(
    (line) => `${formatSpeakerDisplay(line.speaker)}: ${line.text.trim()}`
  );
  return [header, '', ...lines].join('\n\n');
}

function formatFullScriptAsText(data: ScriptResult): string {
  const header = [
    `PROGRAM: ${data.programName}`,
    ...(data.programDuration ? [`DURASI PROGRAM: ${data.programDuration}`] : []),
    `TEMA: ${data.theme}`,
    '',
  ];
  const body = data.segments.map((seg, idx) => formatSingleTalkAsText(seg, idx));
  return [...header, body.join('\n\n---\n\n')].join('\n').trim();
}

export const AIScriptPanel: React.FC<AIScriptPanelProps> = ({
  defaultAnnouncerName,
  onSaveDraft,
}) => {
  const isOnline = useOnlineStatus();
  const initialForm = useMemo(() => getStoredScriptForm(), []);

  const [announcer1, setAnnouncer1] = useState(
    () => initialForm?.announcer1 || defaultAnnouncerName || ''
  );
  const [hasSecondAnnouncer, setHasSecondAnnouncer] = useState(
    () => initialForm?.hasSecondAnnouncer ?? true
  );
  const [announcer2, setAnnouncer2] = useState(() => initialForm?.announcer2 || '');
  const [programName, setProgramName] = useState(() => initialForm?.programName || '');
  const [programDuration, setProgramDuration] = useState(
    () => initialForm?.programDuration || ''
  );
  const [segments, setSegments] = useState<ScriptSegmentInput[]>(() =>
    initialForm?.segments?.length ? initialForm.segments : OFFICIAL_FIVE_TALKS
  );
  const [newSegmentInput, setNewSegmentInput] = useState('');
  const [newSegmentDuration, setNewSegmentDuration] = useState(2);
  const [closingType, setClosingType] = useState<'segmen1' | 'segmen2'>(
    () => initialForm?.closingType || 'segmen2'
  );
  const [theme, setTheme] = useState(() => initialForm?.theme || '');
  const [newsUrl, setNewsUrl] = useState(() => initialForm?.newsUrl || '');
  const [showManualText, setShowManualText] = useState(
    () => initialForm?.showManualText || false
  );
  const [articleText, setArticleText] = useState(() => initialForm?.articleText || '');

  const [activeJobId, setActiveJobId] = useState<string | null>(() => getActiveScriptJobId());
  const [jobState, setJobState] = useState<ScriptJobResponse | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justCompletedNotice, setJustCompletedNotice] = useState(false);
  const [result, setResult] = useState<ScriptResult | null>(() => getStoredScriptResult());

  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedTalkIndex, setCopiedTalkIndex] = useState<number | null>(null);
  const [editingTalkIndex, setEditingTalkIndex] = useState<number | null>(null);

  const clientSessionId = useMemo(() => getClientSessionId(), []);
  const savedJobIdsRef = useRef<Set<string>>(new Set());
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const isGenerating = Boolean(
    activeJobId && (!jobState || isJobStatusActive(jobState.status))
  );

  // Sync default announcer name when empty
  useEffect(() => {
    if (!announcer1 && defaultAnnouncerName) {
      setAnnouncer1(defaultAnnouncerName);
    }
  }, [defaultAnnouncerName, announcer1]);

  // Persist form inputs cleanly across tab switches and app backgrounding
  useEffect(() => {
    setStoredScriptForm({
      announcer1,
      hasSecondAnnouncer,
      announcer2,
      programName,
      programDuration,
      segments,
      closingType,
      theme,
      newsUrl,
      articleText,
      showManualText,
    });
  }, [
    announcer1,
    hasSecondAnnouncer,
    announcer2,
    programName,
    programDuration,
    segments,
    closingType,
    theme,
    newsUrl,
    articleText,
    showManualText,
  ]);

  // Persist latest valid script result so errors/rerenders/offline never erase prior output
  useEffect(() => {
    if (!result) {
      void loadLatestScriptFromIndexedDB().then((cached) => {
        if (cached) {
          setResult(cached);
          setStoredScriptResult(cached);
        }
      });
    }
  }, [result]);

  useEffect(() => {
    if (result) {
      setStoredScriptResult(result);
      void saveLatestScriptToIndexedDB(result);
    }
  }, [result]);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const applyCompletedJob = useCallback(
    (payload: ScriptJobResponse) => {
      const completedResult: ScriptResult = {
        isDemo: payload.isDemo,
        programName: payload.programName,
        programDuration: payload.programDuration,
        theme: payload.theme,
        segments: payload.segments,
        urlWarning: payload.urlWarning,
      };
      setResult(completedResult);
      setStoredScriptResult(completedResult);
      void saveLatestScriptToIndexedDB(completedResult);
      setEditingTalkIndex(null);
      setActiveScriptJobId(null);
      setActiveJobId(null);
      setConnectionLost(false);
      setErrorMsg(null);
      setJustCompletedNotice(true);

      if (!savedJobIdsRef.current.has(payload.jobId)) {
        savedJobIdsRef.current.add(payload.jobId);
        onSaveDraft({
          id: `sc-${payload.jobId}`,
          type: 'script',
          title: `${completedResult.programName} — ${completedResult.theme}`,
          createdAt: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          content: formatFullScriptAsText(completedResult),
        });
      }
    },
    [onSaveDraft]
  );

  const pollJobStatus = useCallback(
    async (targetJobId: string) => {
      clearPollTimer();
      try {
        const response = await fetch(`/api/ai/script/jobs/${encodeURIComponent(targetJobId)}`);
        if (!isMountedRef.current) return;

        if (response.status === 404) {
          setActiveScriptJobId(null);
          setActiveJobId(null);
          setJobState(null);
          setConnectionLost(false);
          setErrorMsg(
            'Sesi penyusunan script sebelumnya sudah berakhir di server. Tekan Coba Lagi untuk membuat ulang.'
          );
          return;
        }

        const parsed = await parseApiJsonResponse<ScriptJobResponse>(response);
        if (!isMountedRef.current) return;

        if (!parsed.data) {
          setConnectionLost(true);
          return;
        }

        const payload = parsed.data;
        setConnectionLost(false);
        setJobState(payload);

        if (payload.status === 'completed') {
          applyCompletedJob(payload);
          return;
        }

        if (payload.status === 'cancelled') {
          setActiveScriptJobId(null);
          setActiveJobId(null);
          setCancelling(false);
          return;
        }

        if (payload.status === 'failed' || payload.status === 'timed_out') {
          setActiveScriptJobId(null);
          setActiveJobId(null);
          setErrorMsg(
            payload.error || 'Waduh, penyusunan script gagal diselesaikan. Silakan coba lagi ya.'
          );
          return;
        }

        pollTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            void pollJobStatus(targetJobId);
          }
        }, 1100);
      } catch {
        if (!isMountedRef.current) return;
        // Keep activeJobId intact so returning to app resumes polling instead of cancelling
        setConnectionLost(true);
      }
    },
    [applyCompletedJob, clearPollTimer]
  );

  // Resume active job on mount & sync immediately when returning to the browser tab/app.
  // Never cancels on visibilitychange, blur, pagehide, or unmount.
  useEffect(() => {
    isMountedRef.current = true;
    const storedJobId = getActiveScriptJobId();
    if (storedJobId) {
      setActiveJobId(storedJobId);
      void pollJobStatus(storedJobId);
    }

    const handleVisibilityReturn = () => {
      if (document.visibilityState === 'visible') {
        const currentJobId = getActiveScriptJobId();
        if (currentJobId) {
          void pollJobStatus(currentJobId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityReturn);
    return () => {
      isMountedRef.current = false;
      clearPollTimer();
      document.removeEventListener('visibilitychange', handleVisibilityReturn);
    };
  }, [clearPollTimer, pollJobStatus]);

  const isFreeline = programName.toLowerCase().includes('freeline');
  const totalTargetMinutes = segments.reduce((sum, s) => sum + s.durationMinutes, 0);

  const handleSelectOfficialProgram = (selectedId: string) => {
    const found = OFFICIAL_PROGRAMS.find((p) => p.id === selectedId);
    if (!found) return;
    setProgramName(found.name);
    if (!programDuration.trim() && found.scheduleTime) {
      setProgramDuration(found.scheduleTime);
    }
    if (found.id === 'freeline') {
      setHasSecondAnnouncer(false);
      setAnnouncer2('');
    }
  };

  const handleAddSegment = () => {
    const clean = newSegmentInput.trim();
    if (!clean) return;
    setSegments((prev) => [
      ...prev,
      { title: clean, durationMinutes: Math.min(15, Math.max(1, newSegmentDuration)) },
    ]);
    setNewSegmentInput('');
    setNewSegmentDuration(2);
  };

  const handleRemoveSegment = (index: number) => {
    if (segments.length <= 1) return;
    setSegments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateSegmentTitle = (index: number, value: string) => {
    setSegments((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, title: value } : item))
    );
  };

  const handleUpdateSegmentDuration = (index: number, delta: number) => {
    setSegments((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const nextVal = Math.min(15, Math.max(1, item.durationMinutes + delta));
        return { ...item, durationMinutes: nextVal };
      })
    );
  };

  const generateScript = async () => {
    if (isGenerating) return;

    if (!isOnline) {
      setErrorMsg(
        'Koneksi internet diperlukan untuk membuat AI Script baru. Script yang sudah tersimpan tetap bisa kamu baca, edit, dan salin.'
      );
      return;
    }

    const p1 = announcer1.trim();
    const p2 = hasSecondAnnouncer ? announcer2.trim() : '';

    if (!p1) {
      setErrorMsg('Jangan lupa isi minimal 1 nama penyiar, ya!');
      return;
    }
    if (hasSecondAnnouncer && !p2) {
      setErrorMsg('Isi nama penyiar kedua atau hapus kolomnya kalau siaran solo.');
      return;
    }
    if (!theme.trim() && !newsUrl.trim() && !articleText.trim() && !programName.trim()) {
      setErrorMsg('Isi minimal nama program, tema siaran, atau link berita referensi dulu ya.');
      return;
    }

    const cleanedSegments = segments
      .map((s) => ({
        title: s.title.trim(),
        durationMinutes: Math.min(15, Math.max(1, s.durationMinutes)),
      }))
      .filter((s) => Boolean(s.title));

    if (cleanedSegments.length === 0) {
      setErrorMsg('Minimal harus ada 1 talk/segmen sebelum generate script.');
      return;
    }

    setErrorMsg(null);
    setConnectionLost(false);
    setCancelling(false);
    setJustCompletedNotice(false);

    try {
      const response = await fetch('/api/ai/script/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientSessionId,
          announcers: p2 ? [p1, p2] : [p1],
          programName: programName.trim(),
          programDuration: programDuration.trim(),
          segments: cleanedSegments,
          closingType,
          theme: theme.trim(),
          newsUrl: newsUrl.trim(),
          articleText: showManualText ? articleText.trim() : '',
        }),
      });

      const parsed = await parseApiJsonResponse<ScriptJobResponse>(response);

      if (!parsed.ok || !parsed.data) {
        if (parsed.data?.code === 'URL_UNREACHABLE') {
          setShowManualText(true);
        }
        setErrorMsg(
          parsed.data?.error ||
            parsed.fallbackError ||
            'Waduh, gagal memulai penyusunan script. Klik Coba Lagi ya.'
        );
        return;
      }

      const payload = parsed.data;
      setJobState(payload);
      if (payload.status === 'completed') {
        applyCompletedJob(payload);
        return;
      }

      setActiveJobId(payload.jobId);
      setActiveScriptJobId(payload.jobId);
      void pollJobStatus(payload.jobId);
    } catch {
      setErrorMsg('Koneksi ke server lagi terganggu nih. Cek jaringan kamu lalu klik Coba Lagi.');
    }
  };

  const handleCancelGeneration = async () => {
    const targetId = activeJobId || jobState?.jobId;
    if (!targetId || cancelling) return;

    setCancelling(true);
    clearPollTimer();

    try {
      await fetch(`/api/ai/script/jobs/${encodeURIComponent(targetId)}/cancel`, {
        method: 'POST',
      });
    } catch {
      // Clear local active session on explicit user cancellation
    } finally {
      setActiveScriptJobId(null);
      setActiveJobId(null);
      setJobState(null);
      setConnectionLost(false);
      setCancelling(false);
    }
  };

  const handleReconnect = () => {
    const targetId = activeJobId || getActiveScriptJobId();
    if (!targetId) return;
    setConnectionLost(false);
    void pollJobStatus(targetId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void generateScript();
  };

  const handleEditDialogueLine = (
    segIndex: number,
    lineIndex: number,
    field: 'speaker' | 'text',
    value: string
  ) => {
    if (!result) return;
    const updatedSegments: ScriptSegmentOutput[] = result.segments.map((seg, sIdx) => {
      if (sIdx !== segIndex) return seg;
      const updatedDialogue = seg.dialogue.map((line, lIdx) =>
        lIdx === lineIndex ? { ...line, [field]: value } : line
      );
      const updatedWords = updatedDialogue.reduce(
        (sum, line) => sum + line.text.trim().split(/\s+/).filter(Boolean).length,
        0
      );
      return {
        ...seg,
        wordCount: updatedWords,
        estimatedDurationMinutes: estimateSegmentMinutes(updatedWords),
        dialogue: updatedDialogue,
      };
    });
    setResult({ ...result, segments: updatedSegments });
  };

  const handleCopyAll = async () => {
    if (!result) return;
    const ok = await copyTextToClipboard(formatFullScriptAsText(result));
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    }
  };

  const handleCopyTalk = async (seg: ScriptSegmentOutput, index: number) => {
    const ok = await copyTextToClipboard(formatSingleTalkAsText(seg, index));
    if (ok) {
      setCopiedTalkIndex(index);
      setTimeout(() => {
        setCopiedTalkIndex((prev) => (prev === index ? null : prev));
      }, 1800);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadTextFile(`script-${result.programName}`, formatFullScriptAsText(result));
  };

  const currentStageIndex = useMemo(() => {
    if (!jobState) return 0;
    if (jobState.status === 'preparing' || jobState.status === 'queued') return 0;
    if (jobState.status === 'generating') return 1;
    if (jobState.status === 'finalizing') return 2;
    if (jobState.status === 'completed') return 3;
    return 0;
  }, [jobState]);

  const progressSteps = [
    { label: 'Menyiapkan script', key: 'preparing' },
    { label: 'Sedang menulis', key: 'generating' },
    { label: 'Menyelesaikan hasil', key: 'finalizing' },
    { label: 'Berhasil', key: 'completed' },
  ];

  const livePreviewSegments =
    isGenerating && jobState?.segments && jobState.segments.length > 0 ? jobState.segments : [];

  return (
    <div className="space-y-6">
      {/* Top Rundown Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-3xl bg-[#F6FAFF] border border-[#D4E4F7] p-5 sm:p-7 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE8F6]">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#2B6CB0]">
              Crew SIMFONI · Gaya Sobat Muda · 107,7 SIMFONI FM
            </div>
            <h2 className="font-display font-bold text-xl text-[#1F2428]">
              Yuk, bikin script! 🎙️
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#425466] max-w-md">
            Opening salam lengkap + sapaan Sobat Muda, pakai kita (bukan kami), dan isi pembahasan sesuai durasi tiap talk.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Column 1: Penyiar, Program & Tema */}
          <div className="lg:col-span-6 space-y-4">
            {/* Nama Penyiar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="sc-announcer-1" className="text-xs font-bold text-[#1F2428]">
                  Nama Penyiar {isFreeline ? '(Freeline = 1 Penyiar)' : '(Default Tandem 2 Penyiar)'}
                </label>
                {!hasSecondAnnouncer && (
                  <button
                    type="button"
                    onClick={() => setHasSecondAnnouncer(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#2B6CB0] hover:underline min-h-[36px] whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Tambah Penyiar 2</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  id="sc-announcer-1"
                  type="text"
                  value={announcer1}
                  onChange={(e) => setAnnouncer1(e.target.value)}
                  placeholder="Penyiar 1 (misal: Grace)"
                  className="w-full px-3.5 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
                />
                {hasSecondAnnouncer && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={announcer2}
                      onChange={(e) => setAnnouncer2(e.target.value)}
                      placeholder="Penyiar 2 (misal: Rafa)"
                      aria-label="Penyiar 2"
                      className="flex-1 min-w-0 px-3.5 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
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
              {isFreeline && (
                <p className="text-[11px] font-medium text-[#2B6CB0]">
                  Program Freeline dibawakan oleh 1 penyiar.
                </p>
              )}
            </div>

            {/* Nama Program Siaran + Durasi Program Opsional */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-8 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="sc-program" className="block text-xs font-bold text-[#1F2428]">
                    Nama Program Siaran
                  </label>
                  <select
                    aria-label="Pilih dari daftar program"
                    value=""
                    onChange={(e) => handleSelectOfficialProgram(e.target.value)}
                    className="text-xs font-semibold text-[#2B6CB0] bg-white border border-[#C7DDF6] rounded-xl px-2 py-1 max-w-[160px]"
                  >
                    <option value="" disabled>
                      Pilih program...
                    </option>
                    {OFFICIAL_PROGRAMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  id="sc-program"
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="Misal: English Day"
                  className="w-full px-3.5 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
                />
              </div>

              <div className="sm:col-span-4 space-y-1.5">
                <label
                  htmlFor="sc-program-duration"
                  className="block text-xs font-bold text-[#1F2428] sm:pt-1"
                >
                  Durasi Program (Opsional)
                </label>
                <input
                  id="sc-program-duration"
                  type="text"
                  value={programDuration}
                  onChange={(e) => setProgramDuration(e.target.value)}
                  placeholder="Misal: 2 jam"
                  className="w-full px-3.5 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
                />
              </div>
            </div>

            {/* Tema Siaran */}
            <div className="space-y-1.5">
              <label htmlFor="sc-theme" className="block text-xs font-bold text-[#1F2428]">
                Tema Siaran
              </label>
              <textarea
                id="sc-theme"
                rows={2}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Misal: Cara ngatasin burnout kuliah jelang UTS biar tetap waras"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
              />
            </div>

            {/* Jenis Penutup Segmen */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1F2428]">
                Aturan Penutup (Closing) Segmen
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClosingType('segmen1')}
                  className={`px-3 py-2.5 rounded-xl border text-left text-xs transition-colors min-h-[44px] ${
                    closingType === 'segmen1'
                      ? 'bg-[#2B6CB0] border-[#2B6CB0] text-white font-semibold'
                      : 'bg-white border-[#C7DDF6] text-[#425466] hover:bg-[#EAF3FE]'
                  }`}
                >
                  Closing Segmen 1 (Tanpa Salam)
                </button>
                <button
                  type="button"
                  onClick={() => setClosingType('segmen2')}
                  className={`px-3 py-2.5 rounded-xl border text-left text-xs transition-colors min-h-[44px] ${
                    closingType === 'segmen2'
                      ? 'bg-[#2B6CB0] border-[#2B6CB0] text-white font-semibold'
                      : 'bg-white border-[#C7DDF6] text-[#425466] hover:bg-[#EAF3FE]'
                  }`}
                >
                  Closing Segmen 2 (Salam Peace &amp; Kreasi)
                </button>
              </div>
            </div>

            {/* Link Berita Opsional */}
            <div className="space-y-1.5">
              <label htmlFor="sc-news-url" className="block text-xs font-bold text-[#1F2428]">
                Link Berita Referensi (Opsional)
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-[#525C68] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="sc-news-url"
                  type="url"
                  inputMode="url"
                  value={newsUrl}
                  onChange={(e) => setNewsUrl(e.target.value)}
                  placeholder="Tempel link beritanya di sini, ya! (opsional)"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428] placeholder:text-[#8B95A1] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
                />
              </div>
              {showManualText && (
                <textarea
                  rows={3}
                  value={articleText}
                  onChange={(e) => setArticleText(e.target.value)}
                  placeholder="Tempel teks referensi berita di sini..."
                  className="w-full mt-2 px-3.5 py-2.5 rounded-2xl bg-white border border-[#C7DDF6] text-sm text-[#1F2428]"
                />
              )}
            </div>
          </div>

          {/* Column 2: Segmen + Durasi Target Builder */}
          <div className="lg:col-span-6 space-y-3 bg-white rounded-2xl border border-[#DCE8F6] p-4 sm:p-5 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <label className="block text-xs font-bold text-[#1F2428]">
                    Susunan Talk &amp; Target Durasi
                  </label>
                  <p className="text-[11px] text-[#525C68] tabular-nums">
                    {segments.length} Talk · Total {totalTargetMinutes} menit (±{totalTargetMinutes * 110}–{totalTargetMinutes * 130} kata)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSegments(OFFICIAL_FIVE_TALKS)}
                  className="text-xs font-semibold text-[#2B6CB0] hover:underline whitespace-nowrap"
                >
                  Pakai Struktur 5 Talk
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {segments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-1.5 rounded-xl bg-[#F8FAFC] border border-[#E5E9F0]"
                  >
                    <span className="w-6 text-xs font-mono font-semibold text-[#525C68] text-right tabular-nums shrink-0">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={seg.title}
                      onChange={(e) => handleUpdateSegmentTitle(idx, e.target.value)}
                      aria-label={`Nama talk ${idx + 1}`}
                      className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-white border border-[#E5E9F0] text-sm text-[#1F2428] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
                    />

                    {/* Duration Stepper (Menit) */}
                    <div
                      className="inline-flex items-center rounded-lg bg-white border border-[#C7DDF6] shrink-0"
                      aria-label={`Durasi ${seg.title}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleUpdateSegmentDuration(idx, -1)}
                        disabled={seg.durationMinutes <= 1}
                        aria-label={`Kurangi durasi ${seg.title}`}
                        className="w-9 h-9 flex items-center justify-center text-[#2B6CB0] hover:bg-[#EAF3FE] disabled:opacity-40 rounded-l-lg"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2 text-xs font-semibold text-[#1F2428] tabular-nums whitespace-nowrap">
                        {seg.durationMinutes} mnt
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateSegmentDuration(idx, 1)}
                        disabled={seg.durationMinutes >= 15}
                        aria-label={`Tambah durasi ${seg.title}`}
                        className="w-9 h-9 flex items-center justify-center text-[#2B6CB0] hover:bg-[#EAF3FE] disabled:opacity-40 rounded-r-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {segments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSegment(idx)}
                        aria-label={`Hapus segmen ${seg.title}`}
                        className="w-9 h-9 rounded-lg hover:bg-[#FEE2E2] text-[#64748B] hover:text-[#B91C1C] flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newSegmentInput}
                  onChange={(e) => setNewSegmentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSegment();
                    }
                  }}
                  placeholder="Tambah talk (misal: Quiz / This or That)"
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#E5E9F0] text-sm text-[#1F2428] placeholder:text-[#8B95A1]"
                />
                <div className="inline-flex items-center rounded-xl bg-[#F8FAFC] border border-[#E5E9F0] shrink-0">
                  <button
                    type="button"
                    onClick={() => setNewSegmentDuration((d) => Math.max(1, d - 1))}
                    aria-label="Kurangi durasi talk baru"
                    className="w-9 h-11 flex items-center justify-center text-[#525C68] hover:text-[#2B6CB0]"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 text-xs font-semibold text-[#1F2428] tabular-nums whitespace-nowrap">
                    {newSegmentDuration} mnt
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewSegmentDuration((d) => Math.min(15, d + 1))}
                    aria-label="Tambah durasi talk baru"
                    className="w-9 h-11 flex items-center justify-center text-[#525C68] hover:text-[#2B6CB0]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddSegment}
                  className="inline-flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-[#EAF3FE] border border-[#C7DDF6] text-[#1E4E8C] text-xs font-semibold hover:bg-[#D4E6FA] min-h-[44px] whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              {errorMsg && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-[#991B1B]"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
                    <span>{errorMsg}</span>
                  </div>
                  {!isGenerating && (
                    <button
                      type="button"
                      onClick={() => void generateScript()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#FCA5A5] text-[#991B1B] font-semibold hover:bg-[#FEE2E2] min-h-[36px] whitespace-nowrap self-end sm:self-auto shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Coba Lagi</span>
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#2B6CB0] hover:bg-[#1E5494] text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-all min-h-[48px] shadow-xs"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{jobState?.statusLabel || 'Sedang menulis'}...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-[#BFDBFE]" />
                    <span>Generate Script</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Active Background-Resilient Generating State */}
      {isGenerating && (
        <div className="rounded-3xl bg-white border border-[#C7DDF6] shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-end gap-1 h-6" aria-hidden="true">
                <span className="w-1.5 h-3 rounded-full bg-[#3B82F6] eq-bar" />
                <span className="w-1.5 h-5 rounded-full bg-[#60A5FA] eq-bar eq-bar-2" />
                <span className="w-1.5 h-4 rounded-full bg-[#93C5FD] eq-bar eq-bar-3" />
              </div>
              <div>
                <p className="font-display font-bold text-base text-[#1F2428]">
                  {jobState?.statusLabel || 'Menyiapkan script'}...
                </p>
                <p className="text-xs text-[#525C68]">
                  Aman kalau pindah tab, buka aplikasi lain, atau layar di background — proses tetap berjalan di server.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleCancelGeneration()}
              disabled={cancelling}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-xs font-semibold text-[#B91C1C] min-h-[44px] whitespace-nowrap self-start sm:self-auto"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{cancelling ? 'Membatalkan...' : 'Batalkan Generate'}</span>
            </button>
          </div>

          {/* 4 Clear Real Status Steps */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {progressSteps.map((step, idx) => {
              const isDone = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <div
                  key={step.key}
                  className={`px-3 py-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    isCurrent
                      ? 'bg-[#EAF3FE] border-[#93C5FD] text-[#1E4E8C] font-semibold'
                      : isDone
                        ? 'bg-[#F8FAFC] border-[#C7DDF6] text-[#2B6CB0] font-medium'
                        : 'bg-[#F8FAFC] border-[#E5E9F0] text-[#8B95A1]'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 text-[#2B6CB0] shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2B6CB0] shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-[#CBD5E1] shrink-0" />
                  )}
                  <span className="truncate">{step.label}</span>
                  {step.key === 'generating' && jobState && jobState.totalCount > 0 && (
                    <span className="ml-auto tabular-nums text-[11px] opacity-85">
                      {jobState.completedCount}/{jobState.totalCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Connection Lost Notice (never cancels or recreates job automatically) */}
          {connectionLost && (
            <div className="p-3.5 rounded-2xl bg-[#F6FAFF] border border-[#C7DDF6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-[#1E3A5F]">
                <WifiOff className="w-4 h-4 text-[#2B6CB0] shrink-0 mt-0.5" />
                <span>
                  Koneksi sempat terputus saat aplikasi di latar belakang. Proses di server tetap berjalan, ketuk tombol di samping untuk melanjutkan pantauan.
                </span>
              </div>
              <button
                type="button"
                onClick={handleReconnect}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#2B6CB0] hover:bg-[#1E5494] text-white text-xs font-semibold min-h-[44px] whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Hubungkan Lagi</span>
              </button>
            </div>
          )}

          {/* Live Streamed Talk Preview while generating */}
          {livePreviewSegments.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#EDF1F5]">
              <div className="text-xs font-semibold text-[#2B6CB0]">
                Preview Live · {livePreviewSegments.length} dari {jobState?.totalCount || segments.length} talk mulai tersusun
              </div>
              <div className="space-y-3">
                {livePreviewSegments.map((seg, idx) => (
                  <section
                    key={`live-${seg.segmentTitle}-${idx}`}
                    className="rounded-2xl bg-[#F8FAFC] border border-[#E5E9F0] p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E5E9F0]">
                      <h4 className="font-display font-bold text-sm sm:text-base text-[#1F2428]">
                        TALK {idx + 1} — {seg.segmentTitle.toUpperCase()}
                      </h4>
                      {seg.durationMinutes && (
                        <span className="text-xs text-[#525C68] tabular-nums">
                          Target {seg.durationMinutes} mnt
                        </span>
                      )}
                    </div>
                    <div className="space-y-2.5 text-sm leading-relaxed text-[#1F2428]">
                      {seg.dialogue.map((line, lIdx) => (
                        <p key={`live-line-${idx}-${lIdx}`}>
                          <strong className="font-bold text-[#1E4E8C]">
                            {formatSpeakerDisplay(line.speaker)}:
                          </strong>{' '}
                          <span>{line.text}</span>
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isGenerating && !result && (
        <div className="rounded-3xl bg-white border border-[#E5E9F0] shadow-xs p-6 text-center space-y-1.5">
          <h3 className="font-display font-bold text-base sm:text-lg text-[#1F2428]">
            Hmm, belum ada script yang dibuat nih.
          </h3>
          <p className="text-xs sm:text-sm text-[#525C68] max-w-lg mx-auto">
            Atur susunan talk dan durasi menitnya di atas, lalu tekan{' '}
            <strong>Generate Script</strong>!
          </p>
        </div>
      )}

      {/* Output: 1 Card Per Talk (Preserved even if a new regeneration fails!) */}
      {result && (
        <div className="space-y-4">
          {result.isDemo && (
            <div className="p-4 rounded-2xl bg-[#F6FAFF] border border-[#C7DDF6] flex items-start gap-2.5 text-xs sm:text-sm text-[#1E3A5F]">
              <AlertCircle className="w-4 h-4 text-[#2B6CB0] shrink-0 mt-0.5" />
              <span>
                <strong>MODE DEMO:</strong> GEMINI_API_KEY belum terhubung di server. Hasil berikut memperlihatkan struktur per talk, opening salam + Sobat Muda, target durasi, dan salam siaran SIMFONI FM.
              </span>
            </div>
          )}

          {result.urlWarning && (
            <div className="p-3.5 rounded-2xl bg-[#EAF3FE] border border-[#C7DDF6] text-xs sm:text-sm text-[#1E3A5F]">
              {result.urlWarning}
            </div>
          )}

          {/* Output Header + Global Actions */}
          <div className="rounded-3xl bg-white border border-[#E5E9F0] shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[#2B6CB0]">
                {justCompletedNotice ? 'Berhasil! ' : ''}Script siaran siap baca · {result.programName}
                {result.programDuration ? ` · ${result.programDuration}` : ''}
              </div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-[#1F2428]">
                {result.theme}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void generateScript()}
                disabled={isGenerating}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs sm:text-sm font-semibold text-[#1F2428] min-h-[44px] whitespace-nowrap disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 text-[#2B6CB0]" />
                <span>Regenerate</span>
              </button>

              <button
                type="button"
                onClick={handleCopyAll}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#EAF3FE] hover:bg-[#D4E6FA] text-xs sm:text-sm font-semibold text-[#1E4E8C] min-h-[44px] whitespace-nowrap"
              >
                {copiedAll ? (
                  <Check className="w-4 h-4 text-[#2B6CB0]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copiedAll ? 'Semua Tersalin!' : 'Copy All'}</span>
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

          {/* Talk Cards: One Card Per Talk, All Dialogue Inside */}
          <div className="space-y-4">
            {result.segments.map((seg, segIdx) => {
              const wordCount = countSegmentWords(seg);
              const estMinutes = estimateSegmentMinutes(wordCount);
              const targetMinutes = seg.durationMinutes;
              const isUnderTarget = Boolean(
                targetMinutes && wordCount < targetMinutes * 100
              );
              const isEditingThisTalk = editingTalkIndex === segIdx;
              const isTalkCopied = copiedTalkIndex === segIdx;

              return (
                <section
                  key={`${seg.segmentTitle}-${segIdx}`}
                  className="rounded-3xl bg-white border border-[#E5E9F0] shadow-xs p-5 sm:p-6 space-y-4"
                >
                  {/* Talk Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EDF1F5]">
                    <div className="space-y-1">
                      <h4 className="font-display font-bold text-base sm:text-lg text-[#1F2428] tracking-tight">
                        TALK {segIdx + 1} — {seg.segmentTitle.toUpperCase()}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#525C68] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#2B6CB0]" />
                          {targetMinutes ? `Target ${targetMinutes} mnt · ` : ''}
                          Estimasi ~{estMinutes} mnt ({wordCount} kata)
                        </span>
                      </div>
                      {isUnderTarget && (
                        <p className="text-[11px] font-medium text-[#2B6CB0]">
                          Perkiraan durasi baca ({estMinutes} mnt / {wordCount} kata) masih di bawah target {targetMinutes} mnt — kamu bisa klik Edit Talk atau Regenerate.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingTalkIndex(isEditingThisTalk ? null : segIdx)
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8FAFC] hover:bg-[#EAF3FE] border border-[#E5E9F0] text-xs font-semibold text-[#425466] min-h-[40px] whitespace-nowrap"
                      >
                        {isEditingThisTalk ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#2B6CB0]" />
                            <span>Selesai</span>
                          </>
                        ) : (
                          <>
                            <Pencil className="w-3.5 h-3.5 text-[#2B6CB0]" />
                            <span>Edit Talk</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleCopyTalk(seg, segIdx)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EAF3FE] hover:bg-[#D4E6FA] text-xs font-semibold text-[#1E4E8C] min-h-[40px] whitespace-nowrap"
                      >
                        {isTalkCopied ? (
                          <Check className="w-3.5 h-3.5 text-[#2B6CB0]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{isTalkCopied ? 'Tersalin!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Talk Content: Clean Paragraphs (Default) or Inline Edit */}
                  {isEditingThisTalk ? (
                    <div className="space-y-3">
                      {seg.dialogue.map((line, lineIdx) => (
                        <div
                          key={`edit-${segIdx}-${lineIdx}`}
                          className="space-y-1 pb-3 border-b border-[#F1F5F9] last:border-b-0 last:pb-0"
                        >
                          <input
                            type="text"
                            value={formatSpeakerDisplay(line.speaker)}
                            onChange={(e) =>
                              handleEditDialogueLine(
                                segIdx,
                                lineIdx,
                                'speaker',
                                e.target.value
                              )
                            }
                            aria-label="Nama penyiar"
                            className="w-full text-xs font-bold text-[#1E4E8C] focus:outline-none"
                          />
                          <textarea
                            rows={Math.max(2, Math.ceil(line.text.length / 72))}
                            value={line.text}
                            onChange={(e) =>
                              handleEditDialogueLine(
                                segIdx,
                                lineIdx,
                                'text',
                                e.target.value
                              )
                            }
                            aria-label={`Dialog ${line.speaker}`}
                            className="w-full px-3 py-2 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] text-sm text-[#1F2428] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3.5 text-sm sm:text-[15px] leading-relaxed text-[#1F2428]">
                      {seg.dialogue.map((line, lineIdx) => (
                        <p key={`${segIdx}-${lineIdx}`}>
                          <strong className="font-bold text-[#1E4E8C]">
                            {formatSpeakerDisplay(line.speaker)}:
                          </strong>{' '}
                          <span>{line.text}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
