import {
	PositionedQuickMenu,
	type PositionedQuickMenuState,
	type QuickContextMenuEntry,
} from '@design/ContextMenu';

export type EpubReaderContextMenuState = PositionedQuickMenuState & {
	hasSelection: boolean;
};

type Props = {
	state: EpubReaderContextMenuState | null;
	items: readonly QuickContextMenuEntry[];
	onOpenChange: (open: boolean) => void;
};

/**
 * 锚定在鼠标位置的 EPUB 右键菜单（iframe 内右键无法使用 QuickContextMenu 的 Trigger 包裹）。
 */
export function EpubReaderContextMenu({ state, items, onOpenChange }: Props) {
	return (
		<PositionedQuickMenu
			state={state}
			items={items}
			onOpenChange={onOpenChange}
		/>
	);
}
