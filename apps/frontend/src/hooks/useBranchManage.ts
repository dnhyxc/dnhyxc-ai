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

/**
 * 分支管理 Hook（阶段一性能优化）
 *
 * 目标：在长会话、多分支场景下减少每帧重复计算，且不改变任何产品语义。
 * - `findLatestBranchSelection` 结果按 `allFlatMessages` 引用缓存，避免 `isLatestBranch` 每次全表扫描。
 * - 流式相关：`getStreamingMessages` + 按会话过滤只做一次，派生「是否可见」「不可见时的 branchMap」，
 *   原先两条路径里重复的 filter/循环合并为一份 memo，对外仍通过同名 getter 暴露（调用方可保持不变）。
 * - `isLatestBranch` / `isStreamingBranchVisible`：先 `useMemo` 得到布尔或 Map，再 `useCallback` 包一层 O(1) 返回，
 *   与旧实现「每次调用时现算」相比，子组件依赖这些函数引用时更稳定。
 * - 未使用 `startTransition`，避免与 MobX reaction 更新 `selectedChildMap` 叠加时出现过时闭包或状态撕裂。
 *
 * 定时器仍使用组件内 `let` + 卸载 effect 清理（与历史代码一致）；若需跨 render 防抖可后续改为 useRef。
 */
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
	// 分支切换后的滚动延迟：与重构前相同，注意每次 render 会重置为 null，
	// 仅依赖「上一次点击」触发的 timeout id 在单次 render 周期内有效；卸载时统一 clear。
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

	// 「时间轴上最新」分支路径：仅当完整树 `allFlatMessages` 引用变化时重算。
	// 旧逻辑在每次 `isLatestBranch()` / `switchToLatestBranch()` 内都会调用 findLatestBranchSelection，长列表成本高。
	const latestBranchMapFlat = useMemo(
		() => findLatestBranchSelection(allFlatMessages),
		[allFlatMessages],
	);

	// 当前会话下的流式消息列表：显式依赖 `messages`，保证流式增量写入后父级重渲染时与旧行为一致
	//（旧实现每次在 getter 里调 getStreamingMessages()，等价于「当前渲染周期看到的 Store 快照」）。
	const streamingMsgsThisSession = useMemo(() => {
		if (!streamingBranchSource || !activeSessionId) return [];
		return streamingBranchSource.getStreamingMessages().filter((msg) => {
			const sid = streamingBranchSource.getStreamingMessageSessionId(
				msg.chatId,
			);
			return sid === activeSessionId;
		});
	}, [streamingBranchSource, activeSessionId, messages]);

	// 当前展示分支上的 chatId 集合，用于判断流式气泡是否落在可见路径上。
	const visibleChatIds = useMemo(
		() => new Set(messages.map((m) => m.chatId)),
		[messages],
	);

	// 流式气泡是否在当前选中分支可见：无流式源 / 无当前会话 / 无流式消息时视为 true（无需底栏「切到流式分支」）。
	const isStreamingBranchVisibleValue = useMemo(() => {
		if (!streamingBranchSource || !activeSessionId) return true;
		if (streamingMsgsThisSession.length === 0) return true;
		return streamingMsgsThisSession.some((msg) =>
			visibleChatIds.has(msg.chatId),
		);
	}, [
		streamingBranchSource,
		activeSessionId,
		streamingMsgsThisSession,
		visibleChatIds,
	]);

	// 若流式发生在不可见分支，返回用于「一键切过去」的 branchMap；否则 null。顺序与旧代码「先匹配的不可见流式」一致。
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

	// 对外保持「函数 getter」形态，便于 ChatBotView 等与旧调用方式兼容；内部已是缓存值。
	const isStreamingBranchVisible = useCallback(
		() => isStreamingBranchVisibleValue,
		[isStreamingBranchVisibleValue],
	);

	const getInvisibleStreamingBranchMap = useCallback(
		() => invisibleStreamingBranchMapValue,
		[invisibleStreamingBranchMapValue],
	);

	// 当前展示路径是否与「按时间最新」路径一致：逐条对照 latestBranchMapFlat 与 selectedChildMap。
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
		// `latestBranchMapFlat` 恒为 Map 实例故 if 恒真；空 Map 时仍 set + persist，与旧 findLatest 后立即应用的行为对齐。
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

	// 切到流式所在分支：直接使用上面 memo 的 `invisibleStreamingBranchMapValue`，避免在回调里重复遍历。
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
