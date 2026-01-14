import { useEffect, useState } from 'react';
import { getStorage } from '@/utils';

export const useUserInfo = () => {
	const [userInfo, setUserInfo] = useState(() =>
		JSON.parse(getStorage('userInfo') || '{}'),
	);

	useEffect(() => {
		const handleStorageChange = () => {
			setUserInfo(JSON.parse(getStorage('userInfo') || '{}'));
		};

		window.addEventListener('storage', handleStorageChange);
		window.addEventListener('userInfoChanged', handleStorageChange);

		return () => {
			window.removeEventListener('storage', handleStorageChange);
			window.removeEventListener('userInfoChanged', handleStorageChange);
		};
	}, []);

	return { userInfo, setUserInfo };
};

import {
	getValue,
	onEmit,
	setBodyClass,
	setThemeToAllWindows,
	setValue,
} from '@/utils';

export const useTheme = () => {
	const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('light');

	useEffect(() => {
		initTheme();
	}, []);

	const initTheme = async () => {
		const theme = (await getValue('theme')) as 'dark' | 'light';
		setCurrentTheme(theme);
		setThemeToAllWindows(theme);
		setBodyClass(theme);
	};

	const toggleTheme = async () => {
		const beforeTheme = await getValue('theme');
		const type = beforeTheme === 'light' ? 'dark' : 'light';
		await setValue('theme', type);
		setThemeToAllWindows(type);
		setBodyClass(type);
		setCurrentTheme(type);
		onEmit('theme', type);
	};

	return { toggleTheme, currentTheme };
};
