/**
 * 按列表增量查询单词收藏状态。
 * - 列表已内嵌 favoriteId（资源库 / 记词记录等）：直接从 items 同步，不打 status 接口
 * - 资源库无内嵌时：回退 GET favorites-status
 * - 其他场景：POST .../vocabulary-favorites/status（按词批量）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	type EnglishVocabFavoriteRef,
	fetchEnglishVocabularyFavoriteStatus,
	listEnglishVocabularyLibraryFavoriteStatus,
	normalizeEnglishVocabWordKey,
} from '@/service';
import {
	buildLibraryRangeChunks,
	mapWithConcurrency,
} from '@/views/englishLearning/utils/libraryWordsListPrefetch';

const WORD_SIG_SEP = '\u0001';
const STATUS_QUERY_DEBOUNCE_MS = 150;
const LIBRARY_STATUS_CONCURRENCY = 3;

/** 会话内已查过的收藏状态，避免列表重挂载 / 缓存恢复时重复打 status */
const sessionQueriedWordKeys = new Set<string>();
const sessionFavoriteIdByWordKey = new Map<string, string>();
/** 资源库：已同步收藏状态的 items 末尾（不含） */
const sessionLibraryStatusEnd = new Map<string, number>();

export type UseIncrementalVocabFavoriteStatusOptions = {
	libraryId?: string | null;
};

type VocabFavoriteListItem = { word: string; favoriteId?: string | null };

function itemsEmbedFavoriteId(
	items: ReadonlyArray<VocabFavoriteListItem>,
): boolean {
	return items.some((it) => 'favoriteId' in it);
}

function seedFavoriteStateFromSession(items: ReadonlyArray<{ word: string }>) {
	const map = new Map<string, string>();
	const queried = new Set<string>();
	for (const item of items) {
		const wk = normalizeEnglishVocabWordKey(item.word);
		if (!wk) continue;
		if (sessionQueriedWordKeys.has(wk)) {
			queried.add(wk);
			const id = sessionFavoriteIdByWordKey.get(wk);
			if (id) map.set(wk, id);
		}
	}
	return { map, queried };
}

function markWordsFromItemsQueried(items: ReadonlyArray<{ word: string }>) {
	for (const item of items) {
		const wk = normalizeEnglishVocabWordKey(item.word);
		if (wk) sessionQueriedWordKeys.add(wk);
	}
}

export function useIncrementalVocabFavoriteStatus(
	items: ReadonlyArray<VocabFavoriteListItem>,
	options?: UseIncrementalVocabFavoriteStatusOptions,
) {
	const libraryId = options?.libraryId ?? null;
	const [favoriteIdByWordKey, setFavoriteIdByWordKey] = useState<
		Map<string, string>
	>(() => new Map());
	const queriedKeysRef = useRef<Set<string>>(new Set());
	const prevItemsWordSigRef = useRef('');
	const libraryStatusEndRef = useRef(0);
	const libraryIdRef = useRef<string | null>(null);

	const favoritedWordKeys = useMemo(
		() => new Set(favoriteIdByWordKey.keys()),
		[favoriteIdByWordKey],
	);

	const itemsWordSig = useMemo(
		() => items.map((it) => it.word).join(WORD_SIG_SEP),
		[items],
	);

	useEffect(() => {
		if (libraryIdRef.current !== libraryId) {
			libraryIdRef.current = libraryId;
			libraryStatusEndRef.current = libraryId
				? (sessionLibraryStatusEnd.get(libraryId) ?? 0)
				: 0;
		}

		if (items.length === 0) {
			setFavoriteIdByWordKey(new Map());
			queriedKeysRef.current = new Set();
			prevItemsWordSigRef.current = '';
			if (libraryId) {
				libraryStatusEndRef.current =
					sessionLibraryStatusEnd.get(libraryId) ?? 0;
			}
			return;
		}

		const prevSig = prevItemsWordSigRef.current;
		const appended =
			prevSig.length > 0 &&
			(itemsWordSig === prevSig ||
				itemsWordSig.startsWith(`${prevSig}${WORD_SIG_SEP}`));
		const prepended =
			prevSig.length > 0 &&
			(itemsWordSig === prevSig ||
				itemsWordSig.endsWith(`${WORD_SIG_SEP}${prevSig}`));
		if (!appended && !prepended) {
			const seeded = seedFavoriteStateFromSession(items);
			setFavoriteIdByWordKey(seeded.map);
			queriedKeysRef.current = seeded.queried;
			if (libraryId) {
				libraryStatusEndRef.current = Math.min(
					sessionLibraryStatusEnd.get(libraryId) ?? 0,
					items.length,
				);
			}
		}
		prevItemsWordSigRef.current = itemsWordSig;

		let cancelled = false;
		const timer = window.setTimeout(() => {
			const mergeFavoritedRefs = (refs: EnglishVocabFavoriteRef[]) => {
				if (cancelled || refs.length === 0) return;
				setFavoriteIdByWordKey((prev) => {
					const next = new Map(prev);
					for (const r of refs) {
						next.set(r.wordKey, r.id);
						sessionFavoriteIdByWordKey.set(r.wordKey, r.id);
						sessionQueriedWordKeys.add(r.wordKey);
					}
					return next;
				});
			};

			if (libraryId && itemsEmbedFavoriteId(items)) {
				const syncFrom =
					appended && libraryStatusEndRef.current > 0
						? libraryStatusEndRef.current
						: 0;
				const slice = items.slice(syncFrom);
				if (slice.length === 0) return;

				setFavoriteIdByWordKey((prev) => {
					const next = new Map(prev);
					for (const item of slice) {
						const wk = normalizeEnglishVocabWordKey(item.word);
						if (!wk || !('favoriteId' in item)) continue;
						sessionQueriedWordKeys.add(wk);
						if (item.favoriteId) {
							next.set(wk, item.favoriteId);
							sessionFavoriteIdByWordKey.set(wk, item.favoriteId);
						} else {
							next.delete(wk);
							sessionFavoriteIdByWordKey.delete(wk);
						}
					}
					return next;
				});
				if (cancelled) return;
				libraryStatusEndRef.current = items.length;
				sessionLibraryStatusEnd.set(libraryId, items.length);
				return;
			}

			if (libraryId) {
				const statusEnd = libraryStatusEndRef.current;
				const fetchFrom = statusEnd;
				const fetchTo = items.length;
				const chunks = buildLibraryRangeChunks(fetchFrom, fetchTo);
				if (chunks.length === 0) {
					markWordsFromItemsQueried(items);
					return;
				}

				void (async () => {
					try {
						await mapWithConcurrency(
							chunks,
							LIBRARY_STATUS_CONCURRENCY,
							async (chunk) => {
								const res = await listEnglishVocabularyLibraryFavoriteStatus(
									libraryId,
									{
										limit: chunk.limit,
										offset: chunk.offset,
										silent: true,
									},
								);
								const refs = Array.isArray(res.data?.favorited)
									? res.data.favorited
									: [];
								mergeFavoritedRefs(refs);
								return refs;
							},
						);
						if (cancelled) return;
						libraryStatusEndRef.current = fetchTo;
						sessionLibraryStatusEnd.set(libraryId, fetchTo);
						markWordsFromItemsQueried(items.slice(fetchFrom, fetchTo));
					} catch {
						if (!cancelled) {
							libraryStatusEndRef.current = fetchFrom;
						}
					}
				})();
				return;
			}

			const wordsToQuery: string[] = [];
			for (const item of items) {
				const wk = normalizeEnglishVocabWordKey(item.word);
				if (!wk || queriedKeysRef.current.has(wk)) continue;
				queriedKeysRef.current.add(wk);
				sessionQueriedWordKeys.add(wk);
				wordsToQuery.push(item.word);
			}
			if (wordsToQuery.length === 0) return;

			void (async () => {
				try {
					await fetchEnglishVocabularyFavoriteStatus(wordsToQuery, {
						onPartial: mergeFavoritedRefs,
					});
					if (cancelled) return;
				} catch {
					if (!cancelled) {
						for (const word of wordsToQuery) {
							const wk = normalizeEnglishVocabWordKey(word);
							if (wk) {
								queriedKeysRef.current.delete(wk);
								sessionQueriedWordKeys.delete(wk);
							}
						}
					}
				}
			})();
		}, STATUS_QUERY_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [itemsWordSig, items, libraryId]);

	const getVocabularyFavoriteId = (wordKey: string) =>
		favoriteIdByWordKey.get(wordKey);

	const setVocabularyFavoriteId = (wordKey: string, id: string) => {
		sessionQueriedWordKeys.add(wordKey);
		sessionFavoriteIdByWordKey.set(wordKey, id);
		setFavoriteIdByWordKey((prev) => {
			const next = new Map(prev);
			next.set(wordKey, id);
			return next;
		});
	};

	const clearVocabularyFavorite = (wordKey: string) => {
		sessionFavoriteIdByWordKey.delete(wordKey);
		setFavoriteIdByWordKey((prev) => {
			if (!prev.has(wordKey)) return prev;
			const next = new Map(prev);
			next.delete(wordKey);
			return next;
		});
	};

	return {
		favoritedWordKeys,
		getVocabularyFavoriteId,
		setVocabularyFavoriteId,
		clearVocabularyFavorite,
	};
}
