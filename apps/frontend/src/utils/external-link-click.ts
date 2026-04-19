import { openExternalUrl } from './open-external';

export type AttachExternalLinkClickOptions = {
	/**
	 * 限定命中范围的选择器（默认只拦截 Markdown 预览区域内链接）。
	 * 使用 `closest()` 判断，因此支持事件来自子节点（如 <span>）。
	 */
	anchorSelector?: string;
	/**
	 * 是否跳过页内锚点 `#xxx`（默认跳过，交给本地滚动/定位逻辑处理）。
	 *
	 * 为 true 且 `href` 以 `#` 开头时：拦截器会在捕获阶段调用 **`preventDefault()`**，
	 * 以阻止浏览器的「片段导航」去滚动错误的滚动祖先（例如 Layout 里包裹 Outlet 的 `overflow-y-auto`）。
	 * 此分支**不会** `stopPropagation`，以便同一容器上的冒泡监听仍能完成「仅滚预览 Viewport」等逻辑。
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
 *
 * 页内锚点（`skipHashAnchors`）：见类型字段说明；实录见 `docs/monaco/markdown-preview-toc-hash-navigation.md`。
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
		// 仅取消默认，不 stopPropagation：冒泡阶段由宿主（如 Monaco preview）在预览 Viewport 上写入 scrollTop
		// 若此处不 preventDefault，浏览器仍会做片段导航并滚动「最近可滚动祖先」（含 Layout 的 Outlet）
		if (skipHashAnchors && href.startsWith('#')) {
			e.preventDefault();
			return;
		}

		e.preventDefault();
		if (stopPropagation) e.stopPropagation();
		void openExternalUrl(href);
	};

	container.addEventListener('click', onClickCapture, true);
	return () => container.removeEventListener('click', onClickCapture, true);
}
