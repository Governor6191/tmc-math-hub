import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

// A3: numeric entity decoding (hex + decimal + named)
export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(?:amp|lt|gt|quot|#39);/g, m => ENTITIES[m]);
}

export function parseFolderListing(html) {
  // A2: loud failure on unrecognized markup
  if (!html.includes('flip-entries')) {
    throw new Error('Unrecognized Drive folder listing markup (no flip-entries container) — has Google changed embeddedfolderview?');
  }

  const entries = [];
  const chunks = html.split(/<div class="flip-entry" id="entry-/).slice(1);
  for (const chunk of chunks) {
    const id = (chunk.match(/^([\w-]+)"/) || [])[1];
    const titleM = chunk.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/);
    if (!id || !titleM) continue;
    const name = decodeEntities(titleM[1].replace(/<[^>]*>/g, '').trim());

    // A1: anchor type classification on the captured id to avoid trailing chrome mismatch
    let type;
    if (chunk.includes(`/drive/folders/${id}`)) type = 'folder';
    else if (chunk.includes(`/file/d/${id}`)) type = 'file';
    else continue;
    entries.push({ id, name, type });
  }
  return entries;
}

export function slugify(title) {
  return title.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── Part B: tree crawler ────────────────────────────────────────────────────

export async function crawlTree(fetchListing, id, name, depth = 0, maxDepth = 4) {
  const node = { id, name, files: [], folders: [] };
  if (depth > maxDepth) {
    console.error(`  WARNING: max depth reached at "${name}" (${id}) — not descending`);
    return node;
  }
  let entries;
  try {
    entries = parseFolderListing(await fetchListing(id));
  } catch (err) {
    throw new Error(`while crawling "${name}" (${id}): ${err.message}`);
  }
  for (const e of entries) {
    if (e.type === 'file') node.files.push({ id: e.id, name: e.name });
    else {
      if (depth + 1 > maxDepth) {
        console.error(`  WARNING: max depth reached at "${e.name}" (${e.id}) — not descending`);
      } else {
        node.folders.push(await crawlTree(fetchListing, e.id, e.name, depth + 1, maxDepth));
      }
    }
  }
  return node;
}

const DEFAULT_EXAM_FORMATS = [
  { id: 'midsem', label: 'Mid-semester', questions: 30, minutes: 40 },
  { id: 'endsem', label: 'End of semester', questions: 60, minutes: 90 },
];

function titleCase(s) {
  const SMALL = new Set(['for', 'and', 'of', 'the', 'in', 'to', 'with']);
  return s.toLowerCase().split(/\s+/).filter(Boolean).map((w, i) => {
    if (/^[ivx]+$/.test(w)) return w.toUpperCase();
    if (i > 0 && SMALL.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

// C1: semester numbers prefer the digits after a "sem" token ("Yr 4 sem 2" → 2),
// fall back to the first digit run, null when no digits at all.
function semesterNumber(name) {
  const m = name.match(/sem\D*?(\d+)/i) || name.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

// C3: a semester folder holding exactly one child folder and zero files, where the
// child itself holds only folders, is duplicate nesting — use the child's contents.
// (The child must have zero files and at least one folder: a lone course folder with
// root files, or a lone empty course folder, is NOT a wrapper.)
function drillThrough(semFolder) {
  let node = semFolder;
  for (let i = 0; i < 2; i++) {
    const child = node.folders[0];
    if (node.folders.length !== 1 || node.files.length !== 0 ||
        child.files.length !== 0 || child.folders.length === 0) break;
    console.error(`  note: drilling through duplicate folder "${child.name}" inside "${node.name}"`);
    node = child;
  }
  return node;
}

// C4: collect every descendant file of the course folder — root files first
// (listing order), then subfolders in listing order, depth-first. A file is
// 'practice' when any folder on its path below the course matches /practice/i.
function collectMaterials(courseFolder) {
  const materials = [];
  (function walk(node, underPractice) {
    for (const f of node.files) {
      materials.push({ title: f.name, driveFileId: f.id, kind: underPractice ? 'practice' : 'pdf' });
    }
    for (const sub of node.folders) walk(sub, underPractice || /practice/i.test(sub.name));
  })(courseFolder, false);
  return materials;
}

export function buildCatalog(rootTree) {
  const years = [];
  const seenIds = new Set();
  for (const yearFolder of rootTree.folders) {
    const yearNum = Number((yearFolder.name.match(/(\d+)/) || [])[1]);
    if (!yearNum) { console.error(`  WARNING: skipping folder "${yearFolder.name}" — no year number in name`); continue; }

    // C2: a year child with no semester number is a track folder ("APPLIED MATHS");
    // its semester-numbered children are semester folders whose courses get a track tag.
    const semSources = [];
    for (const child of yearFolder.folders) {
      const semNum = semesterNumber(child.name);
      if (semNum) { semSources.push({ semFolder: child, semNum, track: null }); continue; }
      let found = false;
      for (const sub of child.folders) {
        const subNum = semesterNumber(sub.name);
        if (subNum) { semSources.push({ semFolder: sub, semNum: subNum, track: titleCase(child.name) }); found = true; }
      }
      if (!found) console.error(`  WARNING: skipping track folder "${child.name}" — no semester-numbered children`);
    }

    // Semesters with the same number (from tracks and/or the year root) merge.
    const bySem = new Map();
    for (const { semFolder, semNum, track } of semSources) {
      if (!bySem.has(semNum)) bySem.set(semNum, []);
      const courses = bySem.get(semNum);
      for (const courseFolder of drillThrough(semFolder).folders) {
        let id = slugify(courseFolder.name);
        if (seenIds.has(id)) id = `${id}-y${yearNum}s${semNum}`;
        if (seenIds.has(id) && track) id = `${slugify(courseFolder.name)}-y${yearNum}s${semNum}-${slugify(track)}`;
        if (seenIds.has(id)) throw new Error(`duplicate course id after suffixing: ${id}`);
        seenIds.add(id);
        courses.push({
          id,
          title: titleCase(courseFolder.name),
          ...(track ? { track } : {}),
          driveFolderId: courseFolder.id,
          examFormats: structuredClone(DEFAULT_EXAM_FORMATS),
          topics: [],
          materials: collectMaterials(courseFolder),
        });
      }
    }
    const semesters = [...bySem.entries()].map(([semester, courses]) => {
      courses.sort((a, b) => a.title.localeCompare(b.title));
      return { semester, courses };
    });
    semesters.sort((a, b) => a.semester - b.semester);
    years.push({ year: yearNum, semesters });
  }
  years.sort((a, b) => a.year - b.year);
  return { generatedAt: new Date().toISOString().slice(0, 10), years };
}

// ── CLI entry-point (Task 4 — do not run in Task 3) ────────────────────────

const ROOT_ID = '1k-3KXvCbHkT3RKFBFY2XOz9wbcI2pbb3';
const DELAY_MS = 500;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function liveFetchListing(id) {
  for (let attempt = 1; ; attempt++) {
    await sleep(DELAY_MS * attempt);
    try {
      const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.error(`  crawled folder ${id}`);
      return await res.text();
    } catch (err) {
      if (attempt >= 3) throw new Error(`fetch failed for folder ${id} after ${attempt} attempts: ${err.message}`);
      console.error(`  retrying folder ${id} (attempt ${attempt} failed: ${err.message})`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error('Crawling TMC_SLIDES_HUB (sequential, ~500ms/folder)...');
  // C4: depth 6 — tracks add a level under the year, course subfolders add more.
  const tree = await crawlTree(liveFetchListing, ROOT_ID, 'TMC_SLIDES_HUB', 0, 6);
  const catalog = buildCatalog(tree);
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/catalog.generated.json', import.meta.url), JSON.stringify(catalog, null, 2) + '\n');
  const courses = catalog.years.flatMap(y => y.semesters).flatMap(s => s.courses);
  const files = courses.flatMap(c => c.materials);
  console.log(`wrote data/catalog.generated.json: ${catalog.years.length} years, ${courses.length} courses, ${files.length} files`);
}
