import { isTauriRuntime } from './runtime';

/**
 * 在系统浏览器或新标签页中打开链接。
 * Tauri：经 core.invoke 调 opener（避免动态 import `@tauri-apps/plugin-opener`
 * 在 Vite 长跑 HMR 后触发 504 Outdated Optimize Dep）。
 * Web：window.open。
 */
export async function openExternalUrl(url: string): Promise<void> {
	if (!url) return;
	if (isTauriRuntime()) {
		try {
			const { invoke } = await import('@tauri-apps/api/core');
			await invoke('plugin:opener|open_url', { url });
			return;
		} catch {
			// opener 不可用时回退，至少不吞掉点击
		}
	}
	window.open(url, '_blank', 'noopener,noreferrer');
}
