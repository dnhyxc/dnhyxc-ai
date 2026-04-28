import { useCallback, useMemo, useState } from 'react';

/**
 * 分享勾选状态管理（share selection）：
 * - 进入/退出分享模式（isSharing）
 * - 勾选集合（checkedMessages）
 * - 成对勾选（例如 user+assistant 一问一答）
 * - 全选/清空
 * - 是否已全选
 *
 * 该 hook 不关心具体 UI（弹窗/按钮/布局），仅提供稳定的状态机与可复用的勾选策略。
 */
export function useShareSelection<TMessage extends { chatId: string }>({
	/** 是否允许分享（不允许时所有操作 noop，保持外部逻辑不受影响） */
	enabled,
	/**
	 * 成对勾选策略：
	 * - 返回 [id1, id2] 表示“这一组对话”对应的两个 message.chatId（顺序无要求）
	 * - 返回 null 表示该消息无法成对（例如缺少 parent/child 或边界不完整）
	 *
	 * 可选的 allMessages 便于用“相邻 pair”的页面（例如知识库助手线性列表）。
	 */
	pairResolver,
	/** 可选：用于 setCheckedMessage / 全选 / isAllChecked 的默认消息来源 */
	getAllMessages,
}: {
	enabled: boolean;
	pairResolver: (
		msg: TMessage,
		allMessages?: TMessage[],
	) => [string, string] | null;
	getAllMessages?: () => TMessage[];
}) {
	// 是否开启分享（进入勾选模式）
	const [isSharing, setIsSharing] = useState(false);

	// 选中的消息 chatId 集合（成对勾选时会同时写入两条 chatId）
	const [checkedMessages, setCheckedMessages] = useState<Set<string>>(
		() => new Set(),
	);

	// 清除所有选中消息（取消全选/退出分享时复用）
	const clearAllCheckedMessages = useCallback(() => {
		setCheckedMessages(new Set());
	}, []);

	const togglePair = useCallback(
		(pair: [string, string]) => {
			if (!enabled) return;
			const [a, b] = pair;
			setCheckedMessages((prev) => {
				const next = new Set(prev);
				if (next.has(a) || next.has(b)) {
					next.delete(a);
					next.delete(b);
				} else {
					next.add(a);
					next.add(b);
				}
				return next;
			});
		},
		[enabled],
	);

	// 勾选/取消勾选：按 pairResolver 的一问一答成对 toggle
	const setCheckedMessage = useCallback(
		(message: TMessage, allMessages?: TMessage[]) => {
			if (!enabled) return;
			const pair = pairResolver(message, allMessages ?? getAllMessages?.());
			if (!pair) return;
			togglePair(pair);
		},
		[enabled, getAllMessages, pairResolver, togglePair],
	);

	// 用一组 chatId 直接覆盖当前集合（用于“全选/按当前展示顺序重建”）
	const replaceCheckedMessages = useCallback(
		(ids: string[]) => {
			if (!enabled) return;
			setCheckedMessages(new Set(ids));
		},
		[enabled],
	);

	// 全选：把当前展示列表的所有 chatId 写入集合
	const setAllCheckedMessages = useCallback(
		(messages?: TMessage[]) => {
			if (!enabled) return;
			const list = messages ?? getAllMessages?.() ?? [];
			replaceCheckedMessages(list.map((m) => m.chatId));
		},
		[enabled, getAllMessages, replaceCheckedMessages],
	);

	// 检查是否已全选：当前展示列表每条 chatId 都在集合中
	const isAllChecked = useCallback(
		(messages?: TMessage[]) => {
			if (!enabled) return false;
			const list = messages ?? getAllMessages?.() ?? [];
			if (!list.length) return false;
			return list.every((m) => checkedMessages.has(m.chatId));
		},
		[checkedMessages, enabled, getAllMessages],
	);

	// 已选择组数：约定成对勾选，因此 size/2 向下取整
	const selectedPairCount = useMemo(() => {
		if (!enabled) return 0;
		return Math.floor(checkedMessages.size / 2);
	}, [enabled, checkedMessages]);

	return {
		isSharing,
		setIsSharing,
		checkedMessages,
		setCheckedMessage,
		togglePair,
		replaceCheckedMessages,
		setAllCheckedMessages,
		clearAllCheckedMessages,
		isAllChecked,
		selectedPairCount,
	};
}
