// Pure helpers for the progress dashboard: local day keys, streak arithmetic
// and day-count merging. No DOM, no storage, injected "today", so it all runs
// under node:test.

export function dayKey(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// Shift a YYYY-MM-DD key by whole days. Anchored at noon so clock changes
// elsewhere in the world cannot skip or repeat a date.
export function shiftDay(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  dt.setDate(dt.getDate() + delta);
  return dayKey(dt.getTime());
}

// days: iterable of YYYY-MM-DD keys with any activity. The current streak ends
// today, or yesterday when today has no activity yet (the streak is still
// alive, just not extended). best is the longest run anywhere in history.
export function streaks(days, todayKey) {
  const set = new Set(days);
  let current = 0;
  let cursor = set.has(todayKey) ? todayKey : shiftDay(todayKey, -1);
  while (set.has(cursor)) { current += 1; cursor = shiftDay(cursor, -1); }
  let best = 0;
  for (const k of set) {
    if (set.has(shiftDay(k, -1))) continue; // only measure from the start of a run
    let len = 1;
    let c = k;
    while (set.has(shiftDay(c, 1))) { len += 1; c = shiftDay(c, 1); }
    if (len > best) best = len;
  }
  return { current, best };
}

// Merge day-count maps, keeping the larger count per day. Used to blend the
// exact activity log with days derived from older answer timestamps.
export function mergeDayCounts(...maps) {
  const out = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m || {})) {
      const n = Number(v) || 0;
      if (n > (out[k] || 0)) out[k] = n;
    }
  }
  return out;
}

// The last n day keys ending at todayKey, oldest first, with their counts.
export function lastDays(counts, todayKey, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = shiftDay(todayKey, -i);
    out.push({ day: k, count: counts[k] || 0 });
  }
  return out;
}
