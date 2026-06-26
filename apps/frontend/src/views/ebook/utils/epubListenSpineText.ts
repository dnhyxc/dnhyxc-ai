/**
 * 本文件实现了 EPUB 阅读器中“边听边读”（Listen While Reading）模式下，针对每个 spine 节（章节）高效抽取原文内容、生成 TTS 用 plain 文本、以及取得用于后续高亮映射的 DOM outerRange。
 *
 * 核心能力包括：
 * - 支持按 spine 节按需加载、缓存章节 plain 文本与 Range，帮助 TTS/高亮操作加速定位与匹配。
 * - 封装了章节内容的抽取流程：自动处理 epub.js 的导航、Cfi 定位、DOM 解析，并做超长内容截断。
 * - 提供和 TTS 处理规则一致的 stripMarkdown/空白归一化，确保后续听读文本与界面高亮能严格对齐。
 * - 设计有专用 cache 方案，按 Book/spine 索引唯一标识，避免重复加载与性能浪费。
 * - 对外导出了章节内容 slice、位置同步、TTS 句子 Dom 匹配等接口，供 Listen/高亮流畅协作使用。
 */
import type { Book, Rendition } from 'epubjs';
import {
	buildSentenceOffsetSpans,
	stripMarkdownForTts,
} from '@/utils/englishTts';
import { indexChapterSentenceRanges } from './epubListenChapterHighlight';
import { getRenditionViewsList, resolveCfiDomRange } from './epubRangeGeometry';
import { getEpubScrollContainer } from './epubScrolledNav';

/** ponytail: 单节 plain 上限，超出截断 */
export const MAX_SECTION_PLAIN_CHARS = 50_000;

const DISPLAY_TIMEOUT_MS = 6000;
const RENDERED_WAIT_MS = 800;
const MANAGER_LOC_TIMEOUT_MS = 500;

export type EpubSectionTextSlice = {
	spineIndex: number;
	plain: string;
	outerRange: Range | null;
	startCfi: string;
};

export type LoadSectionTextOpts = {
	book?: Book | null;
	startCfi?: string;
};

const sectionCache = new Map<string, EpubSectionTextSlice>();

function cacheKey(book: Book, spineIndex: number): string {
	return `${(book as Book & { key?: string }).key ?? 'book'}:${spineIndex}`;
}

type EpubLoc = {
	start?: { index?: number; cfi?: string; href?: string };
	end?: { index?: number; cfi?: string; href?: string };
};

type ManagerLocItem = {
	index?: number;
	href?: string;
	mapping?: { start?: string; end?: string };
};

/** epub.js 在连续滚动 relocated 后写入 rend.location，比 currentLocation() 可靠 */
export function resolveCurrentLocationSync(rend: Rendition): EpubLoc | null {
	const cached = (rend as Rendition & { location?: EpubLoc }).location;
	return cached?.start ? cached : null;
}

function mapManagerLocation(items: ManagerLocItem[]): EpubLoc | null {
	if (!items.length) return null;
	const start = items[0]!;
	const end = items[items.length - 1]!;
	return {
		start: {
			index: start.index,
			href: start.href,
			cfi: start.mapping?.start,
		},
		end: {
			index: end.index,
			href: end.href,
			cfi: end.mapping?.end,
		},
	};
}

/** 连续滚动下 currentLocation() 常返回 undefined，须读 rend.location 或 await manager */
export async function resolveCurrentLocationAsync(
	rend: Rendition,
): Promise<EpubLoc | null> {
	const cached = resolveCurrentLocationSync(rend);
	if (cached) return cached;

	try {
		const manager = (
			rend as unknown as { manager?: { currentLocation?: () => unknown } }
		).manager;
		const raw = manager?.currentLocation?.();
		if (raw && typeof (raw as Promise<unknown>).then === 'function') {
			const items = await Promise.race([
				raw as Promise<ManagerLocItem[]>,
				new Promise<null>((resolve) => {
					window.setTimeout(() => resolve(null), MANAGER_LOC_TIMEOUT_MS);
				}),
			]);
			if (items?.length) return mapManagerLocation(items);
		}
	} catch {
		// manager 不可用
	}

	const sync = rend.currentLocation() as EpubLoc | null;
	return sync?.start ? sync : null;
}

export async function resolveCurrentSpineIndexAsync(
	rend: Rendition,
): Promise<number | null> {
	const idx = (await resolveCurrentLocationAsync(rend))?.start?.index;
	return idx != null && Number.isFinite(idx) ? idx : null;
}

/** @deprecated 连续滚动模式下不可靠，请用 resolveCurrentSpineIndexAsync */
export function resolveCurrentSpineIndex(_rend: Rendition): number | null {
	return null;
}

export function getRenditionBook(
	rend: Rendition,
	fallback?: Book | null,
): Book | null {
	return (rend as Rendition & { book?: Book }).book ?? fallback ?? null;
}

function getSpineLength(book: Book): number {
	const spine = book.spine as
		| { length?: number; spineItems?: unknown[] }
		| undefined;
	if (typeof spine?.length === 'number' && spine.length > 0) {
		return spine.length;
	}
	return spine?.spineItems?.length ?? 0;
}

function spineItemAt(
	book: Book,
	spineIndex: number,
): { cfiBase?: string; href?: string } | undefined {
	const spine = book.spine as {
		get?: (i: number) => { cfiBase?: string; href?: string };
		spineItems?: { cfiBase?: string; href?: string }[];
	};
	try {
		return spine?.get?.(spineIndex) ?? spine?.spineItems?.[spineIndex];
	} catch {
		return spine?.spineItems?.[spineIndex];
	}
}

function listContentDocuments(rend: Rendition): Document[] {
	const raw = rend.getContents();
	const items: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
	return items
		.map((item) => (item as { document?: Document }).document)
		.filter((doc): doc is Document => !!doc?.body);
}

/** 连续滚动：取视口中心所在的 iframe document */
function pickViewportDocument(rend: Rendition): Document | null {
	const docs = listContentDocuments(rend);
	if (!docs.length) return null;
	if (docs.length === 1) return docs[0]!;

	const host = getEpubScrollContainer(rend);
	const centerY = host
		? host.getBoundingClientRect().top + host.getBoundingClientRect().height / 2
		: window.innerHeight / 2;

	for (const doc of docs) {
		const frame = doc.defaultView?.frameElement as HTMLElement | undefined;
		if (!frame) continue;
		const rect = frame.getBoundingClientRect();
		if (rect.height <= 0) continue;
		if (rect.top <= centerY && rect.bottom >= centerY) return doc;
	}

	return (
		docs.find(
			(doc) =>
				stripMarkdownForTts(doc.body!.innerText ?? '').trim().length > 80,
		) ?? docs[0]!
	);
}

function sectionPlain(doc: Document): string {
	return stripMarkdownForTts(
		doc.body?.innerText ?? doc.body?.textContent ?? '',
	).trim();
}

function getSectionDocument(
	rend: Rendition,
	spineIndex: number,
): Document | null {
	for (const view of getRenditionViewsList(rend)) {
		if (view.index !== spineIndex) continue;
		const doc = view.contents?.document;
		if (doc?.body && sectionPlain(doc)) return doc;
	}

	const docs = listContentDocuments(rend);
	if (docs.length === 1) return docs[0]!;
	if (docs.length > 1) {
		return pickViewportDocument(rend);
	}
	return null;
}

export async function ensureSpineSectionDisplayed(
	rend: Rendition,
	spineIndex: number,
	book?: Book | null,
): Promise<void> {
	const loc = resolveCurrentLocationSync(rend);
	if (loc?.start?.index === spineIndex) return;

	const resolvedBook = book ?? getRenditionBook(rend);
	const item = resolvedBook ? spineItemAt(resolvedBook, spineIndex) : undefined;
	const href = item?.href?.trim();

	await Promise.race([
		Promise.resolve(href ? rend.display(href) : rend.display(spineIndex)).catch(
			() => undefined,
		),
		new Promise<void>((resolve) => {
			window.setTimeout(resolve, DISPLAY_TIMEOUT_MS);
		}),
	]);

	await new Promise<void>((resolve) => {
		let settled = false;
		const done = () => {
			if (settled) return;
			settled = true;
			try {
				rend.off('rendered', done);
			} catch {
				// rendition 已销毁
			}
			resolve();
		};
		rend.on('rendered', done);
		window.setTimeout(done, RENDERED_WAIT_MS);
	});
}

function sliceFromDocument(
	book: Book,
	spineIndex: number,
	doc: Document,
	startCfiFallback: string,
): EpubSectionTextSlice | null {
	const body = doc.body;
	if (!body) return null;

	let plain = stripMarkdownForTts(
		body.innerText ?? body.textContent ?? '',
	).trim();
	if (!plain) return null;
	if (plain.length > MAX_SECTION_PLAIN_CHARS) {
		plain = plain.slice(0, MAX_SECTION_PLAIN_CHARS);
	}

	const outerRange = doc.createRange();
	outerRange.selectNodeContents(body);

	const item = spineItemAt(book, spineIndex);
	const startCfi = item?.cfiBase?.trim() || startCfiFallback.trim() || '';

	return { spineIndex, plain, outerRange, startCfi };
}

/** 加载 spine 节 plain（优先同步读可见 iframe，避免 currentLocation 卡死） */
export async function loadSectionTextSlice(
	rend: Rendition,
	spineIndex: number,
	opts?: LoadSectionTextOpts,
): Promise<EpubSectionTextSlice | null> {
	const book = getRenditionBook(rend, opts?.book);
	if (!book || spineIndex < 0 || spineIndex >= getSpineLength(book)) {
		return null;
	}

	const startCfiFallback =
		opts?.startCfi?.trim() ||
		resolveCurrentLocationSync(rend)?.start?.cfi?.trim() ||
		'';

	const key = cacheKey(book, spineIndex);
	const cached = sectionCache.get(key);
	if (cached?.outerRange?.startContainer.isConnected) return cached;
	if (cached) sectionCache.delete(key);

	// 1. 同步读当前 iframe（不 await location / display）
	let doc = getSectionDocument(rend, spineIndex) ?? pickViewportDocument(rend);
	if (doc) {
		const slice = sliceFromDocument(book, spineIndex, doc, startCfiFallback);
		if (slice) {
			sectionCache.set(key, slice);
			return slice;
		}
	}

	// 2. 仍失败再尝试 display 后读取
	await ensureSpineSectionDisplayed(rend, spineIndex, book);
	doc = getSectionDocument(rend, spineIndex) ?? pickViewportDocument(rend);
	if (!doc) return null;

	const slice = sliceFromDocument(book, spineIndex, doc, startCfiFallback);
	if (!slice) return null;

	sectionCache.set(key, slice);
	return slice;
}

export function clearSectionTextCache(): void {
	sectionCache.clear();
}

export function resolveStartSentenceAtCfi(
	rend: Rendition,
	slice: EpubSectionTextSlice,
	startCfi: string,
): { plainStart: number; sentenceIndex: number } {
	const trimmed = slice.plain.trim();
	const sentences = buildSentenceOffsetSpans(trimmed);
	if (!sentences.length) return { plainStart: 0, sentenceIndex: 0 };

	const cfi = startCfi.trim();
	if (!cfi || !slice.outerRange) {
		return { plainStart: sentences[0]!.start, sentenceIndex: 0 };
	}

	const at = resolveCfiDomRange(rend, cfi);
	if (!at) {
		return { plainStart: sentences[0]!.start, sentenceIndex: 0 };
	}

	const sectionDoc = slice.outerRange.startContainer.ownerDocument;
	if (at.startContainer.ownerDocument !== sectionDoc) {
		return { plainStart: sentences[0]!.start, sentenceIndex: 0 };
	}

	const ranges = indexChapterSentenceRanges(slice.outerRange, trimmed);

	for (let i = sentences.length - 1; i >= 0; i -= 1) {
		const sent = sentences[i]!;
		const r = ranges[i];
		if (!r) continue;
		if (r.compareBoundaryPoints(Range.END_TO_START, at) <= 0) {
			return { plainStart: sent.start, sentenceIndex: i };
		}
	}
	return { plainStart: sentences[0]!.start, sentenceIndex: 0 };
}

export function getSpineSectionCount(
	rend: Rendition,
	bookFallback?: Book | null,
): number {
	const book = getRenditionBook(rend, bookFallback);
	return book ? getSpineLength(book) : 0;
}

if (buildSentenceOffsetSpans('你好。世界。').length < 2) {
	throw new Error('[epubListenSpineText] 句界拆分异常');
}
