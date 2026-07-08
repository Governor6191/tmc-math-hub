# Cloze authoring standard (reasoning first)

Adopted 2026-07-02 after the Calculus I prototype (commit bc10a0e). Every cloze
question on the site must meet this standard. It exists because the first
generation of cloze narrated the method in full and left blanks only at the
terminal arithmetic, which tested calculator punching instead of understanding.

## The five rules

1. **The narration never states the fact a blank asks for.** Not in the same
   sentence, not in the next one, not inside a later formula. If the solution
   displays the assembled result somewhere, a blank cannot ask for any part of
   it.
2. **At least one dropdown per question tests a reasoning choice**: which
   condition applies, which theorem fits, which rewrite or setup is correct,
   which case we are in. Its distractors are real misconceptions (the mistake a
   student who half-understands would make), never random noise.
3. **At most one pure-arithmetic blank per question**, and only as the final
   consequence of the chain. Evaluating an expression the solution already
   wrote out is never a blank.
4. **Blanks chain.** A later blank should require having genuinely understood
   the earlier ones. Partial credit then measures how far the reasoning
   carried. A later blank may reuse a value established by an earlier blank;
   that is chaining, not a leak.
5. **Keep the scenario syllabus-familiar.** Rewrites keep the mathematical
   situation of the question they replace (they may deepen it), so students
   still meet what class taught. Difficulty may move warmup to core.

## Schema (unchanged)

```json
{
  "id": "<courseId>-<topicId>-NNN", "format": "cloze",
  "stem": "...", "solution": "text with {{1}} markers between math chunks",
  "gaps": [
    { "id": 1, "type": "dropdown", "options": ["4 strings, may contain $math$"], "answer": "<exact option string>" },
    { "id": 2, "type": "number", "answer": 7, "tolerance": 0 },
    { "id": 3, "type": "text", "accept": ["jump"] }
  ],
  "explanation": "...", "difficulty": "core", "source": "..."
}
```

Hard constraints:

- A `{{n}}` blank must NEVER sit inside `$...$` math or inside a `backtick`
  code span. Put the blank between chunks: `$f(3) =$ {{1}}` not `$f(3) = {{1}}$`.
- Dropdowns have exactly 4 options; `answer` is character-identical to one of
  them; no two options may be mathematically equal to each other.
- `number` gaps: integers get `tolerance: 0`. Decimals only when genuinely
  decimal (round to 4 places, tolerance 0.0005; simple ones like 0.25 or 0.5
  get tolerance 0.001). Never require typing a repeating decimal: put
  fractions in a dropdown as `$\frac{2}{3}$` instead.
- `text` gaps only for a single robust word with variants
  (`"accept": ["maximum", "max"]`); when in doubt use a dropdown.
- Programming courses: wrap all commands, code and outputs in backticks;
  gaps there are number or dropdown only, dropdown options backtick-wrapped.
- Explanations show only after grading, so the explanation SHOULD narrate the
  full reasoning, name the traps, and say why each notable distractor is wrong.
- No em or en dashes anywhere.

## Worked contrast

Weak (retired pattern):

> The right piece gives both the value and the right-hand limit at 3:
> f(3) = 3^2 - 2 = {{1}}. The left-hand limit is 3k + 1. Continuity requires
> these to be equal, so solving 3k + 1 = 7 gives k = {{2}}.

Strong (this standard):

> Continuity at x = 3 requires {{1: dropdown over what continuity demands}}.
> The left-hand limit works out to {{2: dropdown 3k+1 vs k+1 vs 3k vs 9k+1}},
> while the right piece gives f(3) = {{3: number, computed by the student}}.
> The value of k that reconciles the two sides is k = {{4: number}}.

## Verifier checklist

Independent blind verification of every rewritten cloze checks:

1. Re-derive every gap answer from scratch; stored answers must be correct
   within tolerance.
2. No dropdown distractor is also correct, and none is mathematically equal to
   the keyed answer in disguise.
3. No solution sentence states a blank's answer (the giveaway scan).
4. No dropdown option text leaks a sibling gap's numeric answer, except where
   a later blank legitimately builds on an earlier one.
5. Explanations contain no mathematical errors.
