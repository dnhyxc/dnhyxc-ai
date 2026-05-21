/**
 * 按列表增量查询单词收藏状态：仅对尚未查询过的词请求 /status，结果合并进 Map（wordKey → 收藏 id）。
 * 列表被整体替换（非末尾追加）时清空本地状态并重新查询。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	type EnglishVocabFavoriteRef,
	fetchEnglishVocabularyFavoriteStatus,
	normalizeEnglishVocabWordKey,
} from '@/service';

const WORD_SIG_SEP = '\u0001';
const STATUS_QUERY_DEBOUNCE_MS = 150;

export function useIncrementalVocabFavoriteStatus(
	items: ReadonlyArray<{ word: string }>,
) {
	const [favoriteIdByWordKey, setFavoriteIdByWordKey] = useState<
		Map<string, string>
	>(() => new Map());
	const queriedKeysRef = useRef<Set<string>>(new Set());
	const prevItemsWordSigRef = useRef('');

	const favoritedWordKeys = useMemo(
		() => new Set(favoriteIdByWordKey.keys()),
		[favoriteIdByWordKey],
	);

	const itemsWordSig = useMemo(
		() => items.map((it) => it.word).join(WORD_SIG_SEP),
		[items],
	);

	useEffect(() => {
		if (items.length === 0) {
			setFavoriteIdByWordKey(new Map());
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
			setFavoriteIdByWordKey(new Map());
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

			const mergeFavoritedRefs = (refs: EnglishVocabFavoriteRef[]) => {
				if (cancelled || refs.length === 0) return;
				setFavoriteIdByWordKey((prev) => {
					const next = new Map(prev);
					for (const r of refs) next.set(r.wordKey, r.id);
					return next;
				});
			};

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

	const getVocabularyFavoriteId = (wordKey: string) =>
		favoriteIdByWordKey.get(wordKey);

	const setVocabularyFavoriteId = (wordKey: string, id: string) => {
		setFavoriteIdByWordKey((prev) => {
			const next = new Map(prev);
			next.set(wordKey, id);
			return next;
		});
	};

	const clearVocabularyFavorite = (wordKey: string) => {
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
