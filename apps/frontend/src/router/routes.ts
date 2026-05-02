/**
 * 路由表。鉴权白名单（未登录可访问）见 `@/router/authPaths` 的 `isPublicPath`：
 * 首页 `/`、`/login`、`/win`、`/about`、`/service-policy`、`/user-agreement`、`/share/:shareId`、`/setting` 及其子路径。
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
import LegalServicePolicy from '@/views/legal/servicePolicy';
import LegalUserAgreement from '@/views/legal/userAgreement';
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
	/** 多语言标题 key；优先于 title 渲染 */
	titleKey?: string;
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
					titleKey: 'route.chat.title',
				},
				children: [
					{
						index: true,
						// path: '/setting/system',
						Component: NewChat,
						meta: {
							titleKey: 'route.chat.title',
						},
					},
					{
						path: '/chat/c/:id?',
						Component: Session,
						meta: {
							titleKey: 'route.chat.title',
						},
					},
				],
			},
			{
				path: '/document',
				Component: Document,
				meta: {
					titleKey: 'route.document.title',
				},
			},
			{
				path: '/coding',
				Component: Coding,
				meta: {
					titleKey: 'route.coding.title',
				},
			},
			{
				path: '/profile',
				Component: Profile,
				meta: {
					titleKey: 'route.profile.title',
				},
			},
			{
				path: '/knowledge',
				Component: Knowledge,
				meta: {
					titleKey: 'route.knowledge.title',
				},
			},
			{
				path: '/account',
				Component: Account,
				meta: {
					titleKey: 'route.account.title',
				},
			},
			{
				path: '/pay',
				Component: Pay,
				meta: {
					titleKey: 'route.pay.title',
				},
			},
			{
				path: '/setting',
				Component: Setting,
				meta: {
					titleKey: 'route.setting.title',
				},
				children: [
					{
						index: true,
						// path: '/setting/system',
						Component: AppSystem,
						meta: {
							titleKey: 'route.setting.title',
						},
					},
					{
						path: '/setting/about',
						Component: AboutApp,
						meta: {
							titleKey: 'route.setting.about',
						},
					},
					{
						path: '/setting/theme',
						Component: ThemeSetting,
						meta: {
							titleKey: 'route.setting.theme',
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
		path: '/service-policy',
		Component: LegalServicePolicy,
		meta: {
			titleKey: 'route.legal.servicePolicy',
		},
	},
	{
		path: '/user-agreement',
		Component: LegalUserAgreement,
		meta: {
			titleKey: 'route.legal.userAgreement',
		},
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
