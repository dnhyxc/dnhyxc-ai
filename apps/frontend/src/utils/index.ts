import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { Toast } from '@ui/sonner';
import type {
	DownloadBlobOptions,
	DownloadOptions,
	DownloadProgress,
	DownloadResult,
} from '@/types';
import { getPlatformFetch } from './fetch';
import { isTauriRuntime } from './runtime';

export * from './cache';
export * from './clipboard';
export * from './crypto';
export * from './event';
export * from './event';
export * from './format-bytes';
export * from './knowledge-save';
export { openExternalUrl } from './open-external';
export { isTauriRuntime } from './runtime';
export * from './store';
export * from './tauri';
export * from './updater';

import { resolveUploadedFileUrl } from './upload-file-url';

export {
	encodeUploadFileUrl,
	isCrossOriginUploadUrl,
	resolveUploadedFileUrl,
	sanitizeAttachmentsForApi,
	toStorageUploadPath,
} from './upload-file-url';

/** COS / CDN 对外域名（兼容旧 VITE_QINIU_DOMAIN） */
export function getCosPublicDomainPrefix(): string {
	const raw =
		import.meta.env.VITE_COS_PUBLIC_DOMAIN ||
		import.meta.env.VITE_QINIU_DOMAIN ||
		'';
	if (!raw) return '';
	return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * 同源 COS 对象代理路径前缀（图片、PDF 等任意 MIME，展示用不落库）。
 * 默认 `/ext-cos/`，由 `VITE_COS_PROXY_PREFIX` 配置。
 */
export function getCosProxyPrefix(): string {
	const raw = import.meta.env.VITE_COS_PROXY_PREFIX || '/ext-cos/';
	const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
	return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/** 无尾部斜杠，供 Vite / Nginx location 匹配 */
export function getCosProxyPathname(): string {
	return getCosProxyPrefix().replace(/\/$/, '') || '/ext-cos';
}

/**
 * 将 COS/CDN 资源 URL 改写为同源代理路径（展示用，不落库）：
 * - **开发**（含 Tauri dev）：走 Vite `/ext-cos/` 等前缀回源，避免 ATS / mixed content
 * - **Web 生产**（HTTPS）：同上（Nginx 需配置同名 location）
 * - **Tauri 生产包**：使用原始 URL（HTTPS 桶域名需在 Info.plist / allowlist 放行）
 *
 * 持久化请存后端返回的完整 `url`（`uploadCos`）。
 */
function rewriteCosUrlToSameOriginProxy(url: string): string {
	const cosDomainRaw = getCosPublicDomainPrefix();
	const proxyPrefix = getCosProxyPrefix();
	if (!cosDomainRaw) return url;

	if (!url.startsWith(cosDomainRaw)) return url;

	const rawPath = url.slice(cosDomainRaw.length);
	return `${proxyPrefix}${rawPath}`;
}

export const resolveCosUrlForWebDisplay = (url?: string): string => {
	if (!url) return '';
	if (import.meta.env.DEV) {
		return rewriteCosUrlToSameOriginProxy(url);
	}
	if (isTauriRuntime()) return url;
	if (!import.meta.env.PROD) return url;
	return rewriteCosUrlToSameOriginProxy(url);
};

/** @deprecated 使用 resolveCosUrlForWebDisplay */
export const resolveQiniuUrlForWebDisplay = resolveCosUrlForWebDisplay;

/** 是否为 COS 持久化域名上的对象 URL */
export function isCosStoredObjectUrl(url: string): boolean {
	if (!url?.trim()) return false;
	const prefix = getCosPublicDomainPrefix();
	if (prefix && url.startsWith(prefix)) return true;
	return /^https?:\/\/[^/]+\.cos\.[^/]+\.myqcloud\.com\//i.test(url);
}

/** 是否为同源 COS 代理路径（/ext-cos/...） */
export function isCosProxyPathUrl(url: string): boolean {
	if (!url?.trim()) return false;
	const normalized = url.startsWith('/') ? url : `/${url}`;
	return normalized.startsWith(getCosProxyPrefix());
}

/** 从代理路径或 COS 完整 URL 解析对象 key（如 assets/xxx.png） */
export function extractCosObjectKey(url: string): string | null {
	const trimmed = url?.trim();
	if (!trimmed) return null;

	const tryDecodePath = (rawPath: string) => {
		const cleaned = rawPath.replace(/^\//, '');
		if (!/^(?:assets|chat)\//.test(cleaned)) return null;
		try {
			return cleaned
				.split('/')
				.map((seg) => decodeURIComponent(seg))
				.join('/');
		} catch {
			return cleaned;
		}
	};

	if (isCosProxyPathUrl(trimmed)) {
		const proxyPrefix = getCosProxyPrefix();
		return tryDecodePath(trimmed.slice(proxyPrefix.length));
	}

	if (typeof window !== 'undefined') {
		try {
			const u = new URL(trimmed, window.location.origin);
			const pathname = getCosProxyPathname();
			if (u.pathname.startsWith(`${pathname}/`)) {
				return tryDecodePath(u.pathname.slice(pathname.length + 1));
			}
		} catch {
			/* ignore */
		}
	}

	const cosPrefix = getCosPublicDomainPrefix();
	if (cosPrefix && trimmed.startsWith(cosPrefix)) {
		return tryDecodePath(trimmed.slice(cosPrefix.length));
	}

	return null;
}

/**
 * 附件展示 URL：COS 走同源 /ext-cos；历史本地上传仍走 /images、/files 或 upload/serve。
 */
export function resolveAttachmentDisplayUrl(path: string): string {
	if (!path) return path;
	if (isCosStoredObjectUrl(path) || isCosProxyPathUrl(path)) {
		return resolveCosUrlForWebDisplay(path);
	}
	return resolveUploadedFileUrl(path);
}

/** 还原为 COS 桶上的规范 HTTPS URL（供 Tauri download_file 等使用） */
export function resolveCosCanonicalObjectUrl(url: string): string {
	if (!url?.trim()) return url;
	if (url.startsWith('blob:') || url.startsWith('data:')) return url;

	const key = extractCosObjectKey(url);
	if (!key) return url;

	const domain = getCosPublicDomainPrefix();
	if (!domain) return url;

	const encodedKey = key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `${domain}${encodedKey}`;
}

/**
 * 下载用 URL：Web 走同源 /ext-cos 绝对地址；Tauri 走 COS 直链。
 */
export function resolveUrlForDownload(url: string): string {
	if (!url?.trim()) return url;
	if (url.startsWith('blob:') || url.startsWith('data:')) return url;

	if (isTauriRuntime()) {
		return resolveCosCanonicalObjectUrl(url);
	}

	if (isCosProxyPathUrl(url)) {
		const path = url.startsWith('/') ? url : `/${url}`;
		if (typeof window !== 'undefined') {
			return `${window.location.origin}${path}`;
		}
		return path;
	}

	if (isCosStoredObjectUrl(url)) {
		const proxied = rewriteCosUrlToSameOriginProxy(url);
		if (proxied.startsWith('/') && typeof window !== 'undefined') {
			return `${window.location.origin}${proxied}`;
		}
		return proxied;
	}

	return url;
}

function inferFileNameFromUrl(url: string, fallback = 'download'): string {
	try {
		const u = new URL(url, 'http://local.invalid');
		const last = u.pathname.split('/').filter(Boolean).pop();
		if (!last) return fallback;
		return decodeURIComponent(last);
	} catch {
		return fallback;
	}
}

function shouldDownloadViaFetch(url: string, resolvedUrl: string): boolean {
	if (isTauriRuntime()) return false;
	if (url.startsWith('blob:') || url.startsWith('data:')) return false;
	if (isCosProxyPathUrl(url) || isCosStoredObjectUrl(url)) return true;
	if (typeof window !== 'undefined') {
		try {
			return new URL(resolvedUrl).origin === window.location.origin;
		} catch {
			return false;
		}
	}
	return false;
}

export const setStorage = (key: string, value: string) => {
	localStorage.setItem(key, value);
	window.dispatchEvent(new Event(`${key}Changed`));
};

export const getStorage = (key: string) => {
	return localStorage.getItem(key);
};

export const removeStorage = (key: string) => {
	localStorage.removeItem(key);
	window.dispatchEvent(new Event(`${key}Changed`));
};

export const setBodyClass = (theme: string) => {
	if (theme === 'dark') {
		document.body.classList.add('dark');
	} else {
		document.body.classList.remove('dark');
	}
};

/**
 * 下载文件从URL
 */
export const downloadFileFromUrl = async (
	options: DownloadOptions,
): Promise<DownloadResult> => {
	const { url, file_name, overwrite = true, id, max_size, save_dir } = options;
	const resolvedUrl = resolveUrlForDownload(url);
	const downloadId = id ?? crypto.randomUUID?.() ?? String(Date.now());

	try {
		if (shouldDownloadViaFetch(url, resolvedUrl)) {
			const platformFetch = await getPlatformFetch();
			const response = await platformFetch(resolvedUrl, { method: 'GET' });
			if (!response.ok) {
				throw new Error(`下载失败（HTTP ${response.status}）`);
			}
			const contentType = response.headers.get('content-type') || '';
			if (contentType.includes('text/html')) {
				throw new Error('下载失败：资源不可用');
			}
			const blob = await response.blob();
			const name =
				file_name ||
				inferFileNameFromUrl(resolvedUrl, inferFileNameFromUrl(url));
			return await downloadBlob(
				{
					file_name: name,
					overwrite,
					id: downloadId,
					save_dir,
				},
				blob,
			);
		}

		if (!isTauriRuntime()) {
			const a = document.createElement('a');
			a.href = resolvedUrl;
			if (file_name) {
				a.download = file_name;
			}
			a.rel = 'noopener noreferrer';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			return {
				success: 'success',
				message: '已开始下载',
				id: downloadId,
			} as DownloadResult;
		}
		const { invoke } = await import('@tauri-apps/api/core');
		const result: DownloadResult = await invoke('download_file', {
			options: {
				url: resolvedUrl,
				file_name: file_name || inferFileNameFromUrl(resolvedUrl, 'download'),
				overwrite,
				id: downloadId,
				max_size,
				save_dir,
			},
		});
		return result;
	} catch (error) {
		return {
			success: 'error',
			message: error instanceof Error ? error.message : '下载文件失败',
			id: downloadId,
		};
	}
};

/**
 * 将前端二进制数据转为 Tauri `download_blob` 所需的字节数组。
 * Blob/File 无法被 IPC JSON 正确序列化，必须先转为 number[]。
 */
async function toDownloadBlobBytes(blobData: unknown): Promise<{
	bytes: number[];
	contentType: string | null;
}> {
	if (blobData instanceof Blob) {
		const ab = await blobData.arrayBuffer();
		return {
			bytes: Array.from(new Uint8Array(ab)),
			contentType: blobData.type || null,
		};
	}
	if (blobData instanceof ArrayBuffer) {
		return {
			bytes: Array.from(new Uint8Array(blobData)),
			contentType: null,
		};
	}
	if (blobData instanceof Uint8Array) {
		return {
			bytes: Array.from(blobData),
			contentType: null,
		};
	}
	if (Array.isArray(blobData)) {
		return { bytes: blobData as number[], contentType: null };
	}
	throw new Error(
		'downloadBlob：仅支持 Blob、ArrayBuffer、Uint8Array 或字节数组',
	);
}

/**
 * 下载Blob数据（Tauri 侧为 Vec<u8>，须传可序列化的字节数组）
 */
export const downloadBlob = async (
	options: DownloadBlobOptions,
	blobData: unknown,
): Promise<DownloadResult> => {
	try {
		if (!isTauriRuntime()) {
			const { bytes, contentType } = await toDownloadBlobBytes(blobData);
			const blob = new Blob([new Uint8Array(bytes)], {
				type: contentType || 'application/octet-stream',
			});
			const objectUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = objectUrl;
			a.download = options.file_name || 'download';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(objectUrl);
			return {
				success: 'success',
				message: '已开始下载',
				id: options.id,
			} as DownloadResult;
		}
		const { bytes, contentType } = await toDownloadBlobBytes(blobData);
		const { invoke } = await import('@tauri-apps/api/core');
		const result: DownloadResult = await invoke('download_blob', {
			options,
			blobData: bytes,
			contentType,
		});
		if (result.success) {
			Toast({
				type: result.success as 'success' | 'error',
				title: result.message,
			});
		} else {
			Toast({
				type: result.success,
				title: result.message,
			});
		}
		return result;
	} catch (error) {
		return {
			success: 'error',
			message: error instanceof Error ? error.message : '下载Blob失败',
			id: options.id,
		};
	}
};

/**
 * 保存文件到本地
 */
export const saveFileWithPicker = async (options: {
	content: string;
	file_name: string;
}): Promise<{ success: boolean; message?: string }> => {
	try {
		if (!isTauriRuntime()) {
			try {
				if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
					const handle = await (
						window as unknown as {
							showSaveFilePicker: (opts: {
								suggestedName?: string;
							}) => Promise<FileSystemFileHandle>;
						}
					).showSaveFilePicker({
						suggestedName: options.file_name,
					});
					const writable = await handle.createWritable();
					await writable.write(options.content);
					await writable.close();
					Toast({
						type: 'success',
						title: '文件保存成功',
					});
					return { success: true };
				}
			} catch {
				// 用户取消或 API 不可用，走 Blob 回退
			}
			const blob = new Blob([options.content], {
				type: 'text/plain;charset=utf-8',
			});
			const objectUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = objectUrl;
			a.download = options.file_name;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(objectUrl);
			Toast({
				type: 'success',
				title: '文件保存成功',
			});
			return { success: true };
		}
		const { invoke } = await import('@tauri-apps/api/core');
		const result = (await invoke('save_file_with_picker', { options })) as {
			success: boolean;
			message?: string;
		};
		if (result.success) {
			Toast({
				type: 'success',
				title: '文件保存成功',
			});
		} else {
			Toast({
				type: 'error',
				title: '文件保存失败',
			});
		}
		return result as { success: boolean; message?: string; file_path?: string };
	} catch (error) {
		Toast({
			type: 'error',
			title: '文件保存失败',
		});
		return {
			success: false,
			message: error instanceof Error ? error.message : '保存文件失败',
		};
	}
};

/**
 * 创建下载进度监听器
 */
export const createDownloadProgressListener = (
	setProgressInfo: React.Dispatch<React.SetStateAction<DownloadProgress[]>>,
): Promise<UnlistenFn> => {
	if (!isTauriRuntime()) {
		return Promise.resolve(() => {});
	}
	const unlistenPromise = listen('download://progress', (event) => {
		const progress = event.payload as DownloadProgress;
		setProgressInfo((prev) => {
			const idx = prev.findIndex((item) => item.id === progress.id);
			if (idx === -1) {
				return [progress, ...prev];
			}
			const next = [...prev];
			next[idx] = { ...next[idx], ...progress };
			return next;
		});
	});
	return unlistenPromise;
};

export const createUnlistenFileInfoListener = (
	setDownloadInfo?: React.Dispatch<React.SetStateAction<DownloadResult[]>>,
): Promise<UnlistenFn> => {
	if (!isTauriRuntime()) {
		return Promise.resolve(() => {});
	}
	const unlistenPromise = listen('download://progress', (event) => {
		const progress = event.payload as DownloadResult;
		setDownloadInfo?.((prev) => {
			const idx = prev.findIndex((item) => item.id === progress.id);
			if (idx === -1) {
				return [progress, ...prev];
			}
			const next = [...prev];
			next[idx] = { ...next[idx], ...progress };
			return next;
		});
	});
	return unlistenPromise;
};

/**
 * 处理网络下载并调用系统下载器
 */
export const donwnloadWithUrl = async (
	options: DownloadOptions,
	_setDownloadFileInfo?: React.Dispatch<React.SetStateAction<DownloadResult[]>>,
): Promise<DownloadResult> => {
	return downloadFileFromUrl(options);
};

/**
 * 处理图片下载（与 Upload 等组件一致：成功/失败 Toast 提示）
 */
export const handlerDownload = async (
	url: string,
	file_name?: string,
): Promise<DownloadResult> => {
	const res = await downloadFileFromUrl({ url, file_name });
	Toast({
		type: res.success,
		title: res.message,
	});
	return res;
};

// 设置首字母大写
export const capitalizeWords = (str: string) => {
	return str
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
};

// 格式化显示时间
export const formatTime = (seconds: number) => {
	const secs = Math.max(0, Math.ceil(seconds));
	return `${secs.toString()}s`;
};

// 格式化日期
export const formatDate = (date: string | Date) => {
	const d = new Date(date);
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * 通过 Tauri 的 HTTP 插件获取图片，并返回 Blob URL
 * 用于绕过浏览器的跨域资源策略限制
 */
export const fetchImageAsBlobUrl = async (url: string): Promise<string> => {
	try {
		const platformFetch = await getPlatformFetch();
		const response = await platformFetch(url, {
			method: 'GET',
		});
		if (!response.ok) {
			return '';
		}
		const arrayBuffer = await response.arrayBuffer();
		const contentType = response.headers.get('content-type') || '';
		if (contentType.includes('text/html')) {
			return '';
		}
		const blob = new Blob([arrayBuffer], {
			type: contentType || 'application/octet-stream',
		});
		return URL.createObjectURL(blob);
	} catch (_) {
		return '';
	}
};

/**
 * 清理 Blob URL 以防止内存泄漏
 */
export const revokeBlobUrl = (blobUrl: string): void => {
	if (blobUrl.startsWith('blob:')) {
		URL.revokeObjectURL(blobUrl);
	}
};

/**
 * 验证 URL 是否是合法的图片地址
 */
export const isValidImageUrl = (url: string): boolean => {
	try {
		const parsed = new URL(url);
		// 只允许 http 和 https 协议
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return false;
		}
		// 检查常见图片扩展名
		const pathname = parsed.pathname.toLowerCase();
		const imageExtensions = [
			'.jpg',
			'.jpeg',
			'.png',
			'.gif',
			'.webp',
			'.svg',
			'.bmp',
			'.tiff',
			'.ico',
		];
		const hasImageExtension = imageExtensions.some((ext) =>
			pathname.endsWith(ext),
		);
		// 如果 URL 有扩展名但不是图片扩展名，则拒绝
		if (pathname.includes('.') && !hasImageExtension) {
			return false;
		}
		// 其他情况允许通过（无扩展名或有效图片扩展名）
		return true;
	} catch {
		return false;
	}
};

/**
 * 仅保留输入中的数字（去除所有非数字），并限制长度为5位以内
 * 例如：'123abc456' => '12345'
 * 用于单词数量输入的清洗，防止非数字和超长输入
 * @param raw 原始输入字符串
 * @returns 只包含最多5位数字的字符串
 */
export function sanitizeCountDigits(raw: string): string {
	return raw.replace(/\D/g, '').slice(0, 5);
}

/** IPA 展示：已含首尾 / 则不再包一层，否则补上斜杠 */
export function displayIpaWrapped(ipa: string): string {
	const s = ipa.trim();
	if (!s) return '';
	if (s.length >= 2 && s.startsWith('/') && s.endsWith('/')) {
		return s;
	}
	return `/${s}/`;
}

/** 取消选中意图时：去掉输入框开头的自动填充意图名，保留用户后续手动输入 */
export function stripAutoFilledIntentName(
	input: string,
	snapshot: string,
): string {
	const s = snapshot.trim();
	if (!s) return input;
	if (input.trim() === s) return '';
	const raw = input;
	const lead = raw.match(/^\s*/)?.[0] ?? '';
	const rest = raw.slice(lead.length);
	if (!rest.startsWith(s)) return raw;
	const after = rest.slice(s.length).replace(/^\s+/, '');
	return lead + after;
}
