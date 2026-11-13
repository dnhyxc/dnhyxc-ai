/** 用户点了停止。控制器据此返回，不写缓存。 */
export class VocabDetailCancelledError extends Error {
	constructor() {
		super('vocab detail cancelled');
		this.name = 'VocabDetailCancelledError';
	}
}

export function isVocabAbort(error: unknown, signal?: AbortSignal): boolean {
	if (error instanceof VocabDetailCancelledError) return true;
	if (signal?.aborted) return true;
	if (!error || typeof error !== 'object') return false;
	const name = (error as { name?: string }).name ?? '';
	if (name === 'AbortError' || name === 'APIUserAbortError') return true;
	const message = String((error as { message?: unknown }).message ?? '');
	return /abort/i.test(message);
}

/**
 * 一次详解生成的停止状态。
 * 停止先于 arm 到达时记在 early 里，arm 直接抛，不再去请求模型。
 */
export function createVocabRuns() {
	const runs = new Map<string, AbortController>();
	const early = new Set<string>();
	return {
		/** pending：请求已经在飞，但模型调用还没 arm。 */
		stop(key: string, pending: boolean): boolean {
			if (!pending && !runs.has(key)) return false;
			early.add(key);
			const ac = runs.get(key);
			if (ac && !ac.signal.aborted) ac.abort();
			return true;
		},
		arm(key: string): AbortController {
			if (early.has(key)) throw new VocabDetailCancelledError();
			const ac = new AbortController();
			runs.set(key, ac);
			return ac;
		},
		end(key: string, ac: AbortController) {
			if (runs.get(key) === ac) runs.delete(key);
		},
		/** 这一轮结束（成功、失败或取消）后清掉早到的停止，避免下一次打开被误伤。 */
		finish(key: string) {
			early.delete(key);
		},
		stopped(key: string, signal?: AbortSignal) {
			return early.has(key) || Boolean(signal?.aborted);
		},
	};
}

export type VocabOpenSource = 'regen' | 'manual' | 'generated';

export const LIST_PAGE_SIZE = 50;
export const LIST_CURSOR_SEP = '|';

type ListSlot = { glossZh: string; updatedAt: Date };

export type ListHit = {
	lemma: string;
	source: VocabOpenSource;
	glossZh: string;
	updatedAt: Date;
};

export type MergedRow = {
	lemma: string;
	glossZh: string;
	updatedAt: Date;
	source: VocabOpenSource;
};

export type ListCursor = { updatedAt: number; lemma: string };

/** 一词一行。胜出份由 pickVocabOpen 决定，不用三份里更晚的时间。 */
export function mergeLibraryDetailHits(hits: ListHit[]): MergedRow[] {
	const byLemma = new Map<string, Record<VocabOpenSource, ListSlot | null>>();
	for (const hit of hits) {
		if (!hit.lemma) continue;
		const slot = byLemma.get(hit.lemma) ?? {
			regen: null,
			manual: null,
			generated: null,
		};
		const prev = slot[hit.source];
		if (!prev || hit.updatedAt.getTime() >= prev.updatedAt.getTime()) {
			slot[hit.source] = { glossZh: hit.glossZh, updatedAt: hit.updatedAt };
		}
		byLemma.set(hit.lemma, slot);
	}
	const merged: MergedRow[] = [];
	for (const [lemma, versions] of byLemma) {
		const picked = pickVocabOpen(versions);
		if (!picked) continue;
		merged.push({
			lemma,
			glossZh: picked.detail.glossZh,
			updatedAt: picked.detail.updatedAt,
			source: picked.source,
		});
	}
	merged.sort((a, b) => {
		const delta = b.updatedAt.getTime() - a.updatedAt.getTime();
		if (delta !== 0) return delta;
		if (a.lemma === b.lemma) return 0;
		return a.lemma < b.lemma ? 1 : -1;
	});
	return merged;
}

export function parseListCursor(cursor: string): ListCursor {
	const sep = cursor.indexOf(LIST_CURSOR_SEP);
	if (sep <= 0) throw new Error('cursor');
	const updatedAt = new Date(cursor.slice(0, sep)).getTime();
	const lemma = cursor.slice(sep + 1);
	if (Number.isNaN(updatedAt) || !lemma) throw new Error('cursor');
	return { updatedAt, lemma };
}

function isOlderThanCursor(row: MergedRow, cursor: ListCursor): boolean {
	const time = row.updatedAt.getTime();
	if (time < cursor.updatedAt) return true;
	if (time > cursor.updatedAt) return false;
	return row.lemma < cursor.lemma;
}

/** Redis 不可用时在内存里切页。顺序与有序集合的 REV 一致。 */
export function pageMergedDetails(
	rows: MergedRow[],
	cursor: ListCursor | null,
): {
	items: Array<{
		lemma: string;
		glossZh: string;
		updatedAt: string;
		source: VocabOpenSource;
	}>;
	nextCursor: string | null;
	total: number;
} {
	const total = rows.length;
	const rest = cursor
		? rows.filter((row) => isOlderThanCursor(row, cursor))
		: rows;
	const hasMore = rest.length > LIST_PAGE_SIZE;
	const page = hasMore ? rest.slice(0, LIST_PAGE_SIZE) : rest;
	const last = page.at(-1);
	const nextCursor =
		hasMore && last
			? `${last.updatedAt.toISOString()}${LIST_CURSOR_SEP}${last.lemma}`
			: null;
	return {
		items: page.map((row) => ({
			lemma: row.lemma,
			glossZh: row.glossZh,
			updatedAt: row.updatedAt.toISOString(),
			source: row.source,
		})),
		nextCursor,
		total,
	};
}

/** 打开顺序：重新生成，手动导入，全站缓存。都没有则返回 null，由调用方再生成。 */
export function pickVocabOpen<T>(versions: {
	regen: T | null;
	manual: T | null;
	generated: T | null;
}): { detail: T; source: VocabOpenSource } | null {
	if (versions.regen) return { detail: versions.regen, source: 'regen' };
	if (versions.manual) return { detail: versions.manual, source: 'manual' };
	if (versions.generated)
		return { detail: versions.generated, source: 'generated' };
	return null;
}
