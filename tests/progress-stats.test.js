import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, shiftDay, streaks, mergeDayCounts, lastDays } from '../js/progress-stats.js';
import { recordAnswer, getActivity, bumpActivity } from '../js/progress.js';

function fakeStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

test('dayKey formats a timestamp as a local YYYY-MM-DD key', () => {
  const ts = new Date(2026, 6, 1, 9, 30).getTime(); // 1 July 2026, local
  assert.equal(dayKey(ts), '2026-07-01');
});

test('shiftDay crosses month and year boundaries', () => {
  assert.equal(shiftDay('2026-07-01', -1), '2026-06-30');
  assert.equal(shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(shiftDay('2026-02-28', 1), '2026-03-01');
  assert.equal(shiftDay('2024-02-28', 1), '2024-02-29'); // leap year
});

test('streaks: run ending today counts, and best spans history', () => {
  const days = ['2026-06-28', '2026-06-29', '2026-06-30', '2026-07-01', '2026-06-10', '2026-06-11'];
  const s = streaks(days, '2026-07-01');
  assert.equal(s.current, 4);
  assert.equal(s.best, 4);
});

test('streaks: today idle keeps the streak alive from yesterday', () => {
  const s = streaks(['2026-06-29', '2026-06-30'], '2026-07-01');
  assert.equal(s.current, 2);
});

test('streaks: a gap of more than one day resets the current streak', () => {
  const s = streaks(['2026-06-27', '2026-06-28'], '2026-07-01');
  assert.equal(s.current, 0);
  assert.equal(s.best, 2);
});

test('streaks: empty history gives zeros', () => {
  assert.deepEqual(streaks([], '2026-07-01'), { current: 0, best: 0 });
});

test('mergeDayCounts keeps the larger count per day', () => {
  const merged = mergeDayCounts({ '2026-07-01': 3 }, { '2026-07-01': 10, '2026-06-30': 2 });
  assert.deepEqual(merged, { '2026-07-01': 10, '2026-06-30': 2 });
});

test('lastDays returns n days ending today, oldest first, zero-filled', () => {
  const days = lastDays({ '2026-07-01': 5, '2026-06-29': 2 }, '2026-07-01', 3);
  assert.deepEqual(days, [
    { day: '2026-06-29', count: 2 },
    { day: '2026-06-30', count: 0 },
    { day: '2026-07-01', count: 5 },
  ]);
});

test('bumpActivity counts answers per local day', () => {
  const store = fakeStore();
  const noon = new Date(2026, 6, 1, 12).getTime();
  bumpActivity(store, noon);
  bumpActivity(store, noon + 60000);
  bumpActivity(store, noon + 24 * 3600 * 1000);
  const act = getActivity(store);
  assert.equal(act['2026-07-01'], 2);
  assert.equal(act['2026-07-02'], 1);
});

test('recordAnswer bumps the activity log for today', () => {
  const store = fakeStore();
  recordAnswer('calculus-i', 'q1', true, store);
  recordAnswer('calculus-i', 'q2', 0.5, store);
  const act = getActivity(store);
  const today = dayKey(Date.now());
  assert.equal(act[today], 2);
});

test('getActivity degrades to an empty object without storage', () => {
  assert.deepEqual(getActivity(null), {});
});
