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

export function buildCatalog(rootTree) {
  const years = [];
  const seenIds = new Set();
  for (const yearFolder of rootTree.folders) {
    const yearNum = Number((yearFolder.name.match(/(\d+)/) || [])[1]);
    if (!yearNum) { console.error(`  WARNING: skipping folder "${yearFolder.name}" — no year number in name`); continue; }
    const semesters = [];
    for (const semFolder of yearFolder.folders) {
      const semNum = Number((semFolder.name.match(/(\d+)/) || [])[1]);
      if (!semNum) { console.error(`  WARNING: skipping folder "${semFolder.name}" — no year number in name`); continue; }
      const courses = [];
      for (const courseFolder of semFolder.folders) {
        let id = slugify(courseFolder.name);
        if (seenIds.has(id)) id = `${id}-y${yearNum}s${semNum}`;
        if (seenIds.has(id)) throw new Error(`duplicate course id after suffixing: ${id}`);
        seenIds.add(id);
        const materials = courseFolder.files.map(f => ({ title: f.name, driveFileId: f.id, kind: 'pdf' }));
        for (const sub of courseFolder.folders) {
          if (sub.folders.length > 0) console.error(`  WARNING: "${courseFolder.name}/${sub.name}" has nested subfolders — their files are not collected`);
          const kind = /practice/i.test(sub.name) ? 'practice' : 'pdf';
          for (const f of sub.files) materials.push({ title: f.name, driveFileId: f.id, kind });
        }
        courses.push({
          id,
          title: titleCase(courseFolder.name),
          driveFolderId: courseFolder.id,
          examFormats: structuredClone(DEFAULT_EXAM_FORMATS),
          topics: [],
          materials,
        });
      }
      courses.sort((a, b) => a.title.localeCompare(b.title));
      semesters.push({ semester: semNum, courses });
    }
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
  const tree = await crawlTree(liveFetchListing, ROOT_ID, 'TMC_SLIDES_HUB');
  const catalog = buildCatalog(tree);
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/catalog.generated.json', import.meta.url), JSON.stringify(catalog, null, 2) + '\n');
  const courses = catalog.years.flatMap(y => y.semesters).flatMap(s => s.courses);
  const files = courses.flatMap(c => c.materials);
  console.log(`wrote data/catalog.generated.json: ${catalog.years.length} years, ${courses.length} courses, ${files.length} files`);
}
