import { isTauriRuntime } from './runtime';

/**
 * 在系统浏览器或新标签页中打开链接。
 * Tauri：经 core.invoke 调 opener（避免动态 import `@tauri-apps/plugin-opener`
 * 在 Vite 长跑 HMR 后触发 504 Outdated Optimize Dep）。
 * Web：window.open。
 *
 * 与 markdown-kit `patchExternalLinksOpenBlank`（仅补 target=_blank）互补：桌面须走本函数
 * 才能进系统浏览器。见 `docs/tools/外链新标签打开.md` §5。
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

/**
 * 在系统文件管理器中选中并显示文件（macOS 访达 / Windows 资源管理器）。仅 Tauri 可用。
 */
export async function revealItemInDir(path: string): Promise<void> {
	if (!path || !isTauriRuntime()) return;
	const { invoke } = await import('@tauri-apps/api/core');
	await invoke('plugin:opener|reveal_item_in_dir', { paths: [path] });
}
