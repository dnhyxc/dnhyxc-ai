/**
 * 判断围栏正文是否为 Mermaid DSL（含无 lang 或误标为普通代码块的情况）。
 */

const MERMAID_DIAGRAM_HEAD_RE =
	/^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|C4Context|mindmap|timeline|quadrantChart|block-beta|sankey-beta|xychart-beta|packet-beta|kanban|architecture-beta|requirementDiagram)\b/i;

/** 首条非空、非 %% 注释行是否像 Mermaid 图类型声明 */
export function looksLikeMermaidDiagramSource(body: string): boolean {
	const lines = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	for (const line of lines) {
		const t = line.trim();
		if (!t || t.startsWith('%%')) continue;
		return MERMAID_DIAGRAM_HEAD_RE.test(t);
	}
	return false;
}

/**
 * 是否应按 Mermaid 岛渲染（而非普通代码围栏 + 聊天代码工具条）。
 */
export function isMermaidFenceLang(lang: string, body: string): boolean {
	const primary = lang.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
	if (primary === 'mermaid') return true;
	if (primary) return false;
	return looksLikeMermaidDiagramSource(body);
}
