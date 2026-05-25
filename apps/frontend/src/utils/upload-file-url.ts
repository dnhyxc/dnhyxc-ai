import { BASE_URL } from '@/constant';
import { isTauriRuntime } from './runtime';

/** 从 API 根地址推导 uploads 静态资源源站（与 Nest useStaticAssets 同端口） */
function getUploadStaticOrigin(): string {
	return BASE_URL.replace(/\/api\/?$/, '');
}

/** 将历史数据中的绝对 URL 还原为 /images、/files 相对路径 */
function stripUploadOriginToRelative(path: string): string | null {
	const matched = path.match(/^https?:\/\/[^/]+(\/(?:images|files)\/.+)$/i);
	return matched ? matched[1] : null;
}

/** 判断资源 URL 相对当前页面是否跨源（含 9002 页面加载 9112 图片） */
export function isCrossOriginUploadUrl(
	url: string,
	baseHref: string = typeof window !== 'undefined' ? window.location.href : '',
): boolean {
	if (!url || url.startsWith('blob:')) return false;
	try {
		return new URL(url, baseHref).origin !== new URL(baseHref).origin;
	} catch {
		return /^https?:\/\//i.test(url);
	}
}

/** 对路径各段做 encodeURIComponent，避免中文文件名在 fetch / img 中失败 */
export function encodeUploadFileUrl(url: string): string {
	if (!url) return url;
	try {
		if (url.startsWith('/')) {
			const qIdx = url.indexOf('?');
			const pathPart = qIdx >= 0 ? url.slice(0, qIdx) : url;
			const query = qIdx >= 0 ? url.slice(qIdx) : '';
			const encodedPath = pathPart
				.split('/')
				.map((seg) => (seg ? encodeURIComponent(decodeURIComponent(seg)) : ''))
				.join('/');
			return encodedPath + query;
		}
		const u = new URL(url);
		u.pathname = u.pathname
			.split('/')
			.map((seg) => (seg ? encodeURIComponent(decodeURIComponent(seg)) : ''))
			.join('/');
		return u.href;
	} catch {
		return url;
	}
}

/**
 * 将后端返回的 uploads 相对路径转为前端可访问 URL。
 * - 浏览器 Web：统一 `/images`、`/files` 同源相对路径（走 9002 Nginx 反代），避免跨域 fetch 失败
 * - Tauri 桌面：拼 API 同源绝对地址
 */
export function resolveUploadedFileUrl(path: string): string {
	if (!path) return path;

	if (!isTauriRuntime()) {
		const relative = stripUploadOriginToRelative(path);
		if (relative) return encodeUploadFileUrl(relative);
		if (/^https?:\/\//i.test(path)) return path;
		return encodeUploadFileUrl(path.startsWith('/') ? path : `/${path}`);
	}

	if (/^https?:\/\//i.test(path)) return encodeUploadFileUrl(path);

	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return encodeUploadFileUrl(`${getUploadStaticOrigin()}${normalizedPath}`);
}
