const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

export function decodeEntities(s) {
  return s.replace(/&(?:amp|lt|gt|quot|#39);/g, m => ENTITIES[m]);
}

export function parseFolderListing(html) {
  const entries = [];
  const chunks = html.split(/<div class="flip-entry" id="entry-/).slice(1);
  for (const chunk of chunks) {
    const id = (chunk.match(/^([\w-]+)"/) || [])[1];
    const titleM = chunk.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/);
    if (!id || !titleM) continue;
    const name = decodeEntities(titleM[1].replace(/<[^>]*>/g, '').trim());
    const type = chunk.includes('/drive/folders/') ? 'folder' : 'file';
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
