import { readFile, writeFile } from 'node:fs/promises';

const TOPIC_MAP = [
  { id: 'functions', title: 'Functions', files: ['Functions I.pdf', 'Functions II.pdf', '3.Functions II calculus.pdf'] },
  { id: 'limits', title: 'Limits', files: ['4. Limits.pdf', 'Limits.pdf'] },
  { id: 'continuity', title: 'Continuity', files: ['5. Continuity.pdf'] },
  { id: 'derivatives', title: 'Derivatives', files: ['7.Derivatives.pdf', 'Derivatives.pdf'] },
  { id: 'applications-of-differentiation', title: 'Applications of differentiation', files: ['7. Applications of Differentiation I.pdf', '7. Applications of Differentiation II.pdf'] },
  { id: 'sequences-and-series', title: 'Sequences and series', files: ['1.Sequence-and-series.pdf', 'Sequence and Series.pdf'] },
];
const TEXTBOOK_RE = /stewart|dawkins|schaum|smith.*roland|minton|foundations-of-calculus|advanced-calculus/i;

const catalogUrl = new URL('../data/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const year1 = catalog.years.find(y => y.year === 1);
if (!year1) throw new Error('Year 1 not found in catalog');
const sem1 = year1.semesters.find(s => s.semester === 1);
if (!sem1) throw new Error('Semester 1 not found in catalog');
const course = sem1.courses.find(c => c.id === 'calculus-i');
if (!course) throw new Error('calculus-i not found in catalog');

if (course.topics.length > 0) {
  console.error('calculus-i already has topics — this script curates a freshly generated catalog only. Aborting (no changes written).');
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

// Validate every topic's slide count against its TOPIC_MAP entry before writing
let validationFailed = false;
for (const t of TOPIC_MAP) {
  const topic = course.topics.find(tp => tp.id === t.id);
  const got = topic ? topic.slides.length : 0;
  const expected = t.files.length;
  if (got !== expected) {
    const matched = topic ? new Set(topic.slides.map(s => s.title)) : new Set();
    const missing = t.files.filter(f => !matched.has(f));
    process.stderr.write(`ERROR: topic '${t.id}' expected ${expected} files, got ${got}. Unmatched: ${missing.join(', ')}\n`);
    validationFailed = true;
  }
}
if (validationFailed) process.exit(1);

const moved = new Set(course.topics.flatMap(t => t.slides.map(s => s.title)));
course.materials = course.materials.filter(m => !moved.has(m.title));
for (const m of course.materials) {
  if (m.kind === 'pdf' && TEXTBOOK_RE.test(m.title)) m.kind = 'textbook';
}

await writeFile(catalogUrl, JSON.stringify(catalog, null, 2) + '\n');
const mapped = course.topics.flatMap(t => t.slides).length;
console.log(`calculus-i: ${course.topics.length} topics, ${mapped} slides mapped, ${course.materials.length} materials remain`);
