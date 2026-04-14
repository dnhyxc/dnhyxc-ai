/**
 * Mermaid 围栏顶栏：在 ScrollArea viewport 内 `sticky` 吸顶；粘顶后与代码块浮动工具条视觉对齐。
 * 设计背景、哨兵 + IntersectionObserver 约定及与 Portal 方案对比见仓库根目录文档：
 * `docs/mermaid-fence-toolbar-sticky.md`
 */
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** 吸顶后与 ChatCodeFloatingToolbar（`ChatCodeToolBar/index.tsx`）工具条视觉一致 */
const MERMAID_TOOLBAR_PINNED_CHROME =
	'rounded-md bg-theme-background/50 shadow-[0_4px_10px_-4px_color-mix(in_oklch,var(--theme-background)_40%,black)] backdrop-blur-[2px]';

/** 未吸顶时与历史实现一致（仅圆角与背景，无阴影/毛玻璃/额外内边距） */
const MERMAID_TOOLBAR_RESTING_CHROME = 'rounded-t-md bg-theme-background/50';

export type MermaidFenceToolbarProps = {
	/** 用于 Observer 在 block 切换时重建 */
	blockId: string;
	children: ReactNode;
};

/**
 * 通过哨兵节点判断是否已 sticky 粘顶，仅在粘顶时切换为与代码块浮动工具条一致的样式。
 */
export function MermaidFenceToolbar({
	blockId,
	children,
}: MermaidFenceToolbarProps) {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [isPinned, setIsPinned] = useState(false);

	useLayoutEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		// 与 ChatBotView 消息列表一致：滚动容器为 Radix ScrollArea 的 Viewport
		const root = sentinel.closest<HTMLElement>(
			'[data-slot="scroll-area-viewport"]',
		);
		const io = new IntersectionObserver(
			([e]) => {
				// 哨兵先于 sticky 条离开 root 可见区 → 条已贴在滚动区域顶边
				setIsPinned(!e.isIntersecting);
			},
			// root 为 null 时按规范等价于视口，非 ScrollArea 场景下粘顶判定可能略偏差
			{ root, rootMargin: '0px', threshold: 0 },
		);
		io.observe(sentinel);
		return () => io.disconnect();
	}, [blockId]);

	return (
		<>
			<div
				ref={sentinelRef}
				className="h-px w-full shrink-0 pointer-events-none"
				aria-hidden
			/>
			<div
				className={cn(
					'sticky top-0 z-10 flex h-8 select-none items-center justify-between gap-2',
					isPinned
						? MERMAID_TOOLBAR_PINNED_CHROME
						: MERMAID_TOOLBAR_RESTING_CHROME,
				)}
			>
				{children}
			</div>
		</>
	);
}
