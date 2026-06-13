# TMC Math Hub

### Live site: https://governor6191.github.io/tmc-math-hub/

Free learning platform for KNUST Mathematics undergraduates: every course's
slides and textbooks (Year 1 to 4) readable in-page, streamed from the TMC
academic board's Google Drive hub, plus thousands of practice questions and
Moodle-style mock exams (live for every Year 1 course). Light and dark themes,
slide-out navigation, no login.

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
