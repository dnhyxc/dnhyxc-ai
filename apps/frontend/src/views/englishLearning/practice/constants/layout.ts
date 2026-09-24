/** 练习各阶段内容区宽度与水平居中（自适应父级，上限 3xl） */
export const PRACTICE_PAGE_CONTENT_CLASS = 'mx-auto w-full max-w-3xl';

/** 听写/拼写 — 底部主操作按钮（与分段选中 bg-teal-600 一致） */
export const PRACTICE_PRIMARY_ACTION_BTN_CLASS =
	'bg-teal-600 text-white shadow-none hover:bg-teal-500 disabled:opacity-50 [&_[role=status]]:text-white';

/** 作答明细网格：单词默认约三列；语句保持较宽卡（外层自行加 padding） */
export function practiceRoundListGridClass(
	contentKind: 'vocab' | 'classic',
): string {
	return contentKind === 'classic'
		? 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-2.5'
		: 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))] gap-2.5';
}
