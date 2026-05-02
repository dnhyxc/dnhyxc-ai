/** 主应用内法律页路径（与路由表一致，供关于窗口拼浏览器绝对 URL）。 */
export const LEGAL_PAGE_PATHS = {
	servicePolicy: '/service-policy',
	userAgreement: '/user-agreement',
} as const;

/** 当前站点下的法律页绝对地址，用于在系统浏览器中打开。 */
export function getLegalPageAbsoluteUrl(path: string): string {
	if (typeof window === 'undefined') {
		return path;
	}
	return `${window.location.origin}${path}`;
}
