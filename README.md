# TMC Math Hub

Free learning platform for KNUST Mathematics undergraduates: every course's
slides and textbooks (Year 1 to 4) readable in-page, streamed from the TMC
academic board's Google Drive hub. Practice questions and Moodle-style mock
exams arrive in later stages (see the design spec).

## Stack

Plain HTML, CSS, and JavaScript ES modules. No framework, no build step, no
dependencies. Node 18.13 or newer is needed only for maintainer tooling and tests.

## Working on the site

- Preview: `npm run serve` → http://localhost:8088 (pages need a server; `file://` won't work)
- Tests: `npm test`
- Refresh content after the Drive hub changes: see `tools/crawl-drive.md`

## Content model

`data/catalog.json` drives everything: years → semesters (with Year-4 option
tracks) → courses → topics (slides, videos, future question files) +
materials (each with a kind: pdf, practice, textbook, doc, video, image,
code, archive, other, plus a subfolder path hint). The skeleton is generated
by `tools/crawl-drive.js`; topic groupings and video links are hand-curated
(see `tools/curate-calc1.js` for the template).
