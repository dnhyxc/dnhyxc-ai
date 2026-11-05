import { describe, expect, it } from 'vitest';
import {
	createLargeNoteDoc,
	flushWindow,
	isLargeNoteHtml,
	LARGE_MIN_BLOCKS,
	titleToHtml,
	WINDOW_SIZE,
} from '../../src/windowed/doc';

function titledBody(n: number): string {
	const title = titleToHtml('Hi');
	const body = Array.from({ length: n }, (_, i) => `<p>b${i}</p>`).join('');
	return `${title}${body}`;
}

describe('isLargeNoteHtml', () => {
	it('短文为 false', () => {
		expect(isLargeNoteHtml(titledBody(3))).toBe(false);
	});

	it('块数达到 LARGE_MIN_BLOCKS 为 true', () => {
		expect(isLargeNoteHtml(titledBody(LARGE_MIN_BLOCKS))).toBe(true);
	});

	it('非字符串为 false', () => {
		expect(isLargeNoteHtml(null)).toBe(false);
		expect(isLargeNoteHtml('')).toBe(false);
	});
});

describe('createLargeNoteDoc', () => {
	it('拆块并截一窗', () => {
		const html = titledBody(90);
		const created = createLargeNoteDoc(html);
		expect(created.title).toBe('Hi');
		expect(created.doc.blocks.length).toBe(90);
		expect(created.doc.count).toBe(Math.min(WINDOW_SIZE, 90));
	});
});

describe('flushWindow', () => {
	it('拒绝用空窗覆盖已有多块', () => {
		const created = createLargeNoteDoc(titledBody(90));
		const ok = flushWindow(created.doc, '<p></p>');
		expect(ok).toBe(false);
		expect(created.doc.blocks.length).toBe(90);
	});
});
