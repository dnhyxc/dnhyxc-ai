/**
 * 练习词表拉取
 *
 * - **随机**：按 store 总数与题量划分页码（offset = 页码 × 题量），单次拉取 limit=题量。
 * - **顺序**：从 offset=0 起，每页步长等于题量。
 * - **继续练习**：顺序拉下一页；随机拉未使用过的页码；均排除已练 wordKey。
 */
import {
	type EnglishVocabularyFavoriteListEntry,
	type EnglishVocabularyItem,
	type EnglishVocabularyLibraryItemRow,
	type EnglishVocabularyMistakeListEntry,
	listEnglishVocabularyFavorites,
	listEnglishVocabularyLibraryItems,
	listEnglishVocabularyMistakes,
	listEnglishVocabularyPackItems,
	normalizeEnglishVocabWordKey,
} from '@/service';
import EnglishPackStore from '@/store/englishPack';
import {
	getEnglishPracticePoolTotal,
	resolveEnglishPracticePoolKey,
	setEnglishPracticePoolTotal,
} from '@/store/englishPracticePool';
import type {
	PracticeFetchContext,
	PracticeItem,
	PracticeOrder,
	PracticePaginatedPage,
	PracticeSessionCursor,
	PracticeSessionFetchResult,
	PracticeSessionParams,
	PracticeSource,
} from '../types';

export const PRACTICE_MAX_WORDS = 50;

function toPracticeItem(
	word: string,
	fields: Omit<EnglishVocabularyItem, 'word'>,
): PracticeItem {
	const key = normalizeEnglishVocabWordKey(word);
	return { word, ...fields, key };
}

function favoriteToItem(row: EnglishVocabularyFavoriteListEntry): PracticeItem {
	return toPracticeItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
	});
}

function mistakeToItem(row: EnglishVocabularyMistakeListEntry): PracticeItem {
	return toPracticeItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
	});
}

function libraryRowToItem(row: EnglishVocabularyLibraryItemRow): PracticeItem {
	return toPracticeItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
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

function cursorAfterPage(
	order: PracticeOrder,
	pageIndex: number,
	prev: PracticeSessionCursor,
): PracticeSessionCursor {
	if (order === 'sequential') {
		return {
			nextSequentialPageIndex: pageIndex + 1,
			usedRandomPageIndices: prev.usedRandomPageIndices,
		};
	}
	const used = new Set(prev.usedRandomPageIndices);
	used.add(pageIndex);
	return {
		nextSequentialPageIndex: prev.nextSequentialPageIndex,
		usedRandomPageIndices: [...used],
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
		const n = EnglishPackStore.vocabItems.length;
		return n > 0 ? n : undefined;
	}
	const key = resolveEnglishPracticePoolKey(ctx);
	if (!key) return undefined;
	return getEnglishPracticePoolTotal(key);
}

function buildLivePool(): PracticeItem[] {
	return dedupeItems(
		EnglishPackStore.vocabItems.map((row) =>
			toPracticeItem(row.word, {
				ipa: row.ipa,
				pos: row.pos,
				segmentation: row.segmentation,
				translationZh: row.translationZh,
				example: row.example,
			}),
		),
	);
}

function fetchLivePageItems(
	pool: PracticeItem[],
	pageIndex: number,
	pageSize: number,
): PracticeItem[] {
	const start = pageOffset(pageIndex, pageSize);
	return pool.slice(start, start + pageLimit(pageIndex, pageSize, pool.length));
}

async function fetchInitialFromPaginated(
	fetchPage: (offset: number, limit: number) => Promise<PracticePaginatedPage>,
	total: number,
	count: number,
	order: PracticeOrder,
): Promise<PracticeSessionFetchResult> {
	const pageSize = sessionPageSize(count, total);
	const pageIndex =
		order === 'random' ? pickRandomPageIndex(total, pageSize) : 0;
	const page = await fetchPage(
		pageOffset(pageIndex, pageSize),
		pageLimit(pageIndex, pageSize, total),
	);
	const items = dedupeItems(page.items).slice(0, pageSize);
	return {
		items,
		cursor: cursorAfterPage(order, pageIndex, {
			nextSequentialPageIndex: 0,
			usedRandomPageIndices: [],
		}),
	};
}

async function fetchContinueFromPaginated(
	fetchPage: (offset: number, limit: number) => Promise<PracticePaginatedPage>,
	total: number,
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor,
	excludeKeys: readonly string[],
): Promise<PracticeSessionFetchResult> {
	const exclude = new Set(excludeKeys);
	const pageSize = sessionPageSize(count, total);
	const pageCount = getPageCount(total, pageSize);

	const collectFromPages = async (
		pageIndices: number[],
		orderForCursor: PracticeOrder,
	): Promise<PracticeSessionFetchResult | null> => {
		const acc: PracticeItem[] = [];
		let lastHitPage = -1;
		for (const pageIndex of pageIndices) {
			if (acc.length >= pageSize) break;
			const page = await fetchPage(
				pageOffset(pageIndex, pageSize),
				pageLimit(pageIndex, pageSize, total),
			);
			const chunk = filterUnpracticed(
				page.items,
				exclude,
				pageSize - acc.length,
			);
			if (chunk.length > 0) {
				lastHitPage = pageIndex;
				acc.push(...chunk);
			}
		}
		if (acc.length === 0 || lastHitPage < 0) return null;
		return {
			items: acc.slice(0, pageSize),
			cursor: cursorAfterPage(orderForCursor, lastHitPage, cursor),
		};
	};

	if (order === 'sequential') {
		const indices: number[] = [];
		for (let i = cursor.nextSequentialPageIndex; i < pageCount; i += 1) {
			indices.push(i);
		}
		const result = await collectFromPages(indices, 'sequential');
		return result ?? { items: [], cursor };
	}

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

	const result = await collectFromPages(tryOrder, 'random');
	return result ?? { items: [], cursor };
}

function fetchLiveInitial(
	count: number,
	order: PracticeOrder,
): PracticeSessionFetchResult {
	const pool = buildLivePool();
	if (pool.length === 0) return { items: [], cursor: emptyCursor() };

	const total = pool.length;
	const pageSize = sessionPageSize(count, total);
	const pageIndex =
		order === 'random' ? pickRandomPageIndex(total, pageSize) : 0;
	const items = fetchLivePageItems(pool, pageIndex, pageSize).slice(
		0,
		pageSize,
	);

	return {
		items,
		cursor: cursorAfterPage(order, pageIndex, emptyCursor()),
	};
}

function fetchLiveContinue(
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor,
	excludeKeys: readonly string[],
): PracticeSessionFetchResult {
	const pool = buildLivePool();
	if (pool.length === 0) return { items: [], cursor };

	const total = pool.length;
	const exclude = new Set(excludeKeys);
	const pageSize = sessionPageSize(count, total);
	const pageCount = getPageCount(total, pageSize);

	const collectFromLivePages = (
		pageIndices: number[],
		orderForCursor: PracticeOrder,
	): PracticeSessionFetchResult | null => {
		const acc: PracticeItem[] = [];
		let lastHitPage = -1;
		for (const pageIndex of pageIndices) {
			if (acc.length >= pageSize) break;
			const slice = fetchLivePageItems(pool, pageIndex, pageSize);
			const chunk = filterUnpracticed(slice, exclude, pageSize - acc.length);
			if (chunk.length > 0) {
				lastHitPage = pageIndex;
				acc.push(...chunk);
			}
		}
		if (acc.length === 0 || lastHitPage < 0) return null;
		return {
			items: acc.slice(0, pageSize),
			cursor: cursorAfterPage(orderForCursor, lastHitPage, cursor),
		};
	};

	if (order === 'sequential') {
		const indices: number[] = [];
		for (let i = cursor.nextSequentialPageIndex; i < pageCount; i += 1) {
			indices.push(i);
		}
		const result = collectFromLivePages(indices, 'sequential');
		return result ?? { items: [], cursor };
	}

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

	const result = collectFromLivePages(tryOrder, 'random');
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
		const res = await listEnglishVocabularyFavorites({
			limit,
			offset,
			silent: true,
		});
		return { items: (res.data?.items ?? []).map(favoriteToItem) };
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
		const res = await listEnglishVocabularyMistakes({
			limit,
			offset,
			silent: true,
		});
		return { items: (res.data?.items ?? []).map(mistakeToItem) };
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
		const res = await listEnglishVocabularyLibraryItems(libraryId, {
			limit,
			offset,
			silent: true,
		});
		return { items: (res.data?.items ?? []).map(libraryRowToItem) };
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
		const res = await listEnglishVocabularyPackItems(streamId, {
			limit,
			offset,
		});
		const items = (res.data?.items ?? []).map((row) =>
			toPracticeItem(row.word, {
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

function fetchLive(
	count: number,
	order: PracticeOrder,
	cursor: PracticeSessionCursor | null,
	excludeKeys: readonly string[],
): PracticeSessionFetchResult {
	if (cursor) {
		return fetchLiveContinue(count, order, cursor, excludeKeys);
	}
	return fetchLiveInitial(count, order);
}

function runSessionFetch(
	params: PracticeSessionParams,
): Promise<PracticeSessionFetchResult> {
	const count = Math.min(params.count, PRACTICE_MAX_WORDS);
	const ctx: PracticeFetchContext = {
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
			return Promise.resolve(
				fetchLive(count, params.order, cursor, excludeKeys),
			);
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
	source: PracticeSource;
	maxWords: number;
	libraryId?: string;
	streamId?: string;
	order?: PracticeOrder;
}): Promise<PracticeItem[]> {
	const { items } = await fetchPracticeSessionQueue({
		source: params.source,
		count: params.maxWords,
		order: params.order ?? 'sequential',
		libraryId: params.libraryId,
		streamId: params.streamId,
	});
	return items;
}
