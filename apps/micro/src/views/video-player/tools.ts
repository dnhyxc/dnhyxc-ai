/**
 * 视频播放器常量与工具函数
 * 对齐 src/views/tools/VideoPlayer/tools.ts（去除裁剪相关 captureFrame）
 */

export const LIMIT = 100; // 最大上传视频数量

export const PLAY_OPTIONS = [
	{ label: '自动切换', value: 'auto' as const },
	{ label: '循环播放', value: 'loop' as const },
	{ label: '播完暂停', value: 'stop' as const },
];

export const SCREEN_TYPE = [
	{ label: '自动', value: 'auto' as const },
	{ label: '镜像', value: 'mirror' as const },
];

export type PlayType = (typeof PLAY_OPTIONS)[number]['value'];
export type ScreenType = (typeof SCREEN_TYPE)[number]['value'];

export interface VideoUrlList {
	url: string;
	name: string;
	size: number;
	type: string;
	file?: File;
}

/**
 * 将秒数格式化为 HH:MM:SS 或 MM:SS
 * @param time 秒
 * @param withHours 是否强制显示小时位
 */
export function formatTime(time: number, withHours = false): string {
	if (time === undefined || time === null || Number.isNaN(time)) {
		return '00:00';
	}
	const h = Math.floor(time / 3600);
	const m = Math.floor((time % 3600) / 60);
	const s = Math.floor(time % 60);
	const pad = (n: number) => String(n).padStart(2, '0');
	if (h > 0 || withHours) {
		return `${pad(h)}:${pad(m)}:${pad(s)}`;
	}
	return `${pad(m)}:${pad(s)}`;
}

export function formatDate(
	timestamp: number,
	format = 'YYYY.MM.DD.HH.mm.ss',
): string {
	const d = new Date(timestamp);
	const pad = (n: number) => String(n).padStart(2, '0');
	return format
		.replace('YYYY', String(d.getFullYear()))
		.replace('MM', pad(d.getMonth() + 1))
		.replace('DD', pad(d.getDate()))
		.replace('HH', pad(d.getHours()))
		.replace('mm', pad(d.getMinutes()))
		.replace('ss', pad(d.getSeconds()));
}

type FsEl = HTMLElement & {
	webkitRequestFullscreen?: () => Promise<void> | void;
	webkitRequestFullScreen?: () => Promise<void> | void;
	mozRequestFullScreen?: () => Promise<void> | void;
	msRequestFullscreen?: () => Promise<void> | void;
};

type FsDoc = Document & {
	webkitFullscreenElement?: Element | null;
	webkitExitFullscreen?: () => Promise<void> | void;
	webkitCancelFullScreen?: () => Promise<void> | void;
	mozCancelFullScreen?: () => Promise<void> | void;
	msExitFullscreen?: () => Promise<void> | void;
};

export function getFullscreenElement(): Element | null {
	const doc = document as FsDoc;
	return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

/** 元素全屏；失败时返回 'css' 由调用方挂 CSS 全屏 class */
export async function enterFullscreen(
	el: HTMLElement,
): Promise<'native' | 'css'> {
	const node = el as FsEl;
	const req =
		el.requestFullscreen?.bind(el) ||
		node.webkitRequestFullscreen?.bind(node) ||
		node.webkitRequestFullScreen?.bind(node) ||
		node.mozRequestFullScreen?.bind(node) ||
		node.msRequestFullscreen?.bind(node);
	if (!req) return 'css';
	try {
		await Promise.resolve(req());
		return 'native';
	} catch {
		return 'css';
	}
}

export async function exitFullscreen(): Promise<void> {
	if (!getFullscreenElement()) return;
	const doc = document as FsDoc;
	const exit =
		document.exitFullscreen?.bind(document) ||
		doc.webkitExitFullscreen?.bind(doc) ||
		doc.webkitCancelFullScreen?.bind(doc) ||
		doc.mozCancelFullScreen?.bind(doc) ||
		doc.msExitFullscreen?.bind(doc);
	if (!exit) return;
	try {
		await Promise.resolve(exit());
	} catch {
		/* ignore */
	}
}

/**
 * 无 Host 影院态时的默认实现（独立预览 / mockHost 同源）：document 全屏。
 * 嵌入主站时由 Host `api.ui.setAppFullscreen` 覆盖。
 */
export async function setDocumentAppFullscreen(full: boolean): Promise<void> {
	try {
		if (full) {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen();
			}
		} else if (document.fullscreenElement) {
			await document.exitFullscreen();
		}
	} catch {
		/* ignore */
	}
}
