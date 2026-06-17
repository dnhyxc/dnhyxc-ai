import { useCallback, useEffect, useRef, useState } from 'react';

/** 助手消息复制反馈：isCopyedId + onCopy（500ms 复位） */
export function useAssistantCopy() {
	const [isCopyedId, setIsCopyedId] = useState('');
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const onCopy = useCallback((content: string, chatId: string) => {
		void navigator.clipboard.writeText(content);
		setIsCopyedId(chatId);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => setIsCopyedId(''), 1000);
	}, []);

	return { isCopyedId, onCopy };
}
