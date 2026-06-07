import type { DailyVocabCard } from '../types';
import { DAILY_STARTER_WORDS } from './starterWords';

const STORAGE_KEY = 'english_daily_local_srs_v1';

type LocalSrsEntry = {
	repetitions: number;
	intervalDays: number;
	easeFactor: number;
	nextReviewAt: string;
};

function readStore(): Record<string, LocalSrsEntry> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, LocalSrsEntry>;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeStore(data: Record<string, LocalSrsEntry>) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function addCalendarDays(base: Date, days: number): Date {
	const out = new Date(base);
	out.setDate(out.getDate() + days);
	return out;
}

function applySrs(
	entry: LocalSrsEntry | undefined,
	correct: boolean,
): LocalSrsEntry {
	const now = new Date();
	const repetitions = entry?.repetitions ?? 0;
	const intervalDays = entry?.intervalDays ?? 0;
	const easeFactor = entry?.easeFactor ?? 2.5;

	if (!correct) {
		return {
			repetitions: 0,
			intervalDays: 0,
			easeFactor: Math.max(1.3, easeFactor - 0.2),
			nextReviewAt: addCalendarDays(now, 1).toISOString(),
		};
	}

	const nextRepetitions = repetitions + 1;
	let nextInterval = intervalDays;
	if (nextRepetitions === 1) nextInterval = 1;
	else if (nextRepetitions === 2) nextInterval = 3;
	else nextInterval = Math.max(1, Math.round(nextInterval * easeFactor));

	return {
		repetitions: nextRepetitions,
		intervalDays: nextInterval,
		easeFactor: Math.min(2.5, easeFactor + 0.1),
		nextReviewAt: addCalendarDays(now, nextInterval).toISOString(),
	};
}

export function recordStarterMemorizeResult(
	key: string,
	correct: boolean,
): void {
	const store = readStore();
	store[key] = applySrs(store[key], correct);
	writeStore(store);
}

function isDue(entry: LocalSrsEntry | undefined, now: Date): boolean {
	if (!entry) return true;
	const at = new Date(entry.nextReviewAt);
	return !Number.isFinite(at.getTime()) || at.getTime() <= now.getTime();
}

export function pickStarterDueWords(
	count: number,
	excludeKeys: string[] = [],
): DailyVocabCard[] {
	const exclude = new Set(excludeKeys);
	const store = readStore();
	const now = new Date();
	const due = DAILY_STARTER_WORDS.filter(
		(w) => !exclude.has(w.key) && isDue(store[w.key], now),
	);
	const fresh = DAILY_STARTER_WORDS.filter(
		(w) => !exclude.has(w.key) && !store[w.key],
	);
	const pool = [
		...due,
		...fresh.filter((w) => !due.some((d) => d.key === w.key)),
	];
	return pool.slice(0, Math.max(1, count));
}

export function countStarterDueToday(): number {
	const store = readStore();
	const now = new Date();
	return DAILY_STARTER_WORDS.filter((w) => isDue(store[w.key], now)).length;
}

function shuffleStarter<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** 内置词表中尚未进入本地复习计划的词条数 */
export function countStarterLibraryEligible(): number {
	const store = readStore();
	return DAILY_STARTER_WORDS.filter((w) => !store[w.key]).length;
}

/** 未登录：已练过并写入本地复习计划的词条数 */
export function countStarterMemorized(): number {
	const store = readStore();
	return DAILY_STARTER_WORDS.filter((w) => Boolean(store[w.key])).length;
}

/** 未登录：清空本地记词进度，词可再次进入随机池 */
export function resetStarterLibraryMemorizeProgress(): void {
	localStorage.removeItem(STORAGE_KEY);
}

/** 未登录 — 词汇库随机：从内置词表随机抽取未入复习计划的词 */
export function pickStarterRandomWords(
	count: number,
	excludeKeys: string[] = [],
): DailyVocabCard[] {
	const exclude = new Set(excludeKeys);
	const store = readStore();
	const candidates = DAILY_STARTER_WORDS.filter(
		(w) => !exclude.has(w.key) && !store[w.key],
	);
	return shuffleStarter(candidates).slice(0, count);
}
