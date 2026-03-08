import { useCallback } from 'react';
import { findLatestBranchSelection } from '@/components/design/ChatBot/tools';
import useStore from '@/store';
import { Message } from '@/types/chat';

interface UseBranchManagementProps {
	messages: Message[];
	selectedChildMap: Map<string, string>;
	setSelectedChildMap: (map: Map<string, string>) => void;
	setAutoScroll: (autoScroll: boolean) => void;
}

export const useBranchManage = ({
	messages,
	selectedChildMap,
	setSelectedChildMap,
	setAutoScroll,
}: UseBranchManagementProps) => {
	const { chatStore } = useStore();

	// 检测当前显示的分支是否包含流式消息，只检查当前会话的流式消息
	const isStreamingBranchVisible = useCallback(() => {
		const currentSessionId = chatStore.activeSessionId;
		if (!currentSessionId) return true;

		// 只获取当前会话的流式消息
		const streamingMessages = chatStore.getStreamingMessages().filter((msg) => {
			const branchData = chatStore.streamingBranchMaps.get(msg.chatId);
			return branchData?.sessionId === currentSessionId;
		});

		// 如果没有当前会话的流式消息，返回 true 表示当前分支"可见"
		if (streamingMessages.length === 0) return true;

		// 检查当前显示的 messages 中是否包含任何当前会话的流式消息
		const visibleChatIds = new Set(messages.map((m) => m.chatId));
		return streamingMessages.some((msg) => visibleChatIds.has(msg.chatId));
	}, [chatStore, messages]);

	// 获取当前不可见的流式消息的分支映射，只查找当前会话的流式消息
	const getInvisibleStreamingBranchMap = useCallback((): Map<
		string,
		string
	> | null => {
		const currentSessionId = chatStore.activeSessionId;
		if (!currentSessionId) return null;

		// 只获取当前会话的流式消息
		const streamingMessages = chatStore.getStreamingMessages().filter((msg) => {
			const branchData = chatStore.streamingBranchMaps.get(msg.chatId);
			return branchData?.sessionId === currentSessionId;
		});

		if (streamingMessages.length === 0) return null;

		// 获取当前可见的消息 ID
		const visibleChatIds = new Set(messages.map((m) => m.chatId));

		// 找到第一个不可见的当前会话的流式消息
		for (const msg of streamingMessages) {
			if (!visibleChatIds.has(msg.chatId)) {
				// 找到对应的分支映射
				const branchMap = chatStore.getStreamingBranchMap(msg.chatId);
				if (branchMap) {
					return branchMap;
				}
			}
		}
		return null;
	}, [chatStore, messages]);

	// 检测当前是否在最新分支，通过检查当前显示的每条消息是否是其父节点的最新子节点来判断
	const isLatestBranch = useCallback(() => {
		if (chatStore.messages.length === 0) return true;
		if (messages.length === 0) return true;

		// 获取最新分支的选择映射
		const latestBranchMap = findLatestBranchSelection(chatStore.messages);
		if (!latestBranchMap || latestBranchMap.size === 0) return true;

		// 检查当前显示的每个节点是否与最新分支一致
		// 遍历当前显示的消息，检查每个消息是否是最新分支中的消息
		for (const msg of messages) {
			const parentId = msg.parentId || 'root';
			const latestChildId = latestBranchMap.get(parentId);
			const currentChildId = selectedChildMap.get(parentId);

			// 如果当前选择的子节点与最新分支的子节点不同，说明不在最新分支
			if (latestChildId && currentChildId && latestChildId !== currentChildId) {
				return false;
			}
		}

		return true;
	}, [chatStore.messages, messages, selectedChildMap]);

	// 切换到最新分支
	const switchToLatestBranch = useCallback(() => {
		if (chatStore.messages.length === 0) return;
		const latestBranchMap = findLatestBranchSelection(chatStore.messages);
		if (latestBranchMap) {
			setSelectedChildMap(new Map(latestBranchMap));
			// 保存分支选择状态
			if (chatStore.activeSessionId) {
				chatStore.saveSessionBranchSelection(
					chatStore.activeSessionId,
					latestBranchMap,
				);
			}
			setAutoScroll(true);
		}
	}, [chatStore, setSelectedChildMap, setAutoScroll]);

	// 切换回流式消息所在的分支
	const switchToStreamingBranch = useCallback(() => {
		const branchMap = getInvisibleStreamingBranchMap();
		if (branchMap) {
			const newSelectedChildMap = new Map(branchMap);
			setSelectedChildMap(newSelectedChildMap);
			// 保存分支选择状态
			if (chatStore.activeSessionId) {
				chatStore.saveSessionBranchSelection(
					chatStore.activeSessionId,
					newSelectedChildMap,
				);
			}
			setAutoScroll(true);
		}
	}, [
		chatStore,
		getInvisibleStreamingBranchMap,
		setSelectedChildMap,
		setAutoScroll,
	]);

	return {
		isStreamingBranchVisible,
		getInvisibleStreamingBranchMap,
		isLatestBranch,
		switchToLatestBranch,
		switchToStreamingBranch,
	};
};
