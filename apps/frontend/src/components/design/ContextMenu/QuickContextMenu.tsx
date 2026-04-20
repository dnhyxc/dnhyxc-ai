import * as React from 'react';
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from './primitives';
import type { QuickContextMenuEntry } from './types';

export interface QuickContextMenuProps {
	/** 右键/长按触发区域；默认 `triggerAsChild` 为 true 时需为单个可合并 props 的子元素 */
	children: React.ReactNode;
	/** 菜单结构（建议调用方用 `useMemo` 稳定引用以减少子树重渲染） */
	items: readonly QuickContextMenuEntry[];
	/** 与 Radix Trigger 一致：为 true 时不包裹额外 DOM */
	triggerAsChild?: boolean;
	/** 弹层容器 className */
	contentClassName?: string;
	/** 透传 Radix Root */
	onOpenChange?: (open: boolean) => void;
	modal?: boolean;
}

function QuickMenuEntries({
	entries,
}: {
	entries: readonly QuickContextMenuEntry[];
}) {
	return entries.map((entry, index) => {
		if (entry.type === 'separator') {
			return <ContextMenuSeparator key={entry.id ?? `sep-${index}`} />;
		}
		if (entry.type === 'sub') {
			return (
				<ContextMenuSub key={entry.id}>
					<ContextMenuSubTrigger disabled={entry.disabled} inset={entry.inset}>
						{entry.label}
					</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<QuickMenuEntries entries={entry.items} />
					</ContextMenuSubContent>
				</ContextMenuSub>
			);
		}
		return (
			<ContextMenuItem
				key={entry.id}
				disabled={entry.disabled}
				inset={entry.inset}
				variant={entry.variant}
				onSelect={entry.onSelect}
			>
				{entry.label}
				{entry.shortcut != null && entry.shortcut !== '' ? (
					<ContextMenuShortcut>{entry.shortcut}</ContextMenuShortcut>
				) : null}
			</ContextMenuItem>
		);
	});
}

/**
 * 声明式右键菜单：用数据描述 `items`，内部仍走 UI 层与 Radix 行为。
 * 复杂布局可改用同目录导出的 `ContextMenu*` 原语自行组合。
 */
export const QuickContextMenu = React.memo(function QuickContextMenu({
	children,
	items,
	triggerAsChild = true,
	contentClassName,
	onOpenChange,
	modal,
}: QuickContextMenuProps) {
	return (
		<ContextMenu onOpenChange={onOpenChange} modal={modal}>
			<ContextMenuTrigger asChild={triggerAsChild}>
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent className={contentClassName}>
				<QuickMenuEntries entries={items} />
			</ContextMenuContent>
		</ContextMenu>
	);
});
QuickContextMenu.displayName = 'QuickContextMenu';
