/**
 * 未登录可访问的路径（与产品约定一致）。
 * 其余路径进入 Layout 后需携带有效 token，否则跳转 /login。
 */
export function isPublicPath(pathname: string): boolean {
	if (pathname === '/') return true;
	if (pathname === '/login') return true;
	if (pathname === '/win') return true;
	if (pathname === '/about') return true;
	if (
		pathname === '/service-policy' ||
		pathname === '/user-agreement' ||
		pathname === '/update-info' ||
		pathname === '/project-guide' ||
		pathname === '/plugin-dev-guide' ||
		pathname === '/download-desktop'
	)
		return true;
	if (pathname === '/knowledge') return true;
	if (pathname === '/setting' || pathname.startsWith('/setting/')) return true;
	// /share/:shareId
	if (/^\/share\/[^/]+\/?$/.test(pathname)) return true;
	return false;
}

/** 当前路径是否必须登录后才能访问（与 isPublicPath 互斥） */
export function requiresAuthForPath(pathname: string): boolean {
	return !isPublicPath(pathname);
}

/** 本 tab 被踢下线标记（sessionStorage，不影响其他 tab 的 localStorage token） */
export const AUTH_KICKED_KEY = 'auth-kicked';

export function isAuthKicked(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return sessionStorage.getItem(AUTH_KICKED_KEY) === '1';
	} catch {
		return false;
	}
}

export function markAuthKicked(): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(AUTH_KICKED_KEY, '1');
	} catch {
		// 隐私模式等忽略
	}
}

export function clearAuthKicked(): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.removeItem(AUTH_KICKED_KEY);
	} catch {
		// ignore
	}
}

export function hasValidAuthToken(): boolean {
	if (typeof window === 'undefined') return false;
	// 本 tab 已踢下线：即使 localStorage 仍有他 tab 新票，也视为未登录以便跳转登录页
	if (isAuthKicked()) return false;
	return Boolean(localStorage.getItem('token')?.trim());
}
