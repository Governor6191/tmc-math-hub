// Structural and voice validation for question banks.
// Importable (validateBank) and runnable: node tools/validate-questions.js <file> [...files]

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DIFFICULTIES = new Set(['warmup', 'core', 'stretch']);
const STATUSES = new Set(['draft', 'approved']);
const DASH_RE = /[–—]/;

function textProblems(label, s, errors, qid) {
  if (DASH_RE.test(s)) errors.push(`${qid}: ${label} contains an em or en dash (voice rules ban them)`);
  const dollars = (s.match(/\$/g) || []).length;
  if (dollars % 2 !== 0) errors.push(`${qid}: ${label} has an odd number of $ math delimiters`);
  let depth = 0;
  for (const ch of s) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) errors.push(`${qid}: ${label} has unbalanced braces in math`);
}

export function validateBank(bank, expectedCourseId, expectedTopicId) {
  const errors = [];
  if (bank.courseId !== expectedCourseId) errors.push(`bank courseId is "${bank.courseId}", expected "${expectedCourseId}"`);
  if (bank.topicId !== expectedTopicId) errors.push(`bank topicId is "${bank.topicId}", expected "${expectedTopicId}"`);
  if (!STATUSES.has(bank.status)) errors.push(`bank status "${bank.status}" is not draft or approved`);
  if (!Array.isArray(bank.questions) || bank.questions.length === 0) {
    errors.push('bank has no questions array or it is empty');
    return errors;
  }
  const seen = new Set();
  const idRe = new RegExp(`^${expectedCourseId}-${expectedTopicId}-\\d{3}$`);
  for (const q of bank.questions) {
    const qid = q.id ?? '(missing id)';
    if (typeof q.id !== 'string' || !idRe.test(q.id)) errors.push(`${qid}: id does not match ${expectedCourseId}-${expectedTopicId}-NNN`);
    if (seen.has(q.id)) errors.push(`${qid}: duplicate id`);
    seen.add(q.id);
    if (typeof q.stem !== 'string' || q.stem.trim().length < 8) errors.push(`${qid}: stem missing or too short`);
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) errors.push(`${qid}: options must be 2 to 5 entries`);
    if (!Number.isInteger(q.answer) || !Array.isArray(q.options) || q.answer < 0 || q.answer >= q.options.length) errors.push(`${qid}: answer index out of range`);
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 20) errors.push(`${qid}: explanation missing or too short (worked solutions are the point)`);
    if (!DIFFICULTIES.has(q.difficulty)) errors.push(`${qid}: difficulty must be warmup, core, or stretch`);
    if (typeof q.source !== 'string' || q.source.trim().length === 0) errors.push(`${qid}: source must not be empty`);
    for (const [label, s] of [['stem', q.stem], ['explanation', q.explanation], ...(Array.isArray(q.options) ? q.options.map((o, i) => [`option ${i}`, o]) : [])]) {
      if (typeof s === 'string') textProblems(label, s, errors, qid);
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length < 3) { console.error('usage: node tools/validate-questions.js <bank.json> [...more]'); process.exit(1); }
  let failed = false;
  for (const file of process.argv.slice(2)) {
    let bank;
    try {
      bank = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      console.error(`${file}: ${err.message}`);
      failed = true;
      continue;
    }
    const m = file.replace(/\\/g, '/').match(/questions\/([^/]+)\/(?:drafts\/)?([^/]+)\.json$/);
    if (!m) { console.error(`${file}: path does not look like a question bank location`); failed = true; continue; }
    const errors = validateBank(bank, m[1], m[2]);
    if (errors.length) { failed = true; console.error(`${file}: ${errors.length} problem(s)`); errors.forEach(e => console.error(`  ${e}`)); }
    else console.log(`${file}: OK (${bank.questions.length} questions, status ${bank.status})`);
  }
  process.exit(failed ? 1 : 0);
}
