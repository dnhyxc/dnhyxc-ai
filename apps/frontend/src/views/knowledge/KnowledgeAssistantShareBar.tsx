import ShareChat from '@design/Share';
import { Button, Checkbox } from '@ui/index';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { resolveSharePairFromList, useShareFlow } from '@/hooks';
import assistantStore from '@/store/assistant';
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

export interface KnowledgeAssistantShareBarProps {
	aiMessages: Message[];
	shareSelection: ShareSelectionLike;
	shareFlow: ShareFlowLike;
	setShareModelVisible: Dispatch<SetStateAction<boolean>>;
}

export function useKnowledgeAssistantShare(params: {
	aiMessages: Message[];
	isLoggedIn: boolean;
	isRagMode: boolean;
}) {
	const { aiMessages, isLoggedIn, isRagMode } = params;
	const [shareModelVisible, setShareModelVisible] = useState(false);
	const [pendingShareChatId, setPendingShareChatId] = useState<string | null>(
		null,
	);

	const allowAiShare =
		!isRagMode &&
		isLoggedIn &&
		assistantStore.knowledgeAssistantPersistenceAllowed &&
		Boolean(assistantStore.activeSessionId);

	const shareFlow = useShareFlow<Message>({
		enabled: allowAiShare,
		getAllMessages: () => aiMessages,
		pairResolver: (message, all) =>
			resolveSharePairFromList(message, all ?? aiMessages),
	});

	const { shareSelection } = shareFlow;
	const resolveSharePair = useCallback(
		(message: Message): [string, string] | null =>
			resolveSharePairFromList(message, aiMessages),
		[aiMessages],
	);

	const onShare = useCallback(
		(message?: Message) => {
			if (!allowAiShare) return;
			if (!message) return;
			setPendingShareChatId(message.chatId);
			shareSelection.setIsSharing(true);
			const pair = resolveSharePair(message);
			if (!pair) return;
			// 首次点击时同步写一次，再在下一帧重放一次，规避切换分享态过程中的状态覆盖
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
		const target = aiMessages.find((m) => m.chatId === pendingShareChatId);
		if (!target) return;
		const pair = resolveSharePair(target);
		if (pair) {
			shareSelection.replaceCheckedMessages(pair);
		}
		setPendingShareChatId(null);
	}, [
		aiMessages,
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
				orderedMessageIds={aiMessages.map((m) => m.chatId)}
				sessionId={assistantStore.activeSessionId ?? undefined}
				sessionType="assistant"
			/>
		) : null,
	};
}

export function KnowledgeAssistantShareBar({
	aiMessages,
	shareSelection,
	shareFlow,
	setShareModelVisible,
}: KnowledgeAssistantShareBarProps) {
	return (
		<div className="w-full flex justify-between items-center max-w-3xl mx-auto pb-4.5">
			<div className="flex-1 flex items-center gap-3 text-textcolor/80">
				<div className="flex items-center">
					<Checkbox
						id="knowledge-assistant-share-all"
						checked={shareSelection.isAllChecked(aiMessages)}
						onCheckedChange={(v) => {
							if (v) {
								shareSelection.setAllCheckedMessages(aiMessages);
							} else {
								shareSelection.clearAllCheckedMessages();
							}
						}}
						className="cursor-pointer border-textcolor/60"
					/>
					<label
						htmlFor="knowledge-assistant-share-all"
						className="cursor-pointer ml-2 text-md"
					>
						全选
					</label>
				</div>
				<div className="border-l border-textcolor/50 h-3" />
				<div>已选择 {shareSelection.selectedPairCount} 组对话</div>
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
					取消
				</Button>
				<Button
					variant="dynamic"
					size="sm"
					className="text-white border-theme bg-transparent hover:bg-transparent bg-linear-to-r from-teal-500 to-cyan-600"
					disabled={shareSelection.checkedMessages.size === 0}
					onClick={() => setShareModelVisible(true)}
				>
					创建分享链接
				</Button>
			</div>
		</div>
	);
}
