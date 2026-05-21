/**
 * 按列表增量查询经典句收藏状态：仅对尚未查询过的句子请求 /status，结果合并进 Map（contentKey → 收藏 id）。
 * 列表被整体替换（非末尾追加）时清空本地状态并重新查询。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	classicQuoteFavoriteContentKey,
	type EnglishClassicQuoteFavoriteRef,
	fetchEnglishClassicQuoteFavoriteStatus,
} from '@/service';

const ENGLISH_SIG_SEP = '\u0001';
const STATUS_QUERY_DEBOUNCE_MS = 150;

export function useIncrementalClassicQuoteFavoriteStatus(
	items: ReadonlyArray<{ english: string }>,
) {
	const [favoriteIdByContentKey, setFavoriteIdByContentKey] = useState<
		Map<string, string>
	>(() => new Map());
	const queriedKeysRef = useRef<Set<string>>(new Set());
	const prevItemsEnglishSigRef = useRef('');

	const favoritedContentKeys = useMemo(
		() => new Set(favoriteIdByContentKey.keys()),
		[favoriteIdByContentKey],
	);

	const itemsEnglishSig = useMemo(
		() => items.map((it) => it.english).join(ENGLISH_SIG_SEP),
		[items],
	);

	useEffect(() => {
		if (items.length === 0) {
			setFavoriteIdByContentKey(new Map());
			queriedKeysRef.current = new Set();
			prevItemsEnglishSigRef.current = '';
			return;
		}

		const prevSig = prevItemsEnglishSigRef.current;
		const appended =
			prevSig.length > 0 &&
			(itemsEnglishSig === prevSig ||
				itemsEnglishSig.startsWith(`${prevSig}${ENGLISH_SIG_SEP}`));
		if (!appended) {
			setFavoriteIdByContentKey(new Map());
			queriedKeysRef.current = new Set();
		}
		prevItemsEnglishSigRef.current = itemsEnglishSig;

		let cancelled = false;
		const timer = window.setTimeout(() => {
			const englishesToQuery: string[] = [];
			for (const item of items) {
				const ck = classicQuoteFavoriteContentKey(item.english);
				if (!ck || queriedKeysRef.current.has(ck)) continue;
				queriedKeysRef.current.add(ck);
				englishesToQuery.push(item.english);
			}
			if (englishesToQuery.length === 0) return;

			const mergeFavoritedRefs = (refs: EnglishClassicQuoteFavoriteRef[]) => {
				if (cancelled || refs.length === 0) return;
				setFavoriteIdByContentKey((prev) => {
					const next = new Map(prev);
					for (const r of refs) next.set(r.contentKey, r.id);
					return next;
				});
			};

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
	}, [itemsEnglishSig, items]);

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
