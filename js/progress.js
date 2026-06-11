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

export function recordAnswer(courseId, questionId, correct, store = defaultStore()) {
  if (!isAvailable(store)) return false;
  const data = readCourse(courseId, store);
  data[questionId] = { correct: !!correct, at: Date.now() };
  try { store.setItem(KEY_PREFIX + courseId, JSON.stringify(data)); } catch { return false; }
  return true;
}

export function getProgress(courseId, store = defaultStore()) {
  if (!isAvailable(store)) return { attempted: 0, correct: 0, byQuestion: {} };
  const data = readCourse(courseId, store);
  const ids = Object.keys(data);
  return {
    attempted: ids.length,
    correct: ids.filter(id => data[id] && data[id].correct === true).length,
    byQuestion: data,
  };
}
