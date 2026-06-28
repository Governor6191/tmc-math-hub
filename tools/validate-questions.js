// Structural and voice validation for question banks.
// Importable (validateBank) and runnable: node tools/validate-questions.js <file> [...files]

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DIFFICULTIES = new Set(['warmup', 'core', 'stretch']);
const STATUSES = new Set(['draft', 'approved']);
const FORMATS = new Set(['mcq', 'cloze']);
const GAP_TYPES = new Set(['number', 'dropdown', 'text']);
const DASH_RE = /[–—]/;

// Canonicalize an option for duplicate detection. Pure numbers and single
// fractions (optionally signed, optionally with currency words) reduce to a
// numeric key so that, for example, 7/15 and 21/45 collide; anything with
// further structure (powers, e^, binom, sqrt, prose) stays an opaque string
// key, so only genuinely identical expressions collide.
function optionKey(raw) {
  const t = String(raw).replace(/\$/g, '').replace(/\\[,;:!]/g, '').replace(/\s+/g, '');
  const frac = t.match(/^(-?)\\[dt]?frac\{(-?\d+)\}\{(-?\d+)\}$/);
  if (frac) {
    const den = Number(frac[3]);
    if (den !== 0) {
      const sign = frac[1] === '-' ? -1 : 1;
      return 'num:' + (sign * Number(frac[2]) / den).toFixed(9);
    }
  }
  const plain = t.replace(/GHC|GHS|cedis|pesewas|\\?%/gi, '');
  if (/^-?\d+(?:\.\d+)?$/.test(plain)) return 'num:' + Number(plain).toFixed(9);
  return 'str:' + t;
}

function textProblems(label, s, errors, qid) {
  if (DASH_RE.test(s)) errors.push(`${qid}: ${label} contains an em or en dash (voice rules ban them)`);
  // `backtick` code spans render literally (KaTeX skips <code>), so $ and braces
  // inside them are not math; strip paired code spans before the math checks.
  const ticks = (s.match(/`/g) || []).length;
  if (ticks % 2 !== 0) errors.push(`${qid}: ${label} has an odd number of backticks (unclosed code span)`);
  const bare = s.replace(/`[^`]*`/g, '');
  const dollars = (bare.match(/\$/g) || []).length;
  if (dollars % 2 !== 0) errors.push(`${qid}: ${label} has an odd number of $ math delimiters`);
  let depth = 0;
  for (const ch of bare) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) errors.push(`${qid}: ${label} has unbalanced braces in math`);
}

function validateCloze(q, errors) {
  const qid = q.id;
  if (typeof q.solution !== 'string' || q.solution.trim().length < 8) errors.push(`${qid}: cloze solution missing or too short`);
  if (!Array.isArray(q.gaps) || q.gaps.length === 0) { errors.push(`${qid}: cloze has no gaps`); return; }
  const ids = new Set();
  for (const gap of q.gaps) {
    if (!Number.isInteger(gap.id)) { errors.push(`${qid}: a gap id must be an integer`); continue; }
    if (ids.has(gap.id)) errors.push(`${qid}: duplicate gap id ${gap.id}`);
    ids.add(gap.id);
    if (!GAP_TYPES.has(gap.type)) { errors.push(`${qid}: gap ${gap.id} type must be number, dropdown, or text`); continue; }
    if (gap.type === 'number') {
      if (typeof gap.answer !== 'number' || !Number.isFinite(gap.answer)) errors.push(`${qid}: gap ${gap.id} number answer must be a finite number`);
      if (gap.tolerance !== undefined && (typeof gap.tolerance !== 'number' || gap.tolerance < 0)) errors.push(`${qid}: gap ${gap.id} tolerance must be a non-negative number`);
    } else if (gap.type === 'dropdown') {
      if (!Array.isArray(gap.options) || gap.options.length < 2 || !gap.options.every(o => typeof o === 'string')) errors.push(`${qid}: gap ${gap.id} dropdown needs 2 or more string options`);
      else if (!gap.options.includes(gap.answer)) errors.push(`${qid}: gap ${gap.id} dropdown answer is not one of its options`);
    } else if (gap.type === 'text') {
      if (!Array.isArray(gap.accept) || gap.accept.length === 0 || !gap.accept.every(a => typeof a === 'string' && a.length > 0)) errors.push(`${qid}: gap ${gap.id} text needs a non-empty accept list of strings`);
    }
  }
  const counts = {};
  for (const m of String(q.solution).matchAll(/\{\{(\d+)\}\}/g)) { const n = Number(m[1]); counts[n] = (counts[n] || 0) + 1; }
  for (const gap of q.gaps) {
    if (!Number.isInteger(gap.id)) continue;
    if (!counts[gap.id]) errors.push(`${qid}: gap ${gap.id} has no {{${gap.id}}} marker in the solution`);
    else if (counts[gap.id] > 1) errors.push(`${qid}: gap ${gap.id} marker appears more than once`);
  }
  for (const n of Object.keys(counts)) if (!ids.has(Number(n))) errors.push(`${qid}: solution has marker {{${n}}} with no matching gap`);
  if (typeof q.solution === 'string') textProblems('solution', q.solution, errors, qid);
  for (const gap of q.gaps) {
    if (gap.type === 'dropdown' && Array.isArray(gap.options)) gap.options.forEach((o, i) => { if (typeof o === 'string') textProblems(`gap ${gap.id} option ${i}`, o, errors, qid); });
    if (gap.type === 'text' && Array.isArray(gap.accept)) gap.accept.forEach((a, i) => { if (typeof a === 'string') textProblems(`gap ${gap.id} accept ${i}`, a, errors, qid); });
  }
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
    if (typeof q.explanation !== 'string' || q.explanation.trim().length < 20) errors.push(`${qid}: explanation missing or too short (worked solutions are the point)`);
    if (!DIFFICULTIES.has(q.difficulty)) errors.push(`${qid}: difficulty must be warmup, core, or stretch`);
    if (typeof q.source !== 'string' || q.source.trim().length === 0) errors.push(`${qid}: source must not be empty`);
    if (q.format !== undefined && !FORMATS.has(q.format)) errors.push(`${qid}: format must be mcq or cloze`);
    if (typeof q.stem === 'string') textProblems('stem', q.stem, errors, qid);
    if (typeof q.explanation === 'string') textProblems('explanation', q.explanation, errors, qid);

    if (q.format === 'cloze') {
      validateCloze(q, errors);
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) errors.push(`${qid}: options must be 2 to 5 entries`);
      if (!Number.isInteger(q.answer) || !Array.isArray(q.options) || q.answer < 0 || q.answer >= q.options.length) errors.push(`${qid}: answer index out of range`);
      if (Array.isArray(q.options)) {
        const keys = new Map();
        q.options.forEach((o, i) => {
          if (typeof o === 'string') textProblems(`option ${i}`, o, errors, qid);
          if (typeof o !== 'string') return;
          const k = optionKey(o);
          if (keys.has(k)) errors.push(`${qid}: options ${keys.get(k)} and ${i} have the same value`);
          else keys.set(k, i);
        });
      }
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
