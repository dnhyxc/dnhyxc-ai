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
	{
		nameKey: 'nav.chat',
		icon: 'Bot',
		path: '/chat',
		requiresAuth: true,
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
