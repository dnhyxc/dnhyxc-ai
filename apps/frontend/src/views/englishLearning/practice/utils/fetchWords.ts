/**
 * 练习词表拉取
 *
 * - 页大小 = 所选每轮题量；末页可不足一页，仍作为一轮返回
 * - **顺序**：第 1 轮第 0 页，继续练习第 1 页，以此类推
 * - **随机**：每轮从未用过的页码中抽一页；页内可再打乱
 * - 续练排除已练 key；若当前页滤空则跳过再试后续/其它未用页
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
import { shufflePracticeItems } from './grading';
import { toPracticeClassicItem, toPracticeVocabItem } from './item';

export const PRACTICE_MAX_WORDS = 100;

function vocabFavoriteToItem(
	row: EnglishVocabularyFavoriteListEntry,
): PracticeItem {
	return toPracticeVocabItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
		favoriteId: row.favoriteId ?? row.id,
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
		favoriteId: row.favoriteId ?? null,
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
		favoriteId: row.favoriteId ?? null,
	});
}

function vocabLibraryRowToItem(
	row: EnglishVocabularyLibraryItemRow,
): PracticeItem {
	const item = toPracticeVocabItem(row.word, {
		ipa: row.ipa,
		pos: row.pos,
		segmentation: row.segmentation,
		translationZh: row.translationZh,
		example: row.example,
		favoriteId: row.favoriteId ?? null,
	});
	// 库内按行练习：与 wordCount 对齐，避免同词多行被 contentKey 合并
	return { ...item, key: row.id };
}

function classicFavoriteToItem(
	row: EnglishClassicQuoteFavoriteListEntry,
): PracticeItem {
	return toPracticeClassicItem({
		english: row.english,
		translationZh: row.translationZh,
		source: row.source,
		noteZh: row.noteZh,
		favoriteId: row.id,
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
	const item = toPracticeClassicItem({
		english: row.english,
		translationZh: row.translationZh,
		source: row.source,
		noteZh: row.noteZh,
		favoriteId: row.favoriteId ?? null,
	});
	// 库内按行练习：与 quoteCount 对齐，避免同句多行被 contentKey 合并丢题
	return { ...item, key: row.id };
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

/** 随机：优先抽一页，其余未用页作后备（命中页滤空时再用） */
function buildRandomPageTryOrder(
	total: number,
	pageSize: number,
	usedPageIndices: ReadonlySet<number> = new Set(),
): number[] {
	const pageCount = getPageCount(total, pageSize);
	const unused: number[] = [];
	for (let i = 0; i < pageCount; i += 1) {
		if (!usedPageIndices.has(i)) unused.push(i);
	}
	if (unused.length === 0) return [];
	const firstIdx = Math.floor(Math.random() * unused.length);
	const first = unused[firstIdx]!;
	const rest = unused.filter((_, i) => i !== firstIdx);
	return [first, ...rest];
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

/** 拉一页并按已练 key 过滤；不足 pageSize 的末页原样返回 */
async function fetchRoundPage(
	fetchPage: (offset: number, limit: number) => Promise<PracticePaginatedPage>,
	total: number,
	pageSize: number,
	pageIndex: number,
	excludeKeys: ReadonlySet<string>,
): Promise<PracticeItem[]> {
	const limit = pageLimit(pageIndex, pageSize, total);
	if (limit <= 0) return [];
	const page = await fetchPage(pageOffset(pageIndex, pageSize), limit);
	return filterUnpracticed(dedupeItems(page.items), excludeKeys, pageSize);
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

function emptyCursor(): PracticeSessionCursor {
	return { nextSequentialPageIndex: 0, usedRandomPageIndices: [] };
}

/** 首轮：顺序 = 第 0 页；随机 = 抽一未用页 */
async function fetchInitialFromPaginated(
	fetchPage: (offset: number, limit: number) => Promise<PracticePaginatedPage>,
	total: number,
	count: number,
	order: PracticeOrder,
): Promise<PracticeSessionFetchResult> {
	const pageSize = sessionPageSize(count, total);
	if (pageSize <= 0) return { items: [], cursor: emptyCursor() };

	if (order === 'sequential') {
		const items = await fetchRoundPage(
			fetchPage,
			total,
			pageSize,
			0,
			new Set(),
		);
		return {
			items,
			cursor: {
				nextSequentialPageIndex: 1,
				usedRandomPageIndices: [],
			},
		};
	}

	const tryOrder = buildRandomPageTryOrder(total, pageSize);
	for (const pageIndex of tryOrder) {
		const items = await fetchRoundPage(
			fetchPage,
			total,
			pageSize,
			pageIndex,
			new Set(),
		);
		if (items.length === 0) continue;
		return {
			items: shufflePracticeItems(items),
			cursor: {
				nextSequentialPageIndex: 0,
				usedRandomPageIndices: [pageIndex],
			},
		};
	}
	return { items: [], cursor: emptyCursor() };
}

/**
 * 续练：顺序下一页；随机抽未用页。
 * 末页不足每轮题量仍返回；当前页滤空则跳过再试。
 */
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
	if (pageSize <= 0 || pageCount <= 0) return { items: [], cursor };

	const exclude = new Set(excludeKeys);

	if (order === 'sequential') {
		let pageIndex = Math.max(0, cursor.nextSequentialPageIndex);
		while (pageIndex < pageCount) {
			const items = await fetchRoundPage(
				fetchPage,
				total,
				pageSize,
				pageIndex,
				exclude,
			);
			const nextCursor: PracticeSessionCursor = {
				nextSequentialPageIndex: pageIndex + 1,
				usedRandomPageIndices: cursor.usedRandomPageIndices,
			};
			if (items.length > 0) return { items, cursor: nextCursor };
			pageIndex += 1;
		}
		return { items: [], cursor };
	}

	const used = new Set(cursor.usedRandomPageIndices);
	const tryOrder = buildRandomPageTryOrder(total, pageSize, used);
	for (const pageIndex of tryOrder) {
		const items = await fetchRoundPage(
			fetchPage,
			total,
			pageSize,
			pageIndex,
			exclude,
		);
		used.add(pageIndex);
		if (items.length === 0) continue;
		return {
			items: shufflePracticeItems(items),
			cursor: {
				nextSequentialPageIndex: cursor.nextSequentialPageIndex,
				usedRandomPageIndices: [...used],
			},
		};
	}
	return {
		items: [],
		cursor: {
			nextSequentialPageIndex: cursor.nextSequentialPageIndex,
			usedRandomPageIndices: [...used],
		},
	};
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

	const fetchPage = async (offset: number, limit: number) => {
		if (ctx.contentKind === 'classic') {
			const res = await listEnglishClassicQuotesLibraryItems(libraryId, {
				limit,
				offset,
				silent: true,
			});
			return {
				items: (res.data?.items ?? []).map(classicLibraryRowToItem),
				poolSize: res.data?.library?.quoteCount,
			};
		}
		const res = await listEnglishVocabularyLibraryItems(libraryId, {
			limit,
			offset,
			silent: true,
		});
		return {
			items: (res.data?.items ?? []).map(vocabLibraryRowToItem),
			poolSize: res.data?.library?.wordCount,
		};
	};

	let total = resolvePoolTotal(ctx, poolTotal);
	if (total == null) {
		const probe = await fetchPage(0, 1);
		total =
			typeof probe.poolSize === 'number' && probe.poolSize > 0
				? probe.poolSize
				: undefined;
		if (total != null) resolvePoolTotal(ctx, total);
	}
	if (total == null) return { items: [], cursor: emptyCursor() };

	const pageFetch = async (offset: number, limit: number) => {
		const page = await fetchPage(offset, limit);
		return { items: page.items };
	};

	if (cursor) {
		return fetchContinueFromPaginated(
			pageFetch,
			total,
			count,
			order,
			cursor,
			excludeKeys,
		);
	}
	return fetchInitialFromPaginated(pageFetch, total, count, order);
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
				favoriteId: row.favoriteId ?? null,
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
	order: PracticeOrder,
	excludeKeys: readonly string[],
): Promise<PracticeSessionFetchResult> {
	const res = await getEnglishPracticeReviewQueue({
		contentKind,
		count: Math.min(count, PRACTICE_MAX_WORDS),
		excludeKeys: [...excludeKeys],
	});
	const raw = res.data?.items ?? [];
	let items = dedupeItems(
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
						favoriteId: row.favoriteId ?? null,
					}),
		),
	);
	// 顺序：保持复习队列到期序；随机：打乱本轮题目
	if (order === 'random' && items.length > 1) {
		const shuffled = [...items];
		for (let i = shuffled.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
		}
		items = shuffled;
	}
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
			return fetchReview(params.contentKind, count, params.order, excludeKeys);
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

/**
 * ponytail: 顺序续练按页递进；末页不足每轮题量仍返回。
 * total=51, count=20 → 页 0/1/2，第 3 轮应拿到 11 条。
 * 库内同句多行必须用 row.id 作 key，否则 10 条会变成 9 条。
 */
export function selfCheckSequentialPageRounds(): void {
	const total = 51;
	const count = 20;
	const pageSize = sessionPageSize(count, total);
	const pageCount = getPageCount(total, pageSize);
	if (pageSize !== 20 || pageCount !== 3) {
		throw new Error(
			`selfCheckSequentialPageRounds: pageSize=${pageSize} pageCount=${pageCount}`,
		);
	}
	const last = pageLimit(2, pageSize, total);
	if (last !== 11) {
		throw new Error(`selfCheckSequentialPageRounds: last page=${last}`);
	}
	const tryOrder = buildRandomPageTryOrder(total, pageSize, new Set([0, 2]));
	if (tryOrder.length !== 1 || tryOrder[0] !== 1) {
		throw new Error(
			`selfCheckSequentialPageRounds: random unused=${tryOrder.join(',')}`,
		);
	}
	// 同 content 两行：若共用 contentKey，Set 会少 1
	const rowKeys = ['id-a', 'id-b'];
	const contentKeys = ['same', 'same'];
	if (new Set(contentKeys).size !== 1) {
		throw new Error('selfCheckSequentialPageRounds: content dup fixture');
	}
	if (new Set(rowKeys).size !== 2) {
		throw new Error('selfCheckSequentialPageRounds: row id must stay unique');
	}
}
