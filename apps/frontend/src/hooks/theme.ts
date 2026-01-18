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

export const useTheme = () => {
	const [theme, setTheme] = useState<ThemeName>('white');

	useEffect(() => {
		const initTheme = async () => {
			const themeType = (await getValue('themeType')) as ThemeName;

			const themeItem = THEMES.find((t) => t.name === themeType);
			const isColorTheme = themeItem?.type === 'color';

			if (isColorTheme && themeType) {
				setTheme(themeType);
				setThemeClass(themeType);
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
		const themeStyles = getComputedStyle(document.documentElement);
		const themeBg = themeStyles.getPropertyValue('--theme-background').trim();
		const themeCard = themeStyles.getPropertyValue('--theme-card').trim();
		const themeMuted = themeStyles.getPropertyValue('--theme-muted').trim();
		const themeBorder = themeStyles.getPropertyValue('--theme-border').trim();
		const themeFg = themeStyles.getPropertyValue('--theme-foreground').trim();
		const themeSec = themeStyles.getPropertyValue('--theme-secondary').trim();
		const themeSidebar = themeStyles.getPropertyValue('--theme-sidebar').trim();

		document.documentElement.style.setProperty('--background', themeBg);
		document.documentElement.style.setProperty('--card', themeCard);
		document.documentElement.style.setProperty('--muted', themeMuted);
		document.documentElement.style.setProperty('--border', themeBorder);
		document.documentElement.style.setProperty('--foreground', themeFg);
		document.documentElement.style.setProperty('--secondary', themeSec);
		document.documentElement.style.setProperty('--sidebar', themeSidebar);
		document.documentElement.style.setProperty('--popover', themeCard);
		document.documentElement.style.setProperty('--accent', themeMuted);
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
	};

	const changeTheme = async (themeName: ThemeName, emit = true) => {
		const themeItem = THEMES.find((t) => t.name === themeName);
		if (themeItem?.type === 'color') {
			setTheme(themeName);
			setThemeClass(themeName);
			await setValue('theme', themeName === 'black' ? 'dark' : 'light');
			await setValue('themeType', themeName);
		}
		if (emit) {
			onEmit('theme', themeName);
		}
	};

	return { theme, changeTheme, themes: THEMES };
};
