import { OnMount } from '@monaco-editor/react';

/**
 * Monaco 编辑器实例类型（类型别名，type alias）：
 * - 与 `@monaco-editor/react` 的 `OnMount` 回调第一个参数保持一致
 * - 目的：避免在工具函数里散落 `any`，同时让 IDE 能补全 `getScrollTop/getTopForLineNumber` 等 API
 */
export type MonacoEditorInstance = Parameters<OnMount>[0];

/**
 * 将数值限制在 \([0,1]\)（闭区间）。
 *
 * 用途：把「滚动比例」等中间量钳制到合法范围，避免除零或越界插值。
 */
export function clamp01(n: number): number {
	return Math.min(1, Math.max(0, n));
}

/**
 * 写入 `scrollTop` / `setScrollTop` 的死区（dead band，死区）像素阈值。
 *
 * 背景：
 * - 浏览器布局与亚像素（subpixel，亚像素）取整会导致「目标值」与「当前值」在极小范围内来回抖动
 * - 双向同步（bidirectional sync，双向同步）时，这种抖动会被放大成回声振荡
 *
 * 策略：若新旧值差距小于该阈值，则跳过写入。
 */
const SCROLL_APPLY_DEADBAND_PX = 1.5;

/**
 * 判断「滚动同步快照（snapshot，快照）」是否仍然可信的布局容差（epsilon，误差容忍）。
 *
 * 背景：
 * - 预览区 DOM 高度可能因代码高亮、图片解码、Mermaid 渲染等异步任务而变化
 * - 若仍使用旧快照插值，会出现左右滚动位置明显漂移
 *
 * 策略：用 `scrollHeight/clientHeight/contentHeight/...` 与快照记录值做近似比对。
 */
const SYNC_SNAPSHOT_LAYOUT_EPS_PX = 3;

/**
 * 近似相等判断：\(|a-b| \le eps\)。
 *
 * @param a 当前值
 * @param b 目标值
 * @param eps 容差（像素或无量纲，取决于调用方语义）
 */
function nearEqual(a: number, b: number, eps: number): boolean {
	return Math.abs(a - b) <= eps;
}

/**
 * 写入预览容器 `scrollTop`，带死区。
 *
 * @param viewport 预览滚动容器（viewport，视口容器）
 * @param next 目标 `scrollTop`
 */
function applyPreviewScrollTop(viewport: HTMLElement, next: number): void {
	const cur = viewport.scrollTop;
	if (nearEqual(cur, next, SCROLL_APPLY_DEADBAND_PX)) return;
	viewport.scrollTop = next;
}

/**
 * 写入 Monaco 编辑器 `scrollTop`，带死区。
 *
 * @param editor Monaco 编辑器实例
 * @param next 目标 `scrollTop`（与 `editor.getScrollTop()` 同一坐标系）
 */
function applyEditorScrollTop(
	editor: MonacoEditorInstance,
	next: number,
): void {
	const cur = editor.getScrollTop();
	if (nearEqual(cur, next, SCROLL_APPLY_DEADBAND_PX)) return;
	editor.setScrollTop(next);
}

/**
 * 将编辑器垂直滚动位置归一化到 \([0,1]\)（从顶到底）。
 *
 * 语义：
 * - `0`：内容顶端与视口顶端对齐（最上）
 * - `1`：滚动到最大可滚位置（最下）
 *
 * 注意：
 * - 这是「整篇比例」回退方案（fallback，回退/兜底）的核心输入
 * - 在开启折行（word wrap，自动折行）时，它比「按逻辑行号」更稳定，但精度不如标题锚点折线
 */
export function editorVerticalScrollRatio(
	editor: MonacoEditorInstance,
): number {
	const layout = editor.getLayoutInfo();
	const contentHeight = editor.getContentHeight();
	const maxScroll = Math.max(0, contentHeight - layout.height);
	if (maxScroll <= 0) return 0;
	return clamp01(editor.getScrollTop() / maxScroll);
}

/**
 * 按「整篇垂直比例」设置预览容器的 `scrollTop`。
 *
 * @param viewport 预览滚动容器
 * @param ratio \([0,1]\) 的比例（将被 `clamp01`）
 */
export function setPreviewVerticalScrollRatio(
	viewport: HTMLElement,
	ratio: number,
): void {
	const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
	applyPreviewScrollTop(viewport, clamp01(ratio) * maxScroll);
}

/**
 * 计算：若要把某个标题元素的「顶边」对齐到预览视口顶边，预览容器应设置的 `scrollTop`。
 *
 * 关键点：
 * - 使用 `getBoundingClientRect()`（布局测量）把「元素在视口中的位置」转成「需要补偿的滚动增量」
 * - 读取 CSS `scroll-margin-top`（滚动外边距）：用于处理 `scroll-mt-*` 等样式导致的对齐偏移
 *
 * @param viewport 预览滚动容器
 * @param el 带 `data-md-heading-line` 的标题元素（heading，标题）
 */
function scrollTopToAlignHeadingTop(
	viewport: HTMLElement,
	el: HTMLElement,
): number {
	const vr = viewport.getBoundingClientRect();
	const er = el.getBoundingClientRect();
	let scrollMarginTop = 0;
	try {
		const smt = window.getComputedStyle(el).scrollMarginTop;
		const n = Number.parseFloat(smt);
		if (Number.isFinite(n)) scrollMarginTop = n;
	} catch {
		scrollMarginTop = 0;
	}
	return viewport.scrollTop + (er.top - vr.top) - scrollMarginTop;
}

/**
 * Markdown 分屏滚动同步的快照结构（snapshot，快照）。
 *
 * 设计目标：
 * - **冷路径**（布局变化、正文变化）构建一条「分段线性 + 单调非降」的折线（polyline，折线）
 * - **热路径**（滚动）只做 O(log n) 二分定位段 + O(1) 线性插值（interpolation，插值）
 *
 * 折线语义：
 * - `editorY[k]`：编辑器侧用于对齐的纵向坐标（与 `editor.getScrollTop()` 同一坐标系）
 * - `previewY[k]`：预览侧对应的 `scrollTop`
 * - 折线包含文首 `(0,0)` 与文末 `(maxEditor,maxPreview)`，保证端点可插值
 *
 * `useRatioFallback`：
 * - `true`：没有可用标题锚点时，退化为「整篇垂直比例」映射（更简单但更粗）
 */
export type MarkdownScrollSyncSnapshot = {
	/** 分段节点：editorY 非降、previewY 非降，含文首 (0,0) 与文末 (maxEditor,maxPreview) */
	editorY: number[];
	previewY: number[];
	scrollHeight: number;
	clientHeight: number;
	lineCount: number;
	editorContentHeight: number;
	editorViewportHeight: number;
	/** 无标题时退化为整篇比例 */
	useRatioFallback: boolean;
};

/**
 * 将采样得到的锚点序列「单调化」并强制对齐到端点。
 *
 * 背景：
 * - 实际 DOM 测量存在抖动：可能出现 `previewY[k] < previewY[k-1]` 的轻微倒序
 * - 直接用于插值会导致非单调函数，滚动会出现回跳/反向
 *
 * 做法：
 * - 先对 `editorY/previewY` 做前向非降修正（与 `editorY` 同步推进）
 * - 再强制 `e[0]=0/p[0]=0` 与末尾对齐 `maxEditor/maxPreview`
 * - 最后再扫一遍，确保 `previewY` 与 `editorY` 都非降
 */
function stabilizeSyncNodes(
	editorY: number[],
	previewY: number[],
	maxEditor: number,
	maxPreview: number,
): { editorY: number[]; previewY: number[] } {
	const n = editorY.length;
	if (n < 2) return { editorY, previewY };
	const e = [...editorY];
	const p = [...previewY];
	for (let k = 1; k < n; k++) {
		e[k] = Math.max(e[k], e[k - 1]);
		p[k] = Math.max(p[k], p[k - 1]);
	}
	e[0] = 0;
	p[0] = 0;
	e[n - 1] = maxEditor;
	p[n - 1] = maxPreview;
	for (let k = 1; k < n; k++) {
		if (p[k] < p[k - 1]) p[k] = p[k - 1];
		if (e[k] < e[k - 1]) e[k] = e[k - 1];
	}
	return { editorY: e, previewY: p };
}

/**
 * 在布局稳定后调用：采集标题 DOM，测量每个标题在「编辑 / 预览」两侧的纵向锚点，并拼成单调分段折线。
 *
 * 依赖约定（contract，契约）：
 * - 预览侧标题元素必须带 `data-md-heading-line="<lineNumber>"`，且与 Monaco 模型行号一致
 * - 同一行若出现多个 DOM（少见），本实现会合并为「该行最后一次测量」
 *
 * @param editor Monaco 编辑器实例
 * @param viewport 预览滚动容器（内部包含 markdown 渲染 DOM）
 * @returns 可用于双向插值的快照；无模型/无标题时返回比例回退快照
 */
export function buildMarkdownScrollSyncSnapshot(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
): MarkdownScrollSyncSnapshot {
	const model = editor.getModel();
	const scrollHeight = viewport.scrollHeight;
	const clientHeight = viewport.clientHeight;
	const maxPreview = Math.max(0, scrollHeight - clientHeight);
	const layout = editor.getLayoutInfo();
	const maxEditor = Math.max(0, editor.getContentHeight() - layout.height);
	const lineCount = model?.getLineCount() ?? 1;
	const editorContentHeight = editor.getContentHeight();
	const editorViewportHeight = layout.height;

	if (!model) {
		return {
			editorY: [0, maxEditor],
			previewY: [0, maxPreview],
			scrollHeight,
			clientHeight,
			lineCount,
			editorContentHeight,
			editorViewportHeight,
			useRatioFallback: true,
		};
	}

	const headingEls = [
		...viewport.querySelectorAll<HTMLElement>('[data-md-heading-line]'),
	]
		.map((el) => {
			const raw = el.getAttribute('data-md-heading-line');
			const line = raw ? Number.parseInt(raw, 10) : NaN;
			return Number.isFinite(line) ? { line, el } : null;
		})
		.filter((x): x is { line: number; el: HTMLElement } => x !== null)
		.sort((a, b) => a.line - b.line);

	if (headingEls.length === 0) {
		return {
			editorY: [0, maxEditor],
			previewY: [0, maxPreview],
			scrollHeight,
			clientHeight,
			lineCount,
			editorContentHeight,
			editorViewportHeight,
			useRatioFallback: true,
		};
	}

	const editorY: number[] = [0];
	const previewY: number[] = [0];
	let lastHeadingLine = -1;

	for (const { line, el } of headingEls) {
		const ey = Math.min(
			maxEditor,
			Math.max(0, editor.getTopForLineNumber(line)),
		);
		const py = Math.min(
			maxPreview,
			Math.max(0, scrollTopToAlignHeadingTop(viewport, el)),
		);
		if (line === lastHeadingLine) {
			editorY[editorY.length - 1] = ey;
			previewY[previewY.length - 1] = py;
			continue;
		}
		lastHeadingLine = line;
		editorY.push(ey);
		previewY.push(py);
	}

	editorY.push(maxEditor);
	previewY.push(maxPreview);

	const stable = stabilizeSyncNodes(editorY, previewY, maxEditor, maxPreview);

	return {
		editorY: stable.editorY,
		previewY: stable.previewY,
		scrollHeight,
		clientHeight,
		lineCount,
		editorContentHeight,
		editorViewportHeight,
		useRatioFallback: false,
	};
}

/**
 * 判断快照是否与当前布局/模型一致，仍可用于热路径插值。
 *
 * 比对项：
 * - `lineCount`：防止用户增删行后锚点行号整体漂移
 * - `scrollHeight/clientHeight`：预览可滚区域变化（异步内容增高最常见）
 * - `editorContentHeight/editorViewportHeight`：编辑器内容高度或视口高度变化
 *
 * @param snap 既有快照
 * @param viewport 预览滚动容器
 * @param editor Monaco 编辑器实例
 * @param lineCount 当前模型行数
 */
export function isMarkdownScrollSyncSnapshotValid(
	snap: MarkdownScrollSyncSnapshot,
	viewport: HTMLElement,
	editor: MonacoEditorInstance,
	lineCount: number,
): boolean {
	const layout = editor.getLayoutInfo();
	return (
		snap.lineCount === lineCount &&
		nearEqual(
			snap.scrollHeight,
			viewport.scrollHeight,
			SYNC_SNAPSHOT_LAYOUT_EPS_PX,
		) &&
		nearEqual(
			snap.clientHeight,
			viewport.clientHeight,
			SYNC_SNAPSHOT_LAYOUT_EPS_PX,
		) &&
		nearEqual(
			snap.editorContentHeight,
			editor.getContentHeight(),
			SYNC_SNAPSHOT_LAYOUT_EPS_PX,
		) &&
		nearEqual(
			snap.editorViewportHeight,
			layout.height,
			SYNC_SNAPSHOT_LAYOUT_EPS_PX,
		)
	);
}

/**
 * 在单调非降的折线 \((x_i,y_i)\) 上，给定 `x` 做分段线性插值得到 `y`。
 *
 * 约束：
 * - 假设 `xs` 已非降，且长度与 `ys` 一致
 * - `x` 会被钳制到 \([xs[0], xs[last]]\)
 * - 输出 `y` 会被钳制到 \([0, yMax]\)
 *
 * @param xs 自变量节点（此处为 editorScrollTop 或 previewScrollTop）
 * @param ys 因变量节点（另一侧滚动位置）
 * @param x 当前自变量
 * @param yMax `y` 的最大合法值（通常是 maxScroll）
 */
function interpolateMonotone(
	xs: number[],
	ys: number[],
	x: number,
	yMax: number,
): number {
	if (xs.length < 2) return 0;
	const clampedX = Math.min(Math.max(0, x), xs[xs.length - 1]);
	let i = 0;
	while (i < xs.length - 1 && xs[i + 1] < clampedX) {
		i++;
	}
	const xa = xs[i];
	const xb = xs[Math.min(i + 1, xs.length - 1)];
	const ya = ys[i];
	const yb = ys[Math.min(i + 1, ys.length - 1)];
	const dx = xb - xa;
	if (Math.abs(dx) < 1e-3) {
		return Math.min(yMax, Math.max(0, ya));
	}
	const t = clamp01((clampedX - xa) / dx);
	return Math.min(yMax, Math.max(0, ya + t * (yb - ya)));
}

/**
 * 编辑区滚动驱动预览区滚动：用快照折线在 `editor.getScrollTop()` 上插值得到预览 `scrollTop`。
 *
 * 设计动机（与旧方案对比）：
 * - 旧方案常用「首可见逻辑行号」做锚点：在 Monaco **折行**下，逻辑行号与纵向像素进度可能严重不一致
 * - 新方案直接用 `getScrollTop()`（连续值）作为折线自变量，更贴近用户真实阅读位置
 *
 * 行为：
 * - 若快照缺失或失效：现场 `buildMarkdownScrollSyncSnapshot` 并写回 `snapshotRef`
 * - 若无模型：退化为整篇比例映射
 *
 * @param editor Monaco 编辑器实例
 * @param viewport 预览滚动容器
 * @param snapshotRef 快照引用（mutable ref，可变引用）：用于跨渲染缓存冷路径测量结果
 */
export function syncPreviewScrollFromMarkdownEditor(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
	snapshotRef: { current: MarkdownScrollSyncSnapshot | null },
): void {
	const model = editor.getModel();
	if (!model) {
		setPreviewVerticalScrollRatio(viewport, editorVerticalScrollRatio(editor));
		return;
	}
	const lineCount = model.getLineCount();
	const st = editor.getScrollTop();
	const maxPreview = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

	const snap = snapshotRef.current;
	if (
		snap &&
		isMarkdownScrollSyncSnapshotValid(snap, viewport, editor, lineCount)
	) {
		if (snap.useRatioFallback) {
			setPreviewVerticalScrollRatio(
				viewport,
				editorVerticalScrollRatio(editor),
			);
			return;
		}
		const next = interpolateMonotone(
			snap.editorY,
			snap.previewY,
			st,
			maxPreview,
		);
		applyPreviewScrollTop(viewport, next);
		return;
	}

	const built = buildMarkdownScrollSyncSnapshot(editor, viewport);
	snapshotRef.current = built;
	if (built.useRatioFallback) {
		setPreviewVerticalScrollRatio(viewport, editorVerticalScrollRatio(editor));
		return;
	}
	const next = interpolateMonotone(
		built.editorY,
		built.previewY,
		st,
		maxPreview,
	);
	applyPreviewScrollTop(viewport, next);
}

/**
 * 预览区滚动驱动编辑区滚动：在同一单调折线上按预览 `scrollTop` 反插值得到 `editor.scrollTop`。
 *
 * 注意：
 * - 这是「预览 → 编辑」方向；与 `syncPreviewScrollFromMarkdownEditor` 对称
 * - 同样需要快照有效；否则重建
 *
 * @param editor Monaco 编辑器实例
 * @param viewport 预览滚动容器
 * @param snapshotRef 快照引用（mutable ref，可变引用）
 */
export function syncEditorScrollFromMarkdownPreview(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
	snapshotRef: { current: MarkdownScrollSyncSnapshot | null },
): void {
	const model = editor.getModel();
	if (!model) return;

	const lineCount = model.getLineCount();
	const y = viewport.scrollTop;
	const layout = editor.getLayoutInfo();
	const maxEditor = Math.max(0, editor.getContentHeight() - layout.height);
	const maxPreview = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

	const snap = snapshotRef.current;
	if (
		snap &&
		isMarkdownScrollSyncSnapshotValid(snap, viewport, editor, lineCount)
	) {
		if (snap.useRatioFallback) {
			const ratio = maxPreview <= 0 ? 0 : clamp01(y / maxPreview);
			applyEditorScrollTop(editor, ratio * maxEditor);
			return;
		}
		const next = interpolateMonotone(snap.previewY, snap.editorY, y, maxEditor);
		applyEditorScrollTop(editor, next);
		return;
	}

	const built = buildMarkdownScrollSyncSnapshot(editor, viewport);
	snapshotRef.current = built;
	if (built.useRatioFallback) {
		const ratio = maxPreview <= 0 ? 0 : clamp01(y / maxPreview);
		applyEditorScrollTop(editor, ratio * maxEditor);
		return;
	}
	const next = interpolateMonotone(built.previewY, built.editorY, y, maxEditor);
	applyEditorScrollTop(editor, next);
}

/**
 * 将「自动保存间隔（秒）」格式化为 UI 可读文案。
 *
 * 规则：
 * - `< 60`：显示「N 秒」
 * - 能被 60 整除：显示「N 分钟」（避免 120 秒这种不直观表达）
 * - 其它：仍显示「N 秒」（保持真实值，避免误导）
 *
 * @param sec 秒数（正整数；调用方应保证合理范围）
 */
export function formatKnowledgeAutoSaveIntervalLabel(sec: number): string {
	if (sec < 60) return `${sec} 秒`;
	if (sec % 60 === 0) return `${sec / 60} 分钟`;
	return `${sec} 秒`;
}

/**
 * 统一换行符为 `\n`（LF，Line Feed）。
 *
 * 背景：
 * - Windows 常见 `CRLF`（`\r\n`）；旧式 Mac 可能只有 `CR`（`\r`）
 * - Monaco/字符串比对/持久化若混用换行，会出现「看起来一样但不相等」的脏检查问题
 *
 * @param text 输入文本
 * @returns 规范化后的文本（不含 `\r`）
 */
export function normalizeMonacoEol(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Diff 对照基线来源（baseline source，基线来源）：
 * - current：以“点击开启对照瞬间”的当前正文为基线（更像 VS Code 里临时对照）
 * - persisted：以外部传入的“进入编辑器时的内容”（如知识库/回收站打开时的快照）为基线
 * - empty：以空内容为基线（适合新建草稿：当前内容 vs 空）
 */
export type MarkdownDiffBaselineSource = 'current' | 'persisted' | 'empty';

/**
 * 判断是否允许进入 Markdown 分屏 Diff（避免无意义的“空对空”对照）。
 *
 * 规则（与 `MarkdownEditor` 底部栏禁用逻辑一致）：
 * - 当前正文（trim 后）非空：允许
 * - 否则仅当 `diffBaselineSource === 'persisted'` 且外部基线（trim 后）非空：允许（用于展示“全量删除”）
 */
export function isMarkdownDiffEntryEligible(
	editorValue: string,
	diffBaselineSource: MarkdownDiffBaselineSource,
	diffBaselineText?: string,
): boolean {
	const curTrimmed = normalizeMonacoEol(editorValue ?? '').trim();
	if (curTrimmed.length > 0) return true;
	if (diffBaselineSource !== 'persisted') return false;
	const baselineTrimmed = normalizeMonacoEol(diffBaselineText ?? '').trim();
	return baselineTrimmed.length > 0;
}

/**
 * Markdown 底部栏「Diff 对照」按钮是否应禁用（与 `isMarkdownDiffEntryEligible` 互斥）。
 */
export function isMarkdownDiffToolbarDisabled(
	editorValue: string,
	diffBaselineSource: MarkdownDiffBaselineSource,
	diffBaselineText?: string,
): boolean {
	return !isMarkdownDiffEntryEligible(
		editorValue,
		diffBaselineSource,
		diffBaselineText,
	);
}
