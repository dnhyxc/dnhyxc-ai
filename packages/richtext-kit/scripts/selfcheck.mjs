import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const { isLargeNoteHtml, WINDOW_SIZE, createLargeNoteDoc } = require(
	join(root, 'dist/windowed/index.cjs'),
);
const { preparePreviewBody, stripNoteTitleHtml } = require(
	join(root, 'dist/preview/index.cjs'),
);

const title = '<div data-type="note-title" data-value="Hi">Hi</div>';
const body = Array.from({ length: 90 }, (_, i) => `<p>b${i}</p>`).join('');
const html = `${title}${body}`;

if (!isLargeNoteHtml(html)) throw new Error('expected large note');
const doc = createLargeNoteDoc(html);
if (doc.doc.blocks.length !== 90) throw new Error('block split failed');
if (doc.doc.count !== Math.min(WINDOW_SIZE, 90))
	throw new Error('window count');

const stripped = stripNoteTitleHtml(html);
if (stripped.includes('note-title')) throw new Error('title not stripped');
const prepared = preparePreviewBody(`${title}<p></p>`);
if (!prepared.includes('<br>')) throw new Error('empty p not preserved');

console.log('selfcheck ok');
