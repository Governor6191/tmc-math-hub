import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeQuestionMaps, mergeActivityMaps, mergeAttemptLists, mergeLabMaps } from '../js/cloud-merge.js';

test('mergeQuestionMaps: newest timestamp wins per question', () => {
  const local = { q1: { s: 1, at: 200 }, q2: { s: 0, at: 50 } };
  const cloud = { q1: { s: 0, at: 100 }, q3: { s: 1, at: 300 } };
  const m = mergeQuestionMaps(local, cloud);
  assert.deepEqual(m.q1, { s: 1, at: 200 }); // local newer
  assert.deepEqual(m.q2, { s: 0, at: 50 });  // local only
  assert.deepEqual(m.q3, { s: 1, at: 300 }); // cloud only
});

test('mergeQuestionMaps: cloud wins when strictly newer, empty sides pass through', () => {
  const m = mergeQuestionMaps({ q1: { s: 0, at: 10 } }, { q1: { s: 1, at: 20 } });
  assert.equal(m.q1.s, 1);
  assert.deepEqual(mergeQuestionMaps({}, { a: { s: 1, at: 1 } }).a.s, 1);
  assert.deepEqual(mergeQuestionMaps({ a: { s: 1, at: 1 } }, {}).a.s, 1);
});

test('mergeActivityMaps: larger count per day wins', () => {
  const m = mergeActivityMaps({ '2026-07-01': 3, '2026-06-30': 1 }, { '2026-07-01': 5, '2026-06-29': 2 });
  assert.deepEqual(m, { '2026-07-01': 5, '2026-06-30': 1, '2026-06-29': 2 });
});

test('mergeAttemptLists: union dedupes identical attempts and sorts by date', () => {
  const a1 = { date: '2026-06-30T10:00:00Z', formatId: 'midsem', score: 14, total: 20, minutesUsed: 30 };
  const a2 = { date: '2026-07-01T10:00:00Z', formatId: 'midsem', score: 17, total: 20, minutesUsed: 28 };
  const m = mergeAttemptLists([a2, a1], [a1]);
  assert.equal(m.length, 2);
  assert.equal(m[0].score, 14);
  assert.equal(m[1].score, 17);
});

test('mergeLabMaps: keeps the higher best and the newer code', () => {
  const local = { p1: { best: 0.5, code: 'old', at: 100 } };
  const cloud = { p1: { best: 1, code: 'new', at: 200 }, p2: { best: 0.3, code: 'x', at: 10 } };
  const m = mergeLabMaps(local, cloud);
  assert.equal(m.p1.best, 1);
  assert.equal(m.p1.code, 'new');
  assert.equal(m.p2.best, 0.3);
  const m2 = mergeLabMaps({ p1: { best: 1, code: 'mine', at: 300 } }, { p1: { best: 0.4, code: 'theirs', at: 100 } });
  assert.equal(m2.p1.best, 1);
  assert.equal(m2.p1.code, 'mine');
});
