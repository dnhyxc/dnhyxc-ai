import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useRef, useState } from 'react';
import { getStorage as getLocalStorage, setStorage } from '@/utils';

export * from './theme';

export const useCountdown = (initialTime = 60, storageKey = 'countdown') => {
	const [timeLeft, setTimeLeft] = useState(() => {
		const savedTime = getLocalStorage(`${storageKey}_time`);
		return savedTime ? parseFloat(savedTime) : initialTime;
	});
	const [isRunning, setIsRunning] = useState(() => {
		const savedState = getLocalStorage(`${storageKey}_state`);
		return savedState === 'running';
	});

	const animationFrameRef = useRef<number | null>(null);
	const lastTimestampRef = useRef<number | null>(null);

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

		setTimeLeft((prevTime: number) => {
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

export const useStorageInfo = (key?: string) => {
	const [storageInfo, setStorageInfo] = useState(() =>
		JSON.parse(getStorage(key || 'userInfo') || '{}'),
	);

	const eventKey = key ? `${key}Changed` : 'userInfoChanged';

	useEffect(() => {
		const handleStorageChange = () => {
			setStorageInfo(JSON.parse(getStorage(key || 'userInfo') || '{}'));
		};

		window.addEventListener('storage', handleStorageChange);
		window.addEventListener(eventKey, handleStorageChange);

		return () => {
			window.removeEventListener('storage', handleStorageChange);
			window.removeEventListener(eventKey, handleStorageChange);
		};
	}, []);

	return { storageInfo, setStorageInfo };
};

const getStorage = (key: string) => {
	if (typeof window !== 'undefined') {
		return localStorage.getItem(key);
	}
	return '';
};

export const useGetVersion = () => {
	const [version, setVersion] = useState('');

	useEffect(() => {
		getCurrentVersion();
	}, []);

	const getCurrentVersion = async () => {
		const version = await getVersion();
		setVersion(version);
	};

	return { version };
};
