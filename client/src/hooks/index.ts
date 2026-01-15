import { useEffect, useRef, useState } from 'react';
import { getStorage, setStorage } from '@/utils';

export const useCountdown = (initialTime = 60, storageKey = 'countdown') => {
	const [timeLeft, setTimeLeft] = useState(() => {
		const savedTime = getStorage(`${storageKey}_time`);
		return savedTime ? parseFloat(savedTime) : initialTime;
	});
	const [isRunning, setIsRunning] = useState(() => {
		const savedState = getStorage(`${storageKey}_state`);
		return savedState === 'running';
	});

	const animationFrameRef = useRef<number>(null);
	const lastTimestampRef = useRef<number>(null);

	useEffect(() => {
		if (isRunning) {
			animationFrameRef.current = requestAnimationFrame(animate);
		} else {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		}

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [isRunning]);

	const animate = (timestamp: number) => {
		if (!lastTimestampRef.current) {
			lastTimestampRef.current = timestamp;
		}

		const deltaTime = timestamp - lastTimestampRef.current;
		lastTimestampRef.current = timestamp;

		setTimeLeft((prevTime) => {
			const newTime = prevTime - deltaTime / 1000;

			if (newTime <= 0) {
				setIsRunning(false);
				setStorage(`${storageKey}_time`, '0');
				setStorage(`${storageKey}_state`, 'stopped');
				return 0;
			}

			setStorage(`${storageKey}_time`, newTime.toString());
			setStorage(`${storageKey}_state`, 'running');
			return newTime;
		});

		if (isRunning) {
			animationFrameRef.current = requestAnimationFrame(animate);
		}
	};

	const startTimer = () => {
		if (!isRunning) {
			setIsRunning(true);
			lastTimestampRef.current = null;

			if (timeLeft <= 0) {
				setTimeLeft(initialTime);
				setStorage(`${storageKey}_time`, initialTime.toString());
				setStorage(`${storageKey}_state`, 'running');
			} else {
				setStorage(`${storageKey}_time`, timeLeft.toString());
				setStorage(`${storageKey}_state`, 'running');
			}
		}
	};

	const resetTimer = () => {
		setTimeLeft(initialTime);
		setIsRunning(false);
		if (animationFrameRef.current) {
			cancelAnimationFrame(animationFrameRef.current);
		}
	};

	return { timeLeft, isRunning, startTimer, resetTimer };
};

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
