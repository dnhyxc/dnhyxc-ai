/**
 * 按列表增量查询经典句收藏状态。
 * - 资源库：优先用 items 内嵌 favoriteId；否则回退 GET favorites-status
 * - 其他场景：POST .../classic-quotes-favorites/status
 */
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import {
	classicQuoteFavoriteContentKey,
	type EnglishClassicQuoteFavoriteRef,
	fetchEnglishClassicQuoteFavoriteStatus,
	listEnglishClassicQuotesLibraryFavoriteStatus,
} from '@/service';
import { patchClassicFavoriteInListCaches } from '@/views/englishLearning/utils/libraryWordsListCache';
import {
	buildLibraryRangeChunks,
	mapWithConcurrency,
} from '@/views/englishLearning/utils/libraryWordsListPrefetch';

const ENGLISH_SIG_SEP = '\u0001';
const STATUS_QUERY_DEBOUNCE_MS = 150;
const LIBRARY_STATUS_CONCURRENCY = 3;

const sessionLibraryClassicStatusEnd = new Map<string, number>();
const sessionQueriedContentKeys = new Set<string>();
const sessionFavoriteIdByContentKey = new Map<string, string>();

const CLASSIC_FAVORITE_SESSION_EVENT =
	'english-classic-favorite-session-change';
let classicFavoriteSessionVersion = 0;

function subscribeClassicFavoriteSession(onStoreChange: () => void) {
	window.addEventListener(CLASSIC_FAVORITE_SESSION_EVENT, onStoreChange);
	return () =>
		window.removeEventListener(CLASSIC_FAVORITE_SESSION_EVENT, onStoreChange);
}

function getClassicFavoriteSessionVersion() {
	return classicFavoriteSessionVersion;
}

function bumpClassicFavoriteSession() {
	classicFavoriteSessionVersion += 1;
	window.dispatchEvent(new Event(CLASSIC_FAVORITE_SESSION_EVENT));
}

function readClassicQuoteFavorited(
	english: string,
	embeddedFavoriteId: string | null | undefined,
	favoriteIdByContentKey: Map<string, string>,
): boolean {
	const ck = classicQuoteFavoriteContentKey(english);
	if (!ck) return false;
	const sessionId = sessionFavoriteIdByContentKey.get(ck);
	if (sessionQueriedContentKeys.has(ck)) return Boolean(sessionId);
	if (favoriteIdByContentKey.has(ck)) return true;
	return Boolean(embeddedFavoriteId);
}

function seedClassicFavoriteStateFromSession(
	items: ReadonlyArray<{ english: string }>,
) {
	const map = new Map<string, string>();
	const queried = new Set<string>();
	for (const item of items) {
		const ck = classicQuoteFavoriteContentKey(item.english);
		if (!ck) continue;
		if (sessionQueriedContentKeys.has(ck)) {
			queried.add(ck);
			const id = sessionFavoriteIdByContentKey.get(ck);
			if (id) map.set(ck, id);
		}
	}
	return { map, queried };
}

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
	const sessionVersion = useSyncExternalStore(
		subscribeClassicFavoriteSession,
		getClassicFavoriteSessionVersion,
		getClassicFavoriteSessionVersion,
	);

	const favoritedContentKeys = useMemo(() => {
		void sessionVersion;
		const keys = new Set<string>();
		for (const item of items) {
			const ck = classicQuoteFavoriteContentKey(item.english);
			if (
				ck &&
				readClassicQuoteFavorited(
					item.english,
					'favoriteId' in item ? item.favoriteId : undefined,
					favoriteIdByContentKey,
				)
			) {
				keys.add(ck);
			}
		}
		for (const ck of favoriteIdByContentKey.keys()) {
			if (!sessionQueriedContentKeys.has(ck)) keys.add(ck);
		}
		return keys;
	}, [favoriteIdByContentKey, items, sessionVersion]);

	const isClassicQuoteFavorited = useCallback(
		(english: string, embeddedFavoriteId?: string | null) => {
			void sessionVersion;
			return readClassicQuoteFavorited(
				english,
				embeddedFavoriteId,
				favoriteIdByContentKey,
			);
		},
		[favoriteIdByContentKey, sessionVersion],
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
			const seeded = seedClassicFavoriteStateFromSession(items);
			setFavoriteIdByContentKey(seeded.map);
			queriedKeysRef.current = seeded.queried;
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
					for (const r of refs) {
						next.set(r.contentKey, r.id);
						sessionQueriedContentKeys.add(r.contentKey);
						sessionFavoriteIdByContentKey.set(r.contentKey, r.id);
					}
					return next;
				});
				bumpClassicFavoriteSession();
			};

			if (itemsEmbedFavoriteId(items)) {
				const syncFrom =
					libraryId && appended && libraryStatusEndRef.current > 0
						? libraryStatusEndRef.current
						: 0;
				const slice = items.slice(syncFrom);
				if (slice.length === 0) return;

				setFavoriteIdByContentKey((prev) => {
					const next = new Map(prev);
					for (const item of slice) {
						const ck = classicQuoteFavoriteContentKey(item.english);
						if (!ck || !('favoriteId' in item)) continue;
						if (sessionQueriedContentKeys.has(ck)) {
							const sessionId = sessionFavoriteIdByContentKey.get(ck);
							if (sessionId) next.set(ck, sessionId);
							else next.delete(ck);
							continue;
						}
						sessionQueriedContentKeys.add(ck);
						if (item.favoriteId) {
							next.set(ck, item.favoriteId);
							sessionFavoriteIdByContentKey.set(ck, item.favoriteId);
						} else {
							next.delete(ck);
							sessionFavoriteIdByContentKey.delete(ck);
						}
					}
					return next;
				});
				bumpClassicFavoriteSession();
				if (cancelled) return;
				if (libraryId) {
					libraryStatusEndRef.current = items.length;
					sessionLibraryClassicStatusEnd.set(libraryId, items.length);
				}
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
				// 与 vocab 一致：未收藏也记入会话，避免切题/重挂载重复打 status
				sessionQueriedContentKeys.add(ck);
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
							if (ck) {
								queriedKeysRef.current.delete(ck);
								sessionQueriedContentKeys.delete(ck);
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
	}, [itemsEnglishSig, items, libraryId]);

	const resolveClassicQuoteFavoriteId = useCallback(
		(english: string, embeddedFavoriteId?: string | null) => {
			void sessionVersion;
			const ck = classicQuoteFavoriteContentKey(english);
			if (!ck) return undefined;
			const sessionId = sessionFavoriteIdByContentKey.get(ck);
			if (sessionQueriedContentKeys.has(ck)) return sessionId;
			return favoriteIdByContentKey.get(ck) ?? embeddedFavoriteId ?? undefined;
		},
		[favoriteIdByContentKey, sessionVersion],
	);

	const getClassicQuoteFavoriteId = (contentKey: string) => {
		const sessionId = sessionFavoriteIdByContentKey.get(contentKey);
		if (sessionId) return sessionId;
		if (sessionQueriedContentKeys.has(contentKey)) return undefined;
		return favoriteIdByContentKey.get(contentKey);
	};

	const setClassicQuoteFavoriteId = (contentKey: string, id: string) => {
		sessionQueriedContentKeys.add(contentKey);
		sessionFavoriteIdByContentKey.set(contentKey, id);
		patchClassicFavoriteInListCaches(contentKey, id);
		bumpClassicFavoriteSession();
		setFavoriteIdByContentKey((prev) => {
			const next = new Map(prev);
			next.set(contentKey, id);
			return next;
		});
	};

	const clearClassicQuoteFavorite = (contentKey: string) => {
		sessionQueriedContentKeys.add(contentKey);
		sessionFavoriteIdByContentKey.delete(contentKey);
		patchClassicFavoriteInListCaches(contentKey, null);
		bumpClassicFavoriteSession();
		setFavoriteIdByContentKey((prev) => {
			const next = new Map(prev);
			next.delete(contentKey);
			return next;
		});
	};

	return {
		favoritedContentKeys,
		isClassicQuoteFavorited,
		resolveClassicQuoteFavoriteId,
		getClassicQuoteFavoriteId,
		setClassicQuoteFavoriteId,
		clearClassicQuoteFavorite,
	};
}

/**
 * 练习开局：整队一次写入会话收藏缓存（有内嵌 favoriteId 则不打接口，否则一批 status）。
 * Toggle 逐题挂载时即可命中会话，避免每切一句打一次 status。
 */
export async function warmClassicQuoteFavoriteStatusSession(
	items: ReadonlyArray<ClassicFavoriteListItem>,
): Promise<void> {
	if (items.length === 0) return;

	if (itemsEmbedFavoriteId(items)) {
		for (const item of items) {
			const ck = classicQuoteFavoriteContentKey(item.english);
			if (!ck || !('favoriteId' in item)) continue;
			sessionQueriedContentKeys.add(ck);
			if (item.favoriteId) {
				sessionFavoriteIdByContentKey.set(ck, item.favoriteId);
			} else {
				sessionFavoriteIdByContentKey.delete(ck);
			}
		}
		bumpClassicFavoriteSession();
		return;
	}

	const need: string[] = [];
	for (const item of items) {
		const ck = classicQuoteFavoriteContentKey(item.english);
		if (!ck || sessionQueriedContentKeys.has(ck)) continue;
		sessionQueriedContentKeys.add(ck);
		need.push(item.english);
	}
	if (need.length === 0) return;

	try {
		await fetchEnglishClassicQuoteFavoriteStatus(need, {
			onPartial: (refs) => {
				for (const r of refs) {
					sessionFavoriteIdByContentKey.set(r.contentKey, r.id);
				}
				bumpClassicFavoriteSession();
			},
		});
		bumpClassicFavoriteSession();
	} catch {
		for (const english of need) {
			const ck = classicQuoteFavoriteContentKey(english);
			if (ck) sessionQueriedContentKeys.delete(ck);
		}
	}
}
