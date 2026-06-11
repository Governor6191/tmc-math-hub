# TMC Math Hub: project conventions

## Voice and attribution conventions

These rules apply to every file in this repo: site copy, code comments,
commit messages, README, meta tags, package.json, everything.

### Rule 1: No em dashes or en dashes anywhere

No em dash (U+2014). No en dash (U+2013). In any file, for any purpose.

Replace them with periods, commas, parentheses, colons, or restructure the
sentence. For numeric ranges write "to" or use a plain hyphen ("Year 1 to 4").

### Rule 2: No AI affiliation, attribution, or marketing language

This site ships as Sylvester's own work. AI tooling gets no credit, name,
watermark, or hint:

- No "Built with Claude", "Powered by AI", or any equivalent in footer text,
  the About page, meta tags, README, or code comments.
- No "Co-Authored-By" trailers on commits, ever. Commit author is
  Sylvester Arhin Mensah, using his GitHub noreply email (GitHub's email
  privacy setting blocks pushes that expose the personal address).
- No marketing-speak. Avoid: leverage, deep dive, ecosystem, robust,
  seamless, cutting-edge, world-class, transform, elevate. Technical uses
  in mathematics or code are fine ("Laplace transform", CSS "text-transform").
- No hidden AI signals in code comments ("this was generated", "AI assist
  here", and the like).

The voice is direct and matter-of-fact. Contractions where natural. Short
declarative sentences over long balanced ones. If a sentence sounds like a
press release, rewrite it.

### Audit checklist (run before shipping copy changes)

1. Grep the repo for U+2014 and U+2013. Every hit gets fixed. Crawled
   filenames in data/catalog*.json mirror the Drive hub and are data, not
   copy; if one ever contains these characters, leave it and flag it.
2. Grep (case-insensitive) for: Claude, AI, artificial intelligence,
   generated, Anthropic, Co-Authored-By. Real technical uses stay
   (catalog.generated.json, "generatedAt"). Attribution gets removed.
3. Grep for the buzzword list above. Rewrite anything in marketing voice.
4. Check recent commit messages for the same. Flag them for Sylvester to
   review; never rewrite published history without his go-ahead.
