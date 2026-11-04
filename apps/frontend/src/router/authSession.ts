import { Toast } from '@ui/sonner';
import {
	clearAuthKicked,
	markAuthKicked,
	requiresAuthForPath,
} from '@/router/authPaths';
import { beginAuthClearToastMute } from '@/router/authToastMute';
import { resetUserState } from '@/store/resetUserState';

let handlingUnauthorized = false;
/** 踢下线已弹专用 Toast 时，抑制 Layout 再弹「请先登录后再访问」 */
let suppressAuthRedirectToast = false;

/** Layout 鉴权拦截前调用：若刚踢下线则消费标志并跳过笼统登录 Toast */
export function consumeSuppressAuthRedirectToast(): boolean {
	if (!suppressAuthRedirectToast) return false;
	suppressAuthRedirectToast = false;
	return true;
}

/** 从 401 响应体取出 message，供踢下线 Toast 识别 */
export async function readUnauthorizedReason(
	response: Response,
): Promise<string> {
	try {
		const body = (await response.clone().json()) as { message?: unknown };
		if (typeof body?.message === 'string') return body.message;
		if (Array.isArray(body?.message)) {
			return body.message.filter((x) => typeof x === 'string').join('；');
		}
	} catch {
		// 非 JSON 体忽略
	}
	return '';
}

/** 鉴权已清退（含踢下线）：业务 catch 勿再弹「加载失败」类笼统 Toast */
export function isAuthClearedError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const e = err as {
		__authCleared?: boolean;
		code?: number;
		status?: number;
		message?: unknown;
	};
	if (e.__authCleared === true) return true;
	if (e.code === 401 || e.status === 401) return true;
	if (typeof e.message === 'string') {
		if (e.message.includes('别处登录')) return true;
		if (e.message.includes('请先登录')) return true;
	}
	return false;
}

/**
 * 清本 tab 内存登录态。
 * localStorage 跨 tab 共享：仅当 storage 里仍是「这张失效票」时才删，避免误删他 tab 新登录的 token。
 */
function clearLocalAuthState(failedToken?: string): void {
	const stored = (localStorage.getItem('token') || '').trim();
	const failed = (failedToken || '').trim();
	const clearStorage = !failed || !stored || stored === failed;

	if (clearStorage) {
		localStorage.removeItem('token');
		localStorage.removeItem('userInfo');
	}

	resetUserState();
	window.dispatchEvent(new Event('userInfoChanged'));
	void import('@/utils/fetch').then(({ http }) => http.setAuthToken(''));
	void import('@/store/user').then((m) => m.default.clearUserInfo());
}

function goLogin(navigate?: (to: string) => void | Promise<void>): void {
	if (navigate) {
		void navigate('/login');
		return;
	}
	if (window.location.pathname !== '/login') {
		window.location.replace('/login');
	}
}

/** 主动退出登录（含 Tauri 菜单）：先清服务端本槽会话，再清本地并跳转登录页 */
export function performLogout(
	navigate?: (to: string) => void | Promise<void>,
): void {
	if (typeof window === 'undefined') return;

	void (async () => {
		let usedToken = '';
		try {
			const { http } = await import('@/utils/fetch');
			usedToken = http.getAuthToken();
			await http.post('/auth/logout', undefined, { silent: true });
		} catch {
			// 失败仍清本地
		}
		clearAuthKicked();
		clearLocalAuthState(usedToken || localStorage.getItem('token') || '');
		goLogin(navigate);
	})();
}

/**
 * token 失效（如 401）：清理本 tab 登录态；若当前在需登录页则跳转登录。
 * @param reason 后端 401 message；含「别处登录」时提示踢下线
 * @param failedToken 本次 401 请求实际带的票；用于判断是否可安全改 localStorage
 */
export function notifyUnauthorized(
	reason?: string,
	failedToken?: string,
): void {
	if (typeof window === 'undefined' || handlingUnauthorized) return;
	handlingUnauthorized = true;

	const kicked = Boolean(reason?.includes('别处登录'));
	beginAuthClearToastMute(3000);

	// 本 tab 标记踢下线（sessionStorage）：Layout 会视未登录并跳转，且不删他 tab 的 localStorage 票
	if (kicked) {
		markAuthKicked();
		suppressAuthRedirectToast = true;
	}

	clearLocalAuthState(failedToken);

	if (kicked) {
		Toast({
			type: 'error',
			title: '账号已在别处登录，请重新登录',
			force: true,
		});
	}

	const path = window.location.pathname;
	// 踢下线：任意页（除已在登录页）都跳登录；普通 401：仅需登录页才跳
	const shouldRedirect =
		path !== '/login' && (kicked || requiresAuthForPath(path));

	if (!shouldRedirect) {
		handlingUnauthorized = false;
		return;
	}

	// userInfoChanged 已派发 → Layout 应 SPA navigate；短延迟硬跳兜底，并给踢下线 Toast 绘制时间
	window.setTimeout(
		() => {
			if (window.location.pathname !== '/login') {
				window.location.replace('/login');
				return;
			}
			handlingUnauthorized = false;
		},
		kicked ? 400 : 0,
	);
}
