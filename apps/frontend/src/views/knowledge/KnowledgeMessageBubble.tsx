import { observer } from 'mobx-react';
import type { RefObject } from 'react';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/chat';

export interface KnowledgeAssistantMessageBubbleProps {
	chatId: string;
	index: number;
	messagesLength: number;
	isCopyedId: string;
	onCopy: (content: string, chatId: string) => void;
	onSaveToKnowledge: (message: Message) => void;
	/** 与 ScrollArea Viewport ref 一致，供助手消息内代码块吸顶条与 MdPreview 懒挂载 */
	scrollViewportRef: RefObject<HTMLElement | null>;
}

type ShareSelectionLike = {
	isSharing: boolean;
	checkedMessages: Set<string>;
	setCheckedMessage: (message: Message) => void;
};

/**
 * 单条气泡独立 observer：从 store 解析出当前 Message。
 * `data-msg-rev` 绑定「正文长度 + 思考区长度 + 是否在流式」的合成串，
 * 使 MobX 在流式阶段能稳定订阅这些字段（语义：消息内容版本戳，非 hack 预读）。
 */
export type SelectMessageByChatId = (chatId: string) => Message | undefined;

export const KnowledgeMessageBubble = observer(function KnowledgeMessageBubble({
	selectMessageByChatId,
	chatId,
	index,
	messagesLength,
	isCopyedId,
	onCopy,
	onSaveToKnowledge,
	allowAiShare = false,
	shareSelection,
	onShare,
	scrollViewportRef,
}: KnowledgeAssistantMessageBubbleProps & {
	selectMessageByChatId: SelectMessageByChatId;
	allowAiShare?: boolean;
	shareSelection?: ShareSelectionLike;
	onShare?: (message?: Message) => void;
}) {
	const message = selectMessageByChatId(chatId);
	if (!message) return null;

	const isSharing = allowAiShare ? Boolean(shareSelection?.isSharing) : false;
	const checkedMessages = allowAiShare
		? (shareSelection?.checkedMessages ?? new Set<string>())
		: new Set<string>();
	const setCheckedMessage = allowAiShare
		? shareSelection?.setCheckedMessage
		: undefined;
	const needShare = allowAiShare && !isSharing;

	const streamRev =
		message.role === 'assistant'
			? `${message.content.length}:${message.thinkContent?.length ?? 0}:${message.isStreaming ? 1 : 0}`
			: `${message.content.length}`;

	return (
		<div
			className={cn(
				// min-w-0：flex 子项默认可缩到小于内容宽，避免代码块/长行把整列撑出 ScrollArea
				'relative flex min-w-0 max-w-full flex-1 flex-col gap-1 pb-10 w-full group last:pb-8.5',
				message.role === 'user' ? 'items-end' : '',
			)}
			data-msg-rev={streamRev}
		>
			<div
				id="message-md-wrap"
				className={cn(
					'relative flex min-w-0 max-w-full rounded-md p-3 select-auto text-textcolor mb-5',
					message.role === 'user'
						? 'w-fit max-w-full self-end bg-teal-600/5 border border-teal-500/15 text-end pt-2 pb-2.5 px-3'
						: 'flex-1 bg-theme/5 border border-theme/10',
				)}
			>
				{message.role === 'user' ? (
					<ChatAssistantMessage
						message={message}
						className="text-left min-w-0 max-w-full [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full [&_.markdown-body]:overflow-x-auto"
					/>
				) : (
					<ChatAssistantMessage
						message={message}
						scrollViewportRef={scrollViewportRef}
					/>
				)}

				{/* 仅当前正在流式输出的那条助手消息隐藏操作条，其余消息照常展示 */}
				{!message.isStreaming ? (
					<div
						className={cn(
							'absolute -bottom-9',
							message.role === 'user' ? 'right-0' : 'left-0',
						)}
					>
						<ChatMessageActions
							message={message}
							index={index}
							isCopyedId={isCopyedId}
							messagesLength={messagesLength}
							needShare={needShare}
							onShare={needShare ? onShare : undefined}
							isSharing={isSharing}
							checkedMessages={checkedMessages}
							setCheckedMessage={setCheckedMessage}
							onCopy={onCopy}
							onSaveToKnowledge={onSaveToKnowledge}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
});
