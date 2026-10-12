/**
 * sessionStorage JSON 读写壳（练习 / 今日记词草稿共用）
 */
import { getLoggedInUserId } from '@/store/loggedInUserId';

export function sessionDraftUserScope(): string {
	const id = getLoggedInUserId();
	return id > 0 ? String(id) : 'anon';
}

export function sessionDraftGet<T>(key: string): T | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function sessionDraftSet(key: string, value: unknown): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	try {
		sessionStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch (e) {
		console.warn('[sessionDraft] set failed', key, e);
		return false;
	}
}

export function sessionDraftRemove(key: string): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

/**
 * 清除某前缀下全部键（登出用）。
 * sessionStorage 无按前缀删除 API，且草稿 key 含动态 sid，只能扫库匹配；
 * 须先收集再删：边遍历边 removeItem 会导致下标前移漏删；也不能 clear()（会清掉同页其它数据）。
 */
export function sessionDraftClearPrefix(prefix: string): void {
	if (typeof sessionStorage === 'undefined') return;
	const keys: string[] = [];
	for (let i = 0; i < sessionStorage.length; i++) {
		const k = sessionStorage.key(i);
		if (k?.startsWith(prefix)) keys.push(k);
	}
	for (const k of keys) sessionDraftRemove(k);
}
