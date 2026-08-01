import type { LucideIcon } from 'lucide-react';
import {
	BookOpen,
	CreditCard,
	Database,
	FileText,
	LayoutDashboard,
	MenuSquare,
	MessageSquare,
	Shield,
	Users,
} from 'lucide-react';

export interface MenuItem {
	path: string;
	label: string;
	icon: LucideIcon;
	children?: MenuItem[];
	permission?: string;
}

export const menuItems: MenuItem[] = [
	{
		path: '/dashboard',
		label: '仪表盘',
		icon: LayoutDashboard,
	},
	{
		path: '/users',
		label: '用户管理',
		icon: Users,
	},
	{
		path: '/roles',
		label: '角色权限',
		icon: Shield,
	},
	{
		path: '/menus',
		label: '菜单管理',
		icon: MenuSquare,
	},
	{
		path: '/ebooks',
		label: '书籍管理',
		icon: BookOpen,
	},
	{
		path: '/chats',
		label: '对话管理',
		icon: MessageSquare,
	},
	{
		path: '/knowledge',
		label: '知识库',
		icon: Database,
	},
	{
		path: '/logs',
		label: '系统日志',
		icon: FileText,
	},
	{
		path: '/membership',
		label: '会员订单',
		icon: CreditCard,
	},
];
