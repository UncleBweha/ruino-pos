/**
 * Sync metadata persistence — tracks last sync time, errors, and status.
 * Uses localStorage for lightweight persistence across sessions.
 */

const SYNC_META_KEY = 'ruinu-pos-sync-meta';

export interface SyncError {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  payload?: any;
}

export interface SyncMeta {
  lastSyncTime: string | null;
  lastSyncItemCount: number;
  syncErrors: SyncError[];
  totalSyncedAllTime: number;
}

const DEFAULT_META: SyncMeta = {
  lastSyncTime: null,
  lastSyncItemCount: 0,
  syncErrors: [],
  totalSyncedAllTime: 0,
};

export function getSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (!raw) return { ...DEFAULT_META };
    return { ...DEFAULT_META, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_META };
  }
}

export function setSyncMeta(meta: Partial<SyncMeta>): void {
  try {
    const current = getSyncMeta();
    const updated = { ...current, ...meta };
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable
  }
}

export function addSyncError(error: Omit<SyncError, 'id' | 'timestamp'>): void {
  const meta = getSyncMeta();
  const newError: SyncError = {
    ...error,
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  // Keep max 50 errors
  const errors = [newError, ...meta.syncErrors].slice(0, 50);
  setSyncMeta({ syncErrors: errors });
}

export function clearSyncErrors(): void {
  setSyncMeta({ syncErrors: [] });
}

export function recordSuccessfulSync(itemCount: number): void {
  const meta = getSyncMeta();
  setSyncMeta({
    lastSyncTime: new Date().toISOString(),
    lastSyncItemCount: itemCount,
    totalSyncedAllTime: meta.totalSyncedAllTime + itemCount,
  });
}
