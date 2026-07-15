import type { Book, Rendition } from 'epubjs';

import type { EbookTocItem } from '../../../types';
import { resolveCfiDomRange } from '../mark/epubRangeGeometry';
import {
	getEpubScrollContainer,
	scrolledChapterScrollTop,
	scrolledNavAlignDelta,
} from './epubScrolledNav';
import { canonicalizeEpubTocHref } from './epubSpineIndex';

type SpineSection = {
	index: number;
	href: string;
	document?: Document;
	load: (fn: unknown) => Promise<Document> | Document;
	unload?: () => void;
	cfiFromElement: (el: Element) => string;
};

function splitFragment(href: string): { path: string; fragment: string } {
	const i = href.indexOf('#');
	if (i < 0) return { path: href, fragment: '' };
	return { path: href.slice(0, i), fragment: href.slice(i + 1) };
}

function decodeFrag(fragment: string): string {
	try {
		return decodeURIComponent(fragment);
	} catch {
		return fragment;
	}
}

function findTocAnchor(doc: Document, fragment: string): Element | null {
	const id = decodeFrag(fragment);
	if (!id) return null;
	return (
		doc.getElementById(id) ??
		doc.querySelector(`a[name="${CSS.escape(id)}"]`) ??
		doc.querySelector(`[id="${CSS.escape(id)}"]`)
	);
}

/** filepos 多为空 span，对齐其后标题更稳 */
function resolveSnapElement(anchor: HTMLElement): HTMLElement {
	const rect = anchor.getBoundingClientRect();
	if (rect.height >= 1) return anchor;
	const next = anchor.nextElementSibling;
	return next instanceof HTMLElement ? next : anchor;
}

/**
 * 目录锚点顶对齐。
 * iframe 内 getBoundingClientRect 是 iframe 视口坐标，须加 iframe.top（与 readRangeViewportBounds 一致）；
 * 误用局部 top 会把 scrollTop 加上数千像素，直接滚到章末。
 */
function snapAnchorToContainerTop(rend: Rendition, anchor: HTMLElement): void {
	const container = getEpubScrollContainer(rend);
	if (!container) return;

	const el = resolveSnapElement(anchor);
	const win = el.ownerDocument?.defaultView;
	const iframe = win?.frameElement as HTMLIFrameElement | null;
	const viewEl = iframe?.closest('.epub-view') as HTMLElement | null;

	// 优先 offset 绝对定位：不受 continuous fill 后 getBoundingClientRect 抖动影响
	if (viewEl) {
		let innerTop = 0;
		let node: HTMLElement | null = el;
		while (node && node !== el.ownerDocument?.documentElement) {
			innerTop += node.offsetTop;
			const parent = node.offsetParent as HTMLElement | null;
			if (!parent || parent === node) break;
			node = parent;
		}
		container.scrollTop = scrolledChapterScrollTop(viewEl.offsetTop + innerTop);
		return;
	}

	const rect = el.getBoundingClientRect();
	const targetTop = iframe
		? iframe.getBoundingClientRect().top + rect.top
		: rect.top;
	const delta = scrolledNavAlignDelta(
		targetTop,
		container.getBoundingClientRect().top,
	);
	if (Math.abs(delta) >= 1) container.scrollTop += delta;
}

function findRenderedTocAnchor(
	rend: Rendition,
	fragment: string,
): HTMLElement | null {
	const host = getEpubScrollContainer(rend);
	if (!host || !fragment) return null;
	const id = decodeFrag(fragment);
	for (const iframe of host.querySelectorAll('iframe')) {
		const doc = (iframe as HTMLIFrameElement).contentDocument;
		const el = doc ? findTocAnchor(doc, id) : null;
		if (el instanceof HTMLElement) return el;
	}
	return null;
}

/** Foliate / epub.js#986：TOC href → 元素 CFI，供 display(cfi) 精确落点 */
export async function cfiFromTocHref(
	book: Book,
	href: string,
): Promise<string | undefined> {
	const canon = canonicalizeEpubTocHref(book, href);
	if (!canon) return undefined;

	const { fragment } = splitFragment(canon.href);
	const spine = book.spine as unknown as {
		get?: (t: number) => SpineSection | null;
	};
	const section = spine.get?.(canon.spineIndex);
	if (!section?.load) return undefined;

	await Promise.resolve(section.load(book.load.bind(book)));
	try {
		const doc = section.document;
		if (!doc) return undefined;
		const el = fragment ? findTocAnchor(doc, fragment) : doc.body;
		if (!el) return undefined;
		return section.cfiFromElement(el);
	} finally {
		section.unload?.();
	}
}

function clearContinuousViews(rend: Rendition): void {
	try {
		(
			rend as unknown as { manager?: { clear?: () => void } }
		).manager?.clear?.();
	} catch {
		// manager 未就绪
	}
}

function pauseForLayout(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

function snapAfterTocDisplay(
	rend: Rendition,
	cfi: string | undefined,
	fragment: string,
	spineIndex: number | undefined,
): void {
	if (!getEpubScrollContainer(rend)) return;

	// 1) 优先按 #fragment 找锚点（章首），避免 CFI range 落到大块父节点
	if (fragment) {
		const anchor = findRenderedTocAnchor(rend, fragment);
		if (anchor) {
			snapAnchorToContainerTop(rend, anchor);
			return;
		}
	}

	// 2) CFI → 起始节点
	if (cfi) {
		const range = resolveCfiDomRange(rend, cfi);
		if (range) {
			const node = range.startContainer;
			const el =
				node.nodeType === Node.ELEMENT_NODE
					? (node as HTMLElement)
					: node.parentElement;
			if (el) {
				snapAnchorToContainerTop(rend, el);
				return;
			}
		}
	}

	// 3) 无锚点：整章 view 顶
	if (spineIndex == null) return;
	const views = (
		rend as unknown as {
			manager?: {
				views?: { all?: () => { index: number; element?: HTMLElement }[] };
			};
		}
	).manager?.views?.all?.();
	const viewEl = views?.find((v) => v.index === spineIndex)?.element;
	if (viewEl) snapAnchorToContainerTop(rend, viewEl);
}

/**
 * 目录跳转（Foliate：resolveHref → goTo）。
 * - 有 #fragment 时转 CFI 再 display（同文件多节如 filepos）
 * - 无 fragment 时 display(spineIndex)
 * - continuous 同章二次跳转前 clear
 * - 连续滚动用 iframe 坐标校正顶对齐到节首（非章末）
 * @returns 目标 CFI（有 fragment 时）；听书切章用其定位起播句
 */
export async function navigateEpubTocHref(
	rend: Rendition,
	book: Book,
	href: string,
): Promise<string | undefined> {
	const raw = href.trim();
	if (!raw) return undefined;

	const canon = canonicalizeEpubTocHref(book, raw);
	const displayHref = canon?.href ?? raw;
	const { fragment } = splitFragment(displayHref);

	let displayTarget: string | number = displayHref;
	let snapCfi: string | undefined;

	if (fragment) {
		const cfi = await cfiFromTocHref(book, displayHref);
		if (cfi) {
			displayTarget = cfi;
			snapCfi = cfi;
		}
	} else if (canon) {
		displayTarget = canon.spineIndex;
	}

	clearContinuousViews(rend);
	if (typeof displayTarget === 'number') {
		await rend.display(displayTarget);
	} else {
		await rend.display(displayTarget);
	}
	await pauseForLayout();
	snapAfterTocDisplay(rend, snapCfi, fragment, canon?.spineIndex);
	// fill/trim 后布局可能再动一次；仅补一帧，不对齐超时轮询
	await pauseForLayout();
	snapAfterTocDisplay(rend, snapCfi, fragment, canon?.spineIndex);

	return (
		snapCfi ||
		(rend as { location?: { start?: { cfi?: string } } }).location?.start
			?.cfi ||
		undefined
	);
}

/** 为目录项挂 tocCfi，供同 spine 多锚点时 CFI 比较高亮 */
export async function attachTocCfis(
	book: Book,
	items: EbookTocItem[],
): Promise<EbookTocItem[]> {
	if (items.length === 0) return items;

	type Job = { itemIndex: number; fragment: string };
	const bySpine = new Map<number, Job[]>();
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item?.spineIndex == null) continue;
		const fragment = item.href ? splitFragment(item.href).fragment : '';
		const list = bySpine.get(item.spineIndex) ?? [];
		list.push({ itemIndex: i, fragment });
		bySpine.set(item.spineIndex, list);
	}

	const out = items.map((item) => ({ ...item }));
	const spine = book.spine as unknown as {
		get?: (t: number) => SpineSection | null;
	};

	for (const [spineIndex, jobs] of bySpine) {
		const section = spine.get?.(spineIndex);
		if (!section?.load) continue;
		try {
			await Promise.resolve(section.load(book.load.bind(book)));
			const doc = section.document;
			if (!doc) continue;
			for (const job of jobs) {
				const el = job.fragment ? findTocAnchor(doc, job.fragment) : doc.body;
				if (!el) continue;
				out[job.itemIndex] = {
					...out[job.itemIndex]!,
					tocCfi: section.cfiFromElement(el),
				};
			}
		} catch {
			// 单章失败不影响其余
		} finally {
			section.unload?.();
		}
	}

	return out;
}
