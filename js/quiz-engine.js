// Pure quiz logic. No DOM, no fetch, no storage. Runs in browsers and Node.

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function drawQuestions(questions, count, rng = Math.random) {
  return shuffle(questions, rng).slice(0, Math.min(count, questions.length));
}

// Returns the options in a new order plus where the correct answer landed.
export function shuffleOptions(question, rng = Math.random) {
  const order = shuffle(question.options.map((_, i) => i), rng);
  return {
    options: order.map(i => question.options[i]),
    answerIndex: order.indexOf(question.answer),
    order,
  };
}

export function mark(shuffled, chosenIndex) {
  return { correct: chosenIndex === shuffled.answerIndex, correctIndex: shuffled.answerIndex };
}

export function tally(results) {
  const answered = results.length;
  const correct = results.filter(r => r.correct).length;
  return { answered, correct, percent: answered ? Math.round((correct / answered) * 100) : 0 };
}
