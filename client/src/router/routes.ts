import Layout from '@/layout';
import NotFound from '@/views/404';
import About from '@/views/about';
import Account from '@/views/account';
import Detail from '@/views/detail';
import Home from '@/views/home';
import Login from '@/views/login';
import Profile from '@/views/profile';
import Setting from '@/views/setting';
import ChildWindow from '@/views/win';

const routes = [
	{
		Component: Layout,
		children: [
			{
				path: '/',
				Component: Home,
				meta: {
					title: 'dnhyxc-ai',
				},
			},
			{
				path: '/detail',
				Component: Detail,
				meta: {
					title: '详情',
				},
			},
			{
				path: '/profile',
				Component: Profile,
				meta: {
					title: '个人主页',
				},
			},
			{
				path: '/account',
				Component: Account,
				meta: {
					title: '账号设置',
				},
			},
			{
				path: '/setting',
				Component: Setting,
				meta: {
					title: '系统设置',
				},
			},
		],
	},
	{
		path: '/login',
		Component: Login,
	},
	{
		path: '/win',
		Component: ChildWindow,
	},
	{
		path: '/about',
		Component: About,
	},
	{
		path: '*',
		Component: NotFound,
	},
];

export default routes;
