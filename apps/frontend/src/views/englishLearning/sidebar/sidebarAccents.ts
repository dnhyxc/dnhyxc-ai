/**
 * 英语学习首页侧栏 — 各入口渐变（保持同构：饱和渐变 + 白字）
 *
 * 色相分配原则：
 * - 上区冷色：lime / cyan·blue / indigo·blue / teal·cyan / violet·indigo
 * - 今日复习：玫瑰金（粉金渐变，侧栏唯一）
 * - 下区暖色：橙→黄(收藏)、玫→橙(错题)
 */
export const ENGLISH_SIDEBAR_ICON_GRADIENT = {
	toolbar: 'bg-linear-to-r from-lime-600 to-green-700',
	vocabSource: 'bg-linear-to-r from-cyan-500 to-blue-600',
	classicSource: 'bg-linear-to-r from-indigo-500 to-blue-600',
	vocabPack: 'bg-linear-to-r from-teal-500 to-cyan-600',
	classicPack: 'bg-linear-to-r from-violet-600 to-indigo-600',
	review: 'bg-linear-to-r from-[#9a5c66] to-[#b8874f]',
	favorites: 'bg-linear-to-r from-orange-500 to-yellow-500',
	mistakes: 'bg-linear-to-r from-rose-500 to-orange-500',
} as const;

export const ENGLISH_SIDEBAR_BTN_GRADIENT = {
	toolbar:
		'bg-linear-to-r from-lime-600 to-green-700 hover:bg-linear-to-r hover:from-lime-400 hover:to-green-500',
	vocabSource:
		'bg-linear-to-r from-cyan-500 to-blue-600 hover:bg-linear-to-r hover:from-cyan-400 hover:to-blue-600',
	classicSource:
		'bg-linear-to-r from-indigo-500 to-blue-600 hover:bg-linear-to-r hover:from-indigo-400 hover:to-blue-600',
	vocabPack:
		'bg-linear-to-r from-teal-500 to-cyan-600 hover:bg-linear-to-r hover:from-teal-400 hover:to-cyan-600',
	classicPack:
		'bg-linear-to-r from-violet-600 to-indigo-600 hover:bg-linear-to-r hover:from-violet-400 hover:to-indigo-600',
	review:
		'bg-linear-to-r from-[#9a5c66] to-[#b8874f] hover:bg-linear-to-r hover:from-[#a96872] hover:to-[#c99758]',
	favorites:
		'bg-linear-to-r from-orange-500 to-yellow-500 hover:bg-linear-to-r hover:from-orange-400 hover:to-yellow-500',
	mistakes:
		'bg-linear-to-r from-rose-500 to-orange-500 hover:bg-linear-to-r hover:from-rose-400 hover:to-orange-500',
} as const;
