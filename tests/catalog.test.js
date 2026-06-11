import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalog, resetCatalogCache, findCourse, courseStats } from '../js/catalog.js';

const FIXTURE = {
  years: [{
    year: 1,
    semesters: [{
      semester: 1,
      courses: [{
        id: 'calculus-i', title: 'Calculus I', driveFolderId: 'c1',
        examFormats: [],
        topics: [
          { id: 'limits', title: 'Limits', slides: [{ title: 'Limits.pdf', driveFileId: 'f1' }], videos: [{ title: 'v', youtubeId: 'y1' }], questionFile: null },
          { id: 'functions', title: 'Functions', slides: [{ title: 'F1.pdf', driveFileId: 'f2' }, { title: 'F2.pdf', driveFileId: 'f3' }], videos: [], questionFile: null },
        ],
        materials: [{ title: 'Stewart.pdf', driveFileId: 'f4', kind: 'textbook' }],
      }],
    }],
  }],
};

test('findCourse locates a course with its year and semester', () => {
  const hit = findCourse(FIXTURE, 'calculus-i');
  assert.equal(hit.course.title, 'Calculus I');
  assert.equal(hit.year, 1);
  assert.equal(hit.semester, 1);
});

test('findCourse returns null for unknown ids', () => {
  assert.equal(findCourse(FIXTURE, 'nope'), null);
});

test('courseStats counts topics, slides, videos, files', () => {
  assert.deepEqual(courseStats(FIXTURE.years[0].semesters[0].courses[0]),
    { topics: 2, slides: 3, videos: 1, materials: 1, files: 4 });
});

test('loadCatalog fetches once and caches', async () => {
  resetCatalogCache();
  let calls = 0;
  const fetcher = async () => { calls++; return { ok: true, json: async () => FIXTURE }; };
  const a = await loadCatalog('data/catalog.json', fetcher);
  const b = await loadCatalog('data/catalog.json', fetcher);
  assert.equal(a, b);
  assert.equal(calls, 1);
});

test('loadCatalog throws a readable error on http failure', async () => {
  resetCatalogCache();
  const fetcher = async () => ({ ok: false, status: 404 });
  await assert.rejects(() => loadCatalog('data/catalog.json', fetcher), /404/);
  resetCatalogCache();
});
