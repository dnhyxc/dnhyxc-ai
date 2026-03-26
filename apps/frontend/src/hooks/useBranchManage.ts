import { useCallback, useEffect, useMemo } from 'react';
import type { ChatStreamingBranchSource } from '@/types/chat';
import { Message } from '@/types/chat';

/**
 * 从完整消息列表推导「每条父节点选最新子节点」的分支 Map。
 * 提到模块级并导出，供 ChatBot 连接层在会话切换时复用，与 hook 内算法保持完全一致。
 */
export function findLatestBranchSelection(
	allMessages: Message[],
): Map<string, string> {
	const selectionMap = new Map<string, string>();
	const childIdSet = new Set<string>();
	const childrenByParentId = new Map<string, Message[]>();

	allMessages.forEach((m) => {
		m.childrenIds?.forEach((c) => {
			childIdSet.add(c);
		});

		if (m.parentId) {
			const siblings = childrenByParentId.get(m.parentId) || [];
			siblings.push(m);
			childrenByParentId.set(m.parentId, siblings);
		}
	});

	const rootMessages = allMessages.filter(
		(m) => !childIdSet.has(m.chatId) && !m.parentId,
	);

	if (rootMessages.length === 0) {
		return selectionMap;
	}

	const getTimestamp = (m: Message): number =>
		m.createdAt
			? new Date(m.createdAt).getTime()
			: new Date(m.timestamp).getTime();

	const getLatestMessage = (msgs: Message[]): Message =>
		msgs.reduce((latest, current) =>
			getTimestamp(current) > getTimestamp(latest) ? current : latest,
		);

	const latestRoot = getLatestMessage(rootMessages);
	selectionMap.set('root', latestRoot.chatId);

	let currentMessage = latestRoot;
	while (currentMessage.childrenIds?.length) {
		const children = childrenByParentId.get(currentMessage.chatId);
		if (!children?.length) break;

		const latestChild = getLatestMessage(children);
		selectionMap.set(currentMessage.chatId, latestChild.chatId);
		currentMessage = latestChild;
	}

	return selectionMap;
}

export interface UseBranchManagementProps {
	messages: Message[];
	/** 完整树，替代原 chatStore.messages，供最新分支判断与 switchToLatest */
	allFlatMessages: Message[];
	activeSessionId: string | null;
	selectedChildMap: Map<string, string>;
	setSelectedChildMap: (map: Map<string, string>) => void;
	onScrollTo: (position: 'down' | 'up', behavior?: 'smooth' | 'auto') => void;
	/**
	 * 不传时：不访问任何 Store；流式分支相关 UI 逻辑恒为「无需跳转分支」，
	 * 便于 ChatBotView 在第三方项目中零依赖复用。
	 */
	streamingBranchSource?: ChatStreamingBranchSource;
	/**
	 * 替代直接调用 chatStore.saveSessionBranchSelection；
	 * 主项目在连接层注入，独立使用时可省略（仅内存分支状态）。
	 */
	onPersistSessionBranchSelection?: (
		sessionId: string,
		map: Map<string, string>,
	) => void;
}

export const useBranchManage = ({
	messages,
	allFlatMessages,
	activeSessionId,
	selectedChildMap,
	setSelectedChildMap,
	onScrollTo,
	streamingBranchSource,
	onPersistSessionBranchSelection,
}: UseBranchManagementProps) => {
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

	// 与原先 isLatestBranch / switchToLatest 内每次调用一致，但 allFlat 未变时只算一次
	const latestBranchMapFlat = useMemo(
		() => findLatestBranchSelection(allFlatMessages),
		[allFlatMessages],
	);

	// 依赖 messages：流式更新后父组件换新引用，与原先每次在回调里 getStreamingMessages() 一致
	const streamingMsgsThisSession = useMemo(() => {
		if (!streamingBranchSource || !activeSessionId) return [];
		return streamingBranchSource.getStreamingMessages().filter((msg) => {
			const sid = streamingBranchSource.getStreamingMessageSessionId(msg.chatId);
			return sid === activeSessionId;
		});
	}, [streamingBranchSource, activeSessionId, messages]);

	const visibleChatIds = useMemo(
		() => new Set(messages.map((m) => m.chatId)),
		[messages],
	);

	const isStreamingBranchVisibleValue = useMemo(() => {
		if (!streamingBranchSource || !activeSessionId) return true;
		if (streamingMsgsThisSession.length === 0) return true;
		return streamingMsgsThisSession.some((msg) => visibleChatIds.has(msg.chatId));
	}, [
		streamingBranchSource,
		activeSessionId,
		streamingMsgsThisSession,
		visibleChatIds,
	]);

	const invisibleStreamingBranchMapValue = useMemo((): Map<
		string,
		string
	> | null => {
		if (!streamingBranchSource || !activeSessionId) return null;
		if (streamingMsgsThisSession.length === 0) return null;
		for (const msg of streamingMsgsThisSession) {
			if (!visibleChatIds.has(msg.chatId)) {
				const branchMap = streamingBranchSource.getStreamingBranchMap(
					msg.chatId,
				);
				if (branchMap) {
					return branchMap;
				}
			}
		}
		return null;
	}, [
		streamingBranchSource,
		activeSessionId,
		streamingMsgsThisSession,
		visibleChatIds,
	]);

	const isStreamingBranchVisible = useCallback(
		() => isStreamingBranchVisibleValue,
		[isStreamingBranchVisibleValue],
	);

	const getInvisibleStreamingBranchMap = useCallback(
		() => invisibleStreamingBranchMapValue,
		[invisibleStreamingBranchMapValue],
	);

	const isLatestBranchValue = useMemo(() => {
		if (allFlatMessages.length === 0) return true;
		if (messages.length === 0) return true;
		if (latestBranchMapFlat.size === 0) return true;

		for (const msg of messages) {
			const parentId = msg.parentId || 'root';
			const latestChildId = latestBranchMapFlat.get(parentId);
			const currentChildId = selectedChildMap.get(parentId);

			if (latestChildId && currentChildId && latestChildId !== currentChildId) {
				return false;
			}
		}

		return true;
	}, [allFlatMessages.length, messages, selectedChildMap, latestBranchMapFlat]);

	const isLatestBranch = useCallback(
		() => isLatestBranchValue,
		[isLatestBranchValue],
	);

	const persistIfNeeded = useCallback(
		(map: Map<string, string>) => {
			if (activeSessionId && onPersistSessionBranchSelection) {
				onPersistSessionBranchSelection(activeSessionId, map);
			}
		},
		[activeSessionId, onPersistSessionBranchSelection],
	);

	const switchToLatestBranch = useCallback(() => {
		if (allFlatMessages.length === 0) return;
		// Map 恒为 truthy；空 Map 时与原先 findLatest 得到空后仍进入 if 的行为一致
		if (latestBranchMapFlat) {
			setSelectedChildMap(new Map(latestBranchMapFlat));
			persistIfNeeded(latestBranchMapFlat);
			if (latestBranchTimer) {
				clearTimeout(latestBranchTimer);
				latestBranchTimer = null;
			}
			latestBranchTimer = setTimeout(() => {
				onScrollTo('down', 'auto');
			}, 50);
		}
	}, [
		allFlatMessages.length,
		latestBranchMapFlat,
		setSelectedChildMap,
		onScrollTo,
		persistIfNeeded,
	]);

	const switchToStreamingBranch = useCallback(() => {
		const branchMap = invisibleStreamingBranchMapValue;
		if (branchMap) {
			const newSelectedChildMap = new Map(branchMap);
			setSelectedChildMap(newSelectedChildMap);
			persistIfNeeded(newSelectedChildMap);
			if (streamingBranchTimer) {
				clearTimeout(streamingBranchTimer);
				streamingBranchTimer = null;
			}
			streamingBranchTimer = setTimeout(() => {
				onScrollTo('down', 'auto');
			}, 50);
		}
	}, [
		invisibleStreamingBranchMapValue,
		setSelectedChildMap,
		onScrollTo,
		persistIfNeeded,
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
