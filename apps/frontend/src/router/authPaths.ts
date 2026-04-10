/**
 * 未登录可访问的路径（与产品约定一致）。
 * 其余路径进入 Layout 后需携带有效 token，否则跳转 /login。
 */
export function isPublicPath(pathname: string): boolean {
	if (pathname === '/') return true;
	if (pathname === '/login') return true;
	if (pathname === '/win') return true;
	if (pathname === '/about') return true;
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

export function hasValidAuthToken(): boolean {
	if (typeof window === 'undefined') return false;
	return Boolean(localStorage.getItem('token')?.trim());
}
