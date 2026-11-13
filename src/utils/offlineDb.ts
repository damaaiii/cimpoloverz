import { OFFICIAL_PROGRAMS, PROGRAM_FLOWCHARTS } from '../data/programsData';
import { HighlightResult, ProgramFlowchart, RadioProgram, SavedDraft, ScriptResult } from '../types';

const DB_NAME = 'cimpo_loverz_offline_db';
const DB_VERSION = 1;

const STORES = {
  PROGRAMS: 'programs_cache',
  DRAFTS: 'drafts',
  OUTPUTS: 'latest_outputs',
} as const;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openOfflineDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.PROGRAMS)) {
          db.createObjectStore(STORES.PROGRAMS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
          db.createObjectStore(STORES.DRAFTS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.OUTPUTS)) {
          db.createObjectStore(STORES.OUTPUTS, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

async function idbPut(storeName: string, value: unknown): Promise<void> {
  const db = await openOfflineDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openOfflineDB();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openOfflineDB();
  if (!db) return [];
  return new Promise<T[]>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openOfflineDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Sincronisasi katalog program & flowchart ke IndexedDB agar tetap tersedia offline.
 * Pembaruan Service Worker tidak pernah menghapus data store ini.
 */
export async function syncProgramsSnapshotToIndexedDB(): Promise<void> {
  await Promise.all([
    idbPut(STORES.PROGRAMS, {
      key: 'official_programs',
      updatedAt: Date.now(),
      items: OFFICIAL_PROGRAMS as RadioProgram[],
    }),
    idbPut(STORES.PROGRAMS, {
      key: 'official_flowcharts',
      updatedAt: Date.now(),
      items: PROGRAM_FLOWCHARTS as Record<string, ProgramFlowchart>,
    }),
  ]);
}

export async function saveDraftToIndexedDB(draft: SavedDraft): Promise<void> {
  await idbPut(STORES.DRAFTS, { ...draft, savedAt: Date.now() });
}

export async function deleteDraftFromIndexedDB(id: string): Promise<void> {
  await idbDelete(STORES.DRAFTS, id);
}

export async function loadDraftsFromIndexedDB(): Promise<SavedDraft[]> {
  const rows = await idbGetAll<SavedDraft & { savedAt?: number }>(STORES.DRAFTS);
  return rows.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

export async function saveLatestHighlightToIndexedDB(result: HighlightResult): Promise<void> {
  await idbPut(STORES.OUTPUTS, {
    key: 'latest_highlight',
    updatedAt: Date.now(),
    data: result,
  });
}

export async function loadLatestHighlightFromIndexedDB(): Promise<HighlightResult | null> {
  const row = await idbGet<{ key: string; data?: HighlightResult }>(
    STORES.OUTPUTS,
    'latest_highlight'
  );
  return row?.data ?? null;
}

export async function saveLatestScriptToIndexedDB(result: ScriptResult): Promise<void> {
  await idbPut(STORES.OUTPUTS, {
    key: 'latest_script',
    updatedAt: Date.now(),
    data: result,
  });
}

export async function loadLatestScriptFromIndexedDB(): Promise<ScriptResult | null> {
  const row = await idbGet<{ key: string; data?: ScriptResult }>(
    STORES.OUTPUTS,
    'latest_script'
  );
  return row?.data ?? null;
}
