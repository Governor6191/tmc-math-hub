// Promotes a reviewed draft bank to live and wires it into the catalog.
// Usage: node tools/promote-bank.js <courseId> <topicId>
// Refuses to run when validation fails. Promotion is the ONLY way a bank
// becomes student-visible; run it after Sylvester approves the batch.

import { readFile, writeFile, rename } from 'node:fs/promises';
import { validateBank } from './validate-questions.js';

const [courseId, topicId] = process.argv.slice(2);
if (!courseId || !topicId) { console.error('usage: node tools/promote-bank.js <courseId> <topicId>'); process.exit(1); }

const draftUrl = new URL(`../data/questions/${courseId}/drafts/${topicId}.json`, import.meta.url);
const liveUrl = new URL(`../data/questions/${courseId}/${topicId}.json`, import.meta.url);
const catalogUrl = new URL('../data/catalog.json', import.meta.url);

let bank;
try {
  bank = JSON.parse(await readFile(draftUrl, 'utf8'));
} catch (err) {
  console.error(`cannot read draft bank: ${err.message}`);
  process.exit(1);
}
const errors = validateBank(bank, courseId, topicId);
if (errors.length) { console.error(`refusing to promote, ${errors.length} validation problem(s):`); errors.forEach(e => console.error(`  ${e}`)); process.exit(1); }

const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
let topic = null;
for (const y of catalog.years) for (const s of y.semesters) for (const c of s.courses) {
  if (c.id === courseId) topic = c.topics.find(t => t.id === topicId) ?? topic;
}
if (!topic) { console.error(`course ${courseId} topic ${topicId} not found in catalog; nothing written`); process.exit(1); }

bank.status = 'approved';
await writeFile(liveUrl, JSON.stringify(bank, null, 2) + '\n');
await rename(draftUrl, new URL(`../data/questions/${courseId}/drafts/${topicId}.json.promoted`, import.meta.url));
topic.questionFile = `data/questions/${courseId}/${topicId}.json`;
topic.questionCount = bank.questions.length;
await writeFile(catalogUrl, JSON.stringify(catalog, null, 2) + '\n');
console.log(`promoted ${courseId}/${topicId}: ${bank.questions.length} questions live, catalog wired. Commit and push to deploy.`);
