/**
 * 经典句看中写：拉取句内词性 / IPA / 释义（内存缓存，同句不重复打模型）
 */
import { useEffect, useMemo, useState } from 'react';
import { isPracticeAbortError } from '../utils/practiceRequestScope';
import type { SentenceWordToken } from '../utils/segmentSentence';
import {
	ensureSentenceWordAnnotation,
	getSentenceWordAnnotationCache,
	sentenceWordAnnotationCacheKey,
} from '../utils/sentenceWordAnnotationCache';
import type { SentenceWordMeta } from '../utils/wordMeta';

const EMPTY_META: readonly (SentenceWordMeta | null)[] = [];

export function useSentenceWordAnnotations(args: {
	enabled: boolean;
	english: string;
	tokens: readonly SentenceWordToken[];
	/** 会话世代 signal；切题 abort */
	signal?: AbortSignal;
}) {
	const { enabled, english, tokens, signal } = args;
	const wordKey = useMemo(() => tokens.map((t) => t.raw).join('\0'), [tokens]);
	const [metaByIndex, setMetaByIndex] = useState<
		readonly (SentenceWordMeta | null)[]
	>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		if (!enabled || !english.trim() || tokens.length === 0) {
			// 同一引用，避免调用方每次传入新 [] 时 setState 死循环
			setMetaByIndex((prev) => (prev.length === 0 ? prev : EMPTY_META));
			setLoading((v) => (v ? false : v));
			setError((v) => (v ? false : v));
			return;
		}

		const key = sentenceWordAnnotationCacheKey(english, wordKey);
		const hit = getSentenceWordAnnotationCache(key);
		if (hit) {
			setMetaByIndex(hit);
			setLoading(false);
			setError(false);
			return;
		}

		const ac = new AbortController();
		const onParentAbort = () => ac.abort();
		if (signal?.aborted) {
			ac.abort();
		} else {
			signal?.addEventListener('abort', onParentAbort, { once: true });
		}

		setLoading(true);
		setError(false);
		setMetaByIndex(tokens.map(() => null));

		// 与开局 miss 补全共享 inflight；失败由 http 层 Toast（非 silent）；abort 不 Toast
		void ensureSentenceWordAnnotation({
			english,
			words: tokens.map((t) => t.raw),
			signal: ac.signal,
		})
			.then((aligned) => {
				if (ac.signal.aborted) return;
				setMetaByIndex(aligned);
				setError(false);
			})
			.catch((err) => {
				if (ac.signal.aborted || isPracticeAbortError(err)) return;
				setMetaByIndex(tokens.map(() => null));
				setError(true);
			})
			.finally(() => {
				if (!ac.signal.aborted) setLoading(false);
			});

		return () => {
			signal?.removeEventListener('abort', onParentAbort);
			ac.abort();
		};
	}, [enabled, english, tokens, wordKey, signal]);

	// 开局批量预热可能晚于本 effect：轮询内存缓存（短间隔，有结果即停）
	useEffect(() => {
		if (!enabled || !english.trim() || tokens.length === 0) return;
		const key = sentenceWordAnnotationCacheKey(english, wordKey);
		if (getSentenceWordAnnotationCache(key)) return;

		const timer = window.setInterval(() => {
			const late = getSentenceWordAnnotationCache(key);
			if (!late) return;
			setMetaByIndex(late);
			setLoading(false);
			setError(false);
			window.clearInterval(timer);
		}, 400);

		return () => window.clearInterval(timer);
	}, [enabled, english, tokens, wordKey]);

	return { metaByIndex, loading, error };
}
