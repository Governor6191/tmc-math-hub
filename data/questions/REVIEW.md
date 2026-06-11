# Reviewing question banks (for Sylvester)

Draft banks live in data/questions/<course>/drafts/. Students never see them:
the site only serves banks wired into catalog.json, which happens at promotion.

Your loop per bank, about 10 minutes each:

1. Open the review page (works locally and on the live site):
   review.html?course=calculus-i&bank=limits
   Every question renders with real math, the correct answer highlighted,
   and the worked solution below.
2. Spot-check at least 10 questions: is the keyed answer right, are the
   distractors plausible, is the explanation actually teaching?
3. To feel it as a student: practice.html?c=calculus-i&t=limits&draft=1
4. Happy? Tell Claude "promote calculus-i limits", or run:
   node tools/promote-bank.js calculus-i limits
   then commit and push. The topic's practice goes live on the next deploy.
5. Not happy? Note the question ids and what is wrong; Claude regenerates
   or fixes those, the batch gets re-verified, you re-check.

Every draft batch was already machine-verified before it reached you:
structural validation plus an independent blind re-solve of every question.
Your check is the final gate, not the only one.

## Authoring notes (for whoever writes questions)

The validator bans em and en dashes, requires an even count of $ signs,
and requires balanced braces in every text field. Two known sharp edges:
write a solitary literal brace as \lbrace or \rbrace (a lone \{ trips the
brace check), and avoid \$ money amounts in stems (use GHS or cedis in
words instead; \$ trips the delimiter count).
