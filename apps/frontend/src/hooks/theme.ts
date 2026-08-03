import { useEffect, useState } from 'react';
import { onEmit } from '@/utils/event';
import { getValue, setValue } from '@/utils/store';

export const THEMES = [
	{
		name: 'white',
		value: '#ffffff',
		label: '白色',
		labelKey: 'setting.theme.color.white',
		type: 'color',
	},
	{
		name: 'black',
		value: '#1e1e1e',
		label: '黑色',
		labelKey: 'setting.theme.color.black',
		type: 'color',
	},
	{
		name: 'green',
		value: '#469c77',
		label: '绿色',
		labelKey: 'setting.theme.color.green',
		type: 'color',
	},
	{
		name: 'purple',
		value: '#8076c3',
		label: '紫色',
		labelKey: 'setting.theme.color.purple',
		type: 'color',
	},
	{
		name: 'blue-1',
		value: '#7987c4',
		label: '蓝紫',
		labelKey: 'setting.theme.color.bluePurple',
		type: 'color',
	},
	{
		name: 'blue-2',
		value: '#607ce9',
		label: '蓝色',
		labelKey: 'setting.theme.color.blue',
		type: 'color',
	},
	{
		name: 'blue-3',
		value: '#459ac3',
		label: '青蓝',
		labelKey: 'setting.theme.color.cyanBlue',
		type: 'color',
	},
	{
		name: 'orange',
		value: '#f3ad56',
		label: '橙色',
		labelKey: 'setting.theme.color.orange',
		type: 'color',
	},
	{
		name: 'red',
		value: '#eb7177',
		label: '红色',
		labelKey: 'setting.theme.color.red',
		type: 'color',
	},
	{
		name: 'beige',
		value: '#c1b7a6',
		label: '米色',
		labelKey: 'setting.theme.color.beige',
		type: 'color',
	},
] as const;

export type ThemeName = (typeof THEMES)[number]['name'];

/**
 * 交互强调色（与彩色主题正交；默认 teal-500）
 * 下列 9 色顺序与 hex 一一对应，名称/描述按色相匹配。
 */
export const ACCENT_COLORS = [
	{
		id: 'teal',
		hex: '#14B8A6',
		label: '默认',
		labelKey: 'setting.theme.accent.teal',
		descKey: 'setting.theme.accent.teal.desc',
	},
	{
		id: 'yuebai',
		hex: '#B9D731',
		label: '青柠',
		labelKey: 'setting.theme.accent.yuebai',
		descKey: 'setting.theme.accent.yuebai.desc',
	},
	{
		id: 'zhizi',
		hex: '#EB507E',
		label: '桃红',
		labelKey: 'setting.theme.accent.zhizi',
		descKey: 'setting.theme.accent.zhizi.desc',
	},
	{
		id: 'xueqing',
		hex: '#1361AB',
		label: '靛青',
		labelKey: 'setting.theme.accent.xueqing',
		descKey: 'setting.theme.accent.xueqing.desc',
	},
	{
		id: 'canglang',
		hex: '#B95036',
		label: '赭石',
		labelKey: 'setting.theme.accent.canglang',
		descKey: 'setting.theme.accent.canglang.desc',
	},
	{
		id: 'wuxin',
		hex: '#F2CE2B',
		label: '缃黄',
		labelKey: 'setting.theme.accent.wuxin',
		descKey: 'setting.theme.accent.wuxin.desc',
	},
	{
		id: 'yushi',
		hex: '#F09C5A',
		label: '杏橙',
		labelKey: 'setting.theme.accent.yushi',
		descKey: 'setting.theme.accent.yushi.desc',
	},
	{
		id: 'tuoyan',
		hex: '#21373D',
		label: '黛青',
		labelKey: 'setting.theme.accent.tuoyan',
		descKey: 'setting.theme.accent.tuoyan.desc',
	},
	{
		id: 'xicao',
		hex: '#EBEFBA',
		label: '松花',
		labelKey: 'setting.theme.accent.xicao',
		descKey: 'setting.theme.accent.xicao.desc',
	},
	{
		id: 'qiansui',
		hex: '#1F3028',
		label: '苍翠',
		labelKey: 'setting.theme.accent.qiansui',
		descKey: 'setting.theme.accent.qiansui.desc',
	},
] as const;

/** hex 徽章字色：深底白字、浅底深字 */
export function accentBadgeFg(hex: string): '#fff' | '#1a1a1a' {
	const h = hex.replace('#', '');
	if (h.length < 6) return '#1a1a1a';
	const r = Number.parseInt(h.slice(0, 2), 16);
	const g = Number.parseInt(h.slice(2, 4), 16);
	const b = Number.parseInt(h.slice(4, 6), 16);
	return (r * 299 + g * 587 + b * 114) / 1000 < 160 ? '#fff' : '#1a1a1a';
}

export type AccentId = (typeof ACCENT_COLORS)[number]['id'];

const DEFAULT_ACCENT_ID: AccentId = 'teal';

/** 供 index.html 首屏脚本读取，与 Tauri store 同步，减轻刷新时主题晚于首帧 */
export const THEME_BOOTSTRAP_STORAGE_KEY = 'dnhyxc_theme_bootstrap';
/** 主题色 bootstrap，与 theme 并列，防首帧 teal 闪一下 */
export const ACCENT_BOOTSTRAP_STORAGE_KEY = 'dnhyxc_accent_bootstrap';

function persistThemeBootstrap(themeName: ThemeName) {
	try {
		localStorage.setItem(THEME_BOOTSTRAP_STORAGE_KEY, themeName);
	} catch {
		// 私密模式等场景忽略
	}
}

function persistAccentBootstrap(accentId: AccentId) {
	try {
		localStorage.setItem(ACCENT_BOOTSTRAP_STORAGE_KEY, accentId);
	} catch {
		// 私密模式等场景忽略
	}
}

function resolveAccentId(raw: string | null | undefined): AccentId | null {
	if (!raw) return null;
	return ACCENT_COLORS.some((c) => c.id === raw) ? (raw as AccentId) : null;
}

/** 将主题色写入 html：--brand-accent 及 light/dark 派生 */
export function applyAccentToDocument(accentId: AccentId) {
	const item =
		ACCENT_COLORS.find((c) => c.id === accentId) ??
		ACCENT_COLORS.find((c) => c.id === DEFAULT_ACCENT_ID)!;
	const root = document.documentElement;
	root.style.setProperty('--brand-accent', item.hex);
	root.style.setProperty(
		'--brand-accent-soft',
		`color-mix(in oklch, ${item.hex} 95%, white)`,
	);
	root.style.setProperty(
		'--brand-accent-light',
		`color-mix(in oklch, ${item.hex} 95%, black)`,
	);
	root.style.setProperty(
		'--brand-accent-dark',
		`color-mix(in oklch, ${item.hex} 80%, black)`,
	);
}

function readAccentBootstrapSync(): AccentId | null {
	if (typeof window === 'undefined') return null;
	try {
		const b = resolveAccentId(
			localStorage.getItem(ACCENT_BOOTSTRAP_STORAGE_KEY),
		);
		if (b) return b;
		const j = localStorage.getItem('dnhyxc_settings_json');
		if (!j) return null;
		const o = JSON.parse(j) as { accentColor?: string };
		return resolveAccentId(o.accentColor);
	} catch {
		return null;
	}
}

/** 与 index.html 首屏逻辑一致，供 useState 初值与 body class 对齐 */
function readThemeBootstrapSync(): ThemeName | null {
	if (typeof window === 'undefined') {
		return null;
	}
	try {
		const fromUrl = parseThemeFromSearch(window.location.search);
		if (fromUrl) {
			return fromUrl;
		}
		const b = localStorage.getItem(THEME_BOOTSTRAP_STORAGE_KEY) as ThemeName;
		if (b && THEMES.some((t) => t.name === b)) {
			return b;
		}
		const j = localStorage.getItem('dnhyxc_settings_json');
		if (!j) {
			return null;
		}
		const o = JSON.parse(j) as { themeType?: string };
		const t = o.themeType as ThemeName;
		return t && THEMES.some((x) => x.name === t) ? t : null;
	} catch {
		return null;
	}
}

/** Tauri 窗口标题栏 light/dark，与 changeTheme 写入的 `theme` 一致（black→dark，其余→light） */
export function readWindowChromeThemeSync(): 'light' | 'dark' {
	const name = readThemeBootstrapSync();
	if (name === 'black') return 'dark';
	if (name) return 'light';
	try {
		const j = localStorage.getItem('dnhyxc_settings_json');
		if (j) {
			const o = JSON.parse(j) as { theme?: string; themeType?: string };
			if (o.theme === 'dark' || o.theme === 'light') return o.theme;
			if (o.themeType === 'black') return 'dark';
			if (o.themeType) return 'light';
		}
	} catch {
		// ignore
	}
	const legacy = localStorage.getItem('theme');
	if (legacy === 'dark' || legacy === 'light') return legacy;
	return 'light';
}

/** 从查询串解析主题名（用于分享页等在浏览器中还原壳内主题） */
export function parseThemeFromSearch(search: string): ThemeName | null {
	const params = new URLSearchParams(
		search.startsWith('?') ? search : `?${search}`,
	);
	const raw = params.get('theme') || params.get('themeType');
	if (!raw) {
		return null;
	}
	const item = THEMES.find((t) => t.name === raw);
	return item ? (item.name as ThemeName) : null;
}

/**
 * 为分享链接追加 theme 查询参数（独立浏览器打开时可读到与 Tauri 一致的主题）
 * @param url 后端返回的绝对或相对 URL
 * @param themeName 当前配色主题名
 */
export function appendShareThemeQuery(
	url: string,
	themeName: ThemeName,
): string {
	try {
		const base =
			typeof window !== 'undefined'
				? window.location.origin
				: 'http://localhost';
		const u = new URL(url, url.startsWith('http') ? undefined : base);
		u.searchParams.set('theme', themeName);
		return u.toString();
	} catch {
		const sep = url.includes('?') ? '&' : '?';
		return `${url}${sep}theme=${encodeURIComponent(themeName)}`;
	}
}

export const useTheme = () => {
	const [theme, setTheme] = useState<ThemeName>(
		() => readThemeBootstrapSync() ?? 'white',
	);
	const [accent, setAccent] = useState<AccentId>(
		() => readAccentBootstrapSync() ?? DEFAULT_ACCENT_ID,
	);

	useEffect(() => {
		// 启动时先把当前主题应用到 body。
		// 否则虽然 state 默认是 white，但未触发 changeTheme 时不会写入 body class / CSS 变量，
		// 导致“设置页默认选中 white，但主题未生效，必须手动点一次”。
		setThemeClass(theme);
		persistThemeBootstrap(theme);
		applyAccentToDocument(accent);
		persistAccentBootstrap(accent);

		const initTheme = async () => {
			// URL 优先：从 Tauri 复制出的分享链接带 ?theme=，浏览器无 store 也能对齐
			const fromUrl =
				typeof window !== 'undefined'
					? parseThemeFromSearch(window.location.search)
					: null;
			if (fromUrl) {
				setTheme(fromUrl);
				setThemeClass(fromUrl);
				persistThemeBootstrap(fromUrl);
			} else {
				const themeType = (await getValue('themeType')) as ThemeName;
				const themeItem = THEMES.find((t) => t.name === themeType);
				if (themeItem?.type === 'color' && themeType) {
					setTheme(themeType);
					setThemeClass(themeType);
					persistThemeBootstrap(themeType);
				}
			}

			const storedAccent = resolveAccentId(
				(await getValue('accentColor')) as string | undefined,
			);
			if (storedAccent) {
				setAccent(storedAccent);
				applyAccentToDocument(storedAccent);
				persistAccentBootstrap(storedAccent);
			}
		};
		void initTheme();
	}, []);

	const setThemeClass = (themeName: string) => {
		document.body.classList.remove(
			...THEMES.filter((t) => t.type === 'color').map((t) => `theme-${t.name}`),
		);
		const themeItem = THEMES.find((t) => t.name === themeName);
		if (themeItem?.type === 'color') {
			document.body.classList.add(`theme-${themeName}`);
			setTimeout(() => applyThemeVariables(), 10);
		} else {
			resetToDefaultTheme();
		}
	};

	const applyThemeVariables = () => {
		/* 主题类挂在 body 上，需从 body 读取 --theme-*，避免 html 上仍是 :root 默认值 */
		const themeStyles = getComputedStyle(document.body);
		const themeBg = themeStyles.getPropertyValue('--theme-background').trim();
		const themeCard = themeStyles.getPropertyValue('--theme-card').trim();
		const themeMuted = themeStyles.getPropertyValue('--theme-muted').trim();
		const themeBorder = themeStyles.getPropertyValue('--theme-border').trim();
		const themeFg = themeStyles.getPropertyValue('--theme-foreground').trim();
		const themeSec = themeStyles.getPropertyValue('--theme-secondary').trim();
		const themeSidebar = themeStyles.getPropertyValue('--theme-sidebar').trim();
		const themeRing = themeStyles.getPropertyValue('--theme-ring').trim();

		const root = document.documentElement;
		root.style.setProperty('--background', themeBg);
		root.style.setProperty('--card', themeCard);
		root.style.setProperty('--muted', themeMuted);
		root.style.setProperty('--border', themeBorder);
		root.style.setProperty('--foreground', themeFg);
		root.style.setProperty('--secondary', themeSec);
		root.style.setProperty('--sidebar', themeSidebar);
		root.style.setProperty('--popover', themeCard);
		root.style.setProperty('--accent', themeMuted);
		if (themeRing) {
			root.style.setProperty('--ring', themeRing);
		}
	};

	const resetToDefaultTheme = () => {
		document.documentElement.style.setProperty('--background', 'oklch(1 0 0)');
		document.documentElement.style.setProperty(
			'--foreground',
			'oklch(0.13 0.028 261.692)',
		);
		document.documentElement.style.setProperty('--card', 'oklch(1 0 0)');
		document.documentElement.style.setProperty(
			'--muted',
			'oklch(0.967 0.003 264.542)',
		);
		document.documentElement.style.setProperty(
			'--border',
			'oklch(0.928 0.006 264.531)',
		);
		document.documentElement.style.setProperty(
			'--secondary',
			'oklch(0.967 0.003 264.542)',
		);
		document.documentElement.style.setProperty(
			'--sidebar',
			'oklch(0.985 0.002 247.839)',
		);
		document.documentElement.style.setProperty('--popover', 'oklch(1 0 0)');
		document.documentElement.style.setProperty(
			'--accent',
			'oklch(0.967 0.003 264.542)',
		);
		document.documentElement.style.removeProperty('--ring');
	};

	const changeTheme = async (themeName: ThemeName, emit = true) => {
		const themeItem = THEMES.find((t) => t.name === themeName);
		if (themeItem?.type === 'color') {
			setTheme(themeName);
			setThemeClass(themeName);
			persistThemeBootstrap(themeName);
			const chrome = themeName === 'black' ? 'dark' : 'light';
			await setValue('theme', chrome);
			await setValue('themeType', themeName);
			// 同步所有 Tauri 窗标题栏（含 about）
			void import('@/utils/tauri').then(({ setThemeToAllWindows }) => {
				void setThemeToAllWindows(chrome);
			});
		}
		if (emit) {
			onEmit('theme', themeName);
		}
	};

	const changeAccent = async (accentId: AccentId) => {
		const item = ACCENT_COLORS.find((c) => c.id === accentId);
		if (!item) return;
		setAccent(accentId);
		applyAccentToDocument(accentId);
		persistAccentBootstrap(accentId);
		await setValue('accentColor', accentId);
	};

	return {
		theme,
		changeTheme,
		themes: THEMES,
		accent,
		changeAccent,
		accents: ACCENT_COLORS,
	};
};
