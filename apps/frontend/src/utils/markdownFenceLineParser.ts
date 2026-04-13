/**
 * 按行解析 Markdown 围栏（fenced code blocks），与 CommonMark 常见写法对齐。
 * 用于：盘古空格、按围栏拆分 mermaid 等；避免正文/注释里出现 ``` 子串时被 indexOf 误截断。
 */

/**
 * CommonMark 围栏行缩进：仅空格、至多 3 格；排除 Tab。
 * 内嵌源码里「制表符 + 单独一行 ```」不应视为 Markdown 围栏边界。
 */
export function isPlausibleMarkdownFenceIndent(indent: string): boolean {
	if (indent.includes('\t')) return false;
	return /^ {0,3}$/.test(indent);
}

/**
 * 闭合行缩进与开头的匹配规则（对齐 CommonMark 常见行为）：
 * - 开头与闭合缩进完全一致 → 通过；
 * - 开头无缩进 → 闭合允许 0～3 个空格；
 * - 开头有缩进（常见于列表续行里的 ```）→ 闭合允许**顶格或少于开头的空格缩进**，
 *   避免「`   ```ts` 开头、` ``` ` 顶格闭合」被误判为未闭合，导致整段后续正文被吞进围栏、MdPreview 错乱。
 */
export function fenceClosingIndentMatchesOpen(
	openIndent: string,
	closeIndent: string,
): boolean {
	if (!isPlausibleMarkdownFenceIndent(closeIndent)) return false;
	if (openIndent === closeIndent) return true;
	if (openIndent === '' && /^ {0,3}$/.test(closeIndent)) return true;
	if (openIndent !== '') {
		if (closeIndent === '') return true;
		if (
			closeIndent.length < openIndent.length &&
			openIndent.startsWith(closeIndent)
		) {
			return true;
		}
	}
	return false;
}

export type MarkdownFenceSegment =
	| { fenced: false; text: string }
	| { fenced: true; text: string; complete: boolean };

/**
 * 将全文按「围栏段 / 非围栏段」切开；围栏内字节级保留。
 * `complete: false` 表示未遇到合法闭合行（流式尾部等）。
 */
export function splitMarkdownFencedBlocks(
	markdown: string,
): MarkdownFenceSegment[] {
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const parts: MarkdownFenceSegment[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		const openMatch = /^(\s*)(`{3,})([^`]*)$/.exec(line.trimEnd());
		if (openMatch && isPlausibleMarkdownFenceIndent(openMatch[1])) {
			const openIndent = openMatch[1];
			const tickLen = openMatch[2].length;
			const fenceLines = [line];
			i++;
			let closed = false;
			while (i < lines.length) {
				const cur = lines[i];
				fenceLines.push(cur);
				const closeMatch = /^(\s*)(`{3,})\s*$/.exec(cur.trimEnd());
				if (
					closeMatch &&
					closeMatch[2].length >= tickLen &&
					fenceClosingIndentMatchesOpen(openIndent, closeMatch[1])
				) {
					closed = true;
					i++;
					break;
				}
				i++;
			}
			parts.push({
				fenced: true,
				text: fenceLines.join('\n'),
				complete: closed,
			});
			if (!closed) break;
			continue;
		}
		const proseStart = i;
		while (i < lines.length) {
			const peek = /^(\s*)(`{3,})([^`]*)$/.exec(lines[i].trimEnd());
			if (peek && isPlausibleMarkdownFenceIndent(peek[1])) break;
			i++;
		}
		parts.push({
			fenced: false,
			text: lines.slice(proseStart, i).join('\n'),
		});
	}
	return parts;
}

export function joinMarkdownSegments(segments: string[]): string {
	let acc = '';
	for (const text of segments) {
		if (acc === '') acc = text;
		else acc = `${acc}\n${text}`;
	}
	return acc;
}
