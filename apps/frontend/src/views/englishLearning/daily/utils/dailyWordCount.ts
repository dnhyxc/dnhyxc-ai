/** 今日记词：每轮练习词数（本地偏好，访客与登录用户共用） */

export const DAILY_WORD_COUNT_DEFAULT = 10;

export const DAILY_WORD_COUNT_OPTIONS = [10, 20, 30, 40, 50] as const;

export type DailyWordCount = (typeof DAILY_WORD_COUNT_OPTIONS)[number];

const STORAGE_KEY = 'english_daily_words_per_round_v1';

export const ENGLISH_DAILY_WORD_COUNT_CHANGE =
	'english-daily-word-count-change';

function isDailyWordCount(value: number): value is DailyWordCount {
	return (DAILY_WORD_COUNT_OPTIONS as readonly number[]).includes(value);
}

export function getDailyWordCount(): DailyWordCount {
	if (typeof window === 'undefined') {
		return DAILY_WORD_COUNT_DEFAULT;
	}
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return DAILY_WORD_COUNT_DEFAULT;
		}
		const parsed = Number.parseInt(raw, 10);
		return isDailyWordCount(parsed) ? parsed : DAILY_WORD_COUNT_DEFAULT;
	} catch {
		return DAILY_WORD_COUNT_DEFAULT;
	}
}

export function setDailyWordCount(count: DailyWordCount): void {
	if (typeof window === 'undefined') {
		return;
	}
	try {
		localStorage.setItem(STORAGE_KEY, String(count));
	} catch {
		// ignore quota / private mode
	}
	window.dispatchEvent(
		new CustomEvent<DailyWordCount>(ENGLISH_DAILY_WORD_COUNT_CHANGE, {
			detail: count,
		}),
	);
}
