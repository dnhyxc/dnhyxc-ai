import { createVocabRuns } from './vocab-detail-run';

/**
 * 卡片单条重标的在途表。键是 userId + cache_key，两个人标同一句互不断开。
 * 形态与 createVocabRuns 相同：停止先于 arm 记在 early 里，arm 直接抛，不再请求模型。
 */
const runs = createVocabRuns();
const inflight = new Map<string, Promise<unknown>>();
const claimed = new Map<string, { userId: number; english: string }>();
const outcomes = new Map<number, { id: string; ok: boolean }[]>();

export type CardAnnotateOutcome = { id: string; ok: boolean };

/** 这一轮结束。停止不算，成功或失败各记一条，下次查询取走。 */
export function pushSentenceAnnotateOutcome(
	userId: number,
	english: string,
	ok: boolean,
): void {
	const id = english.trim().toLowerCase();
	if (!id) return;
	const list = outcomes.get(userId) ?? [];
	list.push({ id, ok });
	outcomes.set(userId, list);
}

export function takeSentenceAnnotateOutcomes(
	userId: number,
): CardAnnotateOutcome[] {
	const list = outcomes.get(userId) ?? [];
	outcomes.delete(userId);
	return list;
}

export function sentenceAnnotateRunKey(
	userId: number,
	cacheKey: string,
): string {
	return `${userId}:${cacheKey}`;
}

/** 占坑。已经在跑则返回 false，调用方不要再打一次模型。 */
export function claimSentenceAnnotate(
	key: string,
	userId: number,
	english: string,
): boolean {
	if (claimed.has(key)) return false;
	claimed.set(key, { userId, english });
	return true;
}

export function armSentenceAnnotate(key: string): AbortController {
	return runs.arm(key);
}

/** arm 之前就被停止：清掉占坑和 early，下一次点击还能再开。 */
export function releaseSentenceAnnotateClaim(key: string): void {
	claimed.delete(key);
	runs.finish(key);
}

export function trackSentenceAnnotate(
	key: string,
	job: Promise<unknown>,
	ac: AbortController,
): void {
	const tracked = job.finally(() => {
		if (inflight.get(key) === tracked) inflight.delete(key);
		runs.end(key, ac);
		runs.finish(key);
		claimed.delete(key);
	});
	inflight.set(key, tracked);
}

export function stopSentenceAnnotate(key: string): boolean {
	return runs.stop(key, claimed.has(key));
}

export function listSentenceAnnotateEnglish(userId: number): string[] {
	const out: string[] = [];
	for (const row of claimed.values()) {
		if (row.userId === userId) out.push(row.english);
	}
	return out;
}
