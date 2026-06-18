import type { Book } from 'epubjs';

function normalizeHrefPath(href: string): string {
	try {
		return decodeURIComponent(href.split('#')[0].replace(/^\//, ''));
	} catch {
		return href.split('#')[0].replace(/^\//, '');
	}
}

/** 将 nav TOC 的 href 映射到 spine 索引，供目录高亮使用 */
export function resolveSpineIndexForHref(
	book: Book,
	href: string,
): number | undefined {
	if (!href?.trim()) return undefined;

	const normTarget = normalizeHrefPath(href);
	const items =
		(book.spine as { spineItems?: { href: string }[] } | undefined)
			?.spineItems ?? [];
	if (!items.length) return undefined;

	let idx = items.findIndex(
		(item) => normalizeHrefPath(item.href) === normTarget,
	);
	if (idx >= 0) return idx;

	idx = items.findIndex((item) => {
		const normItem = normalizeHrefPath(item.href);
		return (
			normTarget.endsWith(normItem) ||
			normItem.endsWith(normTarget) ||
			normTarget.includes(normItem) ||
			normItem.includes(normTarget)
		);
	});
	return idx >= 0 ? idx : undefined;
}
