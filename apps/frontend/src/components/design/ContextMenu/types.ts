import type { ReactNode } from 'react';

/** 分隔线项 */
export type QuickContextMenuSeparator = {
	type: 'separator';
	/** 列表渲染用 key，缺省则使用索引 */
	id?: string;
};

/** 普通可点击项 */
export type QuickContextMenuItem = {
	type: 'item';
	id: string;
	label: ReactNode;
	disabled?: boolean;
	inset?: boolean;
	variant?: 'default' | 'destructive';
	shortcut?: string;
	onSelect?: (event: Event) => void;
};

/** 子菜单 */
export type QuickContextMenuSub = {
	type: 'sub';
	id: string;
	label: ReactNode;
	disabled?: boolean;
	inset?: boolean;
	items: readonly QuickContextMenuEntry[];
};

export type QuickContextMenuEntry =
	| QuickContextMenuSeparator
	| QuickContextMenuItem
	| QuickContextMenuSub;
