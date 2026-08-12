import { Label } from '@ui/index';
import { observer } from 'mobx-react';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import { cn } from '@/lib/utils';
import type {
	AssistantMessageBubbleProps,
	AssistantMessageRowProps,
} from './types';
import {
	buildMessageRev,
	messageAssistantContentClass,
	messageLabelClass,
	messageRowClass,
	messageUserContentClass,
	resolveShareState,
} from './utils';

function AssistantMessageBubble({
	message,
	msgRev,
	index,
	messagesLength,
	isCopyedId,
	onCopy,
	scrollViewportRef,
	variant,
	isLoading,
	onSaveToKnowledge,
	allowAiShare,
	shareSelection,
	onShare,
	className,
	t,
	getSelectionContextMenuItems,
}: AssistantMessageBubbleProps) {
	const isUser = message.role === 'user';
	const { isSharing, checkedMessages, setCheckedMessage, needShare } =
		resolveShareState(allowAiShare, shareSelection);

	return (
		<div
			className={cn(messageRowClass(variant, isUser), className)}
			data-msg-rev={msgRev}
		>
			<Label
				htmlFor={message.chatId}
				className={messageLabelClass(variant, isUser)}
			>
				{isUser ? (
					<ChatAssistantMessage
						message={message}
						t={t}
						className={messageUserContentClass(variant)}
						getSelectionContextMenuItems={getSelectionContextMenuItems}
					/>
				) : (
					<ChatAssistantMessage
						message={message}
						scrollViewportRef={scrollViewportRef}
						t={t}
						className={messageAssistantContentClass(variant)}
						getSelectionContextMenuItems={getSelectionContextMenuItems}
					/>
				)}

				{!message.isStreaming ? (
					<div
						className={cn('absolute -bottom-9', isUser ? 'right-0' : 'left-0')}
					>
						<ChatMessageActions
							message={message}
							index={index}
							isCopyedId={isCopyedId}
							messagesLength={messagesLength}
							isLoading={isLoading}
							needShare={needShare}
							onShare={needShare ? onShare : undefined}
							isSharing={isSharing}
							checkedMessages={checkedMessages}
							setCheckedMessage={setCheckedMessage}
							onCopy={onCopy}
							onSaveToKnowledge={onSaveToKnowledge}
							t={t}
						/>
					</div>
				) : null}
			</Label>
		</div>
	);
}

/**
 * 助手单条消息行：MobX observer + 按 chatId 解析 Message。
 * `variant="default"` 对齐知识库/电子书；`variant="english"` 对齐英语学习 Agent。
 */
export const AssistantMessageRow = observer(function AssistantMessageRow({
	selectMessageByChatId,
	chatId,
	variant = 'default',
	allowAiShare = false,
	...rest
}: AssistantMessageRowProps) {
	const message = selectMessageByChatId(chatId);
	if (!message) return null;

	const msgRev = buildMessageRev(message);

	return (
		<AssistantMessageBubble
			message={message}
			msgRev={msgRev}
			variant={variant}
			allowAiShare={allowAiShare}
			{...rest}
		/>
	);
});

export { AssistantMessageBubble };
