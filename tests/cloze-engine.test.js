import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitSolution, normalizeText, gradeGap, correctDisplay, gradeCloze } from '../js/cloze-engine.js';

test('splitSolution splits text and gap segments in order', () => {
  assert.deepEqual(splitSolution('a {{1}} b {{2}}'), [
    { type: 'text', value: 'a ' },
    { type: 'gap', id: 1 },
    { type: 'text', value: ' b ' },
    { type: 'gap', id: 2 },
  ]);
  assert.deepEqual(splitSolution('{{1}} tail'), [
    { type: 'gap', id: 1 },
    { type: 'text', value: ' tail' },
  ]);
  assert.deepEqual(splitSolution('no gaps'), [{ type: 'text', value: 'no gaps' }]);
});

test('normalizeText strips all whitespace and is case sensitive', () => {
  assert.equal(normalizeText(' 3 x '), '3x');
  assert.notEqual(normalizeText('N'), normalizeText('n'));
});

test('gradeGap number honors tolerance and rejects non-numbers', () => {
  assert.equal(gradeGap({ type: 'number', answer: 3 }, '3'), true);
  assert.equal(gradeGap({ type: 'number', answer: 3 }, ' 3.0 '), true);
  assert.equal(gradeGap({ type: 'number', answer: 3.14, tolerance: 0.01 }, '3.15'), true);
  assert.equal(gradeGap({ type: 'number', answer: 3.14, tolerance: 0.01 }, '3.2'), false);
  assert.equal(gradeGap({ type: 'number', answer: 3 }, 'three'), false);
  assert.equal(gradeGap({ type: 'number', answer: 3 }, ''), false);
});

test('gradeGap dropdown is exact, text uses the accept list normalized', () => {
  assert.equal(gradeGap({ type: 'dropdown', options: ['1', '3'], answer: '3' }, '3'), true);
  assert.equal(gradeGap({ type: 'dropdown', options: ['1', '3'], answer: '3' }, '1'), false);
  assert.equal(gradeGap({ type: 'text', accept: ['3x'] }, '3 x'), true);
  assert.equal(gradeGap({ type: 'text', accept: ['3x'] }, '3X'), false);
});

test('correctDisplay gives the canonical answer per type', () => {
  assert.equal(correctDisplay({ type: 'number', answer: 3 }), '3');
  assert.equal(correctDisplay({ type: 'dropdown', answer: 'does not exist' }), 'does not exist');
  assert.equal(correctDisplay({ type: 'text', accept: ['3x', '3*x'] }), '3x');
});

test('gradeCloze returns per-gap results and a fractional score', () => {
  const q = { gaps: [
    { id: 1, type: 'number', answer: 1 },
    { id: 2, type: 'dropdown', options: ['1', '3'], answer: '3' },
    { id: 3, type: 'text', accept: ['x'] },
  ] };
  const r = gradeCloze(q, { 1: '1', 2: '1', 3: 'x' });
  assert.equal(r.total, 3);
  assert.equal(r.correctCount, 2);
  assert.equal(r.score, 2 / 3);
  assert.equal(r.allCorrect, false);
  assert.equal(r.gaps[1].correct, false);
  assert.equal(r.gaps[1].correctDisplay, '3');
});

test('gradeCloze with no values scores zero', () => {
  const q = { gaps: [{ id: 1, type: 'number', answer: 1 }] };
  assert.deepEqual(gradeCloze(q), { gaps: [{ id: 1, correct: false, given: undefined, correctDisplay: '1' }], correctCount: 0, total: 1, score: 0, allCorrect: false });
});
