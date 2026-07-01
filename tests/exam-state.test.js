import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAttempt, remainingMs, answerQuestion, toggleFlag, answeredCount, scoreAttempt } from '../js/exam-state.js';

function fakeRng(seq) { let i = 0; return () => seq[i++ % seq.length]; }
const FORMAT = { id: 'midsem', label: 'Mid-semester', questions: 3, minutes: 40 };
const POOL = Array.from({ length: 5 }, (_, i) => ({
  id: `q${i}`, stem: `stem ${i}`, options: ['a', 'b', 'c', 'd'], answer: 1,
  explanation: `expl ${i}`, difficulty: 'core', topicTitle: 'Limits',
}));

function freshAttempt() {
  return createAttempt('calculus-i', FORMAT, POOL, fakeRng([0.4, 0.9, 0.1]), () => 1000000);
}

test('createAttempt draws the format count, shuffles options, tracks the key', () => {
  const a = freshAttempt();
  assert.equal(a.courseId, 'calculus-i');
  assert.equal(a.formatId, 'midsem');
  assert.equal(a.questions.length, 3);
  assert.equal(a.durationMs, 40 * 60 * 1000);
  assert.equal(a.startedAt, 1000000);
  for (const q of a.questions) {
    assert.equal(q.options.length, 4);
    assert.equal(q.options[q.answerIndex], 'b');
  }
  assert.deepEqual(a.answers, {});
  assert.deepEqual(a.flags, {});
  assert.equal(a.submitted, false);
});

test('createAttempt caps at the pool size when the format asks for more', () => {
  const big = { ...FORMAT, questions: 50 };
  assert.equal(createAttempt('c', big, POOL, fakeRng([0.5]), () => 0).questions.length, 5);
});

test('remainingMs counts down from duration and floors at zero', () => {
  const a = freshAttempt();
  assert.equal(remainingMs(a, () => 1000000), 40 * 60 * 1000);
  assert.equal(remainingMs(a, () => 1000000 + 60 * 1000), 39 * 60 * 1000);
  assert.equal(remainingMs(a, () => 1000000 + 41 * 60 * 1000), 0);
});

test('answerQuestion records and overwrites; answeredCount counts unique', () => {
  const a = freshAttempt();
  answerQuestion(a, 0, 2);
  answerQuestion(a, 0, 1);
  answerQuestion(a, 2, 0);
  assert.equal(a.answers[0], 1);
  assert.equal(answeredCount(a), 2);
});

test('toggleFlag flips on and off', () => {
  const a = freshAttempt();
  toggleFlag(a, 1);
  assert.equal(a.flags[1], true);
  toggleFlag(a, 1);
  assert.equal(1 in a.flags, false);
});

test('scoreAttempt counts answers matching the shuffled key', () => {
  const a = freshAttempt();
  answerQuestion(a, 0, a.questions[0].answerIndex);
  answerQuestion(a, 1, (a.questions[1].answerIndex + 1) % 4);
  const s = scoreAttempt(a);
  assert.deepEqual(s, { correct: 1, total: 3 });
});

test('an attempt survives a JSON round trip (checkpoint shape)', () => {
  const a = freshAttempt();
  answerQuestion(a, 0, 3);
  toggleFlag(a, 2);
  const back = JSON.parse(JSON.stringify(a));
  assert.equal(remainingMs(back, () => 1000000 + 1000), a.durationMs - 1000);
  assert.equal(back.answers[0], 3);
  assert.equal(back.flags[2], true);
});

test('scoreAttempt gives partial credit for a cloze question and adds it to mcq marks', () => {
  const pool = [
    { id: 'm1', stem: 's', options: ['a', 'b'], answer: 0, explanation: 'e', difficulty: 'core', topicTitle: 'T' },
    { id: 'c1', format: 'cloze', stem: 's2', solution: '{{1}} {{2}}',
      gaps: [{ id: 1, type: 'number', answer: 2 }, { id: 2, type: 'number', answer: 5 }],
      explanation: 'e2', difficulty: 'core', topicTitle: 'T' },
  ];
  const fmt = { id: 'f', label: 'F', questions: 2, minutes: 10 };
  const a = createAttempt('c', fmt, pool, () => 0.1, () => 0);
  const mcq = a.questions.findIndex(q => q.format !== 'cloze');
  const cloze = a.questions.findIndex(q => q.format === 'cloze');
  answerQuestion(a, mcq, a.questions[mcq].answerIndex);     // 1.0
  answerQuestion(a, cloze, { 1: '2', 2: '9' });             // 0.5
  const s = scoreAttempt(a);
  assert.equal(s.total, 2);
  assert.equal(s.correct, 1.5);
});

test('createAttempt snapshots a code question keeping tests, starter and solution', () => {
  const pool = [{
    id: 'k1', format: 'code', language: 'python', stem: 'double', starterCode: 'def double(x):\n    pass',
    tests: [{ name: 'a', kind: 'function', call: 'double(3)', expected: '6', hidden: false }],
    solution: 'def double(x):\n    return 2*x', explanation: 'e', difficulty: 'core', topicTitle: 'T',
  }];
  const fmt = { id: 'f', label: 'F', questions: 1, minutes: 10 };
  const a = createAttempt('c', fmt, pool, () => 0, () => 0);
  const q = a.questions[0];
  assert.equal(q.format, 'code');
  assert.equal(q.starterCode, 'def double(x):\n    pass');
  assert.equal(q.tests.length, 1);
  assert.equal(q.solution, 'def double(x):\n    return 2*x');
});

test('scoreAttempt adds a stored code score to the marks', () => {
  const pool = [
    { id: 'm1', stem: 's', options: ['a', 'b'], answer: 0, explanation: 'e', difficulty: 'core', topicTitle: 'T' },
    { id: 'k1', format: 'code', language: 'python', stem: 'c', starterCode: 'x',
      tests: [{ name: 'a', kind: 'function', call: 'f()', expected: '1', hidden: false }],
      solution: 's', explanation: 'e', difficulty: 'core', topicTitle: 'T' },
  ];
  const fmt = { id: 'f', label: 'F', questions: 2, minutes: 10 };
  const a = createAttempt('c', fmt, pool, () => 0.1, () => 0);
  const mcq = a.questions.findIndex(q => q.format !== 'code' && q.format !== 'cloze');
  const code = a.questions.findIndex(q => q.format === 'code');
  answerQuestion(a, mcq, a.questions[mcq].answerIndex);
  answerQuestion(a, code, { code: 'whatever', graded: { score: 0.5 } });
  const s = scoreAttempt(a);
  assert.equal(s.total, 2);
  assert.equal(s.correct, 1.5);
});

test('createAttempt guarantees a Python code question appears in the exam', () => {
  const pool = [
    ...Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i, stem: 's', options: ['a', 'b'], answer: 0, explanation: 'e', difficulty: 'core', topicTitle: 'T' })),
    { id: 'code1', format: 'code', language: 'python', stem: 'c', starterCode: 'x',
      tests: [{ name: 'a', kind: 'function', call: 'f()', expected: '1', hidden: false }],
      solution: 's', explanation: 'e', difficulty: 'core', topicTitle: 'T' },
  ];
  const fmt = { id: 'f', label: 'F', questions: 5, minutes: 10 };
  const a = createAttempt('c', fmt, pool, () => 0.99, () => 0);
  assert.equal(a.questions.length, 5);
  assert.ok(a.questions.some(q => q.format === 'code'));
});

test('createAttempt keeps C code questions out of the exam entirely', () => {
  const pool = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: 'm' + i, stem: 's', options: ['a', 'b'], answer: 0, explanation: 'e', difficulty: 'core', topicTitle: 'T' })),
    { id: 'cq', format: 'code', language: 'c', stem: 'c', starterCode: 'x',
      tests: [{ name: 'a', kind: 'stdout', stdin: '', expected: '1', hidden: false }],
      solution: 's', explanation: 'e', difficulty: 'core', topicTitle: 'T' },
  ];
  const fmt = { id: 'f', label: 'F', questions: 7, minutes: 10 };
  const a = createAttempt('c', fmt, pool, () => 0, () => 0);
  assert.ok(!a.questions.some(q => q.format === 'code'));
});
