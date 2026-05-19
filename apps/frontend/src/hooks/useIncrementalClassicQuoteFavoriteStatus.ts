/**
 * 按列表增量查询经典句收藏状态：仅对尚未查询过的句子请求 /status，结果合并进 Set。
 * 列表被整体替换（非末尾追加）时清空本地状态并重新查询。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	classicQuoteFavoriteContentKey,
	fetchEnglishClassicQuoteFavoriteStatus,
} from '@/service';

const ENGLISH_SIG_SEP = '\u0001';
const STATUS_QUERY_DEBOUNCE_MS = 150;

export function useIncrementalClassicQuoteFavoriteStatus(
	items: ReadonlyArray<{ english: string }>,
) {
	const [favoritedContentKeys, setFavoritedContentKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const queriedKeysRef = useRef<Set<string>>(new Set());
	const prevItemsEnglishSigRef = useRef('');

	const itemsEnglishSig = useMemo(
		() => items.map((it) => it.english).join(ENGLISH_SIG_SEP),
		[items],
	);

	useEffect(() => {
		if (items.length === 0) {
			setFavoritedContentKeys(new Set());
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
			setFavoritedContentKeys(new Set());
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

			void (async () => {
				try {
					const res =
						await fetchEnglishClassicQuoteFavoriteStatus(englishesToQuery);
					if (cancelled) return;
					const keys = res.data?.favoritedContentKeys;
					if (!Array.isArray(keys) || keys.length === 0) return;
					setFavoritedContentKeys((prev) => {
						const next = new Set(prev);
						for (const k of keys) next.add(k);
						return next;
					});
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

	return { favoritedContentKeys, setFavoritedContentKeys };
}
