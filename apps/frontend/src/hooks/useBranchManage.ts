import { useCallback, useEffect, useMemo, useRef } from 'react';
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
	 * 主项目在连接层注入，独立使用时可省略（仅内存中的 selectedChildMap 生效）。
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
	// 用 ref 存定时器 ID：避免 render 内 let 变量每次清空导致卸载时 clear 不到、或闭包引用过期
	const latestBranchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const streamingBranchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	// 组件卸载时清理「滚到底部」的延迟任务，防止 setState 到已卸载树
	useEffect(() => {
		return () => {
			if (latestBranchTimerRef.current) {
				clearTimeout(latestBranchTimerRef.current);
				latestBranchTimerRef.current = null;
			}
			if (streamingBranchTimerRef.current) {
				clearTimeout(streamingBranchTimerRef.current);
				streamingBranchTimerRef.current = null;
			}
		};
	}, []);

	// 仅当 allFlatMessages 引用变化时重算「始终选最新子节点」的 Map；供 isLatestBranch / switchToLatest 复用，避免每帧 findLatestBranchSelection
	const latestBranchMapMemo = useMemo(
		() =>
			allFlatMessages.length === 0
				? null
				: findLatestBranchSelection(allFlatMessages),
		[allFlatMessages],
	);

	// 布尔值而非函数：ChatBotView 可直接当 props 用，避免每次 render 再执行一遍过滤与 Set 构造
	const isStreamingBranchVisible = useMemo(() => {
		// 无流式数据源或无定会话：不拦截，认为「流式分支可见」
		if (!streamingBranchSource || !activeSessionId) return true;

		const streamingMessages = streamingBranchSource
			.getStreamingMessages()
			.filter((msg) => {
				const sid = streamingBranchSource.getStreamingMessageSessionId(
					msg.chatId,
				);
				return sid === activeSessionId;
			});

		if (streamingMessages.length === 0) return true;

		// 当前展示链上的 chatId 集合：任一流式消息落在这条链上则视为「用户正在看流式所在分支」
		const visibleChatIds = new Set(messages.map((m) => m.chatId));
		return streamingMessages.some((msg) => visibleChatIds.has(msg.chatId));
	}, [streamingBranchSource, activeSessionId, messages]);

	// 找出「正在流式但不在当前展示链上」时应用哪条分支 Map，供一键跳到流式分支
	const getInvisibleStreamingBranchMap = useCallback((): Map<
		string,
		string
	> | null => {
		if (!streamingBranchSource || !activeSessionId) return null;

		const streamingMessages = streamingBranchSource
			.getStreamingMessages()
			.filter((msg) => {
				const sid = streamingBranchSource.getStreamingMessageSessionId(
					msg.chatId,
				);
				return sid === activeSessionId;
			});

		if (streamingMessages.length === 0) return null;

		const visibleChatIds = new Set(messages.map((m) => m.chatId));

		for (const msg of streamingMessages) {
			// 流式消息不在当前链上：取 Store 里为该流式消息预计算的分支选择
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
	}, [streamingBranchSource, activeSessionId, messages]);

	// 当前展示链是否在「每一层父节点都选了时间最新的子节点」；用 latestBranchMapMemo 而非每次全量重算
	const isLatestBranch = useMemo(() => {
		if (allFlatMessages.length === 0) return true;
		if (messages.length === 0) return true;

		if (!latestBranchMapMemo || latestBranchMapMemo.size === 0) return true;

		for (const msg of messages) {
			const parentId = msg.parentId || 'root';
			const latestChildId = latestBranchMapMemo.get(parentId);
			const currentChildId = selectedChildMap.get(parentId);

			// 该层在 latest 映射里存在且用户显式选过子节点，且与 latest 不一致 → 不是最新分支
			if (latestChildId && currentChildId && latestChildId !== currentChildId) {
				return false;
			}
		}

		return true;
	}, [
		allFlatMessages.length, // 用 length 而非数组本身：同长度原地 mutate 时少触发；内容大变但长度不变时须父层换引用才刷新
		messages,
		selectedChildMap,
		latestBranchMapMemo,
	]);

	// 有会话 id 且连接层注入了持久化回调时，把当前分支 Map 写入 Store/后端
	const persistIfNeeded = useCallback(
		(map: Map<string, string>) => {
			if (activeSessionId && onPersistSessionBranchSelection) {
				onPersistSessionBranchSelection(activeSessionId, map);
			}
		},
		[activeSessionId, onPersistSessionBranchSelection],
	);

	// 应用已缓存的 latest 映射并持久化；短延迟后滚到底，等待布局稳定
	const switchToLatestBranch = useCallback(() => {
		if (!latestBranchMapMemo || latestBranchMapMemo.size === 0) return;
		const mapCopy = new Map(latestBranchMapMemo);
		setSelectedChildMap(mapCopy);
		persistIfNeeded(mapCopy);
		if (latestBranchTimerRef.current) {
			clearTimeout(latestBranchTimerRef.current);
			latestBranchTimerRef.current = null;
		}
		latestBranchTimerRef.current = setTimeout(() => {
			onScrollTo('down', 'auto');
		}, 50);
	}, [latestBranchMapMemo, setSelectedChildMap, onScrollTo, persistIfNeeded]);

	// 切到流式所在分支（若存在不可见流式 Map）
	const switchToStreamingBranch = useCallback(() => {
		const branchMap = getInvisibleStreamingBranchMap();
		if (branchMap) {
			const newSelectedChildMap = new Map(branchMap);
			setSelectedChildMap(newSelectedChildMap);
			persistIfNeeded(newSelectedChildMap);
			if (streamingBranchTimerRef.current) {
				clearTimeout(streamingBranchTimerRef.current);
				streamingBranchTimerRef.current = null;
			}
			streamingBranchTimerRef.current = setTimeout(() => {
				onScrollTo('down', 'auto');
			}, 50);
		}
	}, [
		getInvisibleStreamingBranchMap,
		setSelectedChildMap,
		onScrollTo,
		persistIfNeeded,
	]);

	// 对外导出：is* 已为 boolean，非 getter 函数
	return {
		isStreamingBranchVisible,
		getInvisibleStreamingBranchMap,
		isLatestBranch,
		switchToLatestBranch,
		switchToStreamingBranch,
		findLatestBranchSelection,
	};
};
