// One-off curation for statistics-and-probability: five bankable topics as
// containers. Slides are generically named (Unit 1, Unit 5, STAT 166) so they
// stay in materials.

import { readFile, writeFile } from 'node:fs/promises';

const TOPICS = [
  { id: 'descriptive-statistics', title: 'Descriptive statistics' },
  { id: 'probability-basics', title: 'Probability basics' },
  { id: 'conditional-probability', title: 'Conditional probability and Bayes' },
  { id: 'random-variables', title: 'Random variables and expectation' },
  { id: 'special-distributions', title: 'Special distributions' },
];

const catalogUrl = new URL('../data/catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const year1 = catalog.years.find(y => y.year === 1);
if (!year1) throw new Error('Year 1 not found in catalog');
const sem2 = year1.semesters.find(s => s.semester === 2);
if (!sem2) throw new Error('Semester 2 not found in catalog');
const course = sem2.courses.find(c => c.id === 'statistics-and-probability');
if (!course) throw new Error('statistics-and-probability not found in catalog');

if (course.topics.length > 0) {
  console.error('statistics-and-probability already has topics. Aborting (no changes written).');
  process.exit(1);
}

course.topics = TOPICS.map(t => ({ id: t.id, title: t.title, slides: [], videos: [], questionFile: null }));

for (const m of course.materials) {
  if (/montgomery|ramachandran|demystified/i.test(m.title)) m.kind = 'textbook';
}

await writeFile(catalogUrl, JSON.stringify(catalog, null, 2) + '\n');
console.log(`statistics-and-probability: ${course.topics.length} topics created, ${course.materials.filter(m => m.kind === 'textbook').length} textbooks tagged`);
