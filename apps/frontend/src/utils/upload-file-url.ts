import { BASE_URL } from '@/constants';
import type { UploadedFile } from '@/types';
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

/**
 * 落库 / SSE / chat API 使用：保持 /images|/files 相对路径，文件名不 URL 编码。
 * （浏览器展示请用 resolveUploadedFileUrl → encodeUploadFileUrl）
 */
export function toStorageUploadPath(path: string): string {
	if (!path) return path;
	if (/^https?:\/\//i.test(path.trim())) {
		return path.trim();
	}

	const relative =
		stripUploadOriginToRelative(path) ??
		(path.startsWith('/') ? path : `/${path}`);

	return relative
		.split('/')
		.map((seg) => {
			if (!seg) return '';
			try {
				return decodeURIComponent(seg);
			} catch {
				return seg;
			}
		})
		.join('/');
}

/** 发送 chat/sse 前规范化附件 path */
export function sanitizeAttachmentsForApi(
	attachments?: UploadedFile[] | null,
): UploadedFile[] | undefined {
	if (!attachments?.length) return undefined;
	return attachments.map((a) => ({
		...a,
		path: toStorageUploadPath(a.path),
		cosKey: a.cosKey,
	}));
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
 * 生产 Web 附件 URL：与当前页面同源 /api/upload/serve（9002 页面必须走 9002/api，不能写死 9112）。
 */
function buildUploadServeUrl(storagePath: string): string {
	if (typeof window !== 'undefined' && !isTauriRuntime()) {
		return `${window.location.origin}/api/upload/serve?path=${encodeURIComponent(storagePath)}`;
	}
	const base = BASE_URL.replace(/\/$/, '');
	return `${base}/upload/serve?path=${encodeURIComponent(storagePath)}`;
}

/**
 * 将后端返回的 uploads 相对路径转为前端可访问 URL。
 * - 生产 Web：`/api/upload/serve?path=...`（走已有 /api 反代）
 * - 开发 Web：同源 `/images`、`/files` + 分段编码（Vite 反代）
 * - Tauri：API 同源绝对地址 + 编码
 */
export function resolveUploadedFileUrl(path: string): string {
	if (!path) return path;

	const storage = toStorageUploadPath(path);

	if (!isTauriRuntime()) {
		// 非 dev（含 9002 生产构建）一律走 /api/upload/serve，不依赖 Nginx /images/
		if (!import.meta.env.DEV) {
			return buildUploadServeUrl(storage);
		}
		return encodeUploadFileUrl(storage);
	}

	if (/^https?:\/\//i.test(path)) return encodeUploadFileUrl(path);

	const normalizedPath = storage.startsWith('/') ? storage : `/${storage}`;
	if (import.meta.env.PROD) {
		return buildUploadServeUrl(normalizedPath);
	}
	return encodeUploadFileUrl(`${getUploadStaticOrigin()}${normalizedPath}`);
}
