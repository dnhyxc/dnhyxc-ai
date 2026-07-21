import {
	BookOpenText,
	Bot,
	// Codesandbox,
	Flower,
	LibraryBig,
	NotebookTabs,
	Package,
	Puzzle,
	TreePalm,
	Vegan,
	WalletCards,
} from 'lucide-react';

export type SidebarMenuConfig = {
	nameKey: string;
	icon: string;
	path: string;
	/** 为 true 时仅登录后展示 */
	requiresAuth?: boolean;
};

export const ICON_MAP = {
	TreePalm: <TreePalm />,
	Package: <Package />,
	Bot: <Bot />,
	// Codesandbox: <Codesandbox />,
	NotebookTabs: <NotebookTabs />,
	LibraryBig: <LibraryBig />,
	BookOpenText: <BookOpenText />,
	WalletCards: <WalletCards />,
	Vegan: <Vegan />,
	Puzzle: <Puzzle />,
	Flower: <Flower />,
};

export const MENUS: SidebarMenuConfig[] = [
	{
		nameKey: 'nav.home',
		icon: 'TreePalm',
		path: '/',
	},
	{
		nameKey: 'nav.knowledge',
		icon: 'NotebookTabs',
		path: '/knowledge',
	},
	{
		nameKey: 'nav.ebook',
		icon: 'LibraryBig',
		path: '/ebook',
	},
	// 智能对话：侧栏始终展示；`/chat` 不在 `isPublicPath` 内，未登录点击进入后由 Layout 校验 token 并跳转登录（与主页等入口一致）
	{
		nameKey: 'nav.chat',
		icon: 'Bot',
		path: '/chat',
	},
	{
		nameKey: 'nav.englishLearning',
		icon: 'Vegan',
		path: '/english-learning',
	},
	{
		nameKey: 'nav.plugins',
		icon: 'Flower',
		path: '/plugins',
	},
	// {
	// 	name: 'document',
	// 	icon: 'Package',
	// 	path: '/document',
	// },
	// {
	// 	name: 'coding',
	// 	icon: 'Codesandbox',
	// 	path: '/coding',
	// },
	// {
	// 	name: '个人主页',
	// 	icon: 'WalletCards',
	// 	path: '/profile',
	// },
	// {
	// 	nameKey: 'nav.pay',
	// 	icon: 'CreditCard',
	// 	path: '/pay',
	// },
];
