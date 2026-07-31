import { requiresAuthForPath } from '@/router/authPaths';
import { resetUserState } from '@/store/resetUserState';

let handlingUnauthorized = false;

/** 主动退出登录（含 Tauri 菜单）：清登录态并跳转登录页 */
export function performLogout(
	navigate?: (to: string) => void | Promise<void>,
): void {
	if (typeof window === 'undefined') return;

	// 同步清 storage，避免 userStore 静态 import 造成 utils↔authSession 循环依赖
	localStorage.removeItem('token');
	localStorage.removeItem('userInfo');
	resetUserState();
	window.dispatchEvent(new Event('userInfoChanged'));

	void import('@/utils/fetch').then(({ http }) => http.setAuthToken(''));
	void import('@/store/user').then((m) => m.default.clearUserInfo());

	if (navigate) {
		void navigate('/login');
		return;
	}
	if (window.location.pathname !== '/login') {
		window.location.replace('/login');
	}
}

/**
 * token 失效（如 401）：清理本地登录态；若当前在需登录页则整页跳转登录（刷新后同样生效）。
 */
export function notifyUnauthorized(): void {
	if (typeof window === 'undefined' || handlingUnauthorized) return;
	handlingUnauthorized = true;

	// 须同步清理，避免随后 location.replace 导致异步任务未执行完
	localStorage.removeItem('token');
	localStorage.removeItem('userInfo');
	resetUserState();
	window.dispatchEvent(new Event('userInfoChanged'));

	void import('@/utils/fetch').then(({ http }) => http.setAuthToken(''));
	void import('@/store/user').then((m) => m.default.clearUserInfo());

	const path = window.location.pathname;
	if (requiresAuthForPath(path) && path !== '/login') {
		window.location.replace('/login');
	}

	window.setTimeout(() => {
		handlingUnauthorized = false;
	}, 1500);
}
