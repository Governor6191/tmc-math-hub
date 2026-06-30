// Pure exam attempt model. No DOM, no storage, injected clock and rng,
// JSON-serializable so the whole attempt checkpoints to localStorage.

import { drawQuestions, shuffleOptions, shuffle } from './quiz-engine.js';
import { gradeCloze } from './cloze-engine.js';

export function createAttempt(courseId, format, pool, rng = Math.random, now = Date.now) {
  const drawn = drawQuestions(pool, format.questions, rng);
  return {
    courseId,
    formatId: format.id,
    formatLabel: format.label,
    durationMs: format.minutes * 60 * 1000,
    startedAt: now(),
    questions: drawn.map(q => {
      if (q.format === 'cloze') {
        return {
          id: q.id,
          format: 'cloze',
          stem: q.stem,
          solution: q.solution,
          gaps: q.gaps.map(g => (g.type === 'dropdown' ? { ...g, options: shuffle(g.options, rng) } : { ...g })),
          explanation: q.explanation,
          difficulty: q.difficulty,
          topicTitle: q.topicTitle ?? '',
        };
      }
      if (q.format === 'code') {
        return {
          id: q.id,
          format: 'code',
          language: q.language || 'python',
          stem: q.stem,
          starterCode: q.starterCode,
          tests: q.tests,
          solution: q.solution,
          explanation: q.explanation,
          difficulty: q.difficulty,
          topicTitle: q.topicTitle ?? '',
        };
      }
      const s = shuffleOptions(q, rng);
      return {
        id: q.id,
        format: 'mcq',
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
    if (q.format === 'cloze') correct += gradeCloze(q, attempt.answers[i] || {}).score;
    else if (q.format === 'code') correct += (attempt.answers[i] && attempt.answers[i].graded ? attempt.answers[i].graded.score : 0);
    else if (attempt.answers[i] === q.answerIndex) correct += 1;
  });
  return { correct, total: attempt.questions.length };
}
