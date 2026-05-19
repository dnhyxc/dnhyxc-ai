/**
 * 按列表增量查询单词收藏状态：仅对尚未查询过的词请求 /status，结果合并进 Set。
 * 列表被整体替换（非末尾追加）时清空本地状态并重新查询。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	fetchEnglishVocabularyFavoriteStatus,
	normalizeEnglishVocabWordKey,
} from '@/service';

const WORD_SIG_SEP = '\u0001';
const STATUS_QUERY_DEBOUNCE_MS = 150;

export function useIncrementalVocabFavoriteStatus(
	items: ReadonlyArray<{ word: string }>,
) {
	const [favoritedWordKeys, setFavoritedWordKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const queriedKeysRef = useRef<Set<string>>(new Set());
	const prevItemsWordSigRef = useRef('');

	const itemsWordSig = useMemo(
		() => items.map((it) => it.word).join(WORD_SIG_SEP),
		[items],
	);

	useEffect(() => {
		if (items.length === 0) {
			setFavoritedWordKeys(new Set());
			queriedKeysRef.current = new Set();
			prevItemsWordSigRef.current = '';
			return;
		}

		const prevSig = prevItemsWordSigRef.current;
		const appended =
			prevSig.length > 0 &&
			(itemsWordSig === prevSig ||
				itemsWordSig.startsWith(`${prevSig}${WORD_SIG_SEP}`));
		if (!appended) {
			setFavoritedWordKeys(new Set());
			queriedKeysRef.current = new Set();
		}
		prevItemsWordSigRef.current = itemsWordSig;

		let cancelled = false;
		const timer = window.setTimeout(() => {
			const wordsToQuery: string[] = [];
			for (const item of items) {
				const wk = normalizeEnglishVocabWordKey(item.word);
				if (!wk || queriedKeysRef.current.has(wk)) continue;
				queriedKeysRef.current.add(wk);
				wordsToQuery.push(item.word);
			}
			if (wordsToQuery.length === 0) return;

			void (async () => {
				try {
					const res = await fetchEnglishVocabularyFavoriteStatus(wordsToQuery);
					if (cancelled) return;
					const keys = res.data?.favoritedWordKeys;
					if (!Array.isArray(keys) || keys.length === 0) return;
					setFavoritedWordKeys((prev) => {
						const next = new Set(prev);
						for (const k of keys) next.add(k);
						return next;
					});
				} catch {
					if (!cancelled) {
						for (const word of wordsToQuery) {
							const wk = normalizeEnglishVocabWordKey(word);
							if (wk) queriedKeysRef.current.delete(wk);
						}
					}
				}
			})();
		}, STATUS_QUERY_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [itemsWordSig, items]);

	return { favoritedWordKeys, setFavoritedWordKeys };
}
