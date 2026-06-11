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

// guard: markup change detection — throws on unrecognized structure, returns [] on valid empty listing
test('parseFolderListing throws on unrecognized markup, returns [] on valid empty listing', () => {
  assert.throws(() => parseFolderListing('<html><body>nothing here</body></html>'), /flip-entries/);
  assert.deepEqual(parseFolderListing('<div class="flip-entries"></div>'), []);
});

// guard: trailing folder link after last entry must not misclassify a file as a folder
test('a trailing folders link after the last entry does not misclassify it', () => {
  const html = `<div class="flip-entries"><div class="flip-entry" id="entry-abc123"><a href="https://drive.google.com/file/d/abc123/view"><div class="flip-entry-title">notes.pdf</div></a></div></div><div class="footer"><a href="https://drive.google.com/drive/folders/zzz999">open hub</a></div>`;
  assert.deepEqual(parseFolderListing(html), [{ id: 'abc123', name: 'notes.pdf', type: 'file' }]);
});

test('decodeEntities handles the five common entities', () => {
  assert.equal(decodeEntities('A &amp; B &lt;x&gt; &quot;q&quot; &#39;s&#39;'), `A & B <x> "q" 's'`);
  // numeric entities (decimal and hex)
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
    { title: 'calci_complete_practice.pdf', driveFileId: 'f2', kind: 'practice', path: 'PRACTICE' },
  ]);
});

// G1: two-pass id assignment — collision across years/semesters still gets suffix
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

// ── Task 4b: Year 4 tracks, drill-through, deep materials ──────────────────

test('track folders merge into the same semester and tag their courses with track', async () => {
  const LIST = {
    root: fakeListing([{ id: 'y4', name: 'YEAR 4', type: 'folder' }]),
    y4: fakeListing([
      { id: 'tr1', name: 'APPLIED MATHS', type: 'folder' },
      { id: 's1', name: 'SEM 1', type: 'folder' },
    ]),
    tr1: fakeListing([{ id: 'ts1', name: 'SEM 1', type: 'folder' }]),
    ts1: fakeListing([{ id: 'c1', name: 'OPTIMIZATION I', type: 'folder' }]),
    s1: fakeListing([{ id: 'c2', name: 'REAL FUNCTION I', type: 'folder' }]),
    c1: fakeListing([{ id: 'f1', name: 'opt.pdf', type: 'file' }]),
    c2: fakeListing([{ id: 'f2', name: 'real.pdf', type: 'file' }]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB'));
  assert.equal(catalog.years.length, 1);
  assert.equal(catalog.years[0].semesters.length, 1);
  const sem = catalog.years[0].semesters[0];
  assert.equal(sem.semester, 1);
  assert.deepEqual(sem.courses.map(c => c.id), ['optimization-i', 'real-function-i']);
  const tracked = sem.courses.find(c => c.id === 'optimization-i');
  const untracked = sem.courses.find(c => c.id === 'real-function-i');
  assert.equal(tracked.track, 'Applied Maths');
  assert.equal('track' in untracked, false);
});

test('"Yr 4 sem 2" parses as semester 2 and duplicate nesting is drilled through', async () => {
  const LIST = {
    root: fakeListing([{ id: 'y4', name: 'YEAR 4', type: 'folder' }]),
    y4: fakeListing([{ id: 'o1', name: 'Yr 4 sem 2', type: 'folder' }]),
    o1: fakeListing([{ id: 'i1', name: 'Yr 4 sem 2', type: 'folder' }]),
    i1: fakeListing([
      { id: 'c1', name: 'Functional Analysis', type: 'folder' },
      { id: 'c2', name: 'Optimization 2', type: 'folder' },
    ]),
    c1: fakeListing([{ id: 'f1', name: 'fa.pdf', type: 'file' }]),
    c2: fakeListing([]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB'));
  assert.equal(catalog.years[0].semesters.length, 1);
  const sem = catalog.years[0].semesters[0];
  assert.equal(sem.semester, 2);
  assert.deepEqual(sem.courses.map(c => c.id), ['functional-analysis', 'optimization-2']);
  assert.deepEqual(sem.courses[0].materials, [{ title: 'fa.pdf', driveFileId: 'f1', kind: 'pdf' }]);
});

// G4: material subfolder path — root files have no 'path' key; nested files carry relative path
test('materials are collected from all course descendants: root first, then subfolders depth-first', async () => {
  const LIST = {
    root: fakeListing([{ id: 'y1', name: 'YEAR 1', type: 'folder' }]),
    y1: fakeListing([{ id: 's1', name: 'SEM 1', type: 'folder' }]),
    s1: fakeListing([{ id: 'c1', name: 'CALCULUS I', type: 'folder' }]),
    c1: fakeListing([
      { id: 'sl', name: 'SLIDES', type: 'folder' },
      { id: 'pr', name: 'PRACTICE', type: 'folder' },
      { id: 'fc', name: 'c.pdf', type: 'file' },
    ]),
    sl: fakeListing([{ id: 'fa', name: 'a.pdf', type: 'file' }]),
    pr: fakeListing([{ id: 'y23', name: '2023', type: 'folder' }]),
    y23: fakeListing([{ id: 'fb', name: 'b.pdf', type: 'file' }]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB', 0, 6));
  const course = catalog.years[0].semesters[0].courses[0];
  // root file has no 'path' key; subfolder files carry their relative path
  assert.deepEqual(course.materials, [
    { title: 'c.pdf', driveFileId: 'fc', kind: 'pdf' },
    { title: 'a.pdf', driveFileId: 'fa', kind: 'pdf', path: 'SLIDES' },
    { title: 'b.pdf', driveFileId: 'fb', kind: 'practice', path: 'PRACTICE/2023' },
  ]);
  assert.equal('path' in course.materials[0], false);
});

test('a track folder with no semester-numbered children is skipped', async () => {
  const LIST = {
    root: fakeListing([{ id: 'y4', name: 'YEAR 4', type: 'folder' }]),
    y4: fakeListing([
      { id: 'tr', name: 'PURE MATHS', type: 'folder' },
      { id: 's1', name: 'SEM 1', type: 'folder' },
    ]),
    tr: fakeListing([{ id: 'n1', name: 'NOTES', type: 'folder' }]),
    n1: fakeListing([]),
    s1: fakeListing([
      { id: 'c1', name: 'ALGEBRA', type: 'folder' },
      { id: 'c2', name: 'TOPOLOGY', type: 'folder' },
    ]),
    c1: fakeListing([]),
    c2: fakeListing([]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB'));
  assert.equal(catalog.years[0].semesters.length, 1);
  const sem = catalog.years[0].semesters[0];
  assert.deepEqual(sem.courses.map(c => c.id), ['algebra', 'topology']);
  assert.ok(sem.courses.every(c => !('track' in c)));
});

// G1: three-track collision — NONE gets bare slug; all get track-suffixed ids.
// Order-independence: build with tracks in reversed order → same id set.
test('same course name across three tracks in one semester: all get track-suffixed ids (order-independent)', async () => {
  function makeList(trackOrder) {
    const trackFolders = {
      ta: 'APPLIED MATHS',
      tm: 'MATHEMATICAL ECONOMICS',
      tp: 'PURE MATHS',
    };
    const LIST = {
      root: fakeListing([{ id: 'y4', name: 'YEAR 4', type: 'folder' }]),
      y4: fakeListing(trackOrder.map(id => ({ id, name: trackFolders[id], type: 'folder' }))),
      ta: fakeListing([{ id: 'as1', name: 'SEM 1', type: 'folder' }]),
      tm: fakeListing([{ id: 'ms1', name: 'SEM 1', type: 'folder' }]),
      tp: fakeListing([{ id: 'ps1', name: 'SEM 1', type: 'folder' }]),
      as1: fakeListing([{ id: 'ca', name: 'INTEGRAL EQUATION', type: 'folder' }, { id: 'xa', name: 'OPTIMIZATION I', type: 'folder' }]),
      ms1: fakeListing([{ id: 'cm', name: 'INTEGRAL EQUATION', type: 'folder' }, { id: 'xm', name: 'ECONOMETRICS', type: 'folder' }]),
      ps1: fakeListing([{ id: 'cp', name: 'INTEGRAL EQUATION', type: 'folder' }, { id: 'xp', name: 'TOPOLOGY', type: 'folder' }]),
      ca: fakeListing([{ id: 'fa', name: 'ie-applied.pdf', type: 'file' }]),
      cm: fakeListing([{ id: 'fm', name: 'ie-econ.pdf', type: 'file' }]),
      cp: fakeListing([{ id: 'fp', name: 'ie-pure.pdf', type: 'file' }]),
      xa: fakeListing([]), xm: fakeListing([]), xp: fakeListing([]),
    };
    return LIST;
  }

  async function getIds(trackOrder) {
    const catalog = buildCatalog(await crawlTree(async id => makeList(trackOrder)[id], 'root', 'HUB'));
    return catalog.years[0].semesters[0].courses.map(c => c.id).sort();
  }

  const forwardIds = await getIds(['ta', 'tm', 'tp']);
  const reversedIds = await getIds(['tp', 'tm', 'ta']);

  // All three share the same base slug → none gets bare slug
  assert.ok(!forwardIds.includes('integral-equation'), 'bare slug must not appear');
  // All three get track-suffixed ids
  assert.ok(forwardIds.includes('integral-equation-applied-maths'), 'applied-maths variant must appear');
  assert.ok(forwardIds.includes('integral-equation-mathematical-economics'), 'mathematical-economics variant must appear');
  assert.ok(forwardIds.includes('integral-equation-pure-maths'), 'pure-maths variant must appear');

  // Order-independence: same id set regardless of listing order
  assert.deepEqual(forwardIds, reversedIds);

  // driveFolderIds map to the same course regardless of order
  async function getIdToFolderMap(trackOrder) {
    const catalog = buildCatalog(await crawlTree(async id => makeList(trackOrder)[id], 'root', 'HUB'));
    const courses = catalog.years[0].semesters[0].courses;
    return Object.fromEntries(courses.map(c => [c.id, c.driveFolderId]));
  }
  const forwardMap = await getIdToFolderMap(['ta', 'tm', 'tp']);
  const reversedMap = await getIdToFolderMap(['tp', 'tm', 'ta']);
  assert.deepEqual(forwardMap, reversedMap);
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

// G2: junk filtering and kind-by-extension
test('collectMaterials skips junk files and assigns kind by extension', async () => {
  const LIST = {
    root: fakeListing([{ id: 'y1', name: 'YEAR 1', type: 'folder' }]),
    y1: fakeListing([{ id: 's1', name: 'SEM 1', type: 'folder' }]),
    s1: fakeListing([{ id: 'c1', name: 'ALGORITHMS', type: 'folder' }]),
    c1: fakeListing([
      { id: 'f1', name: 'notes.pdf',      type: 'file' },
      { id: 'f2', name: 'deck.pptx',      type: 'file' },
      { id: 'f3', name: 'photo.jpg',      type: 'file' },
      { id: 'f4', name: 'prog.c',         type: 'file' },
      { id: 'f5', name: 'movie.mp4',      type: 'file' },
      { id: 'f6', name: 'arch.zip',       type: 'file' },
      { id: 'f7', name: 'weird.xyz',      type: 'file' },
      // junk — must be skipped
      { id: 'j1', name: '.DS_Store',      type: 'file' },
      { id: 'j2', name: '~$lock.docx',    type: 'file' },
      { id: 'j3', name: 'a.out',          type: 'file' },
      { id: 'j4', name: 'noext',          type: 'file' },
    ]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB'));
  const mats = catalog.years[0].semesters[0].courses[0].materials;
  assert.equal(mats.length, 7, 'exactly 7 non-junk files should survive');
  assert.deepEqual(mats.map(m => m.driveFileId), ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7']);
  assert.deepEqual(mats.map(m => m.kind), ['pdf', 'doc', 'image', 'code', 'video', 'archive', 'other']);
  // junk absent
  const ids = mats.map(m => m.driveFileId);
  assert.ok(!ids.includes('j1') && !ids.includes('j2') && !ids.includes('j3') && !ids.includes('j4'));
});

// G3: drillThrough guard — only drill when child slug === parent slug
test('drillThrough does NOT drill when the lone child has a different name', async () => {
  // Semester folder has exactly one course "OPTIMIZATION 2" which itself has
  // only subfolders (no root files). Must NOT drill — OPTIMIZATION 2 must appear
  // as a course, not its subfolders as courses.
  const LIST = {
    root: fakeListing([{ id: 'y4', name: 'YEAR 4', type: 'folder' }]),
    y4: fakeListing([{ id: 's2', name: 'SEM 2', type: 'folder' }]),
    s2: fakeListing([{ id: 'co', name: 'OPTIMIZATION 2', type: 'folder' }]),
    co: fakeListing([
      { id: 'sub1', name: 'NOTES', type: 'folder' },
      { id: 'sub2', name: 'EXAMS', type: 'folder' },
    ]),
    sub1: fakeListing([{ id: 'f1', name: 'notes.pdf', type: 'file' }]),
    sub2: fakeListing([{ id: 'f2', name: 'exam.pdf', type: 'file' }]),
  };
  const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB', 0, 6));
  const sem = catalog.years[0].semesters[0];
  // Only one course — 'optimization-2'
  assert.equal(sem.courses.length, 1);
  assert.equal(sem.courses[0].id, 'optimization-2');
  assert.equal(sem.courses[0].title, 'Optimization 2');
  // Its materials come from the subfolders
  const matIds = sem.courses[0].materials.map(m => m.driveFileId);
  assert.ok(matIds.includes('f1'));
  assert.ok(matIds.includes('f2'));
});

// G5: spelled-out semester numbers
test('semesterNumber handles spelled-out words and digit fallback', async () => {
  // We test via buildCatalog using semester folder names
  async function semFromName(semName) {
    const LIST = {
      root: fakeListing([{ id: 'y1', name: 'YEAR 1', type: 'folder' }]),
      y1: fakeListing([{ id: 's1', name: semName, type: 'folder' }]),
      s1: fakeListing([{ id: 'c1', name: 'ALGEBRA', type: 'folder' }]),
      c1: fakeListing([]),
    };
    const catalog = buildCatalog(await crawlTree(async id => LIST[id], 'root', 'HUB'));
    return catalog.years[0].semesters[0].semester;
  }

  assert.equal(await semFromName('SEMESTER ONE'), 1);
  assert.equal(await semFromName('FIRST SEMESTER'), 1);
  assert.equal(await semFromName('SEM TWO'), 2);
  assert.equal(await semFromName('SEMESTER TWO'), 2);
  assert.equal(await semFromName('SECOND SEMESTER'), 2);
  // digit fallback still works
  assert.equal(await semFromName('2ND SEM'), 2);
  assert.equal(await semFromName('SEM 1'), 1);
});
