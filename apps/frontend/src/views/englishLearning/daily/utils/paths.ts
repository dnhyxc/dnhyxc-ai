/**
 * 今日记词路由路径
 */
export const ENGLISH_DAILY_PATH = '/english-learning/daily';
export const ENGLISH_DAILY_SESSION_PATH = `${ENGLISH_DAILY_PATH}/session`;
export const ENGLISH_DAILY_DONE_PATH = `${ENGLISH_DAILY_PATH}/done`;

export type DailyRoutePhase = 'intro' | 'session' | 'done';

export function dailyPhaseFromPathname(pathname: string): DailyRoutePhase {
	if (pathname.endsWith('/done')) return 'done';
	if (pathname.endsWith('/session')) return 'session';
	return 'intro';
}

export function mergeDailySearch(
	search: string | undefined,
	patch: Record<string, string | null | undefined>,
): string {
	const p = new URLSearchParams(search?.replace(/^\?/, '') ?? '');
	for (const [k, v] of Object.entries(patch)) {
		if (v == null || v === '') p.delete(k);
		else p.set(k, v);
	}
	return p.toString();
}

function pathWithSearch(path: string, search?: string): string {
	const q = search?.replace(/^\?/, '');
	return q ? `${path}?${q}` : path;
}

export function englishDailySessionUrl(search?: string): string {
	return pathWithSearch(ENGLISH_DAILY_SESSION_PATH, search);
}

export function englishDailyDoneUrl(search?: string): string {
	return pathWithSearch(ENGLISH_DAILY_DONE_PATH, search);
}

export function englishDailyIntroUrl(search?: string): string {
	return pathWithSearch(ENGLISH_DAILY_PATH, search);
}
