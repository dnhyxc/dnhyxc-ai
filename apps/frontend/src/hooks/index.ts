import { useEffect, useRef, useState } from 'react';
import { isTauriRuntime } from '@/utils/runtime';

export * from './i18n';
export * from './theme';
export * from './useInputsOnlyTab';
export * from './useIsSuperAdmin';
export * from './useMembershipActive';
export * from './useStandalonePageLocaleFromSearch';

/** ponytail: 本地读写即可；勿从 @/utils 桶导入，避免壳层误拉整包 utils */
const getLocalStorage = (key: string) => {
	if (typeof window !== 'undefined') {
		return localStorage.getItem(key);
	}
	return '';
};

const setLocalStorage = (key: string, value: string) => {
	if (typeof window !== 'undefined') {
		localStorage.setItem(key, value);
	}
};

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
				setLocalStorage(`${storageKey}_time`, '0');
				setLocalStorage(`${storageKey}_state`, 'stopped');
				return 0;
			}

			setLocalStorage(`${storageKey}_time`, newTime.toString());
			setLocalStorage(`${storageKey}_state`, 'running');
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
				setLocalStorage(`${storageKey}_time`, initialTime.toString());
				setLocalStorage(`${storageKey}_state`, 'running');
			} else {
				setLocalStorage(`${storageKey}_time`, timeLeft.toString());
				setLocalStorage(`${storageKey}_state`, 'running');
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
		JSON.parse(getLocalStorage(key || 'userInfo') || '{}'),
	);

	const eventKey = key ? `${key}Changed` : 'userInfoChanged';

	useEffect(() => {
		const handleStorageChange = () => {
			setStorageInfo(JSON.parse(getLocalStorage(key || 'userInfo') || '{}'));
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

export const useGetVersion = () => {
	const [version, setVersion] = useState('');

	useEffect(() => {
		getCurrentVersion();
	}, []);

	const getCurrentVersion = async () => {
		if (!isTauriRuntime()) {
			setVersion(import.meta.env.VITE_APP_VERSION ?? '浏览器预览');
			return;
		}
		const { getVersion } = await import('@tauri-apps/api/app');
		const v = await getVersion();
		setVersion(v);
	};

	return { version };
};
