const NAV = [
  { href: 'index.html', label: 'Library' },
  { href: 'about.html', label: 'About' },
];

export function renderChrome() {
  const header = document.querySelector('[data-chrome="header"]');
  if (header) {
    const here = location.pathname.split('/').pop() || 'index.html';
    header.innerHTML = `
      <a class="wordmark" href="index.html"><span aria-hidden="true">∑</span> TMC Math Hub</a>
      <nav aria-label="Main">
        ${NAV.map(n => `<a href="${n.href}"${n.href === here ? ' aria-current="page"' : ''}>${n.label}</a>`).join('')}
      </nav>`;
  }
  const footer = document.querySelector('[data-chrome="footer"]');
  if (footer) {
    footer.innerHTML = `
      <p>Built by and for fellows of the KNUST Mathematics Department.</p>
      <p>All PDFs stream from the <a href="https://drive.google.com/drive/folders/1k-3KXvCbHkT3RKFBFY2XOz9wbcI2pbb3">TMC Drive hub</a> — nothing is hosted here.</p>`;
  }
}

export const drivePreviewUrl = id => `https://drive.google.com/file/d/${id}/preview`;
export const driveViewUrl = id => `https://drive.google.com/file/d/${id}/view`;
export const driveDownloadUrl = id => `https://drive.google.com/uc?export=download&id=${id}`;

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
