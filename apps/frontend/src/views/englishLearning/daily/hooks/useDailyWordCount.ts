import { useCallback, useEffect, useState } from 'react';
import {
	type DailyWordCount,
	ENGLISH_DAILY_WORD_COUNT_CHANGE,
	getDailyWordCount,
	setDailyWordCount,
} from '../utils/dailyWordCount';

export function useDailyWordCount() {
	const [count, setCount] = useState<DailyWordCount>(getDailyWordCount);

	useEffect(() => {
		const onChange = (event: Event) => {
			const detail = (event as CustomEvent<DailyWordCount>).detail;
			setCount(detail ?? getDailyWordCount());
		};
		window.addEventListener(ENGLISH_DAILY_WORD_COUNT_CHANGE, onChange);
		return () => {
			window.removeEventListener(ENGLISH_DAILY_WORD_COUNT_CHANGE, onChange);
		};
	}, []);

	const updateCount = useCallback((next: DailyWordCount) => {
		setDailyWordCount(next);
		setCount(next);
	}, []);

	return [count, updateCount] as const;
}
