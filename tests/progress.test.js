import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAvailable, recordAnswer, getProgress } from '../js/progress.js';

// minimal localStorage stand-in
function memStore() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

test('isAvailable is false for a null store, true for a working one', () => {
  assert.equal(isAvailable(null), false);
  assert.equal(isAvailable(memStore()), true);
});

test('recordAnswer then getProgress round-trips', () => {
  const store = memStore();
  recordAnswer('calculus-i', 'calculus-i-limits-001', true, store);
  recordAnswer('calculus-i', 'calculus-i-limits-002', false, store);
  const p = getProgress('calculus-i', store);
  assert.equal(p.attempted, 2);
  assert.equal(p.correct, 1);
  assert.equal(p.byQuestion['calculus-i-limits-001'].correct, true);
});

test('a re-answer overwrites the previous record for that question', () => {
  const store = memStore();
  recordAnswer('calculus-i', 'q1', false, store);
  recordAnswer('calculus-i', 'q1', true, store);
  const p = getProgress('calculus-i', store);
  assert.equal(p.attempted, 1);
  assert.equal(p.correct, 1);
});

test('null store: recordAnswer returns false, getProgress returns zeros', () => {
  assert.equal(recordAnswer('c', 'q', true, null), false);
  assert.deepEqual(getProgress('c', null), { attempted: 0, correct: 0, byQuestion: {} });
});

test('corrupt stored JSON resets gracefully instead of crashing', () => {
  const store = memStore();
  store.setItem('tmc.v1.practice.calculus-i', '{not json');
  assert.deepEqual(getProgress('calculus-i', store), { attempted: 0, correct: 0, byQuestion: {} });
  assert.equal(recordAnswer('calculus-i', 'q1', true, store), true);
  assert.equal(getProgress('calculus-i', store).attempted, 1);
});

test('a stored JSON array is treated as corrupt and reset', () => {
  const store = memStore();
  store.setItem('tmc.v1.practice.calculus-i', '[1,2]');
  assert.deepEqual(getProgress('calculus-i', store), { attempted: 0, correct: 0, byQuestion: {} });
});

test('courses are stored under separate keys', () => {
  const store = memStore();
  recordAnswer('calculus-i', 'q1', true, store);
  recordAnswer('calculus-ii', 'q9', false, store);
  assert.equal(getProgress('calculus-i', store).attempted, 1);
  assert.equal(getProgress('calculus-ii', store).attempted, 1);
});
