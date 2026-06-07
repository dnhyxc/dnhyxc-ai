/**
 * 练习词表拉取
 *
 * - **随机**：按 store 总数与题量划分页码（offset = 页码 × 题量）；若命中页不足题量（如最后一页），继续拉其它页补足。
 * - **顺序**：从 offset=0 起，每页步长等于题量。
 * - **继续练习**：顺序拉下一页；随机拉未使用过的页码；均排除已练 wordKey。
 */
import {
	type EnglishClassicQuoteFavoriteListEntry,
	type EnglishClassicQuoteMistakeListEntry,
	type EnglishClassicQuotesLibraryItemRow,
	type EnglishDailyMemorizeRecordEntry,
	type EnglishVocabularyFavoriteListEntry,
	type EnglishVocabularyLibraryItemRow,
	type EnglishVocabularyMistakeListEntry,
	getEnglishPracticeReviewQueue,
	listEnglishClassicQuoteFavorites,
	listEnglishClassicQuoteMistakes,
	listEnglishClassicQuotesLibraryItems,
	listEnglishClassicQuotesPackItems,
	listEnglishDailyMemorizeRecords,
	listEnglishVocabularyFavorites,
	listEnglishVocabularyLibraryItems,
	listEnglishVocabularyMistakes,
	listEnglishVocabularyPackItems,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import {
	getEnglishPracticePoolTotal,
	resolveEnglishPracticePoolKey,
	setEnglishPracticePoolTotal,
} from '@/store/englishPracticePool';
import type {
	PracticeContentKind,
	PracticeFetchContext,
	PracticeItem,
	PracticeOrder,
	PracticePaginatedPage,
	PracticeSessionCursor,
	PracticeSessionFetchResult,
	PracticeSessionParams,
	PracticeSource,
} from '../types';
import { toPracticeClassicItem, toPracticeVocabItem } from './item';

export const PRACTICE_MAX_WORDS = 50;

function vocabFavoriteToItem(
	row: EnglishVocabularyFavoriteListEntry,
): PracticeItem {
	return toPracticeVocabItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
	});
}

function vocabMistakeToItem(
	row: EnglishVocabularyMistakeListEntry,
): PracticeItem {
	return toPracticeVocabItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
	});
}

function vocabDailyMemorizeToItem(
	row: EnglishDailyMemorizeRecordEntry,
): PracticeItem {
	return toPracticeVocabItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
	});
}

function vocabLibraryRowToItem(
	row: EnglishVocabularyLibraryItemRow,
): PracticeItem {
	return toPracticeVocabItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
	});
}

function classicFavoriteToItem(
	row: EnglishClassicQuoteFavoriteListEntry,
): PracticeItem {
	return toPracticeClassicItem({
		english: row.english,
		translationZh: row.translationZh,
		source: row.source,
		noteZh: row.noteZh,
	});
}

function classicMistakeToItem(
	row: EnglishClassicQuoteMistakeListEntry,
): PracticeItem {
	return toPracticeClassicItem({
		english: row.english,
		translationZh: row.translationZh,
		source: row.source,
		noteZh: row.noteZh,
	});
}

function classicLibraryRowToItem(
	row: EnglishClassicQuotesLibraryItemRow,
): PracticeItem {
	return toPracticeClassicItem({
		english: row.english,
		translationZh: row.translationZh,
		source: row.source,
		noteZh: row.noteZh,
	});
}

function dedupeItems(items: PracticeItem[]): PracticeItem[] {
	const seen = new Set<string>();
	const out: PracticeItem[] = [];
	for (const item of items) {
		if (!item.key || seen.has(item.key)) continue;
		seen.add(item.key);
		out.push(item);
	}
	return out;
}

/** 单次练习题量（与 limit / 页步长一致） */
function sessionPageSize(count: number, total: number): number {
	return Math.min(count, PRACTICE_MAX_WORDS, total);
}

function getPageCount(total: number, pageSize: number): number {
	if (total <= 0 || pageSize <= 0) return 0;
	return Math.max(1, Math.ceil(total / pageSize));
}

function pageOffset(pageIndex: number, pageSize: number): number {
	return pageIndex * pageSize;
}

/** 最后一页可能不足 pageSize */
function pageLimit(pageIndex: number, pageSize: number, total: number): number {
	return Math.min(
		pageSize,
		Math.max(0, total - pageOffset(pageIndex, pageSize)),
	);
}

function pickRandomPageIndex(total: number, pageSize: number): number {
	const pageCount = getPageCount(total, pageSize);
	if (pageCount <= 1) return 0;
	return Math.floor(Math.random() * pageCount);
}

function pickRandomPageIndexExcluding(
	total: number,
	pageSize: number,
	used: number[],
): number | null {
	const pageCount = getPageCount(total, pageSize);
	if (pageCount <= 1) return 0;
	const usedSet = new Set(used);
	const available: number[] = [];
	for (let i = 0; i < pageCount; i += 1) {
		if (!usedSet.has(i)) available.push(i);
	}
	if (available.length === 0) return null;
	return available[Math.floor(Math.random() * available.length)]!;
}

function cursorAfterPages(
	order: PracticeOrder,
	hitPageIndices: readonly number[],
	prev: PracticeSessionCursor,
): PracticeSessionCursor {
	if (hitPageIndices.length === 0) return prev;
	if (order === 'sequential') {
		const maxPage = Math.max(...hitPageIndices);
		return {
			nextSequentialPageIndex: maxPage + 1,
			usedRandomPageIndices: prev.usedRandomPageIndices,
		};
	}
	const used = new Set(prev.usedRandomPageIndices);
	for (const pageIndex of hitPageIndices) used.add(pageIndex);
	return {
		nextSequentialPageIndex: prev.nextSequentialPageIndex,
		usedRandomPageIndices: [...used],
	};
}

function buildRandomPageTryOrder(total: number, pageSize: number): number[] {
	const pageCount = getPageCount(total, pageSize);
	const first = pickRandomPageIndex(total, pageSize);
	const order: number[] = [first];
	for (let i = 0; i < pageCount; i += 1) {
		if (i !== first) order.push(i);
	}
	return order;
}

function buildSequentialPageTryOrder(pageCount: number): number[] {
	return Array.from({ length: pageCount }, (_, i) => i);
}

function buildContinueRandomPageTryOrder(
	total: number,
	pageSize: number,
	cursor: PracticeSessionCursor,
): number[] {
	const pageCount = getPageCount(total, pageSize);
	const freshPage = pickRandomPageIndexExcluding(
		total,
		pageSize,
		cursor.usedRandomPageIndices,
	);
	const tryOrder: number[] = [];
	if (freshPage != null) tryOrder.push(freshPage);
	for (let i = 0; i < pageCount; i += 1) {
		if (!tryOrder.includes(i)) tryOrder.push(i);
	}
	return tryOrder;
}

async function collectSessionFromPaginatedPages(
	fetchPage: (offset: number, limit: number) => Promise<PracticePaginatedPage>,
	total: number,
	pageSize: number,
	pageIndices: readonly number[],
	order: PracticeOrder,
	cursor: PracticeSessionCursor,
	excludeKeys: ReadonlySet<string>,
): Promise<PracticeSessionFetchResult | null> {
	const acc: PracticeItem[] = [];
	const hitPages: number[] = [];

	for (const pageIndex of pageIndices) {
		if (acc.length >= pageSize) break;
		const page = await fetchPage(
			pageOffset(pageIndex, pageSize),
			pageLimit(pageIndex, pageSize, total),
		);
		const exclude = new Set(excludeKeys);
		for (const item of acc) {
			if (item.key) exclude.add(item.key);
		}
		const chunk = filterUnpracticed(
			dedupeItems(page.items),
			exclude,
			pageSize - acc.length,
		);
		if (chunk.length > 0) {
			hitPages.push(pageIndex);
			acc.push(...chunk);
		}
	}

	if (acc.length === 0 || hitPages.length === 0) return null;
	return {
		items: acc.slice(0, pageSize),
		cursor: cursorAfterPages(order, hitPages, cursor),
	};
}

function filterUnpracticed(
	items: PracticeItem[],
	excludeKeys: ReadonlySet<string>,
	count: number,
): PracticeItem[] {
	const out: PracticeItem[] = [];
	const seen = new Set<string>();
	for (const item of items) {
		if (!item.key || excludeKeys.has(item.key) || seen.has(item.key)) continue;
		seen.add(item.key);
		out.push(item);
		if (out.length >= count) break;
	}
	return out;
}

function resolvePoolTotal(
	ctx: PracticeFetchContext,
	poolTotal?: number,
): number | undefined {
	if (poolTotal != null && poolTotal > 0) {
		const key = resolveEnglishPracticePoolKey(ctx);
		if (key) setEnglishPracticePoolTotal(key, poolTotal);
		return poolTotal;
	}
	if (ctx.source === 'live') {
		const n =
			ctx.contentKind === 'classic'
				? EnglishPackStore.classicItems.length
				: EnglishPackStore.vocabItems.length;
		return n > 0 ? n : undefined;
	}
	const key = resolveEnglishPracticePoolKey(ctx);
	if (!key) return undefined;
	return getEnglishPracticePoolTotal(key);
}

function buildLivePool(contentKind: PracticeContentKind): PracticeItem[] {
	if (contentKind === 'classic') {
		return dedupeItems(
			EnglishPackStore.classicItems.map((row) =>
				toPracticeClassicItem({
					english: row.english,
					translationZh: row.translationZh,
					source: row.source,
					noteZh: row.noteZh,
				}),
			),
		);
	}
	return dedupeItems(
		EnglishPackStore.vocabItems.map((row) =>
			toPracticeVocabItem(row.word, {
				ipa: row.ipa,
				pos: row.pos,
				segmentation: row.segmentation,
				translationZh: row.translationZh,
				example: row.example,
			}),
		),
	);
}

async function fetchInitialFromPaginated(
	fetchPage: (offset: number, limit: number) => Promise<PracticePaginatedPage>,
	total: number,
	count: number,
	order: PracticeOrder,
): Promise<PracticeSessionFetchResult> {
	const pageSize = sessionPageSize(count, total);
	const pageCount = getPageCount(total, pageSize);
	const pageIndices =
		order === 'random'
			? buildRandomPageTryOrder(total, pageSize)
			: buildSequentialPageTryOrder(pageCount);
	const result = await collectSessionFromPaginatedPages(
		fetchPage,
		total,
		pageSize,
		pageIndices,
		order,
		emptyCursor(),
		new Set(),
	);
	return result ?? { items: [], cursor: emptyCursor() };
}

async function fetchContinueFromPaginated(
	fetchPage: (offset: number, limit: number) => Promise<PracticePaginatedPage>,
	total: number,
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor,
	excludeKeys: readonly string[],
): Promise<PracticeSessionFetchResult> {
	const pageSize = sessionPageSize(count, total);
	const pageCount = getPageCount(total, pageSize);
	const exclude = new Set(excludeKeys);

	const pageIndices =
		order === 'sequential'
			? Array.from(
					{ length: Math.max(0, pageCount - cursor.nextSequentialPageIndex) },
					(_, i) => cursor.nextSequentialPageIndex + i,
				)
			: buildContinueRandomPageTryOrder(total, pageSize, cursor);

	const result = await collectSessionFromPaginatedPages(
		fetchPage,
		total,
		pageSize,
		pageIndices,
		order,
		cursor,
		exclude,
	);
	return result ?? { items: [], cursor };
}

function emptyCursor(): PracticeSessionCursor {
	return { nextSequentialPageIndex: 0, usedRandomPageIndices: [] };
}

async function fetchFavorites(
	ctx: PracticeFetchContext,
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor | null,
	excludeKeys: readonly string[],
	poolTotal?: number,
): Promise<PracticeSessionFetchResult> {
	const total = resolvePoolTotal(ctx, poolTotal);
	if (total == null) return { items: [], cursor: emptyCursor() };

	const fetchPage = async (offset: number, limit: number) => {
		if (ctx.contentKind === 'classic') {
			const res = await listEnglishClassicQuoteFavorites({
				limit,
				offset,
				silent: true,
			});
			return { items: (res.data?.items ?? []).map(classicFavoriteToItem) };
		}
		const res = await listEnglishVocabularyFavorites({
			limit,
			offset,
			silent: true,
		});
		return { items: (res.data?.items ?? []).map(vocabFavoriteToItem) };
	};

	if (cursor) {
		return fetchContinueFromPaginated(
			fetchPage,
			total,
			count,
			order,
			cursor,
			excludeKeys,
		);
	}
	return fetchInitialFromPaginated(fetchPage, total, count, order);
}

async function fetchDailyMemorize(
	ctx: PracticeFetchContext,
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor | null,
	excludeKeys: readonly string[],
	poolTotal?: number,
): Promise<PracticeSessionFetchResult> {
	if (ctx.contentKind === 'classic') {
		return { items: [], cursor: emptyCursor() };
	}
	const total = resolvePoolTotal(ctx, poolTotal);
	if (total == null) return { items: [], cursor: emptyCursor() };

	const fetchPage = async (offset: number, limit: number) => {
		const res = await listEnglishDailyMemorizeRecords({
			limit,
			offset,
			silent: true,
		});
		return {
			items: (res.data?.items ?? []).map(vocabDailyMemorizeToItem),
		};
	};

	if (cursor) {
		return fetchContinueFromPaginated(
			fetchPage,
			total,
			count,
			order,
			cursor,
			excludeKeys,
		);
	}
	return fetchInitialFromPaginated(fetchPage, total, count, order);
}

async function fetchMistakes(
	ctx: PracticeFetchContext,
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor | null,
	excludeKeys: readonly string[],
	poolTotal?: number,
): Promise<PracticeSessionFetchResult> {
	const total = resolvePoolTotal(ctx, poolTotal);
	if (total == null) return { items: [], cursor: emptyCursor() };

	const fetchPage = async (offset: number, limit: number) => {
		if (ctx.contentKind === 'classic') {
			const res = await listEnglishClassicQuoteMistakes({
				limit,
				offset,
				silent: true,
			});
			return { items: (res.data?.items ?? []).map(classicMistakeToItem) };
		}
		const res = await listEnglishVocabularyMistakes({
			limit,
			offset,
			silent: true,
		});
		return { items: (res.data?.items ?? []).map(vocabMistakeToItem) };
	};

	if (cursor) {
		return fetchContinueFromPaginated(
			fetchPage,
			total,
			count,
			order,
			cursor,
			excludeKeys,
		);
	}
	return fetchInitialFromPaginated(fetchPage, total, count, order);
}

async function fetchLibrary(
	ctx: PracticeFetchContext,
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor | null,
	excludeKeys: readonly string[],
	poolTotal?: number,
): Promise<PracticeSessionFetchResult> {
	const libraryId = ctx.libraryId?.trim();
	if (!libraryId) return { items: [], cursor: emptyCursor() };

	const total = resolvePoolTotal(ctx, poolTotal);
	if (total == null) return { items: [], cursor: emptyCursor() };

	const fetchPage = async (offset: number, limit: number) => {
		if (ctx.contentKind === 'classic') {
			const res = await listEnglishClassicQuotesLibraryItems(libraryId, {
				limit,
				offset,
				silent: true,
			});
			return { items: (res.data?.items ?? []).map(classicLibraryRowToItem) };
		}
		const res = await listEnglishVocabularyLibraryItems(libraryId, {
			limit,
			offset,
			silent: true,
		});
		return { items: (res.data?.items ?? []).map(vocabLibraryRowToItem) };
	};

	if (cursor) {
		return fetchContinueFromPaginated(
			fetchPage,
			total,
			count,
			order,
			cursor,
			excludeKeys,
		);
	}
	return fetchInitialFromPaginated(fetchPage, total, count, order);
}

async function fetchPack(
	ctx: PracticeFetchContext,
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor | null,
	excludeKeys: readonly string[],
	poolTotal?: number,
): Promise<PracticeSessionFetchResult> {
	const streamId = ctx.streamId?.trim();
	if (!streamId) return { items: [], cursor: emptyCursor() };

	const total = resolvePoolTotal(ctx, poolTotal);
	if (total == null) return { items: [], cursor: emptyCursor() };

	const fetchPage = async (offset: number, limit: number) => {
		if (ctx.contentKind === 'classic') {
			const res = await listEnglishClassicQuotesPackItems(streamId, {
				limit,
				offset,
			});
			const items = (res.data?.items ?? []).map((row) =>
				toPracticeClassicItem({
					english: row.english,
					translationZh: row.translationZh,
					source: row.source,
					noteZh: row.noteZh,
				}),
			);
			return { items };
		}
		const res = await listEnglishVocabularyPackItems(streamId, {
			limit,
			offset,
		});
		const items = (res.data?.items ?? []).map((row) =>
			toPracticeVocabItem(row.word, {
				ipa: row.ipa,
				pos: row.pos,
				segmentation: row.segmentation,
				translationZh: row.translationZh,
				example: row.example,
			}),
		);
		return { items };
	};

	if (cursor) {
		return fetchContinueFromPaginated(
			fetchPage,
			total,
			count,
			order,
			cursor,
			excludeKeys,
		);
	}
	return fetchInitialFromPaginated(fetchPage, total, count, order);
}

async function fetchReview(
	contentKind: PracticeContentKind,
	count: number,
	excludeKeys: readonly string[],
): Promise<PracticeSessionFetchResult> {
	const res = await getEnglishPracticeReviewQueue({
		contentKind,
		count: Math.min(count, PRACTICE_MAX_WORDS),
		excludeKeys: [...excludeKeys],
	});
	const raw = res.data?.items ?? [];
	const items = dedupeItems(
		raw.map((row) =>
			row.contentKind === 'classic'
				? toPracticeClassicItem({
						english: row.english,
						translationZh: row.translationZh,
						source: row.source,
						noteZh: row.noteZh,
					})
				: toPracticeVocabItem(row.word, {
						ipa: row.ipa,
						pos: row.pos,
						segmentation: row.segmentation,
						translationZh: row.translationZh,
						example: row.example,
					}),
		),
	);
	return { items, cursor: emptyCursor() };
}

async function fetchLive(
	contentKind: PracticeContentKind,
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor | null,
	excludeKeys: readonly string[],
): Promise<PracticeSessionFetchResult> {
	const pool = buildLivePool(contentKind);
	if (pool.length === 0) return { items: [], cursor: emptyCursor() };

	const fetchPage = async (offset: number, limit: number) => ({
		items: pool.slice(offset, offset + limit),
	});

	if (cursor) {
		return fetchContinueFromPaginated(
			fetchPage,
			pool.length,
			count,
			order,
			cursor,
			excludeKeys,
		);
	}
	return fetchInitialFromPaginated(fetchPage, pool.length, count, order);
}

function runSessionFetch(
	params: PracticeSessionParams,
): Promise<PracticeSessionFetchResult> {
	const count = Math.min(params.count, PRACTICE_MAX_WORDS);
	const ctx: PracticeFetchContext = {
		contentKind: params.contentKind,
		source: params.source,
		libraryId: params.libraryId,
		streamId: params.streamId,
	};
	const cursor = params.cursor ?? null;
	const excludeKeys = params.excludeKeys ?? [];

	switch (params.source) {
		case 'favorites':
			return fetchFavorites(
				ctx,
				count,
				params.order,
				cursor,
				excludeKeys,
				params.poolTotal,
			);
		case 'mistakes':
			return fetchMistakes(
				ctx,
				count,
				params.order,
				cursor,
				excludeKeys,
				params.poolTotal,
			);
		case 'dailyMemorize':
			return fetchDailyMemorize(
				ctx,
				count,
				params.order,
				cursor,
				excludeKeys,
				params.poolTotal,
			);
		case 'library':
			return fetchLibrary(
				ctx,
				count,
				params.order,
				cursor,
				excludeKeys,
				params.poolTotal,
			);
		case 'pack':
			return fetchPack(
				ctx,
				count,
				params.order,
				cursor,
				excludeKeys,
				params.poolTotal,
			);
		case 'live':
			return fetchLive(
				params.contentKind,
				count,
				params.order,
				cursor,
				excludeKeys,
			);
		case 'review':
			return fetchReview(params.contentKind, count, excludeKeys);
		default:
			return Promise.resolve({ items: [], cursor: emptyCursor() });
	}
}

/** 首次开始练习 */
export async function fetchPracticeSessionQueue(
	params: Omit<PracticeSessionParams, 'cursor' | 'excludeKeys'>,
): Promise<PracticeSessionFetchResult> {
	return runSessionFetch(params);
}

/** 结算页「继续练习」：沿用配置，顺序下一页 / 随机新页，排除已练单词 */
export async function fetchPracticeContinueQueue(
	params: Omit<PracticeSessionParams, 'cursor' | 'excludeKeys'> & {
		cursor: PracticeSessionCursor;
		excludeKeys: readonly string[];
	},
): Promise<PracticeSessionFetchResult> {
	return runSessionFetch({
		...params,
		cursor: params.cursor,
		excludeKeys: params.excludeKeys,
	});
}

/** @deprecated 使用 fetchPracticeSessionQueue */
export async function fetchPracticeWordPool(params: {
	contentKind?: PracticeContentKind;
	source: PracticeSource;
	maxWords: number;
	libraryId?: string;
	streamId?: string;
	order?: PracticeOrder;
}): Promise<PracticeItem[]> {
	const { items } = await fetchPracticeSessionQueue({
		contentKind: params.contentKind ?? 'vocab',
		source: params.source,
		count: params.maxWords,
		order: params.order ?? 'sequential',
		libraryId: params.libraryId,
		streamId: params.streamId,
	});
	return items;
}
