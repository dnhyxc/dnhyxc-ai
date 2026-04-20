/**
 * 对 `@/components/ui/context-menu` 的二次封装：样式与行为仍由 UI 层维护；
 * 此处通过 `memo` 收敛重渲染边界，便于业务侧「只优化 design 层」而不改 shadcn 源文件。
 */
import * as React from 'react';

import {
	ContextMenu as ContextMenuBase,
	ContextMenuCheckboxItem as ContextMenuCheckboxItemBase,
	ContextMenuContent as ContextMenuContentBase,
	ContextMenuGroup as ContextMenuGroupBase,
	ContextMenuItem as ContextMenuItemBase,
	ContextMenuLabel as ContextMenuLabelBase,
	ContextMenuPortal as ContextMenuPortalBase,
	ContextMenuRadioGroup as ContextMenuRadioGroupBase,
	ContextMenuRadioItem as ContextMenuRadioItemBase,
	ContextMenuSeparator as ContextMenuSeparatorBase,
	ContextMenuShortcut as ContextMenuShortcutBase,
	ContextMenuSub as ContextMenuSubBase,
	ContextMenuSubContent as ContextMenuSubContentBase,
	ContextMenuSubTrigger as ContextMenuSubTriggerBase,
	ContextMenuTrigger as ContextMenuTriggerBase,
} from '@/components/ui/context-menu';

/** Radix Root：保持与 UI 层一致，不包 memo */
const ContextMenu = ContextMenuBase;

/** Trigger 常随子节点变化，不包 memo，避免错误跳过更新 */
const ContextMenuTrigger = ContextMenuTriggerBase;

const ContextMenuGroup = React.memo(ContextMenuGroupBase);
ContextMenuGroup.displayName = 'ContextMenuGroup';

const ContextMenuPortal = React.memo(ContextMenuPortalBase);
ContextMenuPortal.displayName = 'ContextMenuPortal';

const ContextMenuSub = React.memo(ContextMenuSubBase);
ContextMenuSub.displayName = 'ContextMenuSub';

const ContextMenuRadioGroup = React.memo(ContextMenuRadioGroupBase);
ContextMenuRadioGroup.displayName = 'ContextMenuRadioGroup';

const ContextMenuSubTrigger = React.memo(ContextMenuSubTriggerBase);
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger';

const ContextMenuSubContent = React.memo(ContextMenuSubContentBase);
ContextMenuSubContent.displayName = 'ContextMenuSubContent';

const ContextMenuContent = React.memo(ContextMenuContentBase);
ContextMenuContent.displayName = 'ContextMenuContent';

const ContextMenuItem = React.memo(ContextMenuItemBase);
ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuCheckboxItem = React.memo(ContextMenuCheckboxItemBase);
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem';

const ContextMenuRadioItem = React.memo(ContextMenuRadioItemBase);
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem';

const ContextMenuLabel = React.memo(ContextMenuLabelBase);
ContextMenuLabel.displayName = 'ContextMenuLabel';

const ContextMenuSeparator = React.memo(ContextMenuSeparatorBase);
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

const ContextMenuShortcut = React.memo(ContextMenuShortcutBase);
ContextMenuShortcut.displayName = 'ContextMenuShortcut';

export {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuCheckboxItem,
	ContextMenuRadioItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuGroup,
	ContextMenuPortal,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuRadioGroup,
};
