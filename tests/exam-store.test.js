import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, recordAttempt, getAttempts } from '../js/exam-store.js';

function memStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

test('checkpoint round trip and clear', () => {
  const store = memStore();
  const attempt = { courseId: 'calculus-i', startedAt: 5, durationMs: 100, answers: { 0: 1 } };
  assert.equal(saveCheckpoint(attempt, store), true);
  assert.deepEqual(loadCheckpoint(store), attempt);
  clearCheckpoint(store);
  assert.equal(loadCheckpoint(store), null);
});

test('loadCheckpoint returns null on corrupt data or null store', () => {
  const store = memStore();
  store.setItem('tmc.v1.exam.active', '{nope');
  assert.equal(loadCheckpoint(store), null);
  assert.equal(loadCheckpoint(null), null);
});

test('recordAttempt appends per course; getAttempts returns newest first', () => {
  const store = memStore();
  recordAttempt('calculus-i', { date: 1, formatId: 'midsem', score: 20, total: 30, minutesUsed: 35 }, store);
  recordAttempt('calculus-i', { date: 2, formatId: 'endsem', score: 50, total: 60, minutesUsed: 80 }, store);
  recordAttempt('calculus-ii', { date: 3, formatId: 'midsem', score: 10, total: 30, minutesUsed: 12 }, store);
  const list = getAttempts('calculus-i', store);
  assert.equal(list.length, 2);
  assert.equal(list[0].date, 2);
  assert.equal(getAttempts('calculus-ii', store).length, 1);
  assert.deepEqual(getAttempts('nope', store), []);
});

test('null store degrades: record returns false, getAttempts returns []', () => {
  assert.equal(recordAttempt('c', { date: 1 }, null), false);
  assert.deepEqual(getAttempts('c', null), []);
});

test('corrupt attempts array resets instead of crashing', () => {
  const store = memStore();
  store.setItem('tmc.v1.exam.attempts.calculus-i', '[broken');
  assert.deepEqual(getAttempts('calculus-i', store), []);
  assert.equal(recordAttempt('calculus-i', { date: 9 }, store), true);
  assert.equal(getAttempts('calculus-i', store).length, 1);
});
