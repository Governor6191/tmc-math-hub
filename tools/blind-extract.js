// Emits a bank's questions WITHOUT answers or explanations, for blind re-solving.
// Usage: node tools/blind-extract.js data/questions/calculus-i/drafts/limits.json

import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/blind-extract.js <bank.json>'); process.exit(1); }
const bank = JSON.parse(await readFile(file, 'utf8'));
const blind = bank.questions.map(q => ({ id: q.id, stem: q.stem, options: q.options }));
console.log(JSON.stringify(blind, null, 2));
