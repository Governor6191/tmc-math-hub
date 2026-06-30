import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeC } from '../js/c-engine.js';

const Q = {
  tests: [
    { name: 'ex', kind: 'stdout', stdin: '3 4\n', expected: '7', hidden: false },
    { name: 'h1', kind: 'stdout', stdin: '10 20\n', expected: '30', hidden: true },
  ],
};

test('gradeC: all pass when stdout matches after trailing-space strip', () => {
  const g = gradeC(Q, { ex: { stdout: '7\n' }, h1: { stdout: '30\n' } }, { ok: true });
  assert.equal(g.score, 1);
  assert.equal(g.allCorrect, true);
  assert.equal(g.passed, 2);
  assert.equal(g.compileError, '');
});

test('gradeC: partial credit carries hidden, expected and got', () => {
  const g = gradeC(Q, { ex: { stdout: '7' }, h1: { stdout: '999' } }, { ok: true });
  assert.equal(g.score, 0.5);
  assert.equal(g.allCorrect, false);
  const h1 = g.tests.find(t => t.name === 'h1');
  assert.equal(h1.passed, false);
  assert.equal(h1.hidden, true);
  assert.equal(h1.expected, '30');
  assert.equal(h1.got, '999');
});

test('gradeC: a compile failure fails every test and surfaces the error', () => {
  const g = gradeC(Q, {}, { ok: false, stderr: 'main.c:2:1: error: expected ;' });
  assert.equal(g.score, 0);
  assert.equal(g.passed, 0);
  assert.match(g.compileError, /expected ;/);
  assert.ok(g.tests.every(t => !t.passed));
});

test('gradeC: a timed-out run fails just that test', () => {
  const g = gradeC(Q, { ex: { stdout: '7\n' }, h1: { timedOut: true } }, { ok: true });
  assert.equal(g.passed, 1);
  const h1 = g.tests.find(t => t.name === 'h1');
  assert.equal(h1.passed, false);
  assert.match(h1.got, /timed out/);
});
