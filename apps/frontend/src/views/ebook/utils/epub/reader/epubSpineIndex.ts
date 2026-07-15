import type { Book } from 'epubjs';

import type { EbookTocItem } from '../../../types';

type SpineSection = { index: number; href: string };
type SpineLike = {
	get?: (target: string | number) => SpineSection | null;
	spineItems?: { href: string }[];
};
type PackagingLike = { navPath?: string | false; ncxPath?: string | false };

type NavNode = {
	label?: string;
	href?: string;
	subitems?: NavNode[];
};

function packagingOf(book: Book): PackagingLike | undefined {
	const b = book as Book & {
		packaging?: PackagingLike;
		package?: PackagingLike;
	};
	return b.packaging ?? b.package;
}

function splitHref(href: string): { path: string; fragment: string } {
	const i = href.indexOf('#');
	if (i < 0) return { path: href, fragment: '' };
	return { path: href.slice(0, i), fragment: href.slice(i + 1) };
}

export function normalizeHrefPath(href: string): string {
	const raw = href.split('#')[0]?.replace(/^\//, '') ?? '';
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
}

/**
 * 将 TOC href（相对 nav/ncx）解析为相对 OPF 的路径。
 * 同源：epub.js#1084 / Foliate（navPath 与 spine 同源、相对 OPF）。
 */
export function resolveTocHrefAgainstNav(book: Book, href: string): string {
	const trimmed = href.trim();
	if (!trimmed) return trimmed;

	const { path, fragment } = splitHref(trimmed);
	if (!path) return trimmed;

	const pkg = packagingOf(book);
	const basePath = (pkg?.navPath || pkg?.ncxPath || '') as string;
	if (!basePath) {
		const norm = normalizeHrefPath(path);
		return fragment ? `${norm}#${fragment}` : norm;
	}

	let resolved = path;
	try {
		// ponytail: URL API 解析相对路径；upgrade: epubjs Path 若公共导出再换
		const base = 'https://example.invalid/';
		resolved = new URL(path, base + basePath).href.replace(base, '');
	} catch {
		resolved = path;
	}

	const norm = normalizeHrefPath(resolved);
	return fragment ? `${norm}#${fragment}` : norm;
}

function spineGet(book: Book, path: string): SpineSection | null {
	const spine = book.spine as SpineLike | undefined;
	if (!spine?.get) return null;
	return (
		spine.get(path) ??
		spine.get(encodeURI(path)) ??
		spine.get(normalizeHrefPath(path))
	);
}

function uniqueBasenameIndex(
	items: { href: string }[],
	path: string,
): number | undefined {
	const base = normalizeHrefPath(path).split('/').pop() ?? '';
	if (!base) return undefined;
	const hits: number[] = [];
	for (let i = 0; i < items.length; i++) {
		const itemBase = normalizeHrefPath(items[i]?.href ?? '')
			.split('/')
			.pop();
		if (itemBase === base) hits.push(i);
	}
	return hits.length === 1 ? hits[0] : undefined;
}

function spineIndexExact(book: Book, path: string): number | undefined {
	if (!path) return undefined;

	const section = spineGet(book, path);
	if (section && Number.isFinite(section.index)) return section.index;

	const items = (book.spine as SpineLike | undefined)?.spineItems ?? [];
	if (!items.length) return undefined;

	const norm = normalizeHrefPath(path);
	const exact = items.findIndex(
		(item) => normalizeHrefPath(item.href) === norm,
	);
	if (exact >= 0) return exact;

	return uniqueBasenameIndex(items, path);
}

/**
 * nav TOC href → spine 索引。
 * 先按「已是 OPF 路径」精确匹配，再按 navPath 规范化后匹配；
 * 禁止 includes/endsWith（会把 2.xhtml 打成 12.xhtml）。
 */
export function resolveSpineIndexForHref(
	book: Book,
	href: string,
): number | undefined {
	if (!href?.trim()) return undefined;

	const { path, fragment } = splitHref(href.trim());

	if (!path && fragment) {
		const byId = spineGet(book, `#${fragment}`);
		return byId && Number.isFinite(byId.index) ? byId.index : undefined;
	}

	// 1) 已是 spine/OPF 相对路径（TOC 规范化后、canonical link 等）
	const direct = spineIndexExact(book, path);
	if (direct != null) return direct;

	// 2) TOC 相对 nav/ncx：解析后再精确匹配
	const resolved = resolveTocHrefAgainstNav(book, href);
	const resolvedPath = splitHref(resolved).path;
	if (resolvedPath && resolvedPath !== normalizeHrefPath(path)) {
		return spineIndexExact(book, resolvedPath);
	}

	return undefined;
}

/**
 * 目录跳转目标：规范成 spine 可识别的 href（保留 #fragment）+ 精确 spineIndex。
 * 点击目录应走此结果，避免原始相对路径导致 display 落到错误 section。
 */
export function canonicalizeEpubTocHref(
	book: Book,
	href: string,
): { href: string; spineIndex: number } | undefined {
	if (!href?.trim()) return undefined;

	const { fragment } = splitHref(href.trim());
	const spineIndex = resolveSpineIndexForHref(book, href);
	if (spineIndex == null) return undefined;

	const items = (book.spine as SpineLike | undefined)?.spineItems ?? [];
	const spineHref = items[spineIndex]?.href;
	if (!spineHref) return undefined;

	const displayPath = normalizeHrefPath(spineHref);
	return {
		href: fragment ? `${displayPath}#${fragment}` : displayPath,
		spineIndex,
	};
}

/** 展平 epub.js navigation.toc（含 subitems），并规范化每项 href */
export function flattenEpubNavToc(
	nodes: NavNode[] | undefined,
	book: Book,
	depth = 0,
): EbookTocItem[] {
	if (!nodes?.length) return [];

	const out: EbookTocItem[] = [];
	for (const node of nodes) {
		const label = node.label?.trim() || node.href?.trim() || '';
		if (label) {
			const canon = node.href
				? canonicalizeEpubTocHref(book, node.href)
				: undefined;
			out.push({
				label,
				depth,
				href: canon?.href ?? node.href,
				spineIndex: canon?.spineIndex,
			});
		}
		if (node.subitems?.length) {
			out.push(...flattenEpubNavToc(node.subitems, book, depth + 1));
		}
	}
	return out;
}
