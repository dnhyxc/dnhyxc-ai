/**
 * Host 应用级影院/全屏状态。
 * 插件只调 bridge `api.ui.setAppFullscreen`；壳层显隐由 Layout 订阅。
 *
 * Esc / 系统退出全屏同序：先 notify(false) 收影院与播放器最大化，再缩窗。
 * macOS 绿钮走原生 `host://will-exit-fullscreen`（缩窗动画之前），勿等 Resized。
 */
import { onListen } from '@/utils/event';
import { isTauriRuntime } from '@/utils/runtime';

export const APP_FULLSCREEN_EVENT = 'host:app-fullscreen';
/** Tauri 窗口全屏态（Rust Resized 兜底） */
export const TAURI_WINDOW_FULLSCREEN_EVENT = 'host://window-fullscreen';
/** macOS willExitFullScreen / 菜单关全屏：缩窗前一刻 */
export const TAURI_WILL_EXIT_FULLSCREEN_EVENT = 'host://will-exit-fullscreen';

type Listener = (full: boolean) => void;

let full = false;
const listeners = new Set<Listener>();

/** 本地切入全屏时忽略原生 resize，避免进场动画误清 */
let ignoreNativeUntil = 0;

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
	// 先壳层（Sidebar/Header flushSync），再插件
	for (const fn of listeners) fn(next);
	window.dispatchEvent(
		new CustomEvent(APP_FULLSCREEN_EVENT, { detail: { full: next } }),
	);
}

function getDocFullscreenElement(): Element | null {
	const doc = document as Document & {
		webkitFullscreenElement?: Element | null;
	};
	return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** Host / bridge 入口：改布局态 + 系统窗口全屏 */
export async function setAppFullscreen(next: boolean): Promise<void> {
	// 与 Esc 同序：先收影院 UI，再动系统全屏
	if (full !== next) notify(next);
	ignoreNativeUntil = Date.now() + (next ? 1000 : 200);

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
			if (!getDocFullscreenElement()) {
				await document.documentElement.requestFullscreen();
			}
		} else if (getDocFullscreenElement()) {
			await document.exitFullscreen();
		}
	} catch {
		/* 布局态已切换即可 */
	}
}

/**
 * 系统退出全屏同步（Layout 挂一次）。
 * will-exit：缩窗前先清影院（等同 Esc）；Resized / document 仅作兜底。
 */
export function installAppFullscreenExitSync(): () => void {
	const cleanups: Array<() => void> = [];

	const onDocFs = () => {
		if (Date.now() < ignoreNativeUntil) return;
		if (getDocFullscreenElement()) return;
		if (!full) return;
		if (isTauriRuntime()) return;
		void setAppFullscreen(false);
	};
	document.addEventListener('fullscreenchange', onDocFs);
	document.addEventListener('webkitfullscreenchange', onDocFs);
	cleanups.push(() => {
		document.removeEventListener('fullscreenchange', onDocFs);
		document.removeEventListener('webkitfullscreenchange', onDocFs);
	});

	if (isTauriRuntime()) {
		const willExitP = onListen(TAURI_WILL_EXIT_FULLSCREEN_EVENT, () => {
			if (!full) return;
			// 缩窗动画前立刻收影院，不被 ignore 挡住
			void setAppFullscreen(false);
		});
		cleanups.push(() => {
			void willExitP.then((un) => un());
		});

		const resizedP = onListen<boolean>(TAURI_WINDOW_FULLSCREEN_EVENT, () => {
			if (Date.now() < ignoreNativeUntil) return;
			if (!full) return;
			void setAppFullscreen(false);
		});
		cleanups.push(() => {
			void resizedP.then((un) => un());
		});
	}

	return () => {
		while (cleanups.length) cleanups.pop()?.();
	};
}
