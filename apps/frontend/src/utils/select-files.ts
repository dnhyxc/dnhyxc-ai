/**
 * 通用本地文件选择（Tauri 系统对话框 / Web `<input type="file">`）。
 *
 * ---------------------------------------------------------------------------
 * 何时用
 * ---------------------------------------------------------------------------
 * - **只要路径（桌面）**：`selectFile` / `selectFiles` / `pickLocalFiles`（仅 Tauri）
 * - **要 File（上传 / 读文本，跨端）**：`pickFileObject` / `pickFileObjects`
 * - **只要 Web input**：`pickBrowserFile` / `pickBrowserFiles`
 * - 大视频等勿用 `pickFileObject`（会读入内存）；桌面播放大文件用路径 + `convertFileSrc`
 *
 * ---------------------------------------------------------------------------
 * 导入
 * ---------------------------------------------------------------------------
 * ```ts
 * import {
 *   pickLocalFiles,
 *   selectFile,
 *   pickFileObject,
 *   pickBrowserFiles,
 * } from '@/utils';
 * ```
 *
 * ---------------------------------------------------------------------------
 * 路径 API（仅 Tauri）
 * ---------------------------------------------------------------------------
 * ```ts
 * const path = await pickLocalFiles({ accept: '.md' });
 * const videos = await pickLocalFiles({
 *   accept: '.mp4,.webm,.mov',
 *   multiple: true,
 * });
 * ```
 *
 * ---------------------------------------------------------------------------
 * File API（Web + Tauri）
 * ---------------------------------------------------------------------------
 * ```ts
 * const file = await pickFileObject({
 *   accept: '.svg',
 *   maxBytes: 2 * 1024 * 1024,
 *   title: '选择图标',
 * });
 * if (!file) return; // 取消
 *
 * const files = await pickFileObjects({
 *   accept: '.json',
 *   multiple: true,
 * });
 * ```
 *
 * ---------------------------------------------------------------------------
 * 参数
 * ---------------------------------------------------------------------------
 * | 字段       | 默认     | 说明 |
 * |-----------|----------|------|
 * | `accept`  | 不传/空  | HTML 风格扩展名，如 `.mp4,.webm`；不传则不限制 |
 * | `multiple`| `false`  | 多选 |
 * | `title`   | 不传     | 对话框标题（Tauri；Web 忽略） |
 * | `maxBytes`| 不传     | 单文件上限；超出 throw `file_too_large` |
 *
 * ---------------------------------------------------------------------------
 * 返回值与错误
 * ---------------------------------------------------------------------------
 * - 取消 / 未选 → `null`
 * - 扩展名不符 → throw `Error('accept')`
 * - 超限 → throw `Error('file_too_large')`
 * - 读失败 → throw `Error('read_failed')`
 */

import { isTauriRuntime } from './runtime';

export type SelectFilesOptions = {
	/** 如 `.mp4,.webm,.mov`；不传/空串 = 任意文件 */
	accept?: string;
	/** 默认 false（单选） */
	multiple?: boolean;
	/** 系统对话框标题（Tauri） */
	title?: string;
};

export type PickFileObjectOptions = SelectFilesOptions & {
	/** 单文件最大字节；超出 throw `file_too_large` */
	maxBytes?: number;
};

/** 从 accept 抽出 `.ext`（与 Rust 侧规则一致，供二次校验） */
export function parseAcceptExtensions(accept: string | undefined): string[] {
	if (!accept?.trim()) return [];
	const out: string[] = [];
	for (const part of accept.split(',')) {
		const s = part.trim();
		if (!s.startsWith('.') || s.length < 2) continue;
		const ext = s.slice(1).trim().toLowerCase();
		if (!ext || ext.includes('*') || ext.includes('/')) continue;
		if (!out.includes(ext)) out.push(ext);
	}
	return out;
}

export function fileNameFromPath(path: string): string {
	const parts = path.split(/[/\\]/).filter(Boolean);
	return parts[parts.length - 1] ?? path;
}

export function nameMatchesAccept(
	name: string,
	accept: string | undefined,
): boolean {
	const exts = parseAcceptExtensions(accept);
	if (exts.length === 0) return true;
	const lower = name.toLowerCase();
	return exts.some((ext) => lower.endsWith(`.${ext}`));
}

function pathMatchesAccept(path: string, accept: string | undefined): boolean {
	return nameMatchesAccept(path, accept);
}

function isCanceled(e: unknown): boolean {
	const msg = e instanceof Error ? e.message : String(e ?? '');
	return msg.includes('canceled') || msg.includes('未选择');
}

function assertAccept(name: string, accept: string | undefined): void {
	if (!nameMatchesAccept(name, accept)) {
		throw new Error('accept');
	}
}

function assertMaxBytes(size: number, maxBytes: number | undefined): void {
	if (maxBytes != null && size > maxBytes) {
		throw new Error('file_too_large');
	}
}

function mimeFromName(name: string): string {
	const lower = name.toLowerCase();
	const dot = lower.lastIndexOf('.');
	const ext = dot >= 0 ? lower.slice(dot + 1) : '';
	switch (ext) {
		case 'svg':
			return 'image/svg+xml';
		case 'json':
			return 'application/json';
		case 'md':
		case 'markdown':
			return 'text/markdown';
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'pdf':
			return 'application/pdf';
		default:
			return 'application/octet-stream';
	}
}

/** 底层 invoke：始终返回路径数组；取消 null（仅 Tauri） */
async function invokeSelectFilesRaw(
	options: SelectFilesOptions = {},
): Promise<string[] | null> {
	const { invoke } = await import('@tauri-apps/api/core');
	try {
		const paths = await invoke<string[]>('select_files', {
			input: {
				...(options.accept?.trim() ? { accept: options.accept.trim() } : {}),
				...(options.multiple === true ? { multiple: true } : {}),
				...(options.title?.trim() ? { title: options.title.trim() } : {}),
			},
		});
		const accept = options.accept?.trim() || undefined;
		const filtered = (paths ?? []).filter((p) => pathMatchesAccept(p, accept));
		return filtered.length > 0 ? filtered : null;
	} catch (e) {
		if (isCanceled(e)) return null;
		throw e;
	}
}

/** 单选：返回路径；取消 null（仅 Tauri） */
export async function selectFile(
	options?: Omit<SelectFilesOptions, 'multiple'>,
): Promise<string | null> {
	const paths = await invokeSelectFilesRaw({ ...options, multiple: false });
	return paths?.[0] ?? null;
}

/** 多选：返回路径数组；取消 null（仅 Tauri） */
export async function selectFiles(
	options?: Omit<SelectFilesOptions, 'multiple'> & { multiple?: true },
): Promise<string[] | null> {
	return invokeSelectFilesRaw({ ...options, multiple: true });
}

/**
 * 统一路径入口（仅 Tauri）：默认单选 `string | null`；`multiple: true` → `string[] | null`。
 */
export async function pickLocalFiles(
	options?: SelectFilesOptions & { multiple?: false },
): Promise<string | null>;
export async function pickLocalFiles(
	options: SelectFilesOptions & { multiple: true },
): Promise<string[] | null>;
export async function pickLocalFiles(
	options: SelectFilesOptions = {},
): Promise<string | string[] | null> {
	const paths = await invokeSelectFilesRaw(options);
	if (paths == null) return null;
	return options.multiple === true ? paths : (paths[0] ?? null);
}

/**
 * Web：隐藏 `<input type="file">`；取消 null；扩展名/大小不符 throw。
 * 项目内 Web 选文件统一走此函数。
 */
export function pickBrowserFiles(
	options: PickFileObjectOptions = {},
): Promise<File[] | null> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		if (options.accept?.trim()) input.accept = options.accept.trim();
		input.multiple = options.multiple === true;
		input.style.display = 'none';
		document.body.appendChild(input);

		const cleanup = () => input.remove();

		input.addEventListener('change', () => {
			const list = Array.from(input.files ?? []);
			cleanup();
			if (!list.length) {
				resolve(null);
				return;
			}
			try {
				for (const f of list) {
					assertAccept(f.name, options.accept);
					assertMaxBytes(f.size, options.maxBytes);
				}
				resolve(list);
			} catch (e) {
				reject(e);
			}
		});

		input.addEventListener('cancel', () => {
			cleanup();
			resolve(null);
		});

		input.click();
	});
}

/** Web 单选 File；取消 null */
export async function pickBrowserFile(
	options?: Omit<PickFileObjectOptions, 'multiple'>,
): Promise<File | null> {
	const files = await pickBrowserFiles({ ...options, multiple: false });
	return files?.[0] ?? null;
}

/** Tauri 路径 → File（小文件；经 convertFileSrc） */
async function pathsToFileObjects(
	paths: string[],
	options: PickFileObjectOptions,
): Promise<File[]> {
	const { convertFileSrc } = await import('@tauri-apps/api/core');
	const out: File[] = [];
	for (const path of paths) {
		const name = fileNameFromPath(path);
		assertAccept(name, options.accept);
		const res = await fetch(convertFileSrc(path));
		if (!res.ok) throw new Error('read_failed');
		const buf = await res.arrayBuffer();
		assertMaxBytes(buf.byteLength, options.maxBytes);
		out.push(
			new File([buf], name, {
				type: mimeFromName(name),
				lastModified: Date.now(),
			}),
		);
	}
	return out;
}

/**
 * 跨端选 File[]：Web → input；Tauri → 系统对话框 + asset 读入。
 * 适合图标 / JSON / Markdown 等小文件上传或读文本；大媒体请用 `pickLocalFiles` + 路径。
 */
export async function pickFileObjects(
	options: PickFileObjectOptions = {},
): Promise<File[] | null> {
	if (!isTauriRuntime()) {
		return pickBrowserFiles(options);
	}
	const paths = await invokeSelectFilesRaw(options);
	if (!paths?.length) return null;
	return pathsToFileObjects(paths, options);
}

/** 跨端单选 File；取消 null */
export async function pickFileObject(
	options?: Omit<PickFileObjectOptions, 'multiple'>,
): Promise<File | null> {
	const files = await pickFileObjects({ ...options, multiple: false });
	return files?.[0] ?? null;
}
