import { isTauriRuntime } from './runtime';

/** 在系统浏览器或新标签页中打开链接（Tauri 用 opener 插件，Web 用 window.open） */
export async function openExternalUrl(url: string): Promise<void> {
	if (!url) return;
	if (isTauriRuntime()) {
		const { openUrl } = await import('@tauri-apps/plugin-opener');
		await openUrl(url);
		return;
	}
	window.open(url, '_blank', 'noopener,noreferrer');
}
