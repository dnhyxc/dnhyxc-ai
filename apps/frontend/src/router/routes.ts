/**
 * 路由表。鉴权白名单（未登录可访问）见 `@/router/authPaths` 的 `isPublicPath`：
 * 首页 `/`、`/login`、`/win`、`/about`、`/share/:shareId`、`/setting` 及其子路径。
 */
import React from 'react';
import Layout from '@/layout';
import NotFound from '@/views/404';
import About from '@/views/about';
import Account from '@/views/account';
import Chat from '@/views/chat';
import NewChat from '@/views/chat/new';
import Session from '@/views/chat/session';
import Coding from '@/views/coding';
import Document from '@/views/document';
import Home from '@/views/home';
import Knowledge from '@/views/knowledge';
import Login from '@/views/login';
import Pay from '@/views/pay';
import Profile from '@/views/profile';
import Setting from '@/views/setting';
import AboutApp from '@/views/setting/about';
import AppSystem from '@/views/setting/system';
import ThemeSetting from '@/views/setting/theme';
import Share from '@/views/share';
import ChildWindow from '@/views/win';

export interface RouteMeta {
	title?: string;
}

export interface RouteConfig {
	path?: string;
	index?: boolean;
	Component?: React.ComponentType;
	meta?: RouteMeta;
	children?: RouteConfig[];
}

const routes: RouteConfig[] = [
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
				path: '/chat',
				Component: Chat,
				meta: {
					title: '智能对话',
				},
				children: [
					{
						index: true,
						// path: '/setting/system',
						Component: NewChat,
						meta: {
							title: '智能对话',
						},
					},
					{
						path: '/chat/c/:id?',
						Component: Session,
						meta: {
							title: '智能对话',
						},
					},
				],
			},
			{
				path: '/document',
				Component: Document,
				meta: {
					title: '智能文档处理',
				},
			},
			{
				path: '/coding',
				Component: Coding,
				meta: {
					title: '智能代码处理',
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
				path: '/knowledge',
				Component: Knowledge,
				meta: {
					title: '知识库编辑',
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
				path: '/pay',
				Component: Pay,
				meta: {
					title: '会员充值',
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
		path: '/share/:shareId',
		Component: Share,
	},
	{
		path: '*',
		Component: NotFound,
	},
];

export default routes;
