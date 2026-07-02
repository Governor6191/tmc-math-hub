// Pure merge rules for cloud sync. Local and cloud copies of the same student's
// progress are combined so nothing is ever lost: newest answer wins, streak days
// take the larger count, exam attempts union, lab bests keep the higher score.
// No DOM, no Firebase, node-tested.

// { qid: { s, at } } maps (s = latest score, at = timestamp). Newest at wins.
export function mergeQuestionMaps(local = {}, cloud = {}) {
  const out = { ...cloud };
  for (const [id, entry] of Object.entries(local || {})) {
    const other = out[id];
    if (!other || (entry && (entry.at || 0) >= (other.at || 0))) out[id] = entry;
  }
  return out;
}

// { "YYYY-MM-DD": count } maps. Larger count per day wins.
export function mergeActivityMaps(local = {}, cloud = {}) {
  const out = { ...(cloud || {}) };
  for (const [day, n] of Object.entries(local || {})) {
    const v = Number(n) || 0;
    if (v > (Number(out[day]) || 0)) out[day] = v;
  }
  return out;
}

// Attempt lists: union, deduplicated by (date, formatId, score, total), sorted by date.
export function mergeAttemptLists(local = [], cloud = []) {
  const seen = new Set();
  const out = [];
  for (const a of [...(cloud || []), ...(local || [])]) {
    if (!a || typeof a !== 'object') continue;
    const key = [a.date, a.formatId, a.score, a.total].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  out.sort((x, y) => String(x.date).localeCompare(String(y.date)));
  return out;
}

// Lab saves { qid: { best, code, at } }: higher best wins; the newer at decides
// which code to keep; missing timestamps prefer local (the device in hand).
export function mergeLabMaps(local = {}, cloud = {}) {
  const out = {};
  const ids = new Set([...Object.keys(local || {}), ...Object.keys(cloud || {})]);
  for (const id of ids) {
    const l = (local || {})[id];
    const c = (cloud || {})[id];
    if (!l) { out[id] = c; continue; }
    if (!c) { out[id] = l; continue; }
    const newer = (c.at || 0) > (l.at || 0) ? c : l;
    out[id] = {
      ...newer,
      best: Math.max(Number(l.best) || 0, Number(c.best) || 0),
    };
  }
  return out;
}
