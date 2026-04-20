/**
 * Markdown 页内锚点（目录 TOC、`href="#..."`）与滚动视口对齐的公共逻辑。
 *
 * - 与 `docs/monaco/markdown-preview-toc-hash-navigation.md` §9 文档同步维护。
 * - 宿主（Monaco 预览、聊天气泡等）只提供「DOM 根」与「滚动写入口」；禁止在业务里复制粘贴同一套 click 逻辑。
 */
import type { RefObject } from 'react';
import { useEffect } from 'react';
import { scrollPreviewViewportToRevealElement } from '@/components/design/Monaco/utils';
import { attachExternalLinkClickInterceptor } from '@/utils/external-link-click';

/** 与 `attachExternalLinkClickInterceptor` 默认一致：只处理正文区域内的 `<a>` */
const DEFAULT_ANCHOR_SELECTOR = '.markdown-body a';

export type AttachMarkdownHashLinkNavigationOptions = {
	/** 与 `attachExternalLinkClickInterceptor` 的 `anchorSelector` 一致 */
	anchorSelector?: string;
	/** 写入视口滚动时的 behavior（默认 smooth） */
	scrollBehavior?: ScrollBehavior;
};

/**
 * 在 Markdown 宿主根节点上挂载：外链拦截（`#` 仅 `preventDefault`）+ 冒泡 `click` 处理目录/页内锚点。
 *
 * - 在 **整棵 `host` 子树** 内 `querySelector('#id')`，兼容多块 `.markdown-body`（Mermaid 拆岛等）。
 * - 使用 `scrollPreviewViewportToRevealElement`，**禁止**对标题 `scrollIntoView`，避免滚动链误滚 Layout。
 *
 * 非 React 或需与 `bindMarkdownCodeFenceActions` 等同层合并时可用本函数；否则优先用 `useMarkdownHashLinkViewportScroll`。
 *
 * @returns 卸载函数：移除监听并撤掉外链拦截
 */
export function attachMarkdownHashLinkNavigation(
	host: HTMLElement,
	getViewport: () => HTMLElement | null,
	options?: AttachMarkdownHashLinkNavigationOptions,
): () => void {
	const anchorSelector = options?.anchorSelector ?? DEFAULT_ANCHOR_SELECTOR;
	const behavior = options?.scrollBehavior ?? 'smooth';

	// 捕获阶段：# 链接必须 preventDefault，否则仍会片段导航误滚 Layout（详见 external-link-click）
	const detachInterceptor = attachExternalLinkClickInterceptor(host, {
		anchorSelector,
		skipHashAnchors: true,
		stopPropagation: true,
	});

	// 冒泡阶段：在 host 整棵子树解析目标 id（多块 .markdown-body / Mermaid 拆岛），只改 getViewport() 返回的 scrollTop
	const onClick = (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!host.contains(target)) return;

		const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
		if (!link) return;
		const href = link.getAttribute('href');
		// 排除 href="#" 单独占位
		if (!href || href.length <= 1) return;
		const raw = href.slice(1);
		// 与表单语义对齐：+ 视作空格；decodeURIComponent 兼容中文等百分号编码
		const id = decodeURIComponent(raw.replace(/\+/g, ' '));
		if (!id) return;

		let dest: Element | null = null;
		try {
			// 必须在 host 根上查，勿只用首个 .markdown-body（拆岛后目录与标题可能不在同一段）
			dest = host.querySelector(`#${CSS.escape(id)}`);
		} catch {
			dest = null;
		}
		if (!(dest instanceof HTMLElement)) return;

		e.preventDefault();
		e.stopPropagation();
		link.blur();
		const vp = getViewport();
		if (vp) {
			// 禁止对 dest 使用 scrollIntoView，避免滚动链带动外层 Outlet
			scrollPreviewViewportToRevealElement(vp, dest, { behavior });
		}
	};

	host.addEventListener('click', onClick);
	return () => {
		detachInterceptor();
		host.removeEventListener('click', onClick);
	};
}

export type UseMarkdownHashLinkViewportScrollOptions =
	AttachMarkdownHashLinkNavigationOptions & {
		/** 为 false 时不挂载监听 */
		enabled?: boolean;
	};

/**
 * React 封装：在 `containerRef` 指向的宿主根上处理 Markdown 目录/页内 `#` 链接滚动。
 *
 * `getViewport` 在**每次点击**时调用，请返回实际写入 `scrollTop` 的节点（如 Radix `ScrollArea` Viewport）；
 * 聊天侧可在 ref 为空时用 `closest('[data-slot="scroll-area-viewport"]')` 等逻辑写在回调内。
 *
 * 实录与设计说明见 `docs/monaco/markdown-preview-toc-hash-navigation.md`。
 */
export function useMarkdownHashLinkViewportScroll(
	containerRef: RefObject<HTMLElement | null>,
	getViewport: () => HTMLElement | null,
	options?: UseMarkdownHashLinkViewportScrollOptions,
): void {
	const { enabled = true, anchorSelector, scrollBehavior } = options ?? {};

	useEffect(() => {
		if (!enabled) return;
		const el = containerRef.current;
		if (!el) return;
		// 依赖 getViewport 引用：宿主用 useCallback 稳定化，避免无关重挂载
		return attachMarkdownHashLinkNavigation(el, getViewport, {
			anchorSelector,
			scrollBehavior,
		});
	}, [containerRef, getViewport, enabled, anchorSelector, scrollBehavior]);
}
