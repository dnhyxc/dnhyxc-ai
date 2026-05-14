export type SidebarMenuConfig = {
	nameKey: string;
	icon: string;
	path: string;
	/** 为 true 时仅登录后展示 */
	requiresAuth?: boolean;
};

export const MENUS: SidebarMenuConfig[] = [
	{
		nameKey: 'nav.home',
		icon: 'House',
		path: '/',
	},
	{
		nameKey: 'nav.knowledge',
		icon: 'BookOpenText',
		path: '/knowledge',
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
