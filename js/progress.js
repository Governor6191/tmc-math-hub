// Per-device practice progress in localStorage. Key scheme: tmc.v1.practice.<courseId>
// Store is injectable for tests; the default probes localStorage and degrades to null
// (private browsing, storage full) so callers can keep working without persistence.

const KEY_PREFIX = 'tmc.v1.practice.';

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

export function isAvailable(store = defaultStore()) {
  return store !== null && store !== undefined;
}

function readCourse(courseId, store) {
  let data;
  try { data = JSON.parse(store.getItem(KEY_PREFIX + courseId)); } catch { data = null; }
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

export function recordAnswer(courseId, questionId, value, store = defaultStore()) {
  if (!isAvailable(store)) return false;
  const data = readCourse(courseId, store);
  const n = value === true ? 1 : value === false ? 0 : Number(value);
  const score = Number.isFinite(n) ? n : 0;
  data[questionId] = { correct: score >= 1, score, at: Date.now() };
  try { store.setItem(KEY_PREFIX + courseId, JSON.stringify(data)); } catch { return false; }
  bumpActivity(store, Date.now());
  // Let the cloud sync layer (when signed in) know something changed. Guarded
  // so the module keeps working under node:test where window does not exist.
  try {
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('tmc:answer', { detail: { courseId } }));
    }
  } catch { /* nothing depends on this */ }
  return true;
}

// A small per-day answer counter (key tmc.v1.activity, {"YYYY-MM-DD": n}) so
// the dashboard can show exact streaks and daily activity. Answer timestamps
// alone lose history when a question is re-answered; this log does not.
const ACTIVITY_KEY = 'tmc.v1.activity';

function localDayKey(ts) {
  const d = new Date(ts);
  const p = x => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function getActivity(store = defaultStore()) {
  if (!isAvailable(store)) return {};
  let data;
  try { data = JSON.parse(store.getItem(ACTIVITY_KEY)); } catch { data = null; }
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

export function bumpActivity(store = defaultStore(), now = Date.now()) {
  if (!isAvailable(store)) return false;
  const map = getActivity(store);
  const key = localDayKey(now);
  map[key] = (map[key] || 0) + 1;
  try { store.setItem(ACTIVITY_KEY, JSON.stringify(map)); } catch { return false; }
  return true;
}

export function getProgress(courseId, store = defaultStore()) {
  if (!isAvailable(store)) return { attempted: 0, correct: 0, byQuestion: {} };
  const data = readCourse(courseId, store);
  const ids = Object.keys(data);
  const correct = ids.reduce((sum, id) => {
    const e = data[id];
    if (!e) return sum;
    return sum + (typeof e.score === 'number' ? e.score : (e.correct === true ? 1 : 0));
  }, 0);
  return { attempted: ids.length, correct, byQuestion: data };
}
