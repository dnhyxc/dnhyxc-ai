/**
 * 路由表。鉴权白名单（未登录可访问）见 `@/router/authPaths` 的 `isPublicPath`：
 * 首页 `/`、`/login`、`/win`、`/about`、`/service-policy`、`/user-agreement`、`/update-info`、`/project-guide`、`/download-desktop`、`/share/:shareId`、`/setting` 及其子路径。
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
import DesktopDownloadPage from '@/views/desktopDownload';
import Document from '@/views/document';
import Download from '@/views/download';
import EnglishLearning from '@/views/englishLearning';
import EnglishLearningFavoritesPage from '@/views/englishLearning/favorites/EnglishLearningFavoritesPage';
import EnglishLearningImportPage from '@/views/englishLearning/import/EnglishLearningImportPage';
import EnglishLearningLayout from '@/views/englishLearning/Layout';
import EnglishLearningLibraryPage from '@/views/englishLearning/library/EnglishLearningLibraryPage';
import EnglishLearningPackStreamPage from '@/views/englishLearning/pack/EnglishLearningPackStreamPage';
import EnglishGrammarReferencePage from '@/views/englishLearning/reference/EnglishGrammarReferencePage';
import EnglishMorphologyReferencePage from '@/views/englishLearning/reference/EnglishMorphologyReferencePage';
import Home from '@/views/home';
import Knowledge from '@/views/knowledge';
import LegalServicePolicy from '@/views/legal/servicePolicy';
import LegalUserAgreement from '@/views/legal/userAgreement';
import Login from '@/views/login';
import Pay from '@/views/pay';
import Profile from '@/views/profile';
import ProjectGuidePage from '@/views/projectGuide';
import Setting from '@/views/setting';
import AboutApp from '@/views/setting/about';
import LlmSetting from '@/views/setting/llm';
import AppSystem from '@/views/setting/system';
import ThemeSetting from '@/views/setting/theme';
import Share from '@/views/share';
import UpdateInfoPage from '@/views/updateInfo';
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
				path: '/download',
				Component: Download,
				meta: {
					titleKey: 'route.download.title',
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
				path: '/english-learning',
				Component: EnglishLearningLayout,
				meta: {
					titleKey: 'route.englishLearning.title',
				},
				children: [
					{
						index: true,
						Component: EnglishLearning,
						meta: {
							titleKey: 'route.englishLearning.title',
						},
					},
					{
						path: 'import',
						Component: EnglishLearningImportPage,
						meta: {
							titleKey: 'route.englishLearning.import.title',
						},
					},
					{
						path: 'library',
						Component: EnglishLearningLibraryPage,
						meta: {
							titleKey: 'route.englishLearning.library.title',
						},
					},
					{
						path: 'favorites',
						Component: EnglishLearningFavoritesPage,
						meta: {
							titleKey: 'route.englishLearning.favorites.title',
						},
					},
					{
						path: 'stream',
						Component: EnglishLearningPackStreamPage,
						meta: {
							titleKey: 'route.englishLearning.stream.title',
						},
					},
					{
						path: 'reference/morphology',
						Component: EnglishMorphologyReferencePage,
						meta: {
							titleKey: 'route.englishLearning.morphology.title',
						},
					},
					{
						path: 'reference/grammar',
						Component: EnglishGrammarReferencePage,
						meta: {
							titleKey: 'route.englishLearning.grammar.title',
						},
					},
				],
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
					{
						path: '/setting/llm',
						Component: LlmSetting,
						meta: {
							titleKey: 'route.setting.llm',
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
		path: '/update-info',
		Component: UpdateInfoPage,
		meta: {
			titleKey: 'route.updateInfo.title',
		},
	},
	{
		path: '/project-guide',
		Component: ProjectGuidePage,
		meta: {
			titleKey: 'route.projectGuide.title',
		},
	},
	{
		path: '/download-desktop',
		Component: DesktopDownloadPage,
		meta: {
			titleKey: 'route.downloadDesktop.title',
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
