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

type ManifestItem = { id: string; href: string; mediaType?: string };

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

function parseNavTitles(navHtml: string): Map<string, string> {
	const map = new Map<string, string>();
	for (const tag of navHtml.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? []) {
		const href = readAttr(tag, 'href');
		if (!href) continue;
		const text = tag
			.replace(/<a\b[^>]*>/i, '')
			.replace(/<\/a>/i, '')
			.replace(/<[^>]+>/g, '')
			.trim();
		if (text) map.set(href.split('#')[0], text);
	}
	return map;
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

@Injectable()
export class EpubChapterParserService {
	constructor(private readonly uploadService: UploadService) {}

	async parseEpubBuffer(
		buffer: Buffer,
		bookId: string,
	): Promise<ParsedEpubChapter[]> {
		const zip = await JSZip.loadAsync(buffer);
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

		const opfDir = posix.dirname(opfPath);
		const titleByHref = await this.loadNavTitles(zip, manifest, opfDir);
		const assetUrlCache = new Map<string, string>();
		const chapters: ParsedEpubChapter[] = [];

		for (const id of spineIds) {
			const item = manifest.get(id);
			if (!item?.href) continue;

			const chapterHref = posix.normalize(
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

			const title =
				titleByHref.get(chapterHref) ??
				titleByHref.get(item.href) ??
				`第 ${chapters.length + 1} 章`;

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
		return chapters;
	}

	private async loadNavTitles(
		zip: JSZip,
		manifest: Map<string, ManifestItem>,
		opfDir: string,
	): Promise<Map<string, string>> {
		const navItem = [...manifest.values()].find(
			(item) =>
				item.mediaType === 'application/x-dtbncx+xml' ||
				item.href.toLowerCase().endsWith('.ncx'),
		);
		if (navItem) {
			const ncxPath = posix.normalize(
				opfDir === '.' ? navItem.href : posix.join(opfDir, navItem.href),
			);
			const ncxFile = zip.file(ncxPath);
			if (ncxFile) {
				const ncx = decodeZipText(await ncxFile.async('uint8array'));
				const map = new Map<string, string>();
				for (const tag of ncx.match(/<navPoint\b[\s\S]*?<\/navPoint>/gi) ??
					[]) {
					const src =
						readAttr(tag, 'src') ??
						tag.match(/<content[^>]*src=["']([^"']+)["']/i)?.[1];
					const label = tag
						.match(/<text[^>]*>([\s\S]*?)<\/text>/i)?.[1]
						?.trim();
					if (src && label) map.set(src.split('#')[0], label);
				}
				if (map.size > 0) return map;
			}
		}

		const nav = [...manifest.values()].find((item) =>
			/nav\.(xhtml|html)$/i.test(item.href),
		);
		if (!nav) return new Map();

		const navPath = posix.normalize(
			opfDir === '.' ? nav.href : posix.join(opfDir, nav.href),
		);
		const navFile = zip.file(navPath);
		if (!navFile) return new Map();
		return parseNavTitles(decodeZipText(await navFile.async('uint8array')));
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
