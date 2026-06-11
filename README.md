# TMC Math Hub

Free learning platform for KNUST Mathematics undergraduates: every course's
slides and textbooks (Year 1–4) readable in-page, with practice questions and
Moodle-style mock exams coming in later stages.

- Plain HTML/CSS/JS. No build step, no dependencies.
- PDFs stream from the TMC academic board Google Drive hub — nothing is hosted here.
- `data/catalog.json` is the single source of content; regenerate the skeleton
  with `node tools/crawl-drive.js` (see `tools/crawl-drive.md`).

Local preview: `npm run serve` → http://localhost:8088
Tests: `npm test`
