import ShareChat from '@design/Share';
import { useCallback, useEffect, useState } from 'react';
import { resolveSharePairFromList, useShareFlow } from '@/hooks/useShareFlow';
import type { Message } from '@/types/chat';
import type {
	AssistantShareSessionType,
	UseAssistantShareResult,
} from './types';

export type UseAssistantShareParams = {
	messages?: readonly Message[];
	/** 优先于 messages：避免父组件 render 订阅 messages 数组 */
	getAllMessages?: () => readonly Message[];
	sessionId: string | null | undefined;
	sessionType: AssistantShareSessionType;
	/** 登录、会话存在、业务开关等；false 时不挂载分享 UI */
	enabled: boolean;
};

/**
 * 助手会话分享通用 hook：勾选问答对、打开 ShareChat、从消息行一键进入分享态。
 * 供知识库 / 英语学习 Agent / 电子书阅读助手复用。
 */
export function useAssistantShare(
	params: UseAssistantShareParams,
): UseAssistantShareResult {
	const { messages, getAllMessages, sessionId, sessionType, enabled } = params;
	const readMessages = getAllMessages ?? (() => messages ?? []);
	const [shareModelVisible, setShareModelVisible] = useState(false);
	const [pendingShareChatId, setPendingShareChatId] = useState<string | null>(
		null,
	);

	const allowAiShare = enabled && Boolean(sessionId);

	const shareFlow = useShareFlow<Message>({
		enabled: allowAiShare,
		getAllMessages: () => [...readMessages()],
		pairResolver: (message, all) =>
			resolveSharePairFromList(message, all ?? [...readMessages()]),
	});

	const { shareSelection } = shareFlow;
	const resolveSharePair = useCallback(
		(message: Message): [string, string] | null =>
			resolveSharePairFromList(message, [...readMessages()]),
		[getAllMessages, messages],
	);

	const onShare = useCallback(
		(message?: Message) => {
			if (!allowAiShare) return;
			if (!message) return;
			setPendingShareChatId(message.chatId);
			shareSelection.setIsSharing(true);
			const pair = resolveSharePair(message);
			if (!pair) return;
			// 首次点击时同步写一次，再在下一帧重放，规避切换分享态过程中的状态覆盖
			shareSelection.replaceCheckedMessages(pair);
			queueMicrotask(() => {
				shareSelection.replaceCheckedMessages(pair);
			});
			requestAnimationFrame(() => {
				shareSelection.replaceCheckedMessages(pair);
			});
		},
		[allowAiShare, resolveSharePair, shareSelection],
	);

	useEffect(() => {
		if (!shareSelection.isSharing || !pendingShareChatId) return;
		const target = readMessages().find((m) => m.chatId === pendingShareChatId);
		if (!target) return;
		const pair = resolveSharePair(target);
		if (pair) {
			shareSelection.replaceCheckedMessages(pair);
		}
		setPendingShareChatId(null);
	}, [
		getAllMessages,
		messages,
		pendingShareChatId,
		resolveSharePair,
		shareSelection,
		shareSelection.isSharing,
	]);

	const onCloseShareModel = useCallback(() => {
		setShareModelVisible(false);
		setPendingShareChatId(null);
		shareFlow.onCancelShare();
	}, [shareFlow]);

	return {
		allowAiShare,
		shareFlow,
		shareSelection,
		onShare,
		shareModelVisible,
		setShareModelVisible,
		onCloseShareModel,
		shareChatNode: allowAiShare ? (
			<ShareChat
				open={shareModelVisible}
				onOpenChange={onCloseShareModel}
				checkedMessages={shareSelection.checkedMessages}
				orderedMessageIds={readMessages().map((m) => m.chatId)}
				sessionId={sessionId ?? undefined}
				sessionType={sessionType}
			/>
		) : null,
	};
}
