import { useCallback, useState } from 'react';
import { useShareSelection } from './useShareSelection';

export type SharePairCandidate = {
	chatId: string;
	role?: string;
	parentId?: string;
	childrenIds?: string[];
};

/**
 * 在线性消息列表中解析“一问一答”配对：
 * - 优先使用 parent/children 关系
 * - 关系缺失时按相邻方向兜底
 */
export function resolveSharePairFromList<TMessage extends SharePairCandidate>(
	message: TMessage,
	messages: TMessage[],
): [string, string] | null {
	if (!messages.length) return null;
	const byId = new Map(messages.map((m) => [m.chatId, m]));
	const idx = messages.findIndex((m) => m.chatId === message.chatId);
	if (idx < 0) return null;
	if (message.role === 'assistant') {
		const parentId = message.parentId;
		if (parentId) {
			const parent = byId.get(parentId);
			if (parent?.role === 'user') return [parent.chatId, message.chatId];
		}
		for (let i = idx - 1; i >= 0; i -= 1) {
			const prev = messages[i];
			if (prev?.role === 'user') return [prev.chatId, message.chatId];
		}
		for (let i = idx + 1; i < messages.length; i += 1) {
			const next = messages[i];
			if (next?.role === 'user') return [next.chatId, message.chatId];
		}
		return null;
	}
	const lastChildId = message.childrenIds?.[message.childrenIds.length - 1];
	if (lastChildId) {
		const child = byId.get(lastChildId);
		if (child?.role === 'assistant') return [message.chatId, child.chatId];
	}
	for (let i = idx + 1; i < messages.length; i += 1) {
		const next = messages[i];
		if (next?.role === 'assistant') return [message.chatId, next.chatId];
	}
	for (let i = idx - 1; i >= 0; i -= 1) {
		const prev = messages[i];
		if (prev?.role === 'assistant') return [message.chatId, prev.chatId];
	}
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
