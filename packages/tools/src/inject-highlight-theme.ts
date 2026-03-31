import type { HighlightJsThemeId } from './generated/highlight-js-theme-ids.js';
import { highlightJsThemes } from './styles.js';

/** 与 package.json 中 highlight.js 版本对齐，用于 jsDelivr CDN 路径 */
const HLJS_CDN_VERSION = '11.11.1';

const THEME_ELEMENT_ID = 'dnhyxc-ai-tools-hljs-theme';
const THEME_MARK_ATTR = 'data-dnhyxc-ai-tools-hljs';

function removeInjectedTheme(): void {
	if (typeof document === 'undefined') return;
	const el = document.getElementById(THEME_ELEMENT_ID);
	if (el) {
		el.remove();
	}
}

export interface ApplyHighlightJsThemeOptions {
	/** 合法 id 见类型 HighlightJsThemeId（与 highlightJsThemes 键一致） */
	themeId?: HighlightJsThemeId;
	/** 主题 CSS 全文；若传入则优先使用内联 <style>，不请求 CDN（适合离线、Tauri、?raw 打包进 JS） */
	themeCss?: string;
	onError?: (error: unknown) => void;
}

/**
 * 在 document.head 注入 highlight.js 代码块主题（全局唯一节点，重复调用会替换上一主题）。
 * SSR 或无 document 环境下为 no-op。
 */
export function applyHighlightJsTheme(
	options: ApplyHighlightJsThemeOptions,
): void {
	if (typeof document === 'undefined') return;

	const { themeId, themeCss, onError } = options;
	if (themeCss === undefined && !themeId) return;

	removeInjectedTheme();

	// 显式传入空字符串：仅移除已注入主题，不再挂新样式
	if (themeCss !== undefined) {
		if (themeCss) {
			const style = document.createElement('style');
			style.id = THEME_ELEMENT_ID;
			style.setAttribute(THEME_MARK_ATTR, themeId || 'inline');
			style.textContent = themeCss;
			document.head.appendChild(style);
		}
		return;
	}

	if (themeId) {
		if (!(themeId in highlightJsThemes)) {
			onError?.(new Error(`未知的 highlight.js 主题 id: "${themeId}"`));
			return;
		}

		const pathSeg = themeId.endsWith('.min.css')
			? themeId
			: `${themeId}.min.css`;
		const href = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@${HLJS_CDN_VERSION}/build/styles/${pathSeg.replace(/^\//, '')}`;

		const link = document.createElement('link');
		link.id = THEME_ELEMENT_ID;
		link.rel = 'stylesheet';
		link.href = href;
		link.setAttribute(THEME_MARK_ATTR, themeId);
		link.onerror = () => {
			onError?.(
				new Error(
					`无法从 CDN 加载 highlight.js 主题: ${themeId}（请检查网络或使用 highlightThemeCss）`,
				),
			);
		};
		document.head.appendChild(link);
	}
}

/** 移除由 applyHighlightJsTheme 注入的 link/style（切换路由或单测清理时可调用） */
export function clearAppliedHighlightJsTheme(): void {
	removeInjectedTheme();
}
