import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHarness, parseResults, gradeCode } from '../js/code-engine.js';

const FUNC_Q = {
  id: 'c-1', format: 'code', language: 'python',
  stem: 'mean', starterCode: 'def mean(xs):\n    pass',
  tests: [
    { name: 'basic', kind: 'function', call: 'mean([1,2,3,4])', expected: '2.5', hidden: false },
    { name: 'neg', kind: 'function', call: 'mean([-2,2])', expected: '0.0', hidden: true },
  ],
  solution: 'def mean(xs):\n    return sum(xs)/len(xs)',
  explanation: 'sum over count', difficulty: 'core', source: 's',
};

test('buildHarness embeds student code and every test call', () => {
  const h = buildHarness(FUNC_Q, 'def mean(xs):\n    return sum(xs)/len(xs)');
  assert.ok(h.includes('return sum(xs)/len(xs)'));
  assert.ok(h.includes('mean([1,2,3,4])'));
  assert.ok(h.includes('mean([-2,2])'));
  assert.ok(h.includes('@@TMC@@'));
});

test('parseResults reads only marker lines', () => {
  const out = 'noise\n@@TMC@@{"name":"basic","passed":true,"got":"2.5"}\nmore\n';
  const r = parseResults(out);
  assert.deepEqual(r, [{ name: 'basic', passed: true, got: '2.5' }]);
});

test('gradeCode scores by fraction passed and carries hidden/expected from the question', () => {
  const raw = '@@TMC@@{"name":"basic","passed":true,"got":"2.5"}\n'
            + '@@TMC@@{"name":"neg","passed":false,"got":"1.0"}\n';
  const g = gradeCode(FUNC_Q, raw, '');
  assert.equal(g.total, 2);
  assert.equal(g.passed, 1);
  assert.equal(g.score, 0.5);
  assert.equal(g.allCorrect, false);
  assert.equal(g.tests[1].hidden, true);
  assert.equal(g.tests[1].expected, '0.0');
  assert.equal(g.tests[0].got, '2.5');
});

test('gradeCode marks all tests failed when the run errored before any marker', () => {
  const g = gradeCode(FUNC_Q, '', 'SyntaxError: bad');
  assert.equal(g.passed, 0);
  assert.equal(g.score, 0);
  assert.ok(g.tests.every(t => t.passed === false));
});
