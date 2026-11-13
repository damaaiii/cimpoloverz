export type NavTab = 'home' | 'programs' | 'ai-studio';

export type AIStudioMode = 'highlight' | 'script';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface HighlightResult {
  isDemo: boolean;
  title: string;
  source: string;
  summary: string;
  title2?: string;
  openerLine?: string;
  closerLine?: string;
  dialogue: DialogueLine[];
  dialogue2?: DialogueLine[];
  rawText?: string;
}

export interface ScriptSegmentInput {
  title: string;
  durationMinutes: number;
}

export interface ScriptSegmentOutput {
  segmentTitle: string;
  durationMinutes?: number;
  wordCount?: number;
  estimatedDurationMinutes?: number;
  dialogue: DialogueLine[];
}

export interface ScriptResult {
  isDemo: boolean;
  programName: string;
  programDuration?: string;
  theme: string;
  segments: ScriptSegmentOutput[];
  urlWarning?: string;
}

export type ScriptJobStatus =
  | 'queued'
  | 'preparing'
  | 'generating'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface ScriptJobResponse {
  jobId: string;
  alreadyRunning?: boolean;
  status: ScriptJobStatus;
  statusLabel: string;
  isDemo: boolean;
  programName: string;
  programDuration?: string;
  theme: string;
  segments: ScriptSegmentOutput[];
  completedCount: number;
  totalCount: number;
  urlWarning?: string;
  error?: string;
}

export interface SavedDraft {
  id: string;
  type: AIStudioMode;
  title: string;
  createdAt: string;
  content: string;
}

export type ProgramCategory =
  | 'Daily & Weekly Programs'
  | 'Weekend Program'
  | 'Ramadan Program';

export type FlowchartSlotKind =
  | 'start'
  | 'break'
  | 'toh'
  | 'sweeper'
  | 'song'
  | 'talkset'
  | 'news'
  | 'adlibs'
  | 'decision';

export interface FlowchartStep {
  id: string;
  slot: string;
  content: string;
  description: string;
  time?: string;
  kind: FlowchartSlotKind;
  isConditional?: boolean;
  branchYesLabel?: string;
  branchNoLabel?: string;
}

export interface FlowchartHourBlock {
  id: string;
  hourTitle: string;
  segmentLabel: string;
  timeRange: string;
  steps: FlowchartStep[];
}

export interface ProgramFlowchart {
  id: string;
  sourceFile: string;
  headerTitle: string;
  vibesLagu: string;
  reminders: string[];
  additionalNotes: string[];
  hours: FlowchartHourBlock[];
  verificationNotes?: string[];
}

export interface RadioProgram {
  id: string;
  code?: string;
  name: string;
  category: ProgramCategory;
  scheduleDay: string;
  scheduleTime: string;
  segmentsSummary: string[];
  summary: string;
  flowchartId: string;
  sharedFlowchartNote?: string;
  conflictNotice?: string;
  tandemRuleNote?: string;
}
