import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

// numeric entity decoding (hex + decimal + named)
export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(?:amp|lt|gt|quot|#39);/g, m => ENTITIES[m]);
}

export function parseFolderListing(html) {
  // guard: markup change detection
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

    // anchor type classification on the captured id to avoid trailing chrome mismatch
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

// semester numbers prefer the digits after a "sem" token ("Yr 4 sem 2" → 2),
// then spelled-out ordinals ("SEMESTER ONE"→1, "FIRST SEMESTER"→1, "SEM TWO"→2),
// then fall back to the first digit run; null when no digits or words found.
function semesterNumber(name) {
  // digit after sem token wins
  const mDigit = name.match(/sem\D*?(\d+)/i) || name.match(/(\d+)\s*(?:st|nd|rd|th)?\s*sem/i);
  if (mDigit) return Number(mDigit[1]);

  // spelled-out ordinals only when the name also contains 'sem'
  if (/sem/i.test(name)) {
    const mWord = name.match(/\b(one|first|two|second)\b/i);
    if (mWord) {
      const w = mWord[1].toLowerCase();
      if (w === 'one' || w === 'first') return 1;
      if (w === 'two' || w === 'second') return 2;
    }
  }

  // digit fallback
  const mFallback = name.match(/(\d+)/);
  return mFallback ? Number(mFallback[1]) : null;
}

// drillThrough: descend through duplicate wrapper folders.
// A wrapper is a lone empty child whose slug equals the parent's slug
// (e.g. "Yr 4 sem 2" containing a nested "Yr 4 sem 2").
// A course folder with a different name is NOT a wrapper — do not drill.
function drillThrough(semFolder) {
  let node = semFolder;
  for (let i = 0; i < 2; i++) {
    const child = node.folders[0];
    if (
      node.folders.length !== 1 ||
      node.files.length !== 0 ||
      child.files.length !== 0 ||
      child.folders.length === 0 ||
      slugify(child.name) !== slugify(node.name)   // guard: only drill true duplicate wrappers
    ) break;
    console.error(`  note: drilling through duplicate folder "${child.name}" inside "${node.name}"`);
    node = child;
  }
  return node;
}

// Junk extensions to skip entirely
const JUNK_EXTS = new Set(['out', 'x', 'o', 'exe', 'save', 'tmp']);

// Extension → kind mapping for kept files
function kindFromExt(ext) {
  if (ext === 'pdf') return 'pdf';
  if (['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'csv'].includes(ext)) return 'doc';
  if (['mp4', 'avi', 'mkv', 'mov', 'webm'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return 'image';
  if (['c', 'cpp', 'h', 'py', 'm', 'r', 'f', 'f90', 'ipynb', 'java', 'js'].includes(ext)) return 'code';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'other';
}

// Module-level junk-skip counter (reset at the start of each buildCatalog call)
let junkSkipCount = 0;

// collect every descendant file of the course folder — root files first
// (listing order), then subfolders in listing order, depth-first.
// 'practice' kind when any folder on the path below the course matches /practice/i.
// Files whose path segments form a relative path get that path added;
// course-root files get no 'path' key.
// Junk files (hidden, lock, no-extension, junk extensions) are silently skipped.
function collectMaterials(courseFolder) {
  const materials = [];
  (function walk(node, underPractice, pathSegments) {
    for (const f of node.files) {
      // junk filter
      if (f.name.startsWith('~$') || f.name.startsWith('.')) { junkSkipCount++; continue; }
      const dotIdx = f.name.lastIndexOf('.');
      if (dotIdx === -1) { junkSkipCount++; continue; }
      const ext = f.name.slice(dotIdx + 1).toLowerCase();
      if (JUNK_EXTS.has(ext)) { junkSkipCount++; continue; }

      const kind = underPractice ? 'practice' : kindFromExt(ext);
      const entry = { title: f.name, driveFileId: f.id, kind };
      if (pathSegments.length > 0) entry.path = pathSegments.join('/');
      materials.push(entry);
    }
    for (const sub of node.folders) {
      walk(sub, underPractice || /practice/i.test(sub.name), [...pathSegments, sub.name]);
    }
  })(courseFolder, false, []);
  return materials;
}

export function buildCatalog(rootTree) {
  junkSkipCount = 0;

  // Pass 1: gather every course candidate without assigning ids;
  // count global occurrences of each base slug.
  const allCandidates = [];   // { yearNum, semNum, track, courseFolder }
  const baseSlugCount = new Map();

  for (const yearFolder of rootTree.folders) {
    const yearNum = Number((yearFolder.name.match(/(\d+)/) || [])[1]);
    if (!yearNum) { console.error(`  WARNING: skipping folder "${yearFolder.name}" — no year number in name`); continue; }

    // a year child with no semester number is a track folder ("APPLIED MATHS");
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

    for (const { semFolder, semNum, track } of semSources) {
      for (const courseFolder of drillThrough(semFolder).folders) {
        const base = slugify(courseFolder.name);
        baseSlugCount.set(base, (baseSlugCount.get(base) ?? 0) + 1);
        allCandidates.push({ yearNum, semNum, track, courseFolder, base });
      }
    }
  }

  // Pass 2: assign ids deterministically, independent of listing order.
  // For each base slug that collides, build a track-slug → candidate map first.
  // Strategy:
  //   - unique base slug → use base slug
  //   - else if has track and base+track is unique among candidates → base-trackslug
  //   - else → base-yYsS (appended to whichever candidate id we have so far)
  //   - still duplicate → throw

  // Pre-compute track-suffixed collision counts for multi-occurrence bases
  const trackSuffixCount = new Map();  // "base-trackslug" → count
  for (const c of allCandidates) {
    if ((baseSlugCount.get(c.base) ?? 0) > 1 && c.track) {
      const ts = `${c.base}-${slugify(c.track)}`;
      trackSuffixCount.set(ts, (trackSuffixCount.get(ts) ?? 0) + 1);
    }
  }

  const assignedIds = new Set();
  for (const c of allCandidates) {
    let id;
    if ((baseSlugCount.get(c.base) ?? 0) === 1) {
      id = c.base;
    } else if (c.track) {
      const ts = `${c.base}-${slugify(c.track)}`;
      id = (trackSuffixCount.get(ts) ?? 0) === 1 ? ts : `${ts}-y${c.yearNum}s${c.semNum}`;
    } else {
      id = assignedIds.has(c.base) ? `${c.base}-y${c.yearNum}s${c.semNum}` : c.base;
    }
    if (assignedIds.has(id)) throw new Error(`duplicate course id after suffixing: ${id}`);
    assignedIds.add(id);
    c.resolvedId = id;
  }

  // Build the output structure from the resolved candidates.
  // We must emit every valid year even if it ends up with no courses (e.g. all
  // semesters empty), so we seed the yearMap from the semSources gathered during
  // pass 1 rather than only from allCandidates.
  const years = [];
  const yearMap = new Map();  // yearNum → Map<semNum, course[]>

  // Seed every (year, sem) pair that was discovered — ensures empty semesters appear
  for (const c of allCandidates) {
    if (!yearMap.has(c.yearNum)) yearMap.set(c.yearNum, new Map());
    const semMap = yearMap.get(c.yearNum);
    if (!semMap.has(c.semNum)) semMap.set(c.semNum, []);
  }

  // Also seed years that had semSources but zero courses inside them
  // (captured via the semSourcesByYear scratch built below)
  const semSourcesByYear = new Map();   // yearNum → [{semNum}]
  for (const yearFolder of rootTree.folders) {
    const yearNum = Number((yearFolder.name.match(/(\d+)/) || [])[1]);
    if (!yearNum) continue;
    if (!semSourcesByYear.has(yearNum)) semSourcesByYear.set(yearNum, []);
    for (const child of yearFolder.folders) {
      const semNum = semesterNumber(child.name);
      if (semNum) {
        semSourcesByYear.get(yearNum).push(semNum);
      } else {
        for (const sub of child.folders) {
          const subNum = semesterNumber(sub.name);
          if (subNum) semSourcesByYear.get(yearNum).push(subNum);
        }
      }
    }
  }
  for (const [yearNum, semNums] of semSourcesByYear.entries()) {
    if (!yearMap.has(yearNum)) yearMap.set(yearNum, new Map());
    const semMap = yearMap.get(yearNum);
    for (const semNum of semNums) {
      if (!semMap.has(semNum)) semMap.set(semNum, []);
    }
  }

  // Populate courses into the map
  for (const c of allCandidates) {
    yearMap.get(c.yearNum).get(c.semNum).push({
      id: c.resolvedId,
      title: titleCase(c.courseFolder.name),
      ...(c.track ? { track: c.track } : {}),
      driveFolderId: c.courseFolder.id,
      examFormats: structuredClone(DEFAULT_EXAM_FORMATS),
      topics: [],
      materials: collectMaterials(c.courseFolder),
    });
  }

  for (const [yearNum, semMap] of [...yearMap.entries()].sort((a, b) => a[0] - b[0])) {
    const semesters = [...semMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([semester, courses]) => {
        courses.sort((a, b) => a.title.localeCompare(b.title));
        return { semester, courses };
      });
    years.push({ year: yearNum, semesters });
  }

  return { generatedAt: new Date().toISOString().slice(0, 10), years };
}

// CLI entry point — run directly to regenerate the catalog

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
  // depth 6 — tracks add a level under the year, course subfolders add more.
  const tree = await crawlTree(liveFetchListing, ROOT_ID, 'TMC_SLIDES_HUB', 0, 6);
  const catalog = buildCatalog(tree);
  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/catalog.generated.json', import.meta.url), JSON.stringify(catalog, null, 2) + '\n');
  const courses = catalog.years.flatMap(y => y.semesters).flatMap(s => s.courses);
  const files = courses.flatMap(c => c.materials);
  console.log(`wrote data/catalog.generated.json: ${catalog.years.length} years, ${courses.length} courses, ${files.length} files (${junkSkipCount} junk files skipped)`);
}
