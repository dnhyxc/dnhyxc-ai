import type { Rendition } from 'epubjs';
import type { EbookThought } from '../types';

type EpubIframeContents = {
	document: Document;
	window: Window;
};

/**
 * EPUB 想法下划线点击事件处理器类型定义
 *
 * - onThoughtClick：点击某一条想法（下划线）时的事件回调，通常用于弹出该条想法详情、编辑等操作。
 * - onThoughtGroupClick：同一段（同一 cfiRange）可能存在多条想法，点击下划线分组时触发，传递该段落下所有想法，通常弹出多条列表。
 */
export type EpubThoughtClickHandlers = {
	/**
	 * 点击单条想法时触发
	 * @param thought 当前点击的具体想法对象
	 */
	onThoughtClick: (thought: EbookThought) => void;
	/**
	 * 点击包含多条想法的 cfiRange 下划线分组时触发
	 * @param thoughts 同一段落下（同一 cfiRange）全部想法
	 */
	onThoughtGroupClick: (thoughts: EbookThought[]) => void;
};

type ContentsWithRange = EpubIframeContents & {
	range: (cfi: string) => Range | null;
};

export const EPUB_THOUGHT_UNDERLINE_CLASS = 'moke-epub-thought-ul';

const EPUB_THOUGHT_UNDERLINE_STYLE_ID = 'moke-epub-thought-ul-styles';
const THOUGHT_MARK_DATA_SHOW_LINE = 'showLine';
const THOUGHT_MARK_DATA_SHOW_LINE_ATTR = 'show-line';

/** 深色背景下也可见的琥珀色细虚线 */
const THOUGHT_LINE_COLOR = '#d97706';
const THOUGHT_LINE_OPACITY = '0.55';
/** 下划线与文字底边的间距（px） */
const THOUGHT_LINE_OFFSET_PX = 1;
/** 虚线：短线长度、间隔 */
const THOUGHT_LINE_DASHARRAY = '1 6';

const EPUB_THOUGHT_UNDERLINE_CSS = `
g.${EPUB_THOUGHT_UNDERLINE_CLASS} > rect,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"] > rect {
	stroke: transparent !important;
	stroke-width: 0 !important;
	fill: none !important;
}
g.${EPUB_THOUGHT_UNDERLINE_CLASS} > line,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"] > line {
	stroke: ${THOUGHT_LINE_COLOR} !important;
	stroke-opacity: ${THOUGHT_LINE_OPACITY} !important;
	stroke-width: 1 !important;
	stroke-dasharray: ${THOUGHT_LINE_DASHARRAY} !important;
	stroke-linecap: round !important;
}
g.${EPUB_THOUGHT_UNDERLINE_CLASS}[data-${THOUGHT_MARK_DATA_SHOW_LINE_ATTR}="0"] > line,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"][data-${THOUGHT_MARK_DATA_SHOW_LINE_ATTR}="0"] > line {
	stroke: transparent !important;
	stroke-opacity: 0 !important;
}
`;

/** epub.js 默认 merge 到 g 上；rect 继承后成虚线框，line 默认黑色在深色主题不可见 */
export const EPUB_THOUGHT_UNDERLINE_STYLES: Record<string, string> = {
	stroke: THOUGHT_LINE_COLOR,
	'stroke-opacity': THOUGHT_LINE_OPACITY,
	'stroke-width': '1',
	'stroke-dasharray': THOUGHT_LINE_DASHARRAY,
	'mix-blend-mode': 'normal',
};

/** 仅命中、不绘制可见线（被外层选区完全包含时） */
export const EPUB_THOUGHT_UNDERLINE_HIT_STYLES: Record<string, string> = {
	stroke: 'transparent',
	'stroke-opacity': '0',
	'stroke-width': '1',
	'stroke-dasharray': THOUGHT_LINE_DASHARRAY,
	'mix-blend-mode': 'normal',
};

/**
 * 确保 EPUB 想法下划线（underline）自定义样式已插入目标文档的 <head> 区域。
 *
 * 功能说明：
 * - 检查并插入唯一 style 标签：通过唯一 ID（EPUB_THOUGHT_UNDERLINE_STYLE_ID）在当前文档（默认为全局 document）中查找 <style> 节点；
 *   若找不到，则创建新的 <style>，设定 style.id，并插入文档 <head>。
 * - 始终同步最新样式：无论是否首次插入，每次都将样式内容覆盖为 EPUB_THOUGHT_UNDERLINE_CSS，确保下划线样式及时更新（如动态主题切换、运行时变更等场景）。
 *
 * @param doc 待操作的目标文档（默认为全局 document，可用于 iframe 内容文档）
 */
function ensureThoughtUnderlineStyles(doc: Document = document): void {
	const head = doc.head ?? doc.documentElement;
	if (!head) return;

	// 查找唯一标识的 <style> 标签，用于避免重复插入
	let style = doc.getElementById(
		EPUB_THOUGHT_UNDERLINE_STYLE_ID,
	) as HTMLStyleElement | null;
	if (!style) {
		// 若未找到，创建新的 <style> 节点并设定唯一 id，插入到 <head>
		style = doc.createElement('style');
		style.id = EPUB_THOUGHT_UNDERLINE_STYLE_ID;
		head.appendChild(style);
	}
	// 始终将样式内容设置为最新下划线样式，确保主题或配置变动时及时刷新
	style.textContent = EPUB_THOUGHT_UNDERLINE_CSS;
}

function getRenditionContentsList(rend?: Rendition): EpubIframeContents[] {
	if (!rend) return [];
	const raw = rend.getContents();
	return Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];
}

function patchAllThoughtUnderlineMarks(rend?: Rendition): void {
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}
	for (const doc of docs) {
		try {
			ensureThoughtUnderlineStyles(doc);
			patchThoughtUnderlineMarks(doc);
		} catch {
			// iframe 卸载或文档不可用时忽略
		}
	}
}

/**
 * 修正 EPUB 想法下划线标记的 SVG 元素，补全下划线、适配样式、消除多余 rect。
 *
 * 设计目的：
 * - epub.js 默认使用 g > rect 绘制文本高亮，但我们的想法下划线需用 g > line 虚线渲染；
 * - 需将 rect 做透明处理，仅作为热点，无需参与显示，防止出现在深色/主题切换下出现杂色边框；
 * - line 需根据 rect 自动计算位置、宽度、样式（始终保持下划线紧贴正文）；
 * - 允许通过 data-THOUGHT_MARK_DATA_SHOW_LINE 控制线的可见（如遇选区包裹、需让交互层生效时可隐藏线）。
 *
 * @param root SVG DOM 根节点（默认 document，全局或 EPUB iframe 文档皆可）
 */
function patchThoughtUnderlineMarks(root: ParentNode = document): void {
	// 查找所有目标 g 元素（class 或 ref 名字匹配下划线标识）
	const groups = root.querySelectorAll(
		`g.${EPUB_THOUGHT_UNDERLINE_CLASS}, g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"]`,
	);

	groups.forEach((g) => {
		// 检查当前分组是否需要显示下划线（data-xxx="0" 时隐藏线，仅作为命中区域）
		const showLine =
			(g as SVGElement).dataset[THOUGHT_MARK_DATA_SHOW_LINE] !== '0';

		// 获取该组下所有 rect 和 line（通常一对一）
		const rects = g.querySelectorAll('rect');
		const lines = g.querySelectorAll('line');

		// 处理所有 rect：全部设置为透明描边、无填充，仅用作热点，不参与视觉渲染
		rects.forEach((rect) => {
			rect.setAttribute('stroke', 'transparent'); // 边框为透明
			rect.setAttribute('stroke-width', '0'); // 无实际边框
			rect.setAttribute('fill', 'none'); // 无填充
		});

		// 依次设置每条下划线 line
		lines.forEach((line, index) => {
			// 若有同位置的 rect，用其坐标计算下划线应绘制在哪里
			const rect = rects[index];
			if (rect) {
				const x = Number.parseFloat(rect.getAttribute('x') ?? '0');
				const y = Number.parseFloat(rect.getAttribute('y') ?? '0');
				const width = Number.parseFloat(rect.getAttribute('width') ?? '0');
				const height = Number.parseFloat(rect.getAttribute('height') ?? '0');
				// 计算下划线 Y 值：rect 底部下偏移，保证紧贴正文
				const lineY = y + height + THOUGHT_LINE_OFFSET_PX;
				// 设置起止点（横向画线，y1=y2，x1~x2 由 rect 决定）
				line.setAttribute('x1', String(x));
				line.setAttribute('x2', String(x + width));
				line.setAttribute('y1', String(lineY));
				line.setAttribute('y2', String(lineY));
			}

			// 若不显示线，仅设置其为不可见样式，直接返回
			if (!showLine) {
				line.setAttribute('stroke', 'transparent');
				line.setAttribute('stroke-opacity', '0');
				return;
			}

			// 否则正式绘制可见下划线 —— 主色（如主题色）、虚线、圆端头、适当透明度
			line.setAttribute('stroke', THOUGHT_LINE_COLOR);
			line.setAttribute('stroke-opacity', THOUGHT_LINE_OPACITY);
			line.setAttribute('stroke-width', '1');
			line.setAttribute('stroke-dasharray', THOUGHT_LINE_DASHARRAY);
			line.setAttribute('stroke-linecap', 'round');
		});
	});
}

/**
 * 延迟两帧后为 EPUB 想法下划线 patch 样式与位置的调度函数
 *
 * 用途：
 * 为了解决 epub.js 内容渲染/切换时标记刷新可能与 DOM 更新存在时序差异，可能首帧拿到的 SVG 不完整或刚被重建，
 * 此处使用两级 requestAnimationFrame（rAF）的方式“延后两帧”，保证 DOM 状态稳定后再执行下划线相关样式插入与定制化 patch。
 *
 * 实现细节：
 * - 第一层 rAF：推迟到下一帧，使本轮微/宏任务后的 DOM 更新有机会完成（比如 React/epub.js 完成注入）。
 * - 第二层 rAF：再推迟一帧，进一步规避复杂 DOM 树在批量变化下可能的时间差，确保操作时 SVG 已经挂载且是最终形态。
 * - ensureThoughtUnderlineStyles()：注入自定义 CSS，仅插入一次。
 * - patchThoughtUnderlineMarks()：遍历所有 EPUB 想法下划线组件的 rect/line，定位和样式 patch。
 */
function schedulePatchThoughtUnderlineMarks(rend?: Rendition): () => void {
	let cancelled = false;
	requestAnimationFrame(() => {
		if (cancelled) return;
		requestAnimationFrame(() => {
			if (cancelled) return;
			try {
				patchAllThoughtUnderlineMarks(rend);
			} catch {
				// rendition 销毁后 rAF 仍可能触发，忽略即可
			}
		});
	});
	return () => {
		cancelled = true;
	};
}

/**
 * EPUB 想法下划线 mark 的 SVG Selector
 *
 * 该选择器用于选中所有 epub.js 渲染的想法下划线（虚线），
 * 其 mark 可能以 class 或 ref 属性命中，兼容两种情况。
 *
 * - g.moke-epub-thought-ul            ：通过 class 选中
 * - g[ref="moke-epub-thought-ul"]     ：通过 ref 属性选中（某些 epub.js 版本 mark 时用 ref）
 */
const THOUGHT_MARK_SELECTOR = `g.${EPUB_THOUGHT_UNDERLINE_CLASS}, g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"]`;

/**
 * 设置所有 EPUB 想法下划线 mark 的 pointer-events
 *
 * 常用于“临时禁止下划线交互”，如选中文字阶段禁用点击，防止误触发想法弹窗。
 *
 * @param value pointer-events 的 CSS 属性，'none' 表示禁止交互、'auto' 恢复允许（可点击）
 */
function setThoughtMarkPointerEvents(value: 'none' | 'auto'): void {
	// 遍历所有匹配下划线的 g 节点，设置 pointerEvents 样式控制鼠标事件行为
	document.querySelectorAll(THOUGHT_MARK_SELECTOR).forEach((node) => {
		// 类型断言为 SVGElement，确保可以设置 style
		(node as SVGElement).style.pointerEvents = value;
	});
}

/**
 * 获取指定 window 中当前被用户选中的文本内容
 *
 * @param win 目标 window（通常为 EPUB 阅读区中的 iframe window）
 * @returns 当前选中的文本内容（已去除首尾空白），若无选中文本则返回空字符串
 */
function readSelectionText(win: Window): string {
	// 通过 getSelection() 获得 Selection 对象（可能为 null），读取 toString() 结果再 trim 去除空白
	return (win.getSelection()?.toString() ?? '').trim();
}

/**
 * 判断 {@link Rendition} 当前各内容区（可能多 iframe）中是否存在任意文字选区
 *
 * 原理：遍历 rendition.getContents() 返回的内容对象列表，依次检查其 window 内是否有非空的选中文本
 * 只要有一个 iframe 存在选区即返回 true，所有为空则为 false
 *
 * @param rend EPUB.js 的 Rendition 实例
 * @returns 是否有任一内容区被选中文字（即用户正在选区阶段）
 */
function hasTextSelectionInRend(rend: Rendition): boolean {
	const raw = rend.getContents();

	/**
	 * EPUB.js rendition.getContents() 可能返回：
	 *   - 单个 EpubIframeContents
	 *   - EpubIframeContents[]（多 iframe 章节并存情形）
	 *   - null/undefined（极端情况）
	 *
	 * 故此需规范化为数组结构，便于后续统一遍历
	 */
	const list: EpubIframeContents[] = Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];

	// 遍历所有内容 iframe，只要有 window 选区非空则视为“有选中文字”
	for (const contents of list) {
		if (readSelectionText(contents.window).length > 0) return true;
	}

	// 所有区块均未检测到选中文本，返回 false
	return false;
}

/**
 * [核心保护机制] 防止选中文字时误触 EPUB 想法 underline（虚线下划线）mark 的点击事件
 *
 * - 问题：用户在阅读区拖动鼠标/手指选中一段文字时，选区下方的“想法”虚线下划线区域（SVG 层）屏幕坐标重叠；
 *         若 mouseup(松手)/click 坐标刚好落在 mark 上，容易导致“想法详情弹窗”意外打开，产生误触。
 * - 目标：在选区开始（鼠标/触摸按下）阶段暂时关闭下划线的 pointer-events，待本轮点击事件全部派发结束（mouseup 后的 setTimeout）
 *         再恢复 pointer-events: auto，从而实现“选字不弹窗、正常点击依然可交互”。
 *
 * @param rend EPUB.js 的 Rendition 对象，用于注册/解绑内容 iframe 的相关事件
 * @returns dispose 函数，调用可彻底移除本 guard 绑定的一切监听与副作用，务必随页面卸载时一同释放
 */
function attachThoughtMarkClickGuard(rend: Rendition): () => void {
	// 记录所有已绑定 contents (iframe 渲染区) 及其解绑回调，方便整体注销
	const contentCleanups = new Map<EpubIframeContents, () => void>();

	/**
	 * 在 selection 编辑区内按下（mousedown/touchstart）时触发，此时关闭 underline mark 的 pointer-events，
	 * 让拖动和松手不会命中 SVG 下划线，防止 onClick/markClicked 被错误触发。
	 */
	const onSelectionPointerDown = () => {
		setThoughtMarkPointerEvents('none');
	};

	/**
	 * 在整个文档（顶层 window） pointerup/touchend 时恢复 pointer-events:auto，
	 * 注意需要 setTimeout 避免恢复过早导致 click/mouseup 派发时依然会命中 mark。
	 */
	const onSelectionPointerUp = () => {
		// setTimeout 0：等事件冒泡和 click 完全处理后再恢复（防止因事件顺序提前导致问题）
		setTimeout(() => setThoughtMarkPointerEvents('auto'), 0);
	};

	/**
	 * 绑定具体的 iframe contents —— 在其 document 上挂载 down 事件监听。
	 * 只有初次进入（未被记录）时才绑定一次，防止重复。
	 */
	const bindContents = (contents: EpubIframeContents) => {
		if (contentCleanups.has(contents)) return; // 避免重复注册
		const doc = contents.document;
		doc.addEventListener('mousedown', onSelectionPointerDown, true); // 捕获阶段监听鼠标按下
		doc.addEventListener('touchstart', onSelectionPointerDown, true); // 兼容触摸按下
		// 记录解绑函数，销毁时调用，避免内存泄漏或事件残留
		contentCleanups.set(contents, () => {
			doc.removeEventListener('mousedown', onSelectionPointerDown, true);
			doc.removeEventListener('touchstart', onSelectionPointerDown, true);
		});
	};

	// 注册 EPUB.js 渲染 iframe (contents) 动态载入钩子，每次有新 iframe 加载都会自动绑定事件
	rend.hooks.content.register(bindContents);

	// 对于当前已加载的 contents 也立刻补上一遍绑定（首次进页面就有 iframe 时需覆盖）
	const existing = rend.getContents();
	if (Array.isArray(existing)) {
		for (const item of existing) bindContents(item as EpubIframeContents);
	} else if (existing) {
		bindContents(existing as EpubIframeContents);
	}

	// 在顶层文档全局监听 pointerup（鼠标松手）和 touchend（触摸释放），统一恢复 pointer-events，确保不漏
	document.addEventListener('pointerup', onSelectionPointerUp, true);
	document.addEventListener('touchend', onSelectionPointerUp, true);

	/**
	 * 返回一个卸载函数，调用后移除所有监听与副作用，包括所有 iframe 的事件和全局 pointerup/touchend，
	 * 并确保恢复 pointer-events:auto 强制回归可交互状态。
	 */
	return () => {
		try {
			rend.hooks.content.deregister(bindContents);
		} catch {
			// rendition 已销毁时忽略
		}
		for (const fn of contentCleanups.values()) fn(); // 调用所有解绑逻辑
		contentCleanups.clear();
		document.removeEventListener('pointerup', onSelectionPointerUp, true);
		document.removeEventListener('touchend', onSelectionPointerUp, true);
		setThoughtMarkPointerEvents('auto'); // 万一漏了恢复，强制兜底
	};
}

/**
 * 按 cfiRange 分组聚合所有想法
 *
 * 为什么要分组：EPUB 正文同一段落（同一 cfiRange）可能存在多条想法，页面下划线只需画一条，点击弹出全部想法。此函数将数组聚合为 Map，key 为去除空白的 cfiRange，value 为该段下所有想法，保证每组在后续渲染和事件分发时可批量处理。
 *
 * @param thoughts 所有想法（来自接口，未分组）
 * @returns Map<string, EbookThought[]> key: cfiRange, value: 属于该段的全部想法
 */
function groupThoughtsByCfi(
	thoughts: EbookThought[],
): Map<string, EbookThought[]> {
	const map = new Map<string, EbookThought[]>();
	for (const thought of thoughts) {
		const cfi = thought.cfiRange.trim(); // 去除两端空白防止意外失配
		if (!cfi) continue; // cfiRange 为空则跳过
		const list = map.get(cfi) ?? []; // 已有则取出当前分组，否则新建空数组
		list.push(thought); // 加入该段分组
		map.set(cfi, list); // 更新分组映射
	}
	return map;
}

/** 选区跨度（字符数）：用于重叠下划线叠放，短选区后绘制、位于上层以优先响应点击 */
function cfiGroupSpanLength(group: EbookThought[]): number {
	const quote = group[0]?.quote?.trim();
	if (quote && quote.length > 0) return quote.length;
	return group[0]?.cfiRange.length ?? 0;
}

function sortCfiGroupsForUnderlineStack(
	entries: [string, EbookThought[]][],
): [string, EbookThought[]][] {
	return [...entries].sort((a, b) => {
		const spanDiff = cfiGroupSpanLength(b[1]) - cfiGroupSpanLength(a[1]);
		if (spanDiff !== 0) return spanDiff;
		return a[0].length - b[0].length;
	});
}

/**
 * 根据给定的 cfiRange 字符串，从 epub.js 的 Rendition 实例中解析得到对应的 DOM Range 对象。
 * 支持章节在单或多 iframe（多章节并存）场景，遍历每个 iframe contents 查找匹配的 Range。
 *
 * @param rend - epub.js 的 Rendition 实例
 * @param cfiRange - EPUB CFI 选区范围字符串
 * @returns {Range | null} DOM Range 对象，如果无法解析则返回 null
 */
function resolveCfiDomRange(rend: Rendition, cfiRange: string): Range | null {
	// 获取当前章节对应的 iframe contents，可能为单个对象或对象数组
	const raw = rend.getContents();
	const list: ContentsWithRange[] = Array.isArray(raw)
		? (raw as ContentsWithRange[])
		: raw
			? [raw as ContentsWithRange]
			: [];
	// 遍历所有 contents，尝试在其范围内解析该 CFI
	for (const contents of list) {
		try {
			// contents.range 是 epub.js 注入的方法，根据 CFI 返回对应的 Range
			const range = contents.range?.(cfiRange);
			if (range) return range; // 首个成功解析到的 Range 即返回
		} catch {
			// 其它章节 iframe 无法解析当前 CFI——此为正常情况，忽略异常继续其他 contents
		}
	}
	// 所有 contents 均未解析成功，返回 null
	return null;
}

/**
 * 判断 inner Range 是否被 outer Range 严格包含（而不是刚好重合）。
 * “严格包含”定义为：
 *   - inner 的起点不得早于 outer（大于等于 outer 起点）
 *   - inner 的终点不得晚于 outer（小于等于 outer 终点）
 *   - 但两端不能都等于 outer（即不能完全重合，必须有至少一端不等于）
 *
 * @param inner - 待判断的内部区间
 * @param outer - 被比较的外部区间
 * @returns 若 inner 严格在 outer 区间内部则返回 true，否则返回 false
 */
function isDomRangeStrictlyContained(inner: Range, outer: Range): boolean {
	try {
		// 检查 inner 的起点是否大于等于 outer 起点
		const startsAfterOrEqual =
			inner.compareBoundaryPoints(Range.START_TO_START, outer) >= 0;
		// 检查 inner 的终点是否小于等于 outer 终点
		const endsBeforeOrEqual =
			inner.compareBoundaryPoints(Range.END_TO_END, outer) <= 0;
		// 如起点早于 outer 或终点晚于 outer，则不被包含
		if (!startsAfterOrEqual || !endsBeforeOrEqual) return false;
		// 检查两端是否与 outer 完全重合
		const sameStart =
			inner.compareBoundaryPoints(Range.START_TO_START, outer) === 0;
		const sameEnd = inner.compareBoundaryPoints(Range.END_TO_END, outer) === 0;
		// 只要存在一端不同即可认定被严格包含
		return !(sameStart && sameEnd);
	} catch {
		return false;
	}
}

/**
 * 从给定的 CFI range 字符串中提取“Spine Hint”部分（即基于 spine 的章节定位标识）。
 *
 * CFI 结构通常如下例所示：
 *   epubcfi(/6/12!/4/2[chapter01]!/4/2/14)
 * 其中，"/6/12" 表示 spine 内部的位置，即“Spine Hint”；后面的 ! 为分隔符。
 *
 * 该函数的作用是：只保留括号中的 spine hint 部分（不含 ! 及其后的片段），用于判断不同 CFI 是否属于同一章节内容。
 * 若解析未匹配到，则返回原值，保证不出错。
 *
 * @param cfiRange - 形如 'epubcfi(...!...)' 的 CFI range 字符串
 * @returns   Spine Hint 部分（即括号内 ! 之前的路径）；未匹配返回原字符串
 */
function extractCfiSpineHint(cfiRange: string): string {
	// 使用正则匹配 "epubcfi(" 后面到第一个 "!" 之前的所有内容，并去除多余部分
	const match = cfiRange.match(/epubcfi\(([^!]+)!/);
	return match?.[1] ?? cfiRange;
}

/**
 * 判断 innerQuote 是否被 outerQuote 严格包含（即 innerQuote 是 outerQuote 的连续子串，但不能等于 outerQuote 本身）
 *
 * 规则说明：
 *   - 若任一参数为空或完全相等，认为“没有被严格包含”，直接返回 false
 *   - 若 innerQuote 作为连续子串存在于 outerQuote 内（且不全等），认为被严格包含，返回 true
 *   - 典型用例：innerQuote='他很高兴', outerQuote='那天他很高兴地走出门' => true
 *
 * @param innerQuote - 要检查是否嵌套在 outerQuote 内的小摘录（子串）
 * @param outerQuote - 外层的更长摘录（父串）
 * @returns innerQuote 是否被 outerQuote 严格嵌套
 */
function isQuoteStrictlyNested(
	innerQuote: string,
	outerQuote: string,
): boolean {
	// 任意一端为空，或内容完全相同不算“严格嵌套”
	if (!innerQuote || !outerQuote || innerQuote === outerQuote) return false;
	// outerQuote 包含 innerQuote（且不全等）视为严格嵌套
	return outerQuote.includes(innerQuote);
}

/**
 * 判断 inner CFI 区间是否被 outer 区间“严格包含”（即 inner 是 outer 的严格子集，不能与 outer 完全重合）。
 *
 * 多步判断（兼容 DOM 可用与不可用场景）：
 * 1. 若 CFI 字符串相同，则肯定不严格包含，直接返回 false。
 * 2. 若渲染引擎 rend 能解析两段 CFI 的 DOM Range，则调用 isDomRangeStrictlyContained 严格比较物理区域是否嵌套。
 * 3. 若无法获得 DOM Range，则退化为摘录 quote 的内容判断：
 *    - 取每组 group 的第一个 thought 的 quote，修剪空白。
 *    - 若 inner quote 不是 outer quote 的严格子串（isQuoteStrictlyNested），说明无嵌套，返回 false。
 *    - 若 quote 严格嵌套，再判断二者的“spine hint”是否相同（即是否同章节），只在同章节下认为嵌套成立。
 *
 * 用于决定下划线关系：内层完全被外层包裹时优先只绘外层（避免多条重叠）。
 *
 * @param inner - 被检测是否嵌套的 CFI 字符串
 * @param outer - 外层 CFI 字符串
 * @param innerGroup - inner 关联的 thought 列表（首项的 quote 参与文本判定）
 * @param outerGroup - outer 关联的 thought 列表
 * @param rend - epub.js 渲染引擎，用于解析 CFI -> DOM 区间
 * @returns inner 是否被 outer 严格包含
 */
function isCfiRangeStrictlyContained(
	inner: string,
	outer: string,
	innerGroup: EbookThought[],
	outerGroup: EbookThought[],
	rend: Rendition,
): boolean {
	// 若 CFI 完全一致，不认为是嵌套，直接 false
	if (inner === outer) return false;

	// 尝试利用 Rendition 解析成 DOM Range 精确比较物理区域嵌套关系
	const innerRange = resolveCfiDomRange(rend, inner);
	const outerRange = resolveCfiDomRange(rend, outer);
	if (innerRange && outerRange) {
		// 可解析为 DOM 区间时，直接用 DOM API 判断是否严格包含
		return isDomRangeStrictlyContained(innerRange, outerRange);
	}

	// 不可解析 DOM 时，回退到文字摘录 quote 判断
	const innerQuote = innerGroup[0]?.quote?.trim() ?? '';
	const outerQuote = outerGroup[0]?.quote?.trim() ?? '';
	// 若摘录内容不满足“严格嵌套”，直接 false
	if (!isQuoteStrictlyNested(innerQuote, outerQuote)) return false;

	// quote 嵌套后，还需同章节（spine hint）才算“嵌套”
	return extractCfiSpineHint(inner) === extractCfiSpineHint(outer);
}

/**
 * 计算哪些 CFI 区间应当绘制可见的下划线（即未被其它更大的选区“严格包含”，避免重复覆盖等视觉问题）。
 *
 * 具体逻辑说明：
 * - 遍历所有已分组的 [CFI, 该CFI的thought列表]（entries）；
 * - 对于每一个当前的 cfi，判断它是否被其它 cfi（otherCfi）“严格包含”：
 *   - 只要找到任何一个 otherCfi 满足 `isCfiRangeStrictlyContained(cfi, otherCfi, group, otherGroup, rend)` 为真，则视为 cfi 被其完全包裹。
 *   - 被包裹的 cfi 就不需要绘制可见的下划线，只用于命中点击等透明命中层。
 * - 最后返回所有未被包裹（即不被其它任何 cfi 严格包含）的 cfi 组成的 Set。
 *
 * 这种判定只画最外层可见下划线，嵌套选区只响应点击（避免多层多条虚线重叠）。
 *
 * @param entries - 所有 [cfi, group] 组合（每个 group 下至少有一个 thought）
 * @param rend - epub.js Rendition 实例，用于解析 cfi 到 DOM 区间
 * @returns 返回应绘制下划线的 cfi 字符串集合
 */
function computeLineVisibleCfis(
	entries: [string, EbookThought[]][],
	rend: Rendition,
): Set<string> {
	const visible = new Set<string>(); // 用于保存需要绘制下划线的 cfi

	for (const [cfi, group] of entries) {
		// 检查当前 cfi 是否被其它 cfi 严格包含
		const contained = entries.some(
			([otherCfi, otherGroup]) =>
				otherCfi !== cfi &&
				isCfiRangeStrictlyContained(cfi, otherCfi, group, otherGroup, rend),
		);
		// 如果没有被任何其它 cfi 包裹，则加入可见集合
		if (!contained) visible.add(cfi);
	}
	return visible;
}

/**
 * 同步 EPUB 阅读器中“想法”下划线标记的主函数。
 *
 * 功能与流程：
 * 1. 根据传入的 thoughts 对象（每条读书想法及其 cfi 范围），分组、去重并决定每一段内容是否需要渲染下划线（避免内层多余重叠）。
 * 2. 对于每一个分组（一个 cfiRange 下的多条想法），在 epub.js 注释/标注层中绘制下划线（或仅透明命中区）。
 * 3. 样式动态控制：外层下划线可见，内层只负责命中点击，不可见。
 * 4. 保证 appliedRef 为全量有效标记映射，并清理已经无效的下划线。
 * 5. 挂载 hooks：页面内容渲染/render 之后，以及定位/翻页后，均自动重新 patch 虚线样式，保证任意视图下标记始终一致。
 * 6. 点击事件处理：避免文本二次选区时误触，并根据 cfi 或 thoughtIds 匹配所有相关想法，传出给调用方用于弹窗列表。
 * 7. 返回一个解绑/销毁函数：清理所有注入、监听及标记（react 组件卸载、切换书籍/章节时调用）。
 *
 * @param rend       epub.js Rendition 实例，负责文档渲染与批注
 * @param thoughts   当前页面所有的“想法”对象列表
 * @param handlers   用户点击下划线时的回调（通常打开弹窗、列表等）
 * @param appliedRef 外部引用：cfiRange => 当前生效的 thoughtId 数组（用于管理与清理残留 old 标记）
 * @returns          返回一个用于销毁（unmount）时解绑所有监听与标记的函数
 */
/**
 * 仅同步下划线批注（thoughts 变化时调用，不重复注册 hooks）
 */
export function applyEpubThoughtUnderlines(
	rend: Rendition,
	thoughts: EbookThought[],
	appliedRef: Map<string, string[]>,
): void {
	try {
		ensureThoughtUnderlineStyles();
	} catch {
		return;
	}

	const grouped = groupThoughtsByCfi(thoughts);
	const nextCfis = new Set(grouped.keys());

	for (const cfiRange of [...appliedRef.keys()]) {
		if (!nextCfis.has(cfiRange)) {
			try {
				rend.annotations.remove(cfiRange, 'underline');
			} catch {
				// ignore
			}
			appliedRef.delete(cfiRange);
		}
	}

	const sortedEntries = sortCfiGroupsForUnderlineStack([...grouped.entries()]);
	const lineVisibleCfis = computeLineVisibleCfis(sortedEntries, rend);

	for (const [cfiRange, group] of sortedEntries) {
		const thoughtIds = group.map((t) => t.id);
		const showLine = lineVisibleCfis.has(cfiRange);

		try {
			rend.annotations.remove(cfiRange, 'underline');
			rend.annotations.underline(
				cfiRange,
				{
					thoughtIds,
					[THOUGHT_MARK_DATA_SHOW_LINE]: showLine ? '1' : '0',
				},
				undefined,
				EPUB_THOUGHT_UNDERLINE_CLASS,
				showLine
					? EPUB_THOUGHT_UNDERLINE_STYLES
					: EPUB_THOUGHT_UNDERLINE_HIT_STYLES,
			);
			appliedRef.set(cfiRange, thoughtIds);
		} catch {
			appliedRef.delete(cfiRange);
		}
	}

	schedulePatchThoughtUnderlineMarks(rend);
}

/** 移除当前 appliedRef 中记录的全部下划线 */
export function teardownAppliedThoughtUnderlines(
	rend: Rendition,
	appliedRef: Map<string, string[]>,
): void {
	for (const cfiRange of [...appliedRef.keys()]) {
		try {
			rend.annotations.remove(cfiRange, 'underline');
		} catch {
			// rendition 可能已销毁
		}
	}
	appliedRef.clear();
}

export type EpubThoughtUnderlineListenerOptions = EpubThoughtClickHandlers & {
	getThoughts: () => EbookThought[];
};

/**
 * 安装下划线交互与样式 patch 监听（rendReady 后调用一次即可）
 */
export function installEpubThoughtUnderlineListeners(
	rend: Rendition,
	options: EpubThoughtUnderlineListenerOptions,
): () => void {
	const cancelScheduledPatches: (() => void)[] = [];
	const schedulePatch = () => {
		cancelScheduledPatches.push(schedulePatchThoughtUnderlineMarks(rend));
	};

	const onContent = () => {
		schedulePatch();
	};
	rend.hooks.content.register(onContent);

	const onRelocated = () => {
		schedulePatch();
	};
	rend.on('relocated', onRelocated);

	const onMarkClicked = (cfiRange: string, data: { thoughtIds?: string[] }) => {
		if (hasTextSelectionInRend(rend)) return;
		const thoughts = options.getThoughts();
		const ids = data?.thoughtIds ?? [];
		const matched =
			ids.length > 0
				? thoughts.filter((t) => ids.includes(t.id))
				: thoughts.filter((t) => t.cfiRange === cfiRange);
		if (matched.length === 0) return;
		options.onThoughtGroupClick(matched);
	};
	rend.on('markClicked', onMarkClicked);

	const detachMarkClickGuard = attachThoughtMarkClickGuard(rend);
	schedulePatch();

	return () => {
		for (const cancel of cancelScheduledPatches) cancel();
		cancelScheduledPatches.length = 0;
		detachMarkClickGuard();
		try {
			rend.hooks.content.deregister(onContent);
			rend.off('relocated', onRelocated);
			rend.off('markClicked', onMarkClicked);
		} catch {
			// rendition 已销毁时忽略
		}
	};
}

/**
 * @deprecated 请改用 applyEpubThoughtUnderlines + installEpubThoughtUnderlineListeners
 */
export function syncEpubThoughtUnderlines(
	rend: Rendition,
	thoughts: EbookThought[],
	handlers: EpubThoughtClickHandlers,
	/** cfiRange -> 该段下所有 thoughtId（顺序与 thoughts 一致） */
	appliedRef: Map<string, string[]>,
): () => void {
	const getThoughtsRef = { current: thoughts };
	getThoughtsRef.current = thoughts;

	applyEpubThoughtUnderlines(rend, thoughts, appliedRef);
	const detachListeners = installEpubThoughtUnderlineListeners(rend, {
		...handlers,
		getThoughts: () => getThoughtsRef.current,
	});

	return () => {
		detachListeners();
		teardownAppliedThoughtUnderlines(rend, appliedRef);
	};
}
