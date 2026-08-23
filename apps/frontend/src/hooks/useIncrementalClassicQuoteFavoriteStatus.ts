/**
 * 按列表增量查询经典句收藏状态。
 * - 资源库：优先用 items 内嵌 favoriteId；否则回退 GET favorites-status
 * - 其他场景：POST .../classic-quotes-favorites/status
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	classicQuoteFavoriteContentKey,
	type EnglishClassicQuoteFavoriteRef,
	fetchEnglishClassicQuoteFavoriteStatus,
	listEnglishClassicQuotesLibraryFavoriteStatus,
} from '@/service';
import {
	buildLibraryRangeChunks,
	mapWithConcurrency,
} from '@/views/englishLearning/utils/libraryWordsListPrefetch';

const ENGLISH_SIG_SEP = '\u0001';
const STATUS_QUERY_DEBOUNCE_MS = 150;
const LIBRARY_STATUS_CONCURRENCY = 3;

const sessionLibraryClassicStatusEnd = new Map<string, number>();

export type UseIncrementalClassicQuoteFavoriteStatusOptions = {
	libraryId?: string | null;
};

type ClassicFavoriteListItem = { english: string; favoriteId?: string | null };

function itemsEmbedFavoriteId(
	items: ReadonlyArray<ClassicFavoriteListItem>,
): boolean {
	return items.some((it) => 'favoriteId' in it);
}

export function useIncrementalClassicQuoteFavoriteStatus(
	items: ReadonlyArray<ClassicFavoriteListItem>,
	options?: UseIncrementalClassicQuoteFavoriteStatusOptions,
) {
	const libraryId = options?.libraryId ?? null;
	const [favoriteIdByContentKey, setFavoriteIdByContentKey] = useState<
		Map<string, string>
	>(() => new Map());
	const queriedKeysRef = useRef<Set<string>>(new Set());
	const prevItemsEnglishSigRef = useRef('');
	const libraryStatusEndRef = useRef(0);
	const libraryIdRef = useRef<string | null>(null);

	const favoritedContentKeys = useMemo(
		() => new Set(favoriteIdByContentKey.keys()),
		[favoriteIdByContentKey],
	);

	const itemsEnglishSig = useMemo(
		() => items.map((it) => it.english).join(ENGLISH_SIG_SEP),
		[items],
	);

	useEffect(() => {
		if (libraryIdRef.current !== libraryId) {
			libraryIdRef.current = libraryId;
			libraryStatusEndRef.current = libraryId
				? (sessionLibraryClassicStatusEnd.get(libraryId) ?? 0)
				: 0;
		}

		if (items.length === 0) {
			setFavoriteIdByContentKey(new Map());
			queriedKeysRef.current = new Set();
			prevItemsEnglishSigRef.current = '';
			if (libraryId) {
				libraryStatusEndRef.current =
					sessionLibraryClassicStatusEnd.get(libraryId) ?? 0;
			}
			return;
		}

		const prevSig = prevItemsEnglishSigRef.current;
		const appended =
			prevSig.length > 0 &&
			(itemsEnglishSig === prevSig ||
				itemsEnglishSig.startsWith(`${prevSig}${ENGLISH_SIG_SEP}`));
		const prepended =
			prevSig.length > 0 &&
			(itemsEnglishSig === prevSig ||
				itemsEnglishSig.endsWith(`${ENGLISH_SIG_SEP}${prevSig}`));
		if (!appended && !prepended) {
			setFavoriteIdByContentKey(new Map());
			queriedKeysRef.current = new Set();
			if (libraryId) {
				libraryStatusEndRef.current = Math.min(
					sessionLibraryClassicStatusEnd.get(libraryId) ?? 0,
					items.length,
				);
			}
		}
		prevItemsEnglishSigRef.current = itemsEnglishSig;

		let cancelled = false;
		const timer = window.setTimeout(() => {
			const mergeFavoritedRefs = (refs: EnglishClassicQuoteFavoriteRef[]) => {
				if (cancelled || refs.length === 0) return;
				setFavoriteIdByContentKey((prev) => {
					const next = new Map(prev);
					for (const r of refs) next.set(r.contentKey, r.id);
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

				setFavoriteIdByContentKey((prev) => {
					const next = new Map(prev);
					for (const item of slice) {
						const ck = classicQuoteFavoriteContentKey(item.english);
						if (!ck || !('favoriteId' in item)) continue;
						if (item.favoriteId) next.set(ck, item.favoriteId);
						else next.delete(ck);
					}
					return next;
				});
				if (cancelled) return;
				libraryStatusEndRef.current = items.length;
				sessionLibraryClassicStatusEnd.set(libraryId, items.length);
				return;
			}

			if (libraryId) {
				const statusEnd = libraryStatusEndRef.current;
				const fetchFrom = statusEnd;
				const fetchTo = items.length;
				const chunks = buildLibraryRangeChunks(fetchFrom, fetchTo);
				if (chunks.length === 0) return;

				void (async () => {
					try {
						await mapWithConcurrency(
							chunks,
							LIBRARY_STATUS_CONCURRENCY,
							async (chunk) => {
								const res = await listEnglishClassicQuotesLibraryFavoriteStatus(
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
						sessionLibraryClassicStatusEnd.set(libraryId, fetchTo);
					} catch {
						if (!cancelled) {
							libraryStatusEndRef.current = fetchFrom;
						}
					}
				})();
				return;
			}

			const englishesToQuery: string[] = [];
			for (const item of items) {
				const ck = classicQuoteFavoriteContentKey(item.english);
				if (!ck || queriedKeysRef.current.has(ck)) continue;
				queriedKeysRef.current.add(ck);
				englishesToQuery.push(item.english);
			}
			if (englishesToQuery.length === 0) return;

			void (async () => {
				try {
					await fetchEnglishClassicQuoteFavoriteStatus(englishesToQuery, {
						onPartial: mergeFavoritedRefs,
					});
					if (cancelled) return;
				} catch {
					if (!cancelled) {
						for (const english of englishesToQuery) {
							const ck = classicQuoteFavoriteContentKey(english);
							if (ck) queriedKeysRef.current.delete(ck);
						}
					}
				}
			})();
		}, STATUS_QUERY_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [itemsEnglishSig, items, libraryId]);

	const getClassicQuoteFavoriteId = (contentKey: string) =>
		favoriteIdByContentKey.get(contentKey);

	const setClassicQuoteFavoriteId = (contentKey: string, id: string) => {
		setFavoriteIdByContentKey((prev) => {
			const next = new Map(prev);
			next.set(contentKey, id);
			return next;
		});
	};

	const clearClassicQuoteFavorite = (contentKey: string) => {
		setFavoriteIdByContentKey((prev) => {
			if (!prev.has(contentKey)) return prev;
			const next = new Map(prev);
			next.delete(contentKey);
			return next;
		});
	};

	return {
		favoritedContentKeys,
		getClassicQuoteFavoriteId,
		setClassicQuoteFavoriteId,
		clearClassicQuoteFavorite,
	};
}
