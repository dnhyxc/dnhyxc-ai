/**
 * 二次封装入口：视觉与交互以 `@/components/ui/context-menu` 为单一事实来源；
 * `primitives` 在 UI 之上增加 `memo` 边界；`QuickContextMenu` 提供声明式 `items`。
 * 若需与 UI 完全一致（无 memo），请使用 `ContextMenuUi` 命名空间。
 */

export * as ContextMenuUi from '@/components/ui/context-menu';
export * from './primitives';
export {
	QuickContextMenu,
	type QuickContextMenuProps,
} from './QuickContextMenu';
export * from './types';
