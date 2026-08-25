/**
 * 路由表。鉴权白名单（未登录可访问）见 `@/router/authPaths` 的 `isPublicPath`：
 * 首页 `/`、`/login`、`/win`、`/about`、`/service-policy`、`/user-agreement`、`/update-info`、`/project-guide`、`/download-desktop`、`/share/:shareId`、`/setting` 及其子路径。
 *
 * Layout / Home / Login 保持 eager；其余页面 React.lazy，避免主包打进全站视图。
 */
import React, { lazy } from 'react';
import Layout from '@/layout';
import Home from '@/views/home';
import Login from '@/views/login';

const NotFound = lazy(() => import('@/views/404'));
const About = lazy(() => import('@/views/about'));
const Account = lazy(() => import('@/views/account'));
const Chat = lazy(() => import('@/views/chat'));
const NewChat = lazy(() => import('@/views/chat/new'));
const Session = lazy(() => import('@/views/chat/session'));
const Coding = lazy(() => import('@/views/coding'));
const DesktopDownloadPage = lazy(() => import('@/views/desktopDownload'));
const Document = lazy(() => import('@/views/document'));
const Download = lazy(() => import('@/views/download'));
const Ebook = lazy(() => import('@/views/ebook'));
const EbookLayout = lazy(() => import('@/views/ebook/layout'));
const EbookRead = lazy(() => import('@/views/ebook/read'));
const EnglishLearning = lazy(() => import('@/views/englishLearning'));
const EnglishLearningDailyPage = lazy(
	() => import('@/views/englishLearning/daily'),
);
const EnglishLearningDailyRecordsPage = lazy(
	() => import('@/views/englishLearning/daily/records'),
);
const EnglishLearningFavoritesPage = lazy(
	() => import('@/views/englishLearning/favorites'),
);
const EnglishLearningImportPage = lazy(
	() => import('@/views/englishLearning/import'),
);
const EnglishLearningLayout = lazy(
	() => import('@/views/englishLearning/Layout'),
);
const EnglishLearningLibraryPage = lazy(
	() => import('@/views/englishLearning/library'),
);
const EnglishLearningMistakesPage = lazy(
	() => import('@/views/englishLearning/mistakes'),
);
const EnglishLearningNotesPage = lazy(
	() => import('@/views/englishLearning/notes'),
);
const EnglishLearningNotesPopoutPage = lazy(
	() => import('@/views/englishLearning/notes/popout'),
);
const EnglishLearningPackStreamPage = lazy(
	() => import('@/views/englishLearning/pack'),
);
const EnglishLearningPracticePage = lazy(
	() => import('@/views/englishLearning/practice'),
);
const EnglishGrammarReferencePage = lazy(
	() => import('@/views/englishLearning/reference/grammar'),
);
const EnglishMorphologyReferencePage = lazy(
	() => import('@/views/englishLearning/reference/morphology'),
);
const Knowledge = lazy(() => import('@/views/knowledge'));
const LegalServicePolicy = lazy(() => import('@/views/legal/servicePolicy'));
const LegalUserAgreement = lazy(() => import('@/views/legal/userAgreement'));
const Pay = lazy(() => import('@/views/pay'));
const PluginDevGuidePage = lazy(() => import('@/views/pluginDevGuide'));
const PluginsPage = lazy(() => import('@/views/plugins'));
const PluginsLayout = lazy(() => import('@/views/plugins/Layout'));
const PluginRegistryEditorPage = lazy(() => import('@/views/plugins/registry'));
const Profile = lazy(() => import('@/views/profile'));
const ProjectGuidePage = lazy(() => import('@/views/projectGuide'));
const Setting = lazy(() => import('@/views/setting'));
const AboutApp = lazy(() => import('@/views/setting/about'));
const CloudTtsSetting = lazy(() => import('@/views/setting/cloudTts'));
const LlmSetting = lazy(() => import('@/views/setting/llm'));
const AppSystem = lazy(() => import('@/views/setting/system'));
const ThemeSetting = lazy(() => import('@/views/setting/theme'));
const Share = lazy(() => import('@/views/share'));
const UpdateInfoPage = lazy(() => import('@/views/updateInfo'));
const ChildWindow = lazy(() => import('@/views/win'));

export interface RouteMeta {
	title?: string;
	/** 多语言标题 key；优先于 title 渲染 */
	titleKey?: string;
	/** 插件 registry 内嵌多语言标题（优先于 titleKey） */
	titleI18n?: Partial<Record<'zh-CN' | 'en-US', string>>;
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
				path: '/ebook',
				Component: EbookLayout,
				meta: {
					titleKey: 'route.ebook.title',
				},
				children: [
					{
						index: true,
						Component: Ebook,
						meta: {
							titleKey: 'route.ebook.shelf',
						},
					},
					{
						path: 'read/:bookId',
						Component: EbookRead,
						meta: {
							titleKey: 'route.ebook.read',
						},
					},
				],
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
						path: 'notes',
						Component: EnglishLearningNotesPage,
						meta: {
							titleKey: 'route.englishLearning.notes.title',
						},
					},
					{
						path: 'mistakes',
						Component: EnglishLearningMistakesPage,
						meta: {
							titleKey: 'route.englishLearning.mistakes.title',
						},
					},
					{
						path: 'mistakes/classic',
						Component: EnglishLearningMistakesPage,
						meta: {
							titleKey: 'route.englishLearning.mistakes.title',
						},
					},
					{
						path: 'practice',
						Component: EnglishLearningPracticePage,
						meta: {
							titleKey: 'route.englishLearning.practice.title',
						},
					},
					{
						path: 'daily',
						Component: EnglishLearningDailyPage,
						meta: {
							titleKey: 'route.englishLearning.daily.title',
						},
					},
					{
						path: 'daily/records',
						Component: EnglishLearningDailyRecordsPage,
						meta: {
							titleKey: 'englishLearning.daily.recordsTitle',
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
				path: '/plugins',
				Component: PluginsLayout,
				meta: {
					titleKey: 'route.plugins.title',
				},
				children: [
					{
						index: true,
						Component: PluginsPage,
						meta: {
							titleKey: 'route.plugins.title',
						},
					},
					{
						path: 'registry',
						Component: PluginRegistryEditorPage,
						meta: {
							titleKey: 'route.plugins.registry.title',
						},
					},
				],
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
					{
						path: '/setting/cloud-tts',
						Component: CloudTtsSetting,
						meta: {
							titleKey: 'route.setting.cloudTts',
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
		path: '/english-learning/notes/popout',
		Component: EnglishLearningNotesPopoutPage,
		meta: {
			titleKey: 'route.englishLearning.notes.title',
		},
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
		path: '/plugin-dev-guide',
		Component: PluginDevGuidePage,
		meta: {
			titleKey: 'route.pluginDevGuide.title',
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
