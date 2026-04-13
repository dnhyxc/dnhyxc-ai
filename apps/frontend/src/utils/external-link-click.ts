import { openExternalUrl } from './open-external';

export type AttachExternalLinkClickOptions = {
	/**
	 * 限定命中范围的选择器（默认只拦截 Markdown 预览区域内链接）。
	 * 使用 `closest()` 判断，因此支持事件来自子节点（如 <span>）。
	 */
	anchorSelector?: string;
	/**
	 * 是否跳过页内锚点 `#xxx`（默认跳过，交给本地滚动/定位逻辑处理）。
	 */
	skipHashAnchors?: boolean;
	/**
	 * 是否阻止事件继续冒泡（默认阻止，避免宿主组件重复处理）。
	 */
	stopPropagation?: boolean;
};

/**
 * 在给定容器上接管链接点击，统一用系统默认浏览器打开。
 *
 * 说明：
 * - Tauri：`openExternalUrl` 内部走 opener 插件（系统默认浏览器）。
 * - Web：`openExternalUrl` 内部走 window.open 新标签页。
 */
export function attachExternalLinkClickInterceptor(
	container: HTMLElement,
	opts: AttachExternalLinkClickOptions = {},
): () => void {
	const {
		anchorSelector = '.markdown-body a',
		skipHashAnchors = true,
		stopPropagation = true,
	} = opts;

	const onClickCapture = (e: MouseEvent) => {
		const target = e.target as HTMLElement | null;
		if (!target) return;
		const a = target.closest<HTMLAnchorElement>(anchorSelector);
		if (!a || !container.contains(a)) return;

		const href = a.getAttribute('href')?.trim() ?? '';
		if (!href) return;
		if (skipHashAnchors && href.startsWith('#')) return;

		e.preventDefault();
		if (stopPropagation) e.stopPropagation();
		void openExternalUrl(href);
	};

	container.addEventListener('click', onClickCapture, true);
	return () => container.removeEventListener('click', onClickCapture, true);
}
