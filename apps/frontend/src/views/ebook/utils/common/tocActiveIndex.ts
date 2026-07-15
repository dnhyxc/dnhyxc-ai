import type { Rendition } from 'epubjs';
import * as EpubJS from 'epubjs';

import type { EbookTocItem } from '../../types';
import { getEpubScrollContainer } from '../epub/reader/epubScrolledNav';
import { parsePdfPageHref } from '../pdf/pdfOutline';

type EpubCfiComparer = { compare: (a: string, b: string) => number };

const EpubCFI = (EpubJS as unknown as { EpubCFI: new () => EpubCfiComparer })
	.EpubCFI;

export type TocActivePosition = {
	pdfPage?: number;
	epubSpineIndex?: number;
	/** 当前阅读 CFI；同 spine 多目录锚点时与 tocCfi 比较 */
	epubCfi?: string;
	/** 无 tocCfi 时回退：按锚点在视口中的位置判定（Foliate TOCProgress） */
	getRendition?: () => Rendition | null;
};

function compareCfi(a: string, b: string): number {
	const Ctor =
		EpubCFI ??
		(EpubJS as unknown as { default?: { EpubCFI?: typeof EpubCFI } }).default
			?.EpubCFI;
	if (!Ctor) return 0;
	try {
		return new Ctor().compare(a, b);
	} catch {
		return 0;
	}
}

function activeAmongSameSpine(
	items: EbookTocItem[],
	sameIndexes: number[],
	epubCfi: string | undefined,
	rend: Rendition | null,
): number {
	if (sameIndexes.length === 0) return -1;
	if (sameIndexes.length === 1) return sameIndexes[0]!;

	// 1) 有 tocCfi：取「不超过当前 CFI」的最后一项（Foliate）
	if (epubCfi?.trim()) {
		let best = -1;
		let sawNonZero = false;
		for (const i of sameIndexes) {
			const tocCfi = items[i]?.tocCfi;
			if (!tocCfi) continue;
			const cmp = compareCfi(tocCfi, epubCfi);
			if (cmp !== 0) sawNonZero = true;
			if (cmp <= 0) best = i;
		}
		// 比较器失效时全 0，勿误选同 spine 最后一项
		if (sawNonZero && best >= 0) return best;
	}

	// 2) 活文档：视口顶边之上（含）的最后一个锚点
	const container = rend ? getEpubScrollContainer(rend) : null;
	if (container) {
		const topY = container.getBoundingClientRect().top + 16;
		let best = sameIndexes[0]!;
		for (const i of sameIndexes) {
			const href = items[i]?.href ?? '';
			const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
			if (!hash) {
				best = i;
				continue;
			}
			let decoded = hash;
			try {
				decoded = decodeURIComponent(hash);
			} catch {
				// keep
			}
			let el: Element | null = null;
			for (const iframe of container.querySelectorAll('iframe')) {
				const doc = (iframe as HTMLIFrameElement).contentDocument;
				el =
					doc?.getElementById(decoded) ??
					doc?.querySelector(`a[name="${CSS.escape(decoded)}"]`) ??
					null;
				if (el) break;
			}
			if (!el) continue;
			if (el.getBoundingClientRect().top <= topY) best = i;
			else break;
		}
		return best;
	}

	// 3) 未知碎片位置时取同 spine 第一项（勿取最后一项，否则全书落在该文件末节）
	return sameIndexes[0]!;
}

/**
 * 当前阅读位置对应的目录项索引（无匹配时返回 -1）
 */
export function findActiveTocItemIndex(
	items: EbookTocItem[],
	position: TocActivePosition,
): number {
	if (items.length === 0) return -1;

	const { pdfPage, epubSpineIndex, epubCfi, getRendition } = position;

	if (pdfPage != null && Number.isFinite(pdfPage)) {
		let best = -1;
		for (let i = 0; i < items.length; i++) {
			const page = parsePdfPageHref(items[i].href ?? '');
			if (page != null && page <= pdfPage) {
				best = i;
			}
		}
		return best;
	}

	if (epubSpineIndex != null && Number.isFinite(epubSpineIndex)) {
		let bestBefore = -1;
		const same: number[] = [];
		for (let i = 0; i < items.length; i++) {
			const spineIndex = items[i].spineIndex;
			if (spineIndex == null) continue;
			if (spineIndex < epubSpineIndex) bestBefore = i;
			else if (spineIndex === epubSpineIndex) same.push(i);
		}
		if (same.length === 0) return bestBefore;

		const rend = getRendition?.() ?? null;
		return activeAmongSameSpine(items, same, epubCfi, rend);
	}

	return -1;
}
