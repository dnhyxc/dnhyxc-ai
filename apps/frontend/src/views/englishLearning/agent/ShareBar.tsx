import ShareChat from '@design/Share';
import { Button, Checkbox } from '@ui/index';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { resolveSharePairFromList, useI18n, useShareFlow } from '@/hooks';
import type { Message } from '@/types/chat';

type ShareSelectionLike = {
	checkedMessages: Set<string>;
	selectedPairCount: number;
	replaceCheckedMessages: (ids: string[]) => void;
	isAllChecked: (messages?: Message[]) => boolean;
	setAllCheckedMessages: (messages?: Message[]) => void;
	clearAllCheckedMessages: () => void;
};

type ShareFlowLike = {
	onCancelShare: () => void;
};

export interface EnglishLearningAgentShareBarProps {
	messages: Message[];
	shareSelection: ShareSelectionLike;
	shareFlow: ShareFlowLike;
	setShareModelVisible: Dispatch<SetStateAction<boolean>>;
}

/**
 * 英语学习 Agent 会话分享：逻辑对齐 `useKnowledgeAssistantShare`，数据源为 agent 会话。
 */
export function useSessionShare(params: {
	messages: Message[];
	sessionId: string | null;
	isLoggedIn: boolean;
}) {
	const { messages, sessionId, isLoggedIn } = params;
	const [shareModelVisible, setShareModelVisible] = useState(false);
	const [pendingShareChatId, setPendingShareChatId] = useState<string | null>(
		null,
	);

	const allowAiShare = isLoggedIn && Boolean(sessionId);

	const shareFlow = useShareFlow<Message>({
		enabled: allowAiShare,
		getAllMessages: () => messages,
		pairResolver: (message, all) =>
			resolveSharePairFromList(message, all ?? messages),
	});

	const { shareSelection } = shareFlow;
	const resolveSharePair = useCallback(
		(message: Message): [string, string] | null =>
			resolveSharePairFromList(message, messages),
		[messages],
	);

	const onShare = useCallback(
		(message?: Message) => {
			if (!allowAiShare) return;
			if (!message) return;
			setPendingShareChatId(message.chatId);
			shareSelection.setIsSharing(true);
			const pair = resolveSharePair(message);
			if (!pair) return;
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
		const target = messages.find((m) => m.chatId === pendingShareChatId);
		if (!target) return;
		const pair = resolveSharePair(target);
		if (pair) {
			shareSelection.replaceCheckedMessages(pair);
		}
		setPendingShareChatId(null);
	}, [
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
				orderedMessageIds={messages.map((m) => m.chatId)}
				sessionId={sessionId ?? undefined}
				sessionType="agent"
			/>
		) : null,
	};
}

export function ShareBar({
	messages,
	shareSelection,
	shareFlow,
	setShareModelVisible,
}: EnglishLearningAgentShareBarProps) {
	const { t } = useI18n();
	return (
		<div className="flex w-full items-center justify-between pt-4 pb-4.5">
			<div className="flex flex-1 items-center gap-3 text-textcolor/80">
				<div className="flex items-center">
					<Checkbox
						id="english-learning-agent-share-all"
						checked={shareSelection.isAllChecked(messages)}
						onCheckedChange={(v) => {
							if (v) {
								shareSelection.setAllCheckedMessages(messages);
							} else {
								shareSelection.clearAllCheckedMessages();
							}
						}}
						className="cursor-pointer border-textcolor/60"
					/>
					<label
						htmlFor="english-learning-agent-share-all"
						className="text-md ml-2 cursor-pointer"
					>
						{t('chat.share.selectAll')}
					</label>
				</div>
				<div className="border-textcolor/50 h-3 border-l" />
				<div>
					{t('chat.share.selectedPairs', {
						count: shareSelection.selectedPairCount,
					})}
				</div>
			</div>
			<div className="flex items-center gap-3">
				<Button
					variant="outline"
					size="sm"
					className="border-theme"
					onClick={() => {
						shareFlow.onCancelShare();
					}}
				>
					{t('common.cancel')}
				</Button>
				<Button
					variant="dynamic"
					size="sm"
					className="border-theme bg-transparent bg-linear-to-r from-teal-500 to-cyan-600 text-white hover:bg-transparent"
					disabled={shareSelection.checkedMessages.size === 0}
					onClick={() => setShareModelVisible(true)}
				>
					{t('chat.share.createLink')}
				</Button>
			</div>
		</div>
	);
}
