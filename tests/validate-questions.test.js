import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBank } from '../tools/validate-questions.js';

function goodBank() {
  return {
    courseId: 'calculus-i',
    topicId: 'limits',
    status: 'draft',
    questions: [
      {
        id: 'calculus-i-limits-001',
        stem: 'Evaluate $\\lim_{x\\to 0}\\frac{\\sin 3x}{x}$.',
        options: ['$0$', '$1$', '$3$', 'The limit does not exist'],
        answer: 2,
        explanation: 'Rewrite as $3\\cdot\\frac{\\sin 3x}{3x}$, which tends to $3\\cdot 1 = 3$.',
        difficulty: 'core',
        source: 'in the style of Stewart 8e, section 2.3',
      },
    ],
  };
}

test('a well-formed bank has no errors', () => {
  assert.deepEqual(validateBank(goodBank(), 'calculus-i', 'limits'), []);
});

test('rejects bad status, wrong ids, out-of-range answers, short explanations', () => {
  const b = goodBank();
  b.status = 'published';
  b.questions[0].id = 'oops-001';
  b.questions[0].answer = 9;
  b.questions[0].explanation = 'no';
  const errors = validateBank(b, 'calculus-i', 'limits');
  assert.ok(errors.some(e => e.includes('status')));
  assert.ok(errors.some(e => e.includes('id')));
  assert.ok(errors.some(e => e.includes('answer')));
  assert.ok(errors.some(e => e.includes('explanation')));
});

test('rejects duplicate ids and option counts outside 2 to 5', () => {
  const b = goodBank();
  b.questions.push({ ...goodBank().questions[0] });
  b.questions.push({ ...goodBank().questions[0], id: 'calculus-i-limits-002', options: ['$1$'], answer: 0 });
  const errors = validateBank(b, 'calculus-i', 'limits');
  assert.ok(errors.some(e => e.includes('duplicate')));
  assert.ok(errors.some(e => e.includes('options')));
});

test('rejects unbalanced math delimiters', () => {
  const b = goodBank();
  b.questions[0].stem = 'Evaluate $\\lim_{x\\to 0} x$ and $x';
  const errors = validateBank(b, 'calculus-i', 'limits');
  assert.ok(errors.some(e => e.includes('delimiter')));
});

test('rejects em and en dashes in any question text (voice rules)', () => {
  const b = goodBank();
  b.questions[0].explanation = 'First simplify — then take the limit, carefully.';
  const errors = validateBank(b, 'calculus-i', 'limits');
  assert.ok(errors.some(e => e.includes('dash')));
});

test('rejects bad difficulty and empty source', () => {
  const b = goodBank();
  b.questions[0].difficulty = 'impossible';
  b.questions[0].source = '';
  const errors = validateBank(b, 'calculus-i', 'limits');
  assert.ok(errors.some(e => e.includes('difficulty')));
  assert.ok(errors.some(e => e.includes('source')));
});

test('rejects two options with the same numeric value (reduced vs unreduced)', () => {
  const b = goodBank();
  b.questions[0].options = ['$\\frac{7}{15}$', '$\\frac{21}{45}$', '$1$', '$2$'];
  b.questions[0].answer = 0;
  const errors = validateBank(b, 'calculus-i', 'limits');
  assert.ok(errors.some(e => e.includes('option') && e.includes('same value')));
});

test('rejects two textually identical options', () => {
  const b = goodBank();
  b.questions[0].options = ['$5$', '$5$', '$1$', '$2$'];
  b.questions[0].answer = 0;
  const errors = validateBank(b, 'calculus-i', 'limits');
  assert.ok(errors.some(e => e.includes('option') && e.includes('same value')));
});

test('accepts distinct option values including a sign difference and opaque expressions', () => {
  const b = goodBank();
  b.questions[0].options = ['$\\frac{2}{3}$', '$-\\frac{2}{3}$', '$e^{-2}$', '$1 - e^{-2}$'];
  b.questions[0].answer = 0;
  assert.deepEqual(validateBank(b, 'calculus-i', 'limits'), []);
});
