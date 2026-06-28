import type { EbookTocItem } from '../../types';
import { parsePdfPageHref } from '../pdf/pdfOutline';

export type TocActivePosition = {
	pdfPage?: number;
	epubSpineIndex?: number;
};

/**
 * 当前阅读位置对应的目录项索引（无匹配时返回 -1）
 *
 * @param items - 目录项数组，每个元素表示一本电子书的一个目录节点
 * @param position - 当前阅读位置，包含 pdfPage（PDF 页码，number）或 epubSpineIndex（EPUB spine 索引，number）
 * @returns 对应目录项在 items 中的索引；若无匹配，返回 -1
 */
export function findActiveTocItemIndex(
	items: EbookTocItem[],
	position: TocActivePosition,
): number {
	// 如果目录数组为空，直接返回 -1
	if (items.length === 0) return -1;

	// 解构出 PDF 页码和 EPUB spine 索引
	const { pdfPage, epubSpineIndex } = position;

	// 情况 1: 当前定位是 PDF 页码，且有效
	if (pdfPage != null && Number.isFinite(pdfPage)) {
		let best = -1; // best 记录最后一个页码小于等于当前页码的目录项索引
		// 遍历所有目录项
		for (let i = 0; i < items.length; i++) {
			// 尝试解析此目录项的 href 得到 PDF 页码
			const page = parsePdfPageHref(items[i].href ?? '');
			// 只要解析出页码且小于等于当前 pdfPage，就认为该节点仍然在当前页之前
			if (page != null && page <= pdfPage) {
				best = i;
			}
		}
		// 返回找到的最佳目录项索引（可能是 -1，表示无匹配）
		return best;
	}

	// 情况 2: 当前定位是 EPUB 的 spineIndex，且有效
	if (epubSpineIndex != null && Number.isFinite(epubSpineIndex)) {
		let best = -1; // best 记录最后一个 spineIndex 小于等于当前 spineIndex 的目录项索引
		// 遍历所有目录项
		for (let i = 0; i < items.length; i++) {
			const spineIndex = items[i].spineIndex;
			// 只要目录项的 spineIndex 有效且小于等于当前 spineIndex，就更新 best
			if (spineIndex != null && spineIndex <= epubSpineIndex) {
				best = i;
			}
		}
		// 返回找到的最佳目录项索引（可能是 -1，表示无匹配）
		return best;
	}

	// 如果既不是合法 PDF 页码也不是 EPUB spineIndex，返回 -1
	return -1;
}
