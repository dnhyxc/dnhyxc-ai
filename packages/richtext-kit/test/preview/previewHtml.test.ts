import { describe, expect, it } from 'vitest';
import {
	preparePreviewBody,
	stripNoteTitleHtml,
} from '../../src/preview/previewHtml';
import { titleToHtml } from '../../src/windowed/doc';

describe('stripNoteTitleHtml', () => {
	it('去掉 note-title 节点', () => {
		const html = `${titleToHtml('Hi')}<p>body</p>`;
		const stripped = stripNoteTitleHtml(html);
		expect(stripped).not.toContain('note-title');
		expect(stripped).toContain('<p>body</p>');
	});
});

describe('preparePreviewBody', () => {
	it('空段补 br，避免预览塌高', () => {
		const prepared = preparePreviewBody(`${titleToHtml('Hi')}<p></p>`);
		expect(prepared).toContain('<br>');
		expect(prepared).not.toContain('note-title');
	});
});
