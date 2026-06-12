// One-off curation for vectors-and-mechanics: creates the five syllabus topics
// as question-bank containers. The course notes pdf stays in materials.

import { readFile, writeFile } from 'node:fs/promises';

const TOPICS = [
  { id: 'vector-algebra', title: 'Vector algebra' },
  { id: 'products-of-vectors', title: 'Dot and cross products' },
  { id: 'vector-geometry', title: 'Lines and planes' },
  { id: 'kinematics', title: 'Kinematics and projectiles' },
  { id: 'forces-and-equilibrium', title: 'Forces and equilibrium' },
];

const catalogUrl = new URL('../data/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const year1 = catalog.years.find(y => y.year === 1);
if (!year1) throw new Error('Year 1 not found in catalog');
const sem1 = year1.semesters.find(s => s.semester === 1);
if (!sem1) throw new Error('Semester 1 not found in catalog');
const course = sem1.courses.find(c => c.id === 'vectors-and-mechanics');
if (!course) throw new Error('vectors-and-mechanics not found in catalog');

if (course.topics.length > 0) {
  console.error('vectors-and-mechanics already has topics. Aborting (no changes written).');
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
  if (/stewart|boas|weatherburn|bhatti/i.test(m.title)) m.kind = 'textbook';
}

await writeFile(catalogUrl, JSON.stringify(catalog, null, 2) + '\n');
console.log(`vectors-and-mechanics: ${course.topics.length} topics created, ${course.materials.filter(m => m.kind === 'textbook').length} textbooks tagged`);
