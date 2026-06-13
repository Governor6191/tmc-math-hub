// One-off curation for linear-algebra-i: six topics with their slide decks
// assigned by exact filename.

import { readFile, writeFile } from 'node:fs/promises';

const TOPIC_MAP = [
  { id: 'matrices', title: 'Matrices and matrix algebra', files: ['Matrix Algebra.pdf', 'Matrices 1.pdf', 'Matrices 2.pdf'] },
  { id: 'systems-of-equations', title: 'Systems of linear equations', files: ['Systems_of_linear_equations (1).pdf'] },
  { id: 'determinants', title: 'Determinants', files: ['Determinants.pdf'] },
  { id: 'vector-spaces', title: 'Vector spaces', files: ['Vector Spaces 1.pdf', 'Vector Spaces 2.pdf'] },
  { id: 'eigenvalues-and-eigenvectors', title: 'Eigenvalues and eigenvectors', files: ['Eigenvalues and Eigenvectors.pdf'] },
  { id: 'linear-transformations', title: 'Linear transformations', files: ['Linear Transformation.pdf'] },
];
const TEXTBOOK_RE = /anton|leon|de pillis|linearalgebra|^algebra\.pdf|baah/i;

const catalogUrl = new URL('../data/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const year1 = catalog.years.find(y => y.year === 1);
if (!year1) throw new Error('Year 1 not found in catalog');
const sem2 = year1.semesters.find(s => s.semester === 2);
if (!sem2) throw new Error('Semester 2 not found in catalog');
const course = sem2.courses.find(c => c.id === 'linear-algebra-i');
if (!course) throw new Error('linear-algebra-i not found in catalog');

if (course.topics.length > 0) {
  console.error('linear-algebra-i already has topics. Aborting (no changes written).');
  process.exit(1);
}

course.topics = TOPIC_MAP.map(t => ({
  id: t.id,
  title: t.title,
  slides: t.files
    .map(name => course.materials.find(m => m.title === name))
    .filter(Boolean)
    .map(m => ({ title: m.title, driveFileId: m.driveFileId })),
  videos: [],
  questionFile: null,
}));

let failed = false;
for (const t of TOPIC_MAP) {
  const topic = course.topics.find(tp => tp.id === t.id);
  const got = topic ? topic.slides.length : 0;
  if (got !== t.files.length) {
    const matched = topic ? new Set(topic.slides.map(s => s.title)) : new Set();
    const missing = t.files.filter(f => !matched.has(f));
    process.stderr.write(`ERROR: topic '${t.id}' expected ${t.files.length} files, got ${got}. Unmatched: ${missing.join(', ')}\n`);
    failed = true;
  }
}
if (failed) process.exit(1);

const moved = new Set(course.topics.flatMap(t => t.slides.map(s => s.title)));
course.materials = course.materials.filter(m => !moved.has(m.title));
for (const m of course.materials) {
  if (m.kind === 'pdf' && TEXTBOOK_RE.test(m.title)) m.kind = 'textbook';
}

await writeFile(catalogUrl, JSON.stringify(catalog, null, 2) + '\n');
const mapped = course.topics.flatMap(t => t.slides).length;
console.log(`linear-algebra-i: ${course.topics.length} topics, ${mapped} slides mapped, ${course.materials.length} materials remain`);
