// One-off curation for calculus-ii: five topics with their slide decks
// assigned by exact filename, mirroring the calculus-i template.

import { readFile, writeFile } from 'node:fs/promises';

const TOPIC_MAP = [
  { id: 'introduction-to-integration', title: 'Introduction to integration', files: ['1. Introduction to Integration.pdf'] },
  { id: 'integration-techniques', title: 'Integration techniques', files: ['2. Integration Techniques.pdf', '3. Integration Techniques.pdf', 'Techniques of Integration.pdf', 'Trignometry Integration.pdf'] },
  { id: 'applications-of-integration', title: 'Applications of integration', files: ['4. Applications of Integration.pdf', 'Application of Integration.pdf'] },
  { id: 'coordinate-geometry', title: 'Coordinate geometry', files: ['5. Introduction to Coordinate Geometry.pdf'] },
  { id: 'conic-sections', title: 'Conic sections', files: ['6. Circles and Parabola.pdf', '7. Ellipse and Hyperbola.pdf', 'Conic Section.pdf'] },
];
const TEXTBOOK_RE = /stewart|anton|larson|schaum|3000 solved/i;

const catalogUrl = new URL('../data/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const year1 = catalog.years.find(y => y.year === 1);
if (!year1) throw new Error('Year 1 not found in catalog');
const sem2 = year1.semesters.find(s => s.semester === 2);
if (!sem2) throw new Error('Semester 2 not found in catalog');
const course = sem2.courses.find(c => c.id === 'calculus-ii');
if (!course) throw new Error('calculus-ii not found in catalog');

if (course.topics.length > 0) {
  console.error('calculus-ii already has topics. Aborting (no changes written).');
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
console.log(`calculus-ii: ${course.topics.length} topics, ${mapped} slides mapped, ${course.materials.length} materials remain`);
