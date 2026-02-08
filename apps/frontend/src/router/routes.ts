import Layout from '@/layout';
import NotFound from '@/views/404';
import About from '@/views/about';
import Account from '@/views/account';
import Chat from '@/views/chat';
import Detail from '@/views/detail';
import Document from '@/views/document';
import Editor from '@/views/editor';
import Home from '@/views/home';
import Login from '@/views/login';
import Profile from '@/views/profile';
import Setting from '@/views/setting';
import AboutApp from '@/views/setting/about';
import AppSystem from '@/views/setting/system';
import ThemeSetting from '@/views/setting/theme';
import Skill from '@/views/skill';
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
				path: '/chat/:id?',
				Component: Chat,
				meta: {
					title: '智能对话',
				},
			},
			{
				path: '/document',
				Component: Document,
				meta: {
					title: '智能文档处理',
				},
			},
			{
				path: '/skill',
				Component: Skill,
				meta: {
					title: '技能',
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
				path: '/editor',
				Component: Editor,
				meta: {
					title: '文档编辑',
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
				children: [
					{
						index: true,
						// path: '/setting/system',
						Component: AppSystem,
						meta: {
							title: '系统设置',
						},
					},
					{
						path: '/setting/about',
						Component: AboutApp,
						meta: {
							title: '关于应用',
						},
					},
					{
						path: '/setting/theme',
						Component: ThemeSetting,
						meta: {
							title: '主题设置',
						},
					},
				],
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
