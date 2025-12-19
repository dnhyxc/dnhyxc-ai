import { useState } from 'react';
import { getStorage, onEmit, setStorage, setThemeToAllWindows } from '@/utils';

export const useTheme = () => {
	const [theme, setTheme] = useState<'dark' | 'light'>(
		(getStorage('theme') as 'dark' | 'light') || 'light',
	);
	const toggleTheme = async () => {
		const currentTheme = theme === 'light' ? 'dark' : 'light';
		onEmit('theme', currentTheme);
		setThemeToAllWindows(currentTheme);
		setStorage('theme', currentTheme);
		setTheme(currentTheme);
	};

	return { theme, toggleTheme };
};
