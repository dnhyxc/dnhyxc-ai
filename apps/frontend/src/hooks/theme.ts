import { useEffect, useState } from 'react';
import { getValue, onEmit, setBodyClass, setValue } from '@/utils';

export const THEMES = [
	{ name: 'light', value: '#ffffff', label: '浅色', type: 'default' },
	{ name: 'dark', value: '#1e1e1e', label: '深色', type: 'default' },
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
	const [theme, setTheme] = useState<ThemeName>('light');
	const [isDark, setIsDark] = useState(false);

	useEffect(() => {
		const initTheme = async () => {
			const savedTheme = (await getValue('theme')) as ThemeName;
			const savedDark = (await getValue('darkMode')) as string;

			const themeItem = THEMES.find((t) => t.name === savedTheme);
			const isColorTheme = themeItem?.type === 'color';

			if (isColorTheme && savedTheme) {
				setTheme(savedTheme);
				setThemeClass(savedTheme, false);
			} else {
				const dark = savedDark === 'dark' || savedTheme === 'dark';
				setIsDark(dark);
				setTheme(dark ? 'dark' : 'light');
				setBodyClass(dark ? 'dark' : 'light');
			}
		};
		initTheme();
	}, []);

	const setThemeClass = (themeName: string, dark: boolean) => {
		document.body.classList.remove(
			...THEMES.filter((t) => t.type === 'color').map((t) => `theme-${t.name}`),
		);
		document.body.classList.remove('dark');

		const themeItem = THEMES.find((t) => t.name === themeName);
		if (themeItem?.type === 'color') {
			document.body.classList.add(`theme-${themeName}`);
			setTimeout(() => applyThemeVariables(), 10);
		} else if (dark) {
			document.body.classList.add('dark');
			resetToDefaultTheme();
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
			setThemeClass(themeName, false);
			await setValue('theme', themeName);
			await setValue('darkMode', 'light');
		} else {
			const dark = themeName === 'dark';
			setTheme(themeName);
			setIsDark(dark);
			setBodyClass(dark ? 'dark' : 'light');
			await setValue('theme', themeName);
			await setValue('darkMode', dark ? 'dark' : 'light');
		}
		if (emit) {
			onEmit('theme', themeName);
		}
	};

	const toggleTheme = async () => {
		const newDark = !isDark;
		setIsDark(newDark);
		setBodyClass(newDark ? 'dark' : 'light');
		await setValue('darkMode', newDark ? 'dark' : 'light');
		onEmit('theme', newDark ? 'dark' : 'light');
	};

	return { theme, isDark, changeTheme, toggleTheme, themes: THEMES };
};
