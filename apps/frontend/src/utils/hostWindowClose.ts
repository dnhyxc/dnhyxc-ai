/**
 * Tauri 托管关窗：Rust prevent_close → eval / emit → await 保存 → destroy。
 */
import { LEARNING_NOTES_POPOUT_LABEL } from '@/views/englishLearning/notes/labels';
import { isTauriRuntime } from './runtime';

export type HostWindowCloseHandler = () => void | Promise<void>;

export const HOST_WINDOW_CLOSE_EVENT = 'host://host-window-close';

declare global {
	interface Window {
		__DNHYXC_HOST_WINDOW_CLOSE__?: (label: string) => void;
	}
}

export const MANAGED_HOST_WINDOW_LABELS = new Set<string>([
	LEARNING_NOTES_POPOUT_LABEL,
]);

const handlers = new Map<string, Set<HostWindowCloseHandler>>();
const inflight = new Map<string, Promise<void>>();

let bridgeInstalled = false;

export function registerHostWindowCloseHandler(
	label: string,
	handler: HostWindowCloseHandler,
): () => void {
	if (!handlers.has(label)) handlers.set(label, new Set());
	handlers.get(label)!.add(handler);
	return () => {
		handlers.get(label)?.delete(handler);
	};
}

async function runManagedWindowClose(label: string): Promise<void> {
	if (!MANAGED_HOST_WINDOW_LABELS.has(label)) return;
	const existing = inflight.get(label);
	if (existing) return existing;

	const job = (async () => {
		for (const fn of handlers.get(label) ?? []) {
			try {
				await fn();
			} catch (e) {
				console.warn('[hostWindowClose] handler failed', label, e);
			}
		}
		const { invoke } = await import('@tauri-apps/api/core');
		await invoke('close_webview_window', { label });
	})();

	inflight.set(label, job);
	try {
		await job;
	} finally {
		inflight.delete(label);
	}
}

export function installHostWindowCloseBridge(): void {
	if (!isTauriRuntime() || bridgeInstalled) return;
	bridgeInstalled = true;

	window.__DNHYXC_HOST_WINDOW_CLOSE__ = (label: string) => {
		void runManagedWindowClose(label);
	};

	void (async () => {
		const { getCurrentWebviewWindow } = await import(
			'@tauri-apps/api/webviewWindow'
		);
		const { listen } = await import('@tauri-apps/api/event');
		const win = getCurrentWebviewWindow();
		const label = win.label;
		if (!MANAGED_HOST_WINDOW_LABELS.has(label)) return;

		const onClose = () => runManagedWindowClose(label);

		await win.onCloseRequested(async (event) => {
			event.preventDefault();
			await onClose();
		});

		await listen<string>(HOST_WINDOW_CLOSE_EVENT, (ev) => {
			if (ev.payload === label) void onClose();
		});
	})();
}
