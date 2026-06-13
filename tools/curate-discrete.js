// One-off curation for discrete-mathematics: six bankable topics as containers.
// Slides are generically named (lec1 to lec6) so they stay in materials.
// Topics deliberately avoid logic and sets, which the logic-and-set-theory
// course already covers.

import { readFile, writeFile } from 'node:fs/promises';

const TOPICS = [
  { id: 'combinatorics', title: 'Counting and combinatorics' },
  { id: 'relations-and-functions', title: 'Relations and functions' },
  { id: 'recurrence-relations', title: 'Recurrence relations' },
  { id: 'graph-theory', title: 'Graph theory' },
  { id: 'number-theory', title: 'Number theory and modular arithmetic' },
  { id: 'complex-numbers', title: 'Complex numbers' },
];

const catalogUrl = new URL('../data/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const year1 = catalog.years.find(y => y.year === 1);
if (!year1) throw new Error('Year 1 not found in catalog');
const sem2 = year1.semesters.find(s => s.semester === 2);
if (!sem2) throw new Error('Semester 2 not found in catalog');
const course = sem2.courses.find(c => c.id === 'discrete-mathematics');
if (!course) throw new Error('discrete-mathematics not found in catalog');

if (course.topics.length > 0) {
  console.error('discrete-mathematics already has topics. Aborting (no changes written).');
  process.exit(1);
}

course.topics = TOPICS.map(t => ({ id: t.id, title: t.title, slides: [], videos: [], questionFile: null }));

for (const m of course.materials) {
  if (/epp|schaum|rosen|discrete mathematics 8th|its application/i.test(m.title)) m.kind = 'textbook';
}

await writeFile(catalogUrl, JSON.stringify(catalog, null, 2) + '\n');
console.log(`discrete-mathematics: ${course.topics.length} topics created, ${course.materials.filter(m => m.kind === 'textbook').length} textbooks tagged`);
