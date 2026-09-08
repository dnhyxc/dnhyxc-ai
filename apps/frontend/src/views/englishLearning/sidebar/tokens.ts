/** 英语学习侧栏 — 统一布局与按钮 token（保守收敛：卡片 + 按钮规格） */

export const SIDEBAR_CARD = 'rounded-md border border-theme/5 bg-theme/5 p-4';

/** 侧栏卡片栈：瀑布流（1px 行轨 + JS span；原生 masonry/grid-lanes 用 supports 增强） */
export const SIDEBAR_SECTION_STACK = [
	'grid w-full min-w-0 items-start',
	'grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]',
	'auto-rows-[1px] gap-x-4.5 gap-y-0',
	'*:mb-4.5 *:last:mb-0 *:h-max *:min-w-0',
	// Firefox / 旧实验语法
	'supports-[grid-template-rows:masonry]:grid-rows-[masonry]',
	'supports-[grid-template-rows:masonry]:auto-rows-[initial]',
	'supports-[grid-template-rows:masonry]:gap-4.5',
	'supports-[grid-template-rows:masonry]:*:mb-0',
	// Safari 等：grid-lanes
	'supports-[display:grid-lanes]:[display:grid-lanes]',
	'supports-[display:grid-lanes]:auto-rows-[initial]',
	'supports-[display:grid-lanes]:gap-4.5',
	'supports-[display:grid-lanes]:*:mb-0',
].join(' ');

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
