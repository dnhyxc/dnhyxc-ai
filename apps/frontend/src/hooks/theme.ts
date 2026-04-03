import { useEffect, useState } from 'react';
import { getValue, onEmit, setValue } from '@/utils';

export const THEMES = [
	{ name: 'white', value: '#ffffff', label: '白色', type: 'color' },
	{ name: 'black', value: '#1e1e1e', label: '黑色', type: 'color' },
	{ name: 'green', value: '#469c77', label: '绿色', type: 'color' },
	{ name: 'purple', value: '#8076c3', label: '紫色', type: 'color' },
	{ name: 'blue-1', value: '#7987c4', label: '蓝紫', type: 'color' },
	{ name: 'blue-2', value: '#607ce9', label: '蓝色', type: 'color' },
	{ name: 'blue-3', value: '#459ac3', label: '青蓝', type: 'color' },
	{ name: 'orange', value: '#f3ad56', label: '橙色', type: 'color' },
	{ name: 'red', value: '#eb7177', label: '红色', type: 'color' },
	{ name: 'beige', value: '#c1b7a6', label: '米色', type: 'color' },
] as const;

export type ThemeName = (typeof THEMES)[number]['name'];

/** 供 index.html 首屏脚本读取，与 Tauri store 同步，减轻刷新时主题晚于首帧 */
export const THEME_BOOTSTRAP_STORAGE_KEY = 'dnhyxc_theme_bootstrap';

function persistThemeBootstrap(themeName: ThemeName) {
	try {
		localStorage.setItem(THEME_BOOTSTRAP_STORAGE_KEY, themeName);
	} catch {
		// 私密模式等场景忽略
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

	useEffect(() => {
		const initTheme = async () => {
			// URL 优先：从 Tauri 复制出的分享链接带 ?theme=，浏览器无 store 也能对齐
			if (typeof window !== 'undefined') {
				const fromUrl = parseThemeFromSearch(window.location.search);
				if (fromUrl) {
					setTheme(fromUrl);
					setThemeClass(fromUrl);
					persistThemeBootstrap(fromUrl);
					return;
				}
			}

			const themeType = (await getValue('themeType')) as ThemeName;

			const themeItem = THEMES.find((t) => t.name === themeType);
			const isColorTheme = themeItem?.type === 'color';

			if (isColorTheme && themeType) {
				setTheme(themeType);
				setThemeClass(themeType);
				persistThemeBootstrap(themeType);
			}
		};
		initTheme();
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
			await setValue('theme', themeName === 'black' ? 'dark' : 'light');
			await setValue('themeType', themeName);
		}
		if (emit) {
			onEmit('theme', themeName);
		}
	};

	return { theme, changeTheme, themes: THEMES };
};
