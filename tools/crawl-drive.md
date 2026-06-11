# Regenerating the catalog

`data/catalog.generated.json` is machine-written by `node tools/crawl-drive.js`
(crawls the public TMC Drive hub, root folder `1k-3KXvCbHkT3RKFBFY2XOz9wbcI2pbb3`,
via Drive's `embeddedfolderview` listing — no auth needed, hub must remain
"anyone with the link can view").

`data/catalog.json` is the file the site loads. It is the generated skeleton
**plus hand curation** (topic groupings, video links, exam formats, material kinds).

When new files land in the Drive hub:
1. `node tools/crawl-drive.js`
2. Diff: `git diff --no-index data/catalog.json data/catalog.generated.json`
3. Hand-merge new entries into `data/catalog.json` (don't overwrite curation).
4. `npm test`, eyeball the site locally, commit.
