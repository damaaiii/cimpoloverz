import { HighlightResult, SavedDraft, ScriptResult, ScriptSegmentInput } from '../types';

const KEYS = {
  ANNOUNCER_NAME: 'cimpo_loverz_announcer_name',
  SAVED_DRAFTS: 'cimpo_loverz_saved_drafts',
  CLIENT_SESSION_ID: 'cimpo_loverz_client_session_id',
  ACTIVE_SCRIPT_JOB_ID: 'cimpo_loverz_active_script_job_id',
  STORED_SCRIPT_RESULT: 'cimpo_loverz_stored_script_result',
  STORED_SCRIPT_FORM: 'cimpo_loverz_stored_script_form',
  STORED_HIGHLIGHT_RESULT: 'cimpo_loverz_stored_highlight_result',
};

export interface StoredScriptFormState {
  announcer1: string;
  hasSecondAnnouncer: boolean;
  announcer2: string;
  programName: string;
  programDuration: string;
  segments: ScriptSegmentInput[];
  closingType: 'segmen1' | 'segmen2';
  theme: string;
  newsUrl: string;
  articleText: string;
  showManualText: boolean;
}

export function getStoredAnnouncerName(): string {
  try {
    return localStorage.getItem(KEYS.ANNOUNCER_NAME) || '';
  } catch {
    return '';
  }
}

export function setStoredAnnouncerName(name: string): void {
  try {
    localStorage.setItem(KEYS.ANNOUNCER_NAME, name);
  } catch {
    // ignore storage errors
  }
}

export function getSavedDrafts(): SavedDraft[] {
  try {
    const raw = localStorage.getItem(KEYS.SAVED_DRAFTS);
    return raw ? (JSON.parse(raw) as SavedDraft[]) : [];
  } catch {
    return [];
  }
}

export function setSavedDraftsInStorage(drafts: SavedDraft[]): void {
  try {
    localStorage.setItem(KEYS.SAVED_DRAFTS, JSON.stringify(drafts.slice(0, 12)));
  } catch {
    // ignore
  }
}

export function saveDraftToStorage(draft: SavedDraft): SavedDraft[] {
  const existing = getSavedDrafts().filter((item) => item.id !== draft.id);
  const updated = [draft, ...existing].slice(0, 12);
  setSavedDraftsInStorage(updated);
  return updated;
}

export function deleteDraftFromStorage(id: string): SavedDraft[] {
  const updated = getSavedDrafts().filter((item) => item.id !== id);
  setSavedDraftsInStorage(updated);
  return updated;
}

export function getClientSessionId(): string {
  try {
    const existing = localStorage.getItem(KEYS.CLIENT_SESSION_ID);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `crew-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEYS.CLIENT_SESSION_ID, generated);
    return generated;
  } catch {
    return `crew-fallback-${Date.now()}`;
  }
}

export function getActiveScriptJobId(): string | null {
  try {
    return localStorage.getItem(KEYS.ACTIVE_SCRIPT_JOB_ID);
  } catch {
    return null;
  }
}

export function setActiveScriptJobId(jobId: string | null): void {
  try {
    if (jobId) {
      localStorage.setItem(KEYS.ACTIVE_SCRIPT_JOB_ID, jobId);
    } else {
      localStorage.removeItem(KEYS.ACTIVE_SCRIPT_JOB_ID);
    }
  } catch {
    // ignore
  }
}

export function getStoredScriptResult(): ScriptResult | null {
  try {
    const raw = localStorage.getItem(KEYS.STORED_SCRIPT_RESULT);
    return raw ? (JSON.parse(raw) as ScriptResult) : null;
  } catch {
    return null;
  }
}

export function setStoredScriptResult(result: ScriptResult | null): void {
  try {
    if (result) {
      localStorage.setItem(KEYS.STORED_SCRIPT_RESULT, JSON.stringify(result));
    } else {
      localStorage.removeItem(KEYS.STORED_SCRIPT_RESULT);
    }
  } catch {
    // ignore
  }
}

export function getStoredHighlightResult(): HighlightResult | null {
  try {
    const raw = localStorage.getItem(KEYS.STORED_HIGHLIGHT_RESULT);
    return raw ? (JSON.parse(raw) as HighlightResult) : null;
  } catch {
    return null;
  }
}

export function setStoredHighlightResult(result: HighlightResult | null): void {
  try {
    if (result) {
      localStorage.setItem(KEYS.STORED_HIGHLIGHT_RESULT, JSON.stringify(result));
    } else {
      localStorage.removeItem(KEYS.STORED_HIGHLIGHT_RESULT);
    }
  } catch {
    // ignore
  }
}

export function getStoredScriptForm(): StoredScriptFormState | null {
  try {
    const raw = localStorage.getItem(KEYS.STORED_SCRIPT_FORM);
    return raw ? (JSON.parse(raw) as StoredScriptFormState) : null;
  } catch {
    return null;
  }
}

export function setStoredScriptForm(form: StoredScriptFormState): void {
  try {
    localStorage.setItem(KEYS.STORED_SCRIPT_FORM, JSON.stringify(form));
  } catch {
    // ignore
  }
}
