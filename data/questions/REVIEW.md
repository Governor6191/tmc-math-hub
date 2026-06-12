# Reviewing question banks (for Sylvester)

Standing policy (set by Sylvester, 2026-06-12): a bank auto-promotes once it
passes both machine gates, structural validation plus an independent blind
re-solve of every question with full agreement. Sylvester reviews
retroactively and can pull any question or bank back by id.

Your retroactive loop per bank, about 10 minutes each:

1. Open the review page (works locally and on the live site, before or
   after promotion): review.html?course=calculus-i&bank=limits
   Every question renders with real math, the correct answer highlighted,
   and the worked solution below. Per-bank verification stats live in
   data/questions/<course>/drafts/VERIFICATION.md.
2. Spot-check at least 10 questions: is the keyed answer right, are the
   distractors plausible, is the explanation actually teaching?
3. Found a bad one? Tell Claude the question id and what is wrong; it gets
   fixed or removed, re-verified, and redeployed in one commit.

A bank that fails blind verification never promotes: mismatches get fixed
and re-checked, and a bank with more than 20 percent mismatches is
regenerated from scratch.

## Authoring notes (for whoever writes questions)

The validator bans em and en dashes, requires an even count of $ signs,
and requires balanced braces in every text field. Two known sharp edges:
write a solitary literal brace as \lbrace or \rbrace (a lone \{ trips the
brace check), and avoid \$ money amounts in stems (use GHS or cedis in
words instead; \$ trips the delimiter count).
