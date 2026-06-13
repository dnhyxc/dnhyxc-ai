/** 英语学习侧栏 — 统一布局与按钮 token（保守收敛：卡片 + 按钮规格） */

export const SIDEBAR_CARD = 'rounded-md border border-theme/5 bg-theme/5 p-4';

export const SIDEBAR_SECTION_STACK = 'flex flex-col gap-4.5';

export const SIDEBAR_HEADER_ROW = 'mb-4 flex items-start gap-3';

export const SIDEBAR_ICON_BOX =
	'flex size-10 shrink-0 items-center justify-center rounded-md';

export const SIDEBAR_TITLE = 'text-textcolor font-semibold leading-tight';

export const SIDEBAR_DESC = 'text-textcolor/50 mt-1 text-xs leading-snug';

export const SIDEBAR_LABEL =
	'text-textcolor/45 text-sm font-medium tracking-wide';

/** 侧栏各区块按钮组/网格统一间隙 */
export const SIDEBAR_BTN_GAP = 'gap-3';

export const SIDEBAR_ACTIONS_ROW = `flex flex-wrap items-center ${SIDEBAR_BTN_GAP}`;

export const SIDEBAR_BTN_SECONDARY =
	'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-sm border border-theme/5 bg-theme-background text-textcolor/80 hover:bg-theme/10 hover:text-textcolor';

/** 主按钮公共骨架（再叠 ENGLISH_SIDEBAR_BTN_GRADIENT[key]） */
export const SIDEBAR_BTN_PRIMARY_BASE =
	'h-9 min-w-0 flex-1 gap-2 rounded-md px-3 text-sm text-white';
