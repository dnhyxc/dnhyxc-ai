import { describe, expect, it } from 'vitest';
import {
	MARKDOWN_CODE_FENCE_BLOCK_ROOT_ATTR,
	queryMarkdownCodeFenceBlockRoots,
} from '../../src/markdown/code-fence-dom.js';
import MarkdownParser from '../../src/markdown/parser.js';

describe('queryMarkdownCodeFenceBlockRoots', () => {
	it('在子树内收集所有围栏根节点', () => {
		const parser = new MarkdownParser({
			injectHighlightTheme: false,
			enableChatCodeFenceToolbar: true,
		});
		const html = parser.render('```js\n1\n```');
		const root = document.createElement('div');
		root.innerHTML = html;
		const list = queryMarkdownCodeFenceBlockRoots(root);
		expect(list.length).toBe(1);
		expect(list[0]?.hasAttribute(MARKDOWN_CODE_FENCE_BLOCK_ROOT_ATTR)).toBe(
			true,
		);
	});
});
