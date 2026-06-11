import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFolderListing, decodeEntities, slugify } from '../tools/crawl-drive.js';

const FIXTURE = `
<div class="flip-entries">
<div class="flip-entry" id="entry-18YLXoauiWGy1XTxwYC44MqadChGUr5SW"><div class="flip-entry-visual"><a href="https://drive.google.com/drive/folders/18YLXoauiWGy1XTxwYC44MqadChGUr5SW"><img src="x"></a></div><div class="flip-entry-info"><a href="https://drive.google.com/drive/folders/18YLXoauiWGy1XTxwYC44MqadChGUr5SW"><div class="flip-entry-title">YEAR 1</div></a></div></div>
<div class="flip-entry" id="entry-1SNHKRvcGhOw6leM8jTn4af_AfA4KJgSZ"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/1SNHKRvcGhOw6leM8jTn4af_AfA4KJgSZ/view?usp=drive_web"><div class="flip-entry-title">4. Limits &amp; Continuity.pdf</div></a></div></div>
</div>`;

test('parseFolderListing extracts folders and files with ids, names, types', () => {
  const entries = parseFolderListing(FIXTURE);
  assert.deepEqual(entries, [
    { id: '18YLXoauiWGy1XTxwYC44MqadChGUr5SW', name: 'YEAR 1', type: 'folder' },
    { id: '1SNHKRvcGhOw6leM8jTn4af_AfA4KJgSZ', name: '4. Limits & Continuity.pdf', type: 'file' },
  ]);
});

// A2: garbage HTML now throws; valid-but-empty listing returns []
test('parseFolderListing throws on unrecognized markup, returns [] on valid empty listing', () => {
  assert.throws(() => parseFolderListing('<html><body>nothing here</body></html>'), /flip-entries/);
  assert.deepEqual(parseFolderListing('<div class="flip-entries"></div>'), []);
});

// A1: trailing folders link after the last entry must not misclassify a file
test('a trailing folders link after the last entry does not misclassify it', () => {
  const html = `<div class="flip-entries"><div class="flip-entry" id="entry-abc123"><a href="https://drive.google.com/file/d/abc123/view"><div class="flip-entry-title">notes.pdf</div></a></div></div><div class="footer"><a href="https://drive.google.com/drive/folders/zzz999">open hub</a></div>`;
  assert.deepEqual(parseFolderListing(html), [{ id: 'abc123', name: 'notes.pdf', type: 'file' }]);
});

test('decodeEntities handles the five common entities', () => {
  assert.equal(decodeEntities('A &amp; B &lt;x&gt; &quot;q&quot; &#39;s&#39;'), `A & B <x> "q" 's'`);
  // A3: numeric entities (decimal and hex)
  assert.equal(decodeEntities('L&#244;pital&#x2019;s rule'), 'Lôpital’s rule');
});

test('slugify produces url-safe ids', () => {
  assert.equal(slugify('CALCULUS I'), 'calculus-i');
  assert.equal(slugify('ELECTRICITY & MAGNETISM'), 'electricity-and-magnetism');
  assert.equal(slugify('  COMM SKILLS I  '), 'comm-skills-i');
});

// ── Part B ──────────────────────────────────────────────────────────────────
import { crawlTree, buildCatalog } from '../tools/crawl-drive.js';

function fakeListing(entries) {
  return '<div class="flip-entries">' + entries.map(e =>
    `<div class="flip-entry" id="entry-${e.id}"><a href="${e.type === 'folder'
      ? `https://drive.google.com/drive/folders/${e.id}`
      : `https://drive.google.com/file/d/${e.id}/view`}"><div class="flip-entry-title">${e.name}</div></a></div>`
  ).join('\n') + '</div>';
}

const LISTINGS = {
  root: fakeListing([{ id: 'y1', name: 'YEAR 1', type: 'folder' }]),
  y1: fakeListing([{ id: 's1', name: 'SEM 1', type: 'folder' }]),
  s1: fakeListing([{ id: 'c1', name: 'CALCULUS I', type: 'folder' }]),
  c1: fakeListing([
    { id: 'f1', name: 'Limits.pdf', type: 'file' },
    { id: 'p1', name: 'PRACTICE', type: 'folder' },
  ]),
  p1: fakeListing([{ id: 'f2', name: 'calci_complete_practice.pdf', type: 'file' }]),
};

test('crawlTree walks folders recursively via the injected fetcher', async () => {
  const tree = await crawlTree(async id => LISTINGS[id], 'root', 'TMC_SLIDES_HUB');
  assert.equal(tree.folders[0].name, 'YEAR 1');
  assert.equal(tree.folders[0].folders[0].folders[0].name, 'CALCULUS I');
  const course = tree.folders[0].folders[0].folders[0];
  assert.deepEqual(course.files.map(f => f.name), ['Limits.pdf']);
  assert.equal(course.folders[0].files[0].name, 'calci_complete_practice.pdf');
});

test('buildCatalog produces the spec schema with defaults', async () => {
  const tree = await crawlTree(async id => LISTINGS[id], 'root', 'TMC_SLIDES_HUB');
  const catalog = buildCatalog(tree);
  assert.equal(catalog.years.length, 1);
  assert.equal(catalog.years[0].year, 1);
  assert.equal(catalog.years[0].semesters[0].semester, 1);
  const course = catalog.years[0].semesters[0].courses[0];
  assert.equal(course.id, 'calculus-i');
  assert.equal(course.title, 'Calculus I');
  assert.equal(course.driveFolderId, 'c1');
  assert.deepEqual(course.topics, []);
  assert.deepEqual(course.examFormats.map(f => f.id), ['midsem', 'endsem']);
  assert.deepEqual(course.materials, [
    { title: 'Limits.pdf', driveFileId: 'f1', kind: 'pdf' },
    { title: 'calci_complete_practice.pdf', driveFileId: 'f2', kind: 'practice' },
  ]);
});

test('buildCatalog suffixes colliding course ids across semesters', async () => {
  const LIST = {
    root: fakeListing([{ id: 'y1', name: 'YEAR 1', type: 'folder' }, { id: 'y2', name: 'YEAR 2', type: 'folder' }]),
    y1: fakeListing([{ id: 'a1', name: 'SEM 1', type: 'folder' }]),
    y2: fakeListing([{ id: 'b1', name: 'SEM 1', type: 'folder' }]),
    a1: fakeListing([{ id: 'ca', name: 'ABSTRACT ALGEBRA', type: 'folder' }]),
    b1: fakeListing([{ id: 'cb', name: 'ABSTRACT ALGEBRA', type: 'folder' }]),
    ca: fakeListing([]),
    cb: fakeListing([]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB'));
  const ids = catalog.years.flatMap(y => y.semesters).flatMap(s => s.courses).map(c => c.id);
  assert.deepEqual(ids.sort(), ['abstract-algebra', 'abstract-algebra-y2s1'].sort());
});

test('buildCatalog skips folders without year/semester numbers', async () => {
  const LIST = {
    root: fakeListing([{ id: 'y1', name: 'YEAR 1', type: 'folder' }, { id: 'x1', name: 'ARCHIVE', type: 'folder' }]),
    y1: fakeListing([{ id: 's1', name: 'SEM 1', type: 'folder' }]),
    x1: fakeListing([]),
    s1: fakeListing([]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB'));
  assert.equal(catalog.years.length, 1);
  assert.equal(catalog.years[0].year, 1);
});

test('crawlTree stops descending past maxDepth', async () => {
  let fetches = 0;
  const deepFetcher = async id => { fetches++; return fakeListing([{ id: `${id}x`, name: `D${id.length}`, type: 'folder' }]); };
  const tree = await crawlTree(deepFetcher, 'r', 'root', 0, 2);
  assert.equal(fetches, 3);
  const d2 = tree.folders[0].folders[0];
  assert.deepEqual(d2.folders, []);
});

test('each course gets its own examFormats copy', async () => {
  const LIST = {
    root: fakeListing([{ id: 'y1', name: 'YEAR 1', type: 'folder' }]),
    y1: fakeListing([{ id: 's1', name: 'SEM 1', type: 'folder' }]),
    s1: fakeListing([{ id: 'c1', name: 'ALGEBRA', type: 'folder' }, { id: 'c2', name: 'CALCULUS', type: 'folder' }]),
    c1: fakeListing([]),
    c2: fakeListing([]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB'));
  const [a, b] = catalog.years[0].semesters[0].courses;
  a.examFormats[0].questions = 999;
  assert.equal(b.examFormats[0].questions, 30);
});
