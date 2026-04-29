import { useCallback, useState } from 'react';
import { useShareSelection } from './useShareSelection';

export type SharePairCandidate = {
	chatId: string;
	role?: string;
	parentId?: string;
	childrenIds?: string[];
};

/**
 * 在一串线性消息中，根据 parent/children 关系或位置，自动推断出“一问一答”配对（分享对）。
 * 适配多种场景，优先保证 parent/children 有效，其次回退到邻接（前后查找）。
 *
 * @param message  当前点选的消息（用户或助手）
 * @param messages 当前消息列表（线性，有顺序，包含所有历史消息）
 * @returns [userId, assistantId] 配对 (先 user 后 assistant)，未找到配对则返回 null
 *
 * 处理逻辑：
 * - assistant 消息：
 *   - 优先通过 parentId 找到上一条 user 消息作为提问，和自己组队
 *   - 如果没有 parentId，则往前查找第一个 role='user' 的消息
 *   - 如果前面没有 user，则往后查找第一个 role='user' 的消息
 *   - 都没有则配对失败
 * - user 消息：
 *   - 优先通过 childrenIds（只取最后一个，提示后续回复）找到 role='assistant' 消息
 *   - 如果 childrenIds 无用，则往后查找第一个 role='assistant' 的消息
 *   - 如果后面没有，则往前查找第一个 role='assistant' 的消息
 *   - 都没有则配对失败
 */
export function resolveSharePairFromList<TMessage extends SharePairCandidate>(
	message: TMessage,
	messages: TMessage[],
): [string, string] | null {
	if (!messages.length) return null; // 消息列表为空，无法配对

	// 为方便查找 quick lookup，构建 chatId=>消息 的 Map
	const byId = new Map(messages.map((m) => [m.chatId, m]));

	// 拿到当前消息在列表中的下标 idx
	const idx = messages.findIndex((m) => m.chatId === message.chatId);
	if (idx < 0) return null; // 当前消息不在 messages 中，则无法配对

	// ---------------------- 处理助手消息 ----------------------
	if (message.role === 'assistant') {
		const parentId = message.parentId;
		if (parentId) {
			// 有 parentId，则优先通过父节点找提问 user
			const parent = byId.get(parentId);
			if (parent?.role === 'user') return [parent.chatId, message.chatId];
		}
		// 若无 parentId，则往前查找最近的 user 消息
		for (let i = idx - 1; i >= 0; i -= 1) {
			const prev = messages[i];
			if (prev?.role === 'user') return [prev.chatId, message.chatId];
		}
		// 再往后查找最近的 user 消息（极端情况，比如消息打乱）
		for (let i = idx + 1; i < messages.length; i += 1) {
			const next = messages[i];
			if (next?.role === 'user') return [next.chatId, message.chatId];
		}
		// 上述都未命中则视为未配对
		return null;
	}

	// ---------------------- 处理用户消息 ----------------------
	// 取当前 user 消息的所有 childrenIds，选择最后一个 childId，假设它为最近的 assistant 回复
	// childrenIds 反映了该 user 消息下所有追随的回复，最后一个通常是最后一次助手答复
	const lastChildId = message.childrenIds?.[message.childrenIds.length - 1];
	if (lastChildId) {
		// 有 childrenIds，则优先用最后一个作为对应的 assistant 回复
		const child = byId.get(lastChildId);
		if (child?.role === 'assistant') return [message.chatId, child.chatId];
	}
	// 若无有效 childrenId，则往后查找最近的 assistant 消息
	for (let i = idx + 1; i < messages.length; i += 1) {
		const next = messages[i];
		if (next?.role === 'assistant') return [message.chatId, next.chatId];
	}
	// 若后面也没有 assistant，则往前回头查找（极端容错）
	for (let i = idx - 1; i >= 0; i -= 1) {
		const prev = messages[i];
		if (prev?.role === 'assistant') return [message.chatId, prev.chatId];
	}
	// 所有分支都没找到有效配对
	return null;
}

/**
 * 分享流程（share flow）通用 hook：
 * - 进入/退出分享模式
 * - 勾选状态（复用 useShareSelection）
 * - 分享弹窗 open/close（复用现有 ShareChat 组件）
 *
 * 该 hook 只管理状态与回调，不绑定具体 UI 样式。
 */
export function useShareFlow<TMessage extends { chatId: string }>({
	enabled,
	pairResolver,
	getAllMessages,
}: {
	enabled: boolean;
	pairResolver: (
		msg: TMessage,
		allMessages?: TMessage[],
	) => [string, string] | null;
	getAllMessages?: () => TMessage[];
}) {
	const [shareModelVisible, setShareModelVisible] = useState(false);

	const shareSelection = useShareSelection<TMessage>({
		enabled,
		pairResolver,
		getAllMessages,
	});

	const onShowShareModel = useCallback(() => {
		if (!enabled) return;
		setShareModelVisible(true);
	}, [enabled]);

	const onCloseShareModel = useCallback(() => {
		setShareModelVisible(false);
		shareSelection.setIsSharing(false);
		shareSelection.clearAllCheckedMessages();
	}, [shareSelection]);

	const onCancelShare = useCallback(() => {
		shareSelection.setIsSharing(false);
		shareSelection.clearAllCheckedMessages();
	}, [shareSelection]);

	const onStartShare = useCallback(
		(messagesToSelect?: TMessage[]) => {
			if (!enabled) return;
			shareSelection.setIsSharing(true);
			shareSelection.setAllCheckedMessages(messagesToSelect);
		},
		[enabled, shareSelection],
	);

	const onStartShareWithMessage = useCallback(
		(message: TMessage, allMessages?: TMessage[]) => {
			if (!enabled) return;
			const pair = pairResolver(message, allMessages ?? getAllMessages?.());
			shareSelection.setIsSharing(true);
			if (pair) {
				// 首次点击分享图标时应直接选中当前这一组，避免 toggle 导致状态被抵消
				shareSelection.replaceCheckedMessages(pair);
				return;
			}
			shareSelection.clearAllCheckedMessages();
		},
		[enabled, getAllMessages, pairResolver, shareSelection],
	);

	return {
		shareSelection,
		shareModelVisible,
		onShowShareModel,
		onCloseShareModel,
		onCancelShare,
		onStartShare,
		onStartShareWithMessage,
	};
}
