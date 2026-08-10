/**
 * Host 应用级影院/全屏状态。
 * 插件只调 bridge `api.ui.setAppFullscreen`；壳层显隐由 Layout 订阅。
 */
import { isTauriRuntime } from '@/utils/runtime';

export const APP_FULLSCREEN_EVENT = 'host:app-fullscreen';

type Listener = (full: boolean) => void;

let full = false;
const listeners = new Set<Listener>();

export function getAppFullscreen(): boolean {
	return full;
}

export function subscribeAppFullscreen(fn: Listener): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

function notify(next: boolean) {
	full = next;
	for (const fn of listeners) fn(next);
	window.dispatchEvent(
		new CustomEvent(APP_FULLSCREEN_EVENT, { detail: { full: next } }),
	);
}

/** Host / bridge 入口：改布局态 + 系统窗口全屏 */
export async function setAppFullscreen(next: boolean): Promise<void> {
	if (full !== next) notify(next);

	if (isTauriRuntime()) {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window');
			await getCurrentWindow().setFullscreen(next);
		} catch (err) {
			console.warn('[host] setFullscreen failed', err);
		}
		return;
	}

	try {
		if (next) {
			if (!document.fullscreenElement) {
				await document.documentElement.requestFullscreen();
			}
		} else if (document.fullscreenElement) {
			await document.exitFullscreen();
		}
	} catch {
		/* 布局态已切换即可 */
	}
}
