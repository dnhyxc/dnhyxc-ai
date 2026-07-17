import { posix } from 'node:path';
import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import { UploadService } from '../upload/upload.service';
import {
	countWords,
	extractBodyHtml,
	sanitizeEpubHtml,
} from './epub-html.util';

export type EpubChapterMeta = {
	index: number;
	href: string;
	title: string;
	level: number;
	wordCount: number;
};

export type ParsedEpubChapter = EpubChapterMeta & { html: string };

/** 与 Web flattenEpubNavToc 对齐：一节一条，index 指向 spine 章 */
export type EpubTocItem = {
	index: number;
	href: string;
	title: string;
	level: number;
};

export type ParsedEpubResult = {
	chapters: ParsedEpubChapter[];
	toc: EpubTocItem[];
};

type ManifestItem = { id: string; href: string; mediaType?: string };

type NavEntry = { href: string; title: string; level: number };

const IMAGE_MIME: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
};

function decodeZipText(bytes: Uint8Array): string {
	const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
	return new TextDecoder('utf-8').decode(bom ? bytes.slice(3) : bytes);
}

function readAttr(tag: string, name: string): string | undefined {
	return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
}

function parseContainerPath(xml: string): string {
	return (
		readAttr(xml.match(/<rootfile\b[^>]*>/i)?.[0] ?? '', 'full-path') ?? ''
	);
}

function parseManifest(xml: string): Map<string, ManifestItem> {
	const map = new Map<string, ManifestItem>();
	for (const tag of xml.match(/<item\b[^>]*\/?>/gi) ?? []) {
		const id = readAttr(tag, 'id');
		const href = readAttr(tag, 'href');
		if (!id || !href) continue;
		map.set(id, { id, href, mediaType: readAttr(tag, 'media-type') });
	}
	return map;
}

function parseSpine(xml: string): string[] {
	const ids: string[] = [];
	for (const tag of xml.match(/<itemref\b[^>]*\/?>/gi) ?? []) {
		const idref = readAttr(tag, 'idref');
		if (idref) ids.push(idref);
	}
	return ids;
}

function resolveRelativePath(baseHref: string, rel: string): string {
	if (/^(https?:|data:|\/)/i.test(rel)) return rel;
	const baseDir = posix.dirname(baseHref);
	return posix.normalize(posix.join(baseDir === '.' ? '' : baseDir, rel));
}

function mimeFromPath(path: string): string {
	return (
		IMAGE_MIME[posix.extname(path).toLowerCase()] ?? 'application/octet-stream'
	);
}

function stripTags(html: string): string {
	return html
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeZipPath(path: string): string {
	return posix.normalize(path.replace(/\\/g, '/')).replace(/^\.\//, '');
}

/** NCX：按开闭标签扫深度，保留每个 content（含 fragment） */
function parseNcxNavEntries(ncx: string): NavEntry[] {
	const out: NavEntry[] = [];
	const re =
		/<navPoint\b[^>]*>|<\/navPoint\s*>|<navLabel\b[^>]*>[\s\S]*?<\/navLabel\s*>|<content\b[^>]*\/?>/gi;
	let depth = 0;
	let label = '';
	for (;;) {
		const m = re.exec(ncx);
		if (!m) break;
		const tag = m[0];
		if (/^<navPoint\b/i.test(tag)) {
			depth += 1;
			label = '';
			continue;
		}
		if (/^<\/navPoint/i.test(tag)) {
			depth = Math.max(0, depth - 1);
			continue;
		}
		if (/^<navLabel\b/i.test(tag)) {
			label = stripTags(
				tag.match(/<text\b[^>]*>([\s\S]*?)<\/text>/i)?.[1] ?? tag,
			);
			continue;
		}
		const src = readAttr(tag, 'src');
		if (src && label) {
			out.push({ href: src, title: label, level: Math.max(0, depth - 1) });
		}
	}
	return out;
}

/** EPUB3 nav.xhtml：扫 ol/li/a 层级 */
function parseNavXhtmlEntries(navHtml: string): NavEntry[] {
	const tocChunk =
		navHtml.match(
			/<nav\b[^>]*epub:type=["'][^"']*\btoc\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/i,
		)?.[0] ?? navHtml;
	const out: NavEntry[] = [];
	const re = /<ol\b[^>]*>|<\/ol\s*>|<a\b[^>]*>[\s\S]*?<\/a>/gi;
	let depth = 0;
	for (;;) {
		const m = re.exec(tocChunk);
		if (!m) break;
		const tag = m[0];
		if (/^<ol\b/i.test(tag)) {
			depth += 1;
			continue;
		}
		if (/^<\/ol/i.test(tag)) {
			depth = Math.max(0, depth - 1);
			continue;
		}
		const href = readAttr(tag, 'href');
		const title = stripTags(tag);
		if (href && title) {
			out.push({ href, title, level: Math.max(0, depth - 1) });
		}
	}
	return out;
}

function resolveSpineIndex(
	spinePaths: string[],
	hrefPath: string,
): number | undefined {
	const target = normalizeZipPath(hrefPath);
	const exact = spinePaths.indexOf(target);
	if (exact >= 0) return exact;
	const byTail = spinePaths.findIndex(
		(p) => p.endsWith(`/${target}`) || p.endsWith(target),
	);
	if (byTail >= 0) return byTail;
	const base = posix.basename(target);
	return spinePaths.findIndex((p) => posix.basename(p) === base);
}

@Injectable()
export class EpubChapterParserService {
	constructor(private readonly uploadService: UploadService) {}

	async parseEpubBuffer(
		buffer: Buffer,
		bookId: string,
	): Promise<ParsedEpubResult> {
		const zip = await JSZip.loadAsync(buffer);
		const { opfDir, manifest, spineIds, opfPath } = await this.loadOpf(zip);

		const navEntries = await this.loadNavEntries(zip, manifest, opfDir);
		const assetUrlCache = new Map<string, string>();
		const chapters: ParsedEpubChapter[] = [];
		const spinePaths: string[] = [];

		for (const id of spineIds) {
			const item = manifest.get(id);
			if (!item?.href) continue;

			const chapterHref = normalizeZipPath(
				opfDir === '.' ? item.href : posix.join(opfDir, item.href),
			);
			const chapterFile = zip.file(chapterHref);
			if (!chapterFile) continue;

			const rawHtml = decodeZipText(await chapterFile.async('uint8array'));
			let body = extractBodyHtml(rawHtml);
			body = await this.rewriteImages(
				body,
				chapterHref,
				zip,
				bookId,
				assetUrlCache,
			);
			const html = sanitizeEpubHtml(body);
			if (!html) continue;

			spinePaths.push(chapterHref);
			const title =
				this.firstTitleForPath(
					navEntries,
					opfDir,
					opfPath,
					chapterHref,
					item.href,
				) ?? `第 ${chapters.length + 1} 章`;

			chapters.push({
				index: chapters.length,
				href: chapterHref,
				title,
				level: 0,
				html,
				wordCount: countWords(html),
			});
		}

		if (chapters.length === 0) throw new Error('未能解析出章节正文');

		const toc = this.buildToc(navEntries, spinePaths, opfDir, chapters);
		return { chapters, toc };
	}

	/** 仅重建目录（已解析书籍补 toc，不必重洗 HTML） */
	async parseTocFromEpubBuffer(buffer: Buffer): Promise<EpubTocItem[]> {
		const zip = await JSZip.loadAsync(buffer);
		const { opfDir, manifest, spineIds } = await this.loadOpf(zip);
		const navEntries = await this.loadNavEntries(zip, manifest, opfDir);

		const spinePaths: string[] = [];
		const spineFallback: EpubTocItem[] = [];
		for (const id of spineIds) {
			const item = manifest.get(id);
			if (!item?.href) continue;
			const chapterHref = normalizeZipPath(
				opfDir === '.' ? item.href : posix.join(opfDir, item.href),
			);
			if (!zip.file(chapterHref)) continue;
			const index = spinePaths.length;
			spinePaths.push(chapterHref);
			spineFallback.push({
				index,
				href: chapterHref,
				title: `第 ${index + 1} 章`,
				level: 0,
			});
		}

		const toc = this.buildToc(navEntries, spinePaths, opfDir, spineFallback);
		return toc.length ? toc : spineFallback;
	}

	private async loadOpf(zip: JSZip): Promise<{
		opfPath: string;
		opfDir: string;
		manifest: Map<string, ManifestItem>;
		spineIds: string[];
	}> {
		const containerFile = zip.file('META-INF/container.xml');
		if (!containerFile) throw new Error('EPUB 缺少 container.xml');

		const opfPath = parseContainerPath(
			decodeZipText(await containerFile.async('uint8array')),
		);
		if (!opfPath) throw new Error('EPUB 缺少 OPF 路径');

		const opfFile = zip.file(opfPath);
		if (!opfFile) throw new Error(`EPUB 缺少 OPF：${opfPath}`);
		const opfXml = decodeZipText(await opfFile.async('uint8array'));
		const manifest = parseManifest(opfXml);
		const spineIds = parseSpine(opfXml);
		if (spineIds.length === 0) throw new Error('EPUB spine 为空');

		return {
			opfPath,
			opfDir: posix.dirname(opfPath),
			manifest,
			spineIds,
		};
	}

	private async loadNavEntries(
		zip: JSZip,
		manifest: Map<string, ManifestItem>,
		opfDir: string,
	): Promise<NavEntry[]> {
		const ncxItem = [...manifest.values()].find(
			(item) =>
				item.mediaType === 'application/x-dtbncx+xml' ||
				item.href.toLowerCase().endsWith('.ncx'),
		);
		if (ncxItem) {
			const ncxPath = normalizeZipPath(
				opfDir === '.' ? ncxItem.href : posix.join(opfDir, ncxItem.href),
			);
			const ncxFile = zip.file(ncxPath);
			if (ncxFile) {
				const entries = parseNcxNavEntries(
					decodeZipText(await ncxFile.async('uint8array')),
				);
				if (entries.length) {
					return entries.map((e) => ({
						...e,
						href: resolveRelativePath(ncxPath, e.href),
					}));
				}
			}
		}

		const nav = [...manifest.values()].find(
			(item) =>
				item.mediaType === 'application/xhtml+xml' &&
				(/nav\.(xhtml|html)$/i.test(item.href) || /\btoc\b/i.test(item.href)),
		);
		const navFallback = [...manifest.values()].find((item) =>
			/nav\.(xhtml|html)$/i.test(item.href),
		);
		const navItem = nav ?? navFallback;
		if (!navItem) return [];

		const navPath = normalizeZipPath(
			opfDir === '.' ? navItem.href : posix.join(opfDir, navItem.href),
		);
		const navFile = zip.file(navPath);
		if (!navFile) return [];
		const entries = parseNavXhtmlEntries(
			decodeZipText(await navFile.async('uint8array')),
		);
		return entries.map((e) => ({
			...e,
			href: resolveRelativePath(navPath, e.href),
		}));
	}

	private firstTitleForPath(
		navEntries: NavEntry[],
		opfDir: string,
		_opfPath: string,
		chapterHref: string,
		manifestHref: string,
	): string | undefined {
		const candidates = new Set([
			normalizeZipPath(chapterHref),
			normalizeZipPath(
				opfDir === '.' ? manifestHref : posix.join(opfDir, manifestHref),
			),
			normalizeZipPath(manifestHref),
		]);
		for (const entry of navEntries) {
			const path = normalizeZipPath(entry.href.split('#')[0] ?? '');
			if (candidates.has(path)) return entry.title;
			if (
				[...candidates].some(
					(c) => c.endsWith(`/${path}`) || path.endsWith(`/${c}`),
				)
			) {
				return entry.title;
			}
		}
		return undefined;
	}

	private buildToc(
		navEntries: NavEntry[],
		spinePaths: string[],
		_opfDir: string,
		spineFallback: { index: number; href: string; title: string }[],
	): EpubTocItem[] {
		if (!navEntries.length) {
			return spineFallback.map((c) => ({
				index: c.index,
				href: c.href,
				title: c.title,
				level: 0,
			}));
		}

		const toc: EpubTocItem[] = [];
		for (const entry of navEntries) {
			const [pathPart, frag] = entry.href.split('#');
			const path = normalizeZipPath(pathPart ?? '');
			const index = resolveSpineIndex(spinePaths, path);
			if (index == null) continue;
			const spineHref = spinePaths[index] ?? path;
			toc.push({
				index,
				href: frag ? `${spineHref}#${frag}` : spineHref,
				title: entry.title,
				level: entry.level,
			});
		}

		return toc.length
			? toc
			: spineFallback.map((c) => ({
					index: c.index,
					href: c.href,
					title: c.title,
					level: 0,
				}));
	}

	private async rewriteImages(
		html: string,
		chapterHref: string,
		zip: JSZip,
		bookId: string,
		cache: Map<string, string>,
	): Promise<string> {
		const imgRe = /<img([^>]*)\ssrc=["']([^"']+)["']([^>]*)>/gi;
		let out = html;
		for (const m of [...html.matchAll(imgRe)]) {
			const full = m[0];
			const src = m[2];
			const resolved = resolveRelativePath(chapterHref, src);
			if (/^https?:\/\//i.test(resolved) || resolved.startsWith('data:')) {
				continue;
			}
			let url = cache.get(resolved);
			if (!url) {
				const imgFile = zip.file(resolved);
				if (!imgFile) continue;
				url = await this.uploadService.uploadEbookAssetBuffer({
					bookId,
					relativePath: resolved,
					buffer: await imgFile.async('nodebuffer'),
					mimetype: mimeFromPath(resolved),
				});
				cache.set(resolved, url);
			}
			const alt = m[1].match(/\salt=["']([^"']*)["']/i)?.[1];
			out = out.replace(
				full,
				`<img src="${url}"${alt != null ? ` alt="${alt}"` : ''} loading="lazy" />`,
			);
		}
		return out;
	}
}
