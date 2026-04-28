import { Button, Checkbox } from '@ui/index';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useState } from 'react';
import { useShareFlow } from '@/hooks';
import assistantStore from '@/store/assistant';
import type { Message } from '@/types/chat';
import ShareChat from '@/views/chat/share';

type ShareSelectionLike = {
	checkedMessages: Set<string>;
	selectedPairCount: number;
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

	const allowAiShare =
		!isRagMode &&
		isLoggedIn &&
		assistantStore.knowledgeAssistantPersistenceAllowed &&
		Boolean(assistantStore.activeSessionId);

	const shareFlow = useShareFlow<Message>({
		enabled: allowAiShare,
		getAllMessages: () => aiMessages,
		pairResolver: (message, all) => {
			const list = all ?? aiMessages;
			const idx = list.findIndex((m) => m.chatId === message.chatId);
			if (idx < 0) return null;
			// 线性列表：user -> assistant；按相邻成对勾选（顺序与消息流一致：user 在前，assistant 在后）
			if (message.role === 'assistant') {
				const prev = list[idx - 1];
				if (prev?.role !== 'user') return null;
				return [prev.chatId, message.chatId];
			}
			const next = list[idx + 1];
			if (next?.role !== 'assistant') return null;
			return [message.chatId, next.chatId];
		},
	});

	const { shareSelection } = shareFlow;

	// 被点击分享的消息已由 ChatMessageActions 内部 setCheckedMessage 处理，这里只负责进入分享模式
	const onShare = useCallback(
		(_message?: Message) => {
			if (!allowAiShare) return;
			if (!shareSelection.isSharing) shareSelection.setIsSharing(true);
		},
		[allowAiShare, shareSelection],
	);

	const onCloseShareModel = useCallback(() => {
		setShareModelVisible(false);
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
