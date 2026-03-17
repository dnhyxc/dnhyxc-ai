import { useCallback, useEffect } from 'react';
import useStore from '@/store';
import { Message } from '@/types/chat';

interface UseBranchManagementProps {
	messages: Message[];
	selectedChildMap: Map<string, string>;
	setSelectedChildMap: (map: Map<string, string>) => void;
	onScrollTo: (position: string) => void;
}

export const useBranchManage = ({
	messages,
	selectedChildMap,
	setSelectedChildMap,
	onScrollTo,
}: UseBranchManagementProps) => {
	const { chatStore } = useStore();

	let latestBranchTimer: ReturnType<typeof setTimeout> | null = null;
	let streamingBranchTimer: ReturnType<typeof setTimeout> | null = null;

	useEffect(() => {
		return () => {
			if (latestBranchTimer) {
				clearTimeout(latestBranchTimer);
				latestBranchTimer = null;
			}
			if (streamingBranchTimer) {
				clearTimeout(streamingBranchTimer);
				streamingBranchTimer = null;
			}
		};
	}, []);

	// 查找最新的分支选择：自动选择每个层级的最新（最后创建）子节点
	const findLatestBranchSelection = (
		allMessages: Message[],
	): Map<string, string> => {
		//
		const selectionMap = new Map<string, string>();
		// 构建父子关系映射，同时找出所有子节点ID
		const childIdSet = new Set<string>();
		const childrenByParentId = new Map<string, Message[]>();

		allMessages.forEach((m) => {
			// 收集所有子节点ID
			m.childrenIds?.forEach((c) => {
				childIdSet.add(c);
			});
			// 构建父节点到子消息的映射
			if (m.parentId) {
				const siblings = childrenByParentId.get(m.parentId) || [];
				siblings.push(m);
				childrenByParentId.set(m.parentId, siblings);
			}
		});

		// 找出根消息：不是任何消息的子节点 且 没有父节点
		const rootMessages = allMessages.filter(
			(m) => !childIdSet.has(m.chatId) && !m.parentId,
		);

		if (rootMessages.length === 0) {
			return selectionMap;
		}

		// 获取消息时间戳
		const getTimestamp = (m: Message): number =>
			m.createdAt
				? new Date(m.createdAt).getTime()
				: new Date(m.timestamp).getTime();

		// 获取最新的消息
		const getLatestMessage = (messages: Message[]): Message =>
			messages.reduce((latest, current) =>
				getTimestamp(current) > getTimestamp(latest) ? current : latest,
			);

		// 选择最新的根消息
		const latestRoot = getLatestMessage(rootMessages);
		selectionMap.set('root', latestRoot.chatId);

		// 递归选择每个层级的最新子节点
		let currentMessage = latestRoot;
		while (currentMessage.childrenIds?.length) {
			const children = childrenByParentId.get(currentMessage.chatId);
			if (!children?.length) break;

			const latestChild = getLatestMessage(children);
			selectionMap.set(currentMessage.chatId, latestChild.chatId);
			currentMessage = latestChild;
		}

		return selectionMap;
	};

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
			if (latestBranchTimer) {
				clearTimeout(latestBranchTimer);
				latestBranchTimer = null;
			}
			// setAutoScroll(true);
			latestBranchTimer = setTimeout(() => {
				onScrollTo('down');
			}, 50);
		}
	}, [chatStore, setSelectedChildMap, onScrollTo]);

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
			if (streamingBranchTimer) {
				clearTimeout(streamingBranchTimer);
				streamingBranchTimer = null;
			}
			// setAutoScroll(true);
			streamingBranchTimer = setTimeout(() => {
				onScrollTo('down');
			}, 50);
		}
	}, [
		chatStore,
		getInvisibleStreamingBranchMap,
		setSelectedChildMap,
		onScrollTo,
	]);

	return {
		isStreamingBranchVisible,
		getInvisibleStreamingBranchMap,
		isLatestBranch,
		switchToLatestBranch,
		switchToStreamingBranch,
		findLatestBranchSelection,
	};
};
