// Exam persistence: one active-attempt checkpoint plus per-course attempt history.
// Same injectable-store pattern as progress.js; degrades to no-op without storage.

const ACTIVE_KEY = 'tmc.v1.exam.active';
const ATTEMPTS_PREFIX = 'tmc.v1.exam.attempts.';

function defaultStore() {
  try {
    const probe = '__tmc_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

function usable(store) { return store !== null && store !== undefined; }

export function saveCheckpoint(attempt, store = defaultStore()) {
  if (!usable(store)) return false;
  try { store.setItem(ACTIVE_KEY, JSON.stringify(attempt)); } catch { return false; }
  return true;
}

export function loadCheckpoint(store = defaultStore()) {
  if (!usable(store)) return null;
  let data;
  try { data = JSON.parse(store.getItem(ACTIVE_KEY)); } catch { data = null; }
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
}

export function clearCheckpoint(store = defaultStore()) {
  if (!usable(store)) return;
  try { store.removeItem(ACTIVE_KEY); } catch { /* nothing to do */ }
}

export function recordAttempt(courseId, record, store = defaultStore()) {
  if (!usable(store)) return false;
  const key = ATTEMPTS_PREFIX + courseId;
  let list;
  try { list = JSON.parse(store.getItem(key)); } catch { list = null; }
  if (!Array.isArray(list)) list = [];
  list.push(record);
  try { store.setItem(key, JSON.stringify(list)); } catch { return false; }
  // Nudge the cloud sync layer (when signed in). Guarded for node:test runs.
  try {
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tmc:attempt', { detail: { courseId } }));
    }
  } catch { /* nothing depends on this */ }
  return true;
}

export function getAttempts(courseId, store = defaultStore()) {
  if (!usable(store)) return [];
  let list;
  try { list = JSON.parse(store.getItem(ATTEMPTS_PREFIX + courseId)); } catch { list = null; }
  return Array.isArray(list) ? [...list].reverse() : [];
}
