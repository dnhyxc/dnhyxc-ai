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

	/**
	 * 查找最新的分支选择：自动选择每个层级的最新（最后创建）子节点。
	 * 从消息数组中找出从最新根消息开始，沿每一层最新子节点延伸的唯一分支，
	 * 并用 Map 记录路径（根节点对应 'root'，每个父节点对应选中的子节点）。
	 * @param allMessages 所有消息对象数组
	 * @returns Map 记录了选中分支的父子关系
	 */
	const findLatestBranchSelection = (
		allMessages: Message[],
	): Map<string, string> => {
		// 初始化一个 Map，用于存储最终选中的分支路径
		const selectionMap = new Map<string, string>();
		// 构建两个辅助数据结构：
		// childIdSet 用于快速判断一个消息 ID 是否曾经作为子节点出现过
		const childIdSet = new Set<string>();
		// childrenByParentId 按父消息 ID 分组存储其直接子消息对象，便于快速查找子消息列表
		const childrenByParentId = new Map<string, Message[]>();

		// 遍历所有消息，填充上述两个数据结构
		allMessages.forEach((m) => {
			// 收集当前消息的 childrenIds 数组中所有 ID 到 childIdSet
			// 这些 ID 表示它们是其他消息的子节点
			m.childrenIds?.forEach((c) => {
				childIdSet.add(c);
			});

			// 如果当前消息有父节点（parentId 存在），则将其添加到 childrenByParentId 映射中
			if (m.parentId) {
				// 获取该父节点下已有的子消息列表，如果不存在则初始化为空数组
				const siblings = childrenByParentId.get(m.parentId) || [];
				// 将当前消息加入该父节点的子消息列表
				siblings.push(m);
				// 更新映射
				childrenByParentId.set(m.parentId, siblings);
			}
		});

		// 找出所有根消息：一个消息是根消息，当且仅当它既不是任何消息的子节点
		// （即它的 chatId 不在 childIdSet 中）且它自身没有 parentId
		const rootMessages = allMessages.filter(
			(m) => !childIdSet.has(m.chatId) && !m.parentId,
		);

		// 如果没有根消息，则直接返回空的 selectionMap
		if (rootMessages.length === 0) {
			return selectionMap;
		}

		// 定义一个辅助函数，用于获取消息的时间戳（毫秒数）
		// 优先使用 createdAt 字段，如果不存在则回退到 timestamp 字段
		const getTimestamp = (m: Message): number =>
			m.createdAt
				? new Date(m.createdAt).getTime()
				: new Date(m.timestamp).getTime();

		// 定义一个辅助函数，用于从一组消息中找出时间戳最大的那一条（即最新的消息）
		// 使用 reduce 遍历，每次保留时间戳更大的消息；若时间戳相等，保留先遇到的那个
		const getLatestMessage = (messages: Message[]): Message =>
			messages.reduce((latest, current) =>
				getTimestamp(current) > getTimestamp(latest) ? current : latest,
			);

		// 从根消息列表中选出最新的那条作为起始根消息
		const latestRoot = getLatestMessage(rootMessages);
		// 在 selectionMap 中记录根节点，键为固定字符串 'root'，值为根消息的 chatId
		selectionMap.set('root', latestRoot.chatId);

		// 开始沿分支向下遍历：从 latestRoot 出发，不断寻找其最新子节点，直到没有子节点为止
		let currentMessage = latestRoot;
		// 循环条件：当前消息的 childrenIds 数组存在且长度大于 0
		// 注意：childrenIds 的存在只表示可能有子节点，还需要检查实际子消息对象是否存在
		while (currentMessage.childrenIds?.length) {
			// 根据当前消息的 chatId 从 childrenByParentId 映射中获取其实际存在的子消息列表
			const children = childrenByParentId.get(currentMessage.chatId);
			// 如果没有子消息列表或列表为空，则终止循环
			if (!children?.length) break;

			// 从这些子消息中选出最新的那一条
			const latestChild = getLatestMessage(children);
			// 在 selectionMap 中记录当前父消息选中的子消息，键为父消息 chatId，值为子消息 chatId
			selectionMap.set(currentMessage.chatId, latestChild.chatId);
			// 将当前消息指针移动到最新子消息，以便继续向下遍历
			currentMessage = latestChild;
		}

		// 返回最终构建的路径 Map
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
