import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle, drawQuestions, shuffleOptions, mark, tally } from '../js/quiz-engine.js';

// deterministic rng for tests: cycles through the given sequence
function fakeRng(seq) {
  let i = 0;
  return () => seq[i++ % seq.length];
}

test('shuffle returns a permutation without mutating the input', () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, fakeRng([0.1, 0.9, 0.3, 0.7]));
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});

test('shuffle is deterministic under an injected rng', () => {
  const a = shuffle([1, 2, 3, 4], fakeRng([0.5]));
  const b = shuffle([1, 2, 3, 4], fakeRng([0.5]));
  assert.deepEqual(a, b);
});

test('drawQuestions takes at most count items, no duplicates', () => {
  const qs = Array.from({ length: 20 }, (_, i) => ({ id: `q${i}` }));
  const drawn = drawQuestions(qs, 10, fakeRng([0.3, 0.8, 0.05]));
  assert.equal(drawn.length, 10);
  assert.equal(new Set(drawn.map(q => q.id)).size, 10);
});

test('drawQuestions caps at the bank size', () => {
  const qs = [{ id: 'a' }, { id: 'b' }];
  assert.equal(drawQuestions(qs, 10).length, 2);
});

test('shuffleOptions permutes options and tracks the correct index', () => {
  const q = { options: ['A', 'B', 'C', 'D'], answer: 2 };
  const s = shuffleOptions(q, fakeRng([0.9, 0.1, 0.6]));
  assert.deepEqual([...s.options].sort(), ['A', 'B', 'C', 'D']);
  assert.equal(s.options[s.answerIndex], 'C');
});

test('mark compares against the shuffled correct index', () => {
  const s = { options: ['x', 'y'], answerIndex: 1 };
  assert.deepEqual(mark(s, 1), { correct: true, correctIndex: 1 });
  assert.deepEqual(mark(s, 0), { correct: false, correctIndex: 1 });
});

test('tally counts and rounds the percent', () => {
  assert.deepEqual(tally([]), { answered: 0, correct: 0, percent: 0 });
  assert.deepEqual(
    tally([{ correct: true }, { correct: true }, { correct: false }]),
    { answered: 3, correct: 2, percent: 67 });
});
