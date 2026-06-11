export const USER_INFO_STORAGE_KEY = 'userInfo';

/** 按登录用户隔离 localStorage 键；未登录时仍用 baseKey */
export function userScopedStorageKey(baseKey: string, userId?: number): string {
	const id = userId ?? getLoggedInUserId();
	return id > 0 ? `${baseKey}:${id}` : baseKey;
}

/** 从 localStorage 读取当前登录用户 id（供 knowledge 等模块使用，避免 import userStore 循环依赖） */
export function getLoggedInUserId(): number {
	if (typeof window === 'undefined') return 0;
	const raw = localStorage.getItem(USER_INFO_STORAGE_KEY);
	if (!raw?.trim()) return 0;
	try {
		const parsed = JSON.parse(raw) as { id?: unknown };
		const id = Number(parsed.id);
		return Number.isFinite(id) && id > 0 ? id : 0;
	} catch {
		return 0;
	}
}
