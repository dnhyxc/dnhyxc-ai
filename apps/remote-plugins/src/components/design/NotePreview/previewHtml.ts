/**
 * 去掉文档内嵌的 title 节点。
 * ponytail: 大文档（含 base64 图）用正则，避免 DOMParser 整树解析卡死主线程。
 * title 的 renderHTML 是单层 div，无嵌套同名闭合问题。
 */
export function stripNoteTitleHtml(html: string): string {
	if (!html) return '';
	return html.replace(
		/<div\b[^>]*\bdata-type=["']note-title["'][^>]*>[\s\S]*?<\/div>/i,
		'',
	);
}

/**
 * 空段落补 `<br>`，与 TipTap 编辑态占位一致（纯 `<p></p>` 在静态 HTML 高度会塌掉）。
 */
export function preserveEmptyParagraphs(html: string): string {
	if (!html) return '';
	return html.replace(
		/<p(\b[^>]*)>(?:\s|&nbsp;|\u00a0)*<\/p>/gi,
		'<p$1><br></p>',
	);
}

/** 预览图异步解码；已有对应属性则不改 */
export function decoratePreviewHtml(html: string): string {
	if (!html) return '';
	return html.replace(/<img\b([^>]*)>/gi, (_full, attrs: string) => {
		let next = attrs;
		if (!/\bloading\s*=/i.test(next)) next += ' loading="lazy"';
		if (!/\bdecoding\s*=/i.test(next)) next += ' decoding="async"';
		return `<img${next}>`;
	});
}

/**
 * 按顶层开闭标签切开（笔记多为扁平 p/h/ul/table）。
 * ponytail: 嵌套同名标签可能切不准；失败时调用方回退整段挂载。
 */
export function splitPreviewBlocks(html: string): string[] {
	if (!html) return [];
	const blocks: string[] = [];
	const re = /<([a-z][a-z0-9]*)\b[^>]*(?:\/>|>[\s\S]*?<\/\1>)/gi;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		if (m.index > last) {
			const gap = html.slice(last, m.index).trim();
			if (gap) blocks.push(gap);
		}
		blocks.push(m[0]);
		last = m.index + m[0].length;
	}
	if (last < html.length) {
		const tail = html.slice(last).trim();
		if (tail) blocks.push(tail);
	}
	return blocks.length ? blocks : [html];
}

/** 预览正文：去 title、保留空行（与编辑态一致），图懒加载 */
export function preparePreviewBody(html: string): string {
	return decoratePreviewHtml(preserveEmptyParagraphs(stripNoteTitleHtml(html)));
}
