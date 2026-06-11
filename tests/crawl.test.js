import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFolderListing, decodeEntities, slugify } from '../tools/crawl-drive.js';

const FIXTURE = `
<div class="flip-entries">
<div class="flip-entry" id="entry-18YLXoauiWGy1XTxwYC44MqadChGUr5SW"><div class="flip-entry-visual"><a href="https://drive.google.com/drive/folders/18YLXoauiWGy1XTxwYC44MqadChGUr5SW"><img src="x"></a></div><div class="flip-entry-info"><a href="https://drive.google.com/drive/folders/18YLXoauiWGy1XTxwYC44MqadChGUr5SW"><div class="flip-entry-title">YEAR 1</div></a></div></div>
<div class="flip-entry" id="entry-1SNHKRvcGhOw6leM8jTn4af_AfA4KJgSZ"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/1SNHKRvcGhOw6leM8jTn4af_AfA4KJgSZ/view?usp=drive_web"><div class="flip-entry-title">4. Limits &amp; Continuity.pdf</div></a></div></div>
</div>`;

test('parseFolderListing extracts folders and files with ids, names, types', () => {
  const entries = parseFolderListing(FIXTURE);
  assert.deepEqual(entries, [
    { id: '18YLXoauiWGy1XTxwYC44MqadChGUr5SW', name: 'YEAR 1', type: 'folder' },
    { id: '1SNHKRvcGhOw6leM8jTn4af_AfA4KJgSZ', name: '4. Limits & Continuity.pdf', type: 'file' },
  ]);
});

test('parseFolderListing returns [] on empty/garbage html', () => {
  assert.deepEqual(parseFolderListing('<html><body>nothing here</body></html>'), []);
});

test('decodeEntities handles the five common entities', () => {
  assert.equal(decodeEntities('A &amp; B &lt;x&gt; &quot;q&quot; &#39;s&#39;'), `A & B <x> "q" 's'`);
});

test('slugify produces url-safe ids', () => {
  assert.equal(slugify('CALCULUS I'), 'calculus-i');
  assert.equal(slugify('ELECTRICITY & MAGNETISM'), 'electricity-and-magnetism');
  assert.equal(slugify('  COMM SKILLS I  '), 'comm-skills-i');
});
