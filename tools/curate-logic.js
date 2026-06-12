// One-off curation for logic-and-set-theory: creates the four syllabus topics
// as question-bank containers. The SECTION lecture notes stay in materials
// because their filenames do not say which topics they cover; fellows can
// re-shelve them later if the academic board confirms the mapping.

import { readFile, writeFile } from 'node:fs/promises';

const TOPICS = [
  { id: 'propositional-logic', title: 'Propositional logic' },
  { id: 'arguments-and-proofs', title: 'Arguments and methods of proof' },
  { id: 'predicate-logic', title: 'Predicate logic and quantifiers' },
  { id: 'sets-and-operations', title: 'Sets and set operations' },
];

const catalogUrl = new URL('../data/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const year1 = catalog.years.find(y => y.year === 1);
if (!year1) throw new Error('Year 1 not found in catalog');
const sem1 = year1.semesters.find(s => s.semester === 1);
if (!sem1) throw new Error('Semester 1 not found in catalog');
const course = sem1.courses.find(c => c.id === 'logic-and-set-theory');
if (!course) throw new Error('logic-and-set-theory not found in catalog');

if (course.topics.length > 0) {
  console.error('logic-and-set-theory already has topics. Aborting (no changes written).');
  process.exit(1);
}

course.topics = TOPICS.map(t => ({
  id: t.id,
  title: t.title,
  slides: [],
  videos: [],
  questionFile: null,
}));

for (const m of course.materials) {
  if (/stoll|acharjya|discrete mathematics for computer science/i.test(m.title)) m.kind = 'textbook';
}

await writeFile(catalogUrl, JSON.stringify(catalog, null, 2) + '\n');
console.log(`logic-and-set-theory: ${course.topics.length} topics created, ${course.materials.filter(m => m.kind === 'textbook').length} textbooks tagged`);
