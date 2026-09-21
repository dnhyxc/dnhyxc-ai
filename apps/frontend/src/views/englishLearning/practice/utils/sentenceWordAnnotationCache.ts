/**
 * 句内词标注前端内存缓存（单题 hook 与开局批量预热共用）
 */
import {
	annotateEnglishSentenceWords,
	annotateEnglishSentenceWordsBatch,
	type EnglishSentenceWordAnnotation,
} from '@/service';
import type { SentenceWordMeta } from '../utils/wordMeta';

const cache = new Map<string, SentenceWordMeta[]>();
/** 同 key 并发只打一次单句接口（开局 miss 补全与 hook 抢首题） */
const inflight = new Map<string, Promise<SentenceWordMeta[]>>();

export function sentenceWordAnnotationCacheKey(
	english: string,
	wordKey: string,
): string {
	return `${english.trim().toLowerCase()}::${wordKey}`;
}

export function getSentenceWordAnnotationCache(
	key: string,
): SentenceWordMeta[] | undefined {
	return cache.get(key);
}

export function setSentenceWordAnnotationCache(
	key: string,
	meta: SentenceWordMeta[],
): void {
	cache.set(key, meta);
}

/** 导入标注后清内存，避免练习页继续用旧释义 */
export function clearSentenceWordAnnotationCache(): void {
	cache.clear();
	inflight.clear();
}

function writeAlignedCache(
	english: string,
	words: string[],
	rows: EnglishSentenceWordAnnotation[],
): SentenceWordMeta[] | undefined {
	if (!rows.length) return undefined;
	const aligned = words.map((_, j) => {
		const w = rows[j];
		return {
			posZh: w?.posZh?.trim() ?? '',
			ipa: w?.ipa?.trim() ?? '',
			meaningZh: w?.meaningZh?.trim() ?? '',
		};
	});
	setSentenceWordAnnotationCache(
		sentenceWordAnnotationCacheKey(english, words.join('\0')),
		aligned,
	);
	return aligned;
}

/** 单句标注：内存命中直接返回；同 key 共享 inflight */
export function ensureSentenceWordAnnotation(params: {
	english: string;
	words: string[];
	silent?: boolean;
}): Promise<SentenceWordMeta[]> {
	const english = params.english.trim();
	const words = params.words.map((w) => w.trim()).filter(Boolean);
	const key = sentenceWordAnnotationCacheKey(english, words.join('\0'));
	const hit = cache.get(key);
	if (hit) return Promise.resolve(hit);

	const pending = inflight.get(key);
	if (pending) return pending;

	const run = annotateEnglishSentenceWords({
		english,
		words,
		silent: params.silent,
	})
		.then((res) => {
			const aligned =
				writeAlignedCache(english, words, res.data?.words ?? []) ??
				words.map(() => ({ posZh: '', ipa: '', meaningZh: '' }));
			return aligned;
		})
		.finally(() => {
			inflight.delete(key);
		});

	inflight.set(key, run);
	return run;
}

function itemKey(it: { english: string; words: string[] }): string {
	return sentenceWordAnnotationCacheKey(it.english, it.words.join('\0'));
}

function fillMissesWithLlm(
	misses: { english: string; words: string[] }[],
	preferFirst: { english: string; words: string[] } | undefined,
): void {
	if (misses.length === 0) return;

	// 队列首题若 miss：Session hook 已单句请求，这里跳过避免双打
	const preferKey = preferFirst ? itemKey(preferFirst) : '';
	const rest = preferKey
		? misses.filter((m) => itemKey(m) !== preferKey)
		: misses;
	if (rest.length === 0) return;

	void annotateEnglishSentenceWordsBatch({ items: rest, silent: true })
		.then((res) => {
			const rows = res.data?.items ?? [];
			rest.forEach((req, i) => {
				const row = rows[i];
				if (!row?.words?.length) return;
				writeAlignedCache(req.english, req.words, row.words);
			});
		})
		.catch(() => {
			// silent
		});
}

/**
 * 开局预热：
 * 1) cacheOnly 批量只读库 → 立刻灌内存
 * 2) miss：跳过队列首题（交给 hook 单句），其余批量调模型
 */
export function prefetchSentenceWordAnnotationsBatch(
	items: { english: string; words: string[] }[],
): void {
	const cleaned = items
		.map((it) => ({
			english: it.english.trim(),
			words: it.words.map((w) => w.trim()).filter(Boolean),
		}))
		.filter((it) => it.english && it.words.length > 0);
	if (cleaned.length === 0) return;

	const first = cleaned[0];

	void annotateEnglishSentenceWordsBatch({
		items: cleaned,
		cacheOnly: true,
		silent: true,
	})
		.then((res) => {
			const rows = res.data?.items ?? [];
			const misses: { english: string; words: string[] }[] = [];
			cleaned.forEach((req, i) => {
				const row = rows[i];
				if (row?.cacheHit && row.words?.length) {
					writeAlignedCache(req.english, req.words, row.words);
				} else {
					misses.push(req);
				}
			});
			fillMissesWithLlm(misses, first);
		})
		.catch(() => {
			// 只读失败：整队走 miss 补全（仍静默）
			fillMissesWithLlm(cleaned, first);
		});
}
