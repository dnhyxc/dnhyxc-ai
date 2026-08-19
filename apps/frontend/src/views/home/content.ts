/**
 * Home 页静态色系 + 文案/入口数据工厂（依赖 t / navigate / locale 的在组件里 useMemo 调用）。
 */
import type { LucideIcon } from 'lucide-react';
import {
	ChevronLeft,
	ChevronRight,
	Code2,
	FileText,
	Flower,
	Globe,
	LibraryBig,
	MessageSquare,
	NotebookTabs,
	Puzzle,
	Rocket,
	Shield,
	Sparkles,
	Vegan,
	Zap,
} from 'lucide-react';
import type { NavigateFunction } from 'react-router';
import type { Locale } from '@/i18n';
import { openExternalUrl } from '@/utils';
import { getPluginDevGuideAbsoluteUrl } from '@/views/pluginDevGuide/paths';
import { getProjectGuideAbsoluteUrl } from '@/views/projectGuide/paths';

type TFn = (key: string, params?: Record<string, unknown>) => string;

/** 每張 slide 的色系映射，避免在 JSX 中重複長漸變 class 字串 */
export const HUE_STYLES: Record<
	string,
	{ rail: string; icon: string; btn: string; glow: string }
> = {
	teal: {
		rail: 'bg-teal-400',
		icon: 'from-teal-500/95 to-teal-400/95 shadow-teal-500/25',
		btn: 'from-teal-400/95 to-teal-500/95 hover:shadow-teal-500/30',
		glow: 'from-teal-600/15 via-cyan-500/8',
	},
	emerald: {
		rail: 'bg-emerald-400',
		icon: 'from-emerald-400/90 to-green-500/80 shadow-emerald-500/25',
		btn: 'from-emerald-400/80 to-green-500/80 hover:shadow-emerald-500/30',
		glow: 'from-emerald-500/15 via-teal-500/8',
	},
	amber: {
		rail: 'bg-amber-400',
		icon: 'from-amber-400/90 to-orange-500/90 shadow-amber-500/20',
		btn: 'from-amber-400/80 to-orange-500/80 hover:shadow-amber-500/30',
		glow: 'from-amber-500/15 via-orange-500/8',
	},
	rose: {
		rail: 'bg-rose-400',
		icon: 'from-rose-400/90 to-amber-600/90 shadow-rose-500/20',
		btn: 'from-rose-400/80 to-amber-600/80 hover:shadow-rose-500/30',
		glow: 'from-rose-500/15 via-amber-500/8',
	},
	violet: {
		rail: 'bg-violet-400',
		icon: 'from-violet-400/90 to-purple-600/90 shadow-violet-500/25',
		btn: 'from-violet-400/80 to-purple-600/80 hover:shadow-violet-500/30',
		glow: 'from-violet-500/15 via-purple-500/8',
	},
};

export function createShowcase(t: TFn) {
	return [
		{
			icon: Puzzle,
			title: t('home.showcase.plugin.title'),
			desc: t('home.showcase.plugin.desc'),
			color: 'from-violet-400 to-purple-500',
		},
		{
			icon: Rocket,
			title: t('home.showcase.fast.title'),
			desc: t('home.showcase.fast.desc'),
			color: 'from-sky-400 to-cyan-400',
		},
		{
			icon: Shield,
			title: t('home.showcase.privacy.title'),
			desc: t('home.showcase.privacy.desc'),
			color: 'from-orange-400 to-yellow-400',
		},
		{
			icon: Globe,
			title: t('home.showcase.i18n.title'),
			desc: t('home.showcase.i18n.desc'),
			color: 'from-green-400 to-cyan-400',
		},
		{
			icon: Zap,
			title: t('home.showcase.lightweight.title'),
			desc: t('home.showcase.lightweight.desc'),
			color: 'from-green-400 to-emerald-400',
		},
	];
}

export function createSteps(t: TFn) {
	return [
		{
			step: '1',
			title: t('home.steps.install.title'),
			desc: t('home.steps.install.desc'),
			icon: Rocket,
			/* 固定原版 teal hex，不跟随全局主题色 */
			color: 'from-[#14b8a6] to-cyan-600',
			/** 在默认浏览器打开桌面端下载落地页 */
			downloadDesktop: true,
		},
		{
			step: '2',
			title: t('home.steps.register.title'),
			desc: t('home.steps.register.desc'),
			icon: Shield,
			color: 'from-cyan-500 to-blue-500',
			/** 点击后进入登录页「账号注册」视图 */
			navigateRegister: true,
		},
		{
			step: '3',
			title: t('home.steps.start.title'),
			desc: t('home.steps.start.desc'),
			icon: Zap,
			color: 'from-orange-500 to-amber-500',
			/** 点击后进入智能对话 */
			navigateChat: true,
		},
		{
			step: '4',
			title: t('home.steps.pluginDev.title'),
			desc: t('home.steps.pluginDev.desc'),
			icon: Puzzle,
			color: 'from-violet-500 to-purple-600',
			/** 在默认浏览器打开插件开发手册 */
			openPluginDevGuide: true,
		},
	];
}

export function createFeatures(navigate: NavigateFunction, t: TFn) {
	return [
		{
			index: '01',
			icon: MessageSquare,
			title: t('home.features.chat.title'),
			subtitle: t('home.features.chat.subtitle'),
			desc: t('home.features.chat.desc'),
			/* 固定原版 teal hex，不跟随全局主题色 */
			color: 'from-emerald-400 to-[#14b8a6]',
			glow: 'shadow-emerald-500/25',
			hoverBg:
				'group-hover:bg-linear-to-br group-hover:from-emerald-500/15 group-hover:to-[#0d9488]/5',
			onClick: () => navigate('/chat'),
		},
		{
			index: '02',
			icon: Code2,
			title: t('home.features.coding.title'),
			subtitle: t('home.features.coding.subtitle'),
			desc: t('home.features.coding.desc'),
			color: 'from-amber-400 to-orange-500',
			glow: 'shadow-amber-500/20',
			hoverBg:
				'group-hover:bg-linear-to-br group-hover:from-amber-500/12 group-hover:to-orange-600/5',
			onClick: () => navigate('/coding'),
		},
		{
			index: '03',
			icon: FileText,
			title: t('home.features.document.title'),
			subtitle: t('home.features.document.subtitle'),
			desc: t('home.features.document.desc'),
			color: 'from-rose-400 to-amber-600',
			glow: 'shadow-rose-500/20',
			hoverBg:
				'group-hover:bg-linear-to-br group-hover:from-rose-500/12 group-hover:to-amber-700/5',
			onClick: () => navigate('/document'),
		},
	];
}

export function createQuicklinks(t: TFn) {
	return [
		{
			index: '1',
			icon: Rocket,
			title: t('home.quicklinks.dnhyxc-ai.title'),
			desc: t('home.quicklinks.dnhyxc-ai.desc'),
			color: 'from-lime-500 to-emerald-500',
			downloadDesktop: true,
			onClick: () => void openExternalUrl('https://dnhyxc.cn:9002'),
		},
		{
			index: '2',
			icon: Rocket,
			title: t('home.quicklinks.dnhyxc-ai-admin.title'),
			desc: t('home.quicklinks.dnhyxc-ai-admin.desc'),
			color: 'from-lime-400 to-lime-600',
			downloadDesktop: true,
			onClick: () => void openExternalUrl('https://dnhyxc.cn:9005'),
		},
		{
			index: '3',
			icon: Code2,
			title: t('home.quicklinks.blog.title'),
			desc: t('home.quicklinks.blog.desc'),
			color: 'from-indigo-300 to-blue-400',
			downloadDesktop: true,
			onClick: () => void openExternalUrl('https://dnhyxc.cn'),
		},
		{
			index: '4',
			icon: Code2,
			title: t('home.quicklinks.github.title'),
			desc: t('home.quicklinks.github.desc'),
			color: 'from-red-300 to-rose-400',
			downloadDesktop: true,
			onClick: () => void openExternalUrl('https://github.com/dnhyxc'),
		},
	];
}

export function createHeroSlides(opts: {
	t: TFn;
	locale: Locale;
	navigate: NavigateFunction;
	onQuickStart: () => void;
}) {
	const { t, locale, navigate, onQuickStart } = opts;
	return [
		{
			id: 'overview',
			badge: t('common.appTitle') ?? '智能工作台',
			number: '01',
			icon: Sparkles,
			titleMain: t('home.hero.welcome'),
			titleAccent: t('home.hero.product'),
			subtitle: t('home.hero.subtitle'),
			spotlightA: 'via-cyan-400/15',
			spotlightB: 'from-teal-500/25',
			spotlightC: 'to-amber-300/0',
			accent: 'text-teal-500/80',
			hue: 'teal',
			cta: [
				{
					label: t('home.hero.quickStart'),
					primary: true,
					onClick: onQuickStart,
				},
				{
					label: t('home.hero.learnMore'),
					primary: false,
					onClick: () =>
						void openExternalUrl(getProjectGuideAbsoluteUrl(locale)),
				},
			],
			tags: [
				t('home.hero.knowledge.title'),
				t('home.hero.ebook.title'),
				t('home.hero.english.title'),
				t('home.hero.plugins.title'),
			],
		},
		{
			id: 'knowledge',
			badge: t('home.hero.knowledge.subtitle'),
			number: '02',
			icon: NotebookTabs,
			titleMain: t('home.hero.knowledge.title'),
			titleAccent: t('home.hero.knowledge.subtitle'),
			subtitle: t('home.hero.knowledge.desc'),
			spotlightA: 'from-emerald-500/25',
			spotlightB: 'via-teal-400/18',
			spotlightC: 'to-cyan-300/0',
			accent: 'text-emerald-500/68',
			hue: 'emerald',
			cta: [
				{
					label: t('home.features.enter'),
					primary: true,
					onClick: () => navigate('/knowledge'),
				},
			],
			tags: [],
		},
		{
			id: 'ebook',
			badge: t('home.hero.ebook.subtitle'),
			number: '03',
			icon: LibraryBig,
			titleMain: t('home.hero.ebook.title'),
			titleAccent: t('home.hero.ebook.subtitle'),
			subtitle: t('home.hero.ebook.desc'),
			spotlightA: 'from-amber-500/25',
			spotlightB: 'via-orange-400/18',
			spotlightC: 'to-yellow-300/0',
			accent: 'text-amber-500/80',
			hue: 'amber',
			cta: [
				{
					label: t('home.features.enter'),
					primary: true,
					onClick: () => navigate('/ebook'),
				},
			],
			tags: [],
		},
		{
			id: 'english',
			badge: t('home.hero.english.subtitle'),
			number: '04',
			icon: Vegan,
			titleMain: t('home.hero.english.title'),
			titleAccent: t('home.hero.english.subtitle'),
			subtitle: t('home.hero.english.desc'),
			spotlightA: 'from-rose-500/22',
			spotlightB: 'via-amber-400/16',
			spotlightC: 'to-pink-300/0',
			accent: 'text-rose-500/60',
			hue: 'rose',
			cta: [
				{
					label: t('home.features.enter'),
					primary: true,
					onClick: () => navigate('/english-learning'),
				},
			],
			tags: [],
		},
		{
			id: 'plugins',
			badge: t('home.hero.plugins.subtitle'),
			number: '05',
			icon: Flower,
			titleMain: t('home.hero.plugins.title'),
			titleAccent: t('home.hero.plugins.subtitle'),
			subtitle: t('home.hero.plugins.desc'),
			spotlightA: 'from-violet-500/25',
			spotlightB: 'via-purple-400/18',
			spotlightC: 'to-indigo-300/0',
			accent: 'text-violet-500/80',
			hue: 'violet',
			cta: [
				{
					label: t('home.features.enter'),
					primary: true,
					onClick: () => navigate('/plugins'),
				},
				{
					label: t('home.steps.pluginDev.title'),
					primary: false,
					onClick: () =>
						void openExternalUrl(getPluginDevGuideAbsoluteUrl(locale)),
				},
			],
			tags: [],
		},
	] as const;
}

export function createChevrons(goHero: (delta: number) => void): {
	icon: LucideIcon;
	ariaLabel: string;
	onClick: () => void;
}[] {
	return [
		{
			icon: ChevronLeft,
			ariaLabel: '上一张',
			onClick: () => goHero(-1),
		},
		{
			icon: ChevronRight,
			ariaLabel: '下一张',
			onClick: () => goHero(1),
		},
	];
}
