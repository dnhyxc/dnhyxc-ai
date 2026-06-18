import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { EbookTocItem } from '../types';

const PDF_PAGE_HREF_PREFIX = 'pdf-page:';

type OutlineItem = {
	title?: string;
	dest?: string | unknown[] | null;
	url?: string | null;
	items?: OutlineItem[];
};

type PdfRef = { num: number; gen: number };

function isPdfRef(value: unknown): value is PdfRef {
	return (
		typeof value === 'object' &&
		value !== null &&
		'num' in value &&
		typeof (value as PdfRef).num === 'number'
	);
}

export function pdfPageHref(pageIndex: number): string {
	return `${PDF_PAGE_HREF_PREFIX}${pageIndex}`;
}

export function parsePdfPageHref(href: string): number | null {
	if (!href.startsWith(PDF_PAGE_HREF_PREFIX)) return null;
	const page = Number.parseInt(href.slice(PDF_PAGE_HREF_PREFIX.length), 10);
	return Number.isFinite(page) ? page : null;
}

async function pageIndexFromRef(
	doc: PDFDocumentProxy,
	ref: unknown,
): Promise<number | null> {
	if (!isPdfRef(ref)) return null;
	try {
		const pageIndex = await doc.getPageIndex(ref);
		return Number.isFinite(pageIndex) ? pageIndex : null;
	} catch {
		return null;
	}
}

async function resolveDestPageIndex(
	doc: PDFDocumentProxy,
	dest: OutlineItem['dest'],
): Promise<number | null> {
	if (!dest) return null;

	try {
		// 部分 PDF 的 dest 直接是页面引用对象
		if (isPdfRef(dest)) {
			return await pageIndexFromRef(doc, dest);
		}

		let resolved: unknown = dest;

		if (typeof dest === 'string') {
			resolved = await doc.getDestination(dest);
			if (!resolved) {
				const named = await doc.getDestinations();
				resolved = named?.[dest];
			}
		}

		if (!resolved || !Array.isArray(resolved) || resolved.length === 0) {
			return null;
		}

		return await pageIndexFromRef(doc, resolved[0]);
	} catch {
		return null;
	}
}

async function flattenOutline(
	doc: PDFDocumentProxy,
	items: OutlineItem[],
	depth = 0,
): Promise<EbookTocItem[]> {
	const result: EbookTocItem[] = [];
	for (const item of items) {
		const label = item.title?.trim();
		if (!label) continue;

		const pageIndex = await resolveDestPageIndex(doc, item.dest);
		const entry: EbookTocItem = { label, depth };
		if (pageIndex != null) {
			entry.href = pdfPageHref(pageIndex);
		}
		result.push(entry);

		if (item.items?.length) {
			result.push(...(await flattenOutline(doc, item.items, depth + 1)));
		}
	}
	return result;
}

/** 从 PDF 书签/大纲生成目录项；无大纲时返回空数组 */
export async function loadPdfOutlineToc(
	doc: PDFDocumentProxy,
): Promise<EbookTocItem[]> {
	try {
		const outline = await doc.getOutline();
		if (!outline?.length) return [];
		return await flattenOutline(doc, outline as OutlineItem[]);
	} catch {
		return [];
	}
}
