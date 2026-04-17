/**
 * Mermaid 占位 DOM 选择器与片段常量（centralization，集中管理）。
 *
 * 背景：
 * - `MarkdownParser` 会输出固定结构的 Mermaid 占位 HTML
 * - `runMermaidInMarkdownRoot` / 前端岛组件 / 工具栏预览会依赖同一套选择器
 *
 * 若把选择器字符串散落在业务代码里，一旦解析器调整 DOM，会导致多处同步修改、易漏改。
 * 因此把“对外契约”集中在本文件，由 `@dnhyxc-ai/tools` 统一导出。
 */

/** 外层包裹容器 class（与 `MarkdownParser.patchMermaidFence` 输出一致） */
export const MARKDOWN_MERMAID_WRAP_CLASS = 'markdown-mermaid-wrap';

/** Mermaid 约定入口 class（Mermaid 官方约定） */
export const MERMAID_ENTRY_CLASS = 'mermaid';

/** Mermaid 入口节点 class 选择器：`.mermaid` */
export const MERMAID_ENTRY_SELECTOR = `.${MERMAID_ENTRY_CLASS}`;

/** 外层 data 标记：用于选择器与运行时扫描 */
export const MARKDOWN_MERMAID_WRAP_DATA_ATTR = 'data-mermaid';

/** 外层 data 标记值：表示该节点为 Mermaid 占位 */
export const MARKDOWN_MERMAID_WRAP_DATA_VALUE = '1';

/**
 * 外层包裹选择器：`div.markdown-mermaid-wrap[data-mermaid="1"]`
 * 说明：必须包含 `data-mermaid="1"`，避免误命中其它同名 class。
 */
export const MARKDOWN_MERMAID_WRAP_SELECTOR = `.${MARKDOWN_MERMAID_WRAP_CLASS}[${MARKDOWN_MERMAID_WRAP_DATA_ATTR}="${MARKDOWN_MERMAID_WRAP_DATA_VALUE}"]`;

/**
 * Mermaid 入口节点选择器：`.markdown-mermaid-wrap[data-mermaid="1"] .mermaid`
 * 说明：与 `runMermaidInMarkdownRoot` 的历史实现保持一致。
 */
export const MERMAID_MARKDOWN_ENTRY_SELECTOR = `${MARKDOWN_MERMAID_WRAP_SELECTOR} .${MERMAID_ENTRY_CLASS}`;

/**
 * 已渲染 SVG 的选择器：`.markdown-mermaid-wrap[data-mermaid="1"] .mermaid svg`
 * 说明：用于预览/下载等“读图”路径；与 `mermaid.run` 的入口选择器保持一致的前缀约束。
 */
export const MERMAID_MARKDOWN_SVG_SELECTOR = `${MERMAID_MARKDOWN_ENTRY_SELECTOR} svg`;

/**
 * Tailwind arbitrary selector（任意选择器）类名：给 wrap 内 `.mermaid` 增加 `cursor-zoom-in`。
 * 说明：Tailwind 要求把空格替换为 `_`，因此用模板拼接 class，避免手写散落字符串。
 */
export const MARKDOWN_MERMAID_TAILWIND_CURSOR_ZOOM_IN_CLASS = `[&_.${MARKDOWN_MERMAID_WRAP_CLASS}_.${MERMAID_ENTRY_CLASS}]:cursor-zoom-in`;

/**
 * 在 `root` 子树内收集所有待渲染的 Mermaid 入口节点。
 */
export function queryMermaidMarkdownEntryNodes(
	root: ParentNode,
): NodeListOf<HTMLElement> {
	return root.querySelectorAll<HTMLElement>(MERMAID_MARKDOWN_ENTRY_SELECTOR);
}

/**
 * 在 `root` 子树内查找第一个 Mermaid 入口节点。
 */
export function queryFirstMermaidMarkdownEntryNode(
	root: ParentNode,
): HTMLElement | null {
	return root.querySelector<HTMLElement>(MERMAID_MARKDOWN_ENTRY_SELECTOR);
}

/**
 * 在 `root` 子树内查找第一个 Mermaid 包裹容器。
 */
export function queryFirstMermaidMarkdownWrap(
	root: ParentNode,
): HTMLElement | null {
	return root.querySelector<HTMLElement>(MARKDOWN_MERMAID_WRAP_SELECTOR);
}

/**
 * 从任意元素向上查找最近的 Mermaid 包裹容器（包含 `data-mermaid="1"` 约束）。
 */
export function closestMermaidMarkdownWrap(
	el: Element | null | undefined,
): HTMLElement | null {
	if (!el) return null;
	return el.closest<HTMLElement>(MARKDOWN_MERMAID_WRAP_SELECTOR);
}

/**
 * `MarkdownParser.patchMermaidFence` 输出的占位 HTML 片段（不含换行后缀）。
 * 注意：这是“契约字符串”，任何修改必须同步更新本文件与相关文档。
 */
export const MARKDOWN_MERMAID_PLACEHOLDER_HTML =
	`<div class="${MARKDOWN_MERMAID_WRAP_CLASS}" ${MARKDOWN_MERMAID_WRAP_DATA_ATTR}="${MARKDOWN_MERMAID_WRAP_DATA_VALUE}">` +
	`<div class="${MERMAID_ENTRY_CLASS}">` +
	`</div></div>`;
