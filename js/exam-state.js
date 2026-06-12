// Pure exam attempt model. No DOM, no storage, injected clock and rng,
// JSON-serializable so the whole attempt checkpoints to localStorage.

import { drawQuestions, shuffleOptions } from './quiz-engine.js';

export function createAttempt(courseId, format, pool, rng = Math.random, now = Date.now) {
  const drawn = drawQuestions(pool, format.questions, rng);
  return {
    courseId,
    formatId: format.id,
    formatLabel: format.label,
    durationMs: format.minutes * 60 * 1000,
    startedAt: now(),
    questions: drawn.map(q => {
      const s = shuffleOptions(q, rng);
      return {
        id: q.id,
        stem: q.stem,
        options: s.options,
        answerIndex: s.answerIndex,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topicTitle: q.topicTitle ?? '',
      };
    }),
    answers: {},
    flags: {},
    current: 0,
    submitted: false,
  };
}

export function remainingMs(attempt, now = Date.now) {
  return Math.max(0, attempt.startedAt + attempt.durationMs - now());
}

export function answerQuestion(attempt, qIndex, choice) {
  attempt.answers[qIndex] = choice;
}

export function toggleFlag(attempt, qIndex) {
  if (attempt.flags[qIndex]) delete attempt.flags[qIndex];
  else attempt.flags[qIndex] = true;
}

export function answeredCount(attempt) {
  return Object.keys(attempt.answers).length;
}

export function scoreAttempt(attempt) {
  let correct = 0;
  attempt.questions.forEach((q, i) => {
    if (attempt.answers[i] === q.answerIndex) correct++;
  });
  return { correct, total: attempt.questions.length };
}
