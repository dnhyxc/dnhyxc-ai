import { useCallback, useMemo } from 'react';
import useStore from '@/store';

export const useSessionLoading = () => {
	const { chatStore } = useStore();

	// 判断当前会话是否正在加载
	const isCurrentSessionLoading = useMemo(() => {
		// const currentSessionId = chatStore.activeSessionId;
		// if (!currentSessionId) return false;
		// return chatStore.loadingSessions.has(currentSessionId);
		return chatStore.isCurrentSessionLoading;
	}, [chatStore]);

	// 设置会话加载状态
	const setSessionLoading = useCallback(
		(sessionId: string, isLoading: boolean) => {
			// if (isLoading) {
			// 	chatStore.addLoadingSession(sessionId);
			// } else {
			// 	chatStore.delLoadingSession(sessionId);
			// }
			chatStore.setSessionLoading(sessionId, isLoading);
		},
		[chatStore],
	);

	// 清除所有会话的加载状态
	const clearAllSessionLoading = useCallback(() => {
		chatStore.clearLoadingSessions();
	}, [chatStore]);

	return {
		isCurrentSessionLoading,
		setSessionLoading,
		clearAllSessionLoading,
	};
};
