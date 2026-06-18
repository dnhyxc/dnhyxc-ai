import type { EbookTocItem } from '../types';
import { parsePdfPageHref } from './pdfOutline';

export type TocActivePosition = {
	pdfPage?: number;
	epubSpineIndex?: number;
};

/** 当前阅读位置对应的目录项索引（无匹配时 -1） */
export function findActiveTocItemIndex(
	items: EbookTocItem[],
	position: TocActivePosition,
): number {
	if (items.length === 0) return -1;

	const { pdfPage, epubSpineIndex } = position;

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
		let best = -1;
		for (let i = 0; i < items.length; i++) {
			const spineIndex = items[i].spineIndex;
			if (spineIndex != null && spineIndex <= epubSpineIndex) {
				best = i;
			}
		}
		return best;
	}

	return -1;
}
