import { cn } from '@/lib/utils';
import type { Message } from '@/types/chat';
import type { AssistantMessageVariant, AssistantShareSelection } from './types';

/** 单条消息流式订阅 revision（正文 + 思考区 + 流式态） */
export function buildMessageRev(message: Message): string {
	return message.role === 'assistant'
		? `${message.content.length}:${message.thinkContent?.length ?? 0}:${message.isStreaming ? 1 : 0}`
		: `${message.content.length}`;
}

/** 流式贴底 contentRevision：MobX 原地更新 content 时须每帧重算，不可 memo 数组引用 */
export function buildStreamTick(messages: readonly Message[]): string {
	const last = messages[messages.length - 1];
	if (last == null) return String(messages.length);
	return `${messages.length}:${last.chatId}:${last.content.length}:${last.thinkContent?.length ?? 0}:${last.isStreaming ? 1 : 0}`;
}

export function resolveShareState(
	allowAiShare: boolean,
	shareSelection?: AssistantShareSelection,
) {
	const isSharing = allowAiShare ? Boolean(shareSelection?.isSharing) : false;
	const checkedMessages = allowAiShare
		? (shareSelection?.checkedMessages ?? new Set<string>())
		: new Set<string>();
	const setCheckedMessage =
		allowAiShare && isSharing ? shareSelection?.setCheckedMessage : undefined;
	const needShare = allowAiShare && !isSharing;
	return { isSharing, checkedMessages, setCheckedMessage, needShare };
}

export function messageRowClass(
	variant: AssistantMessageVariant,
	isUser: boolean,
): string {
	if (variant === 'english') {
		return cn(
			'relative flex w-full min-w-0 max-w-full flex-1 flex-col gap-1 pb-10 group last:pb-8.5',
			isUser ? 'items-end' : 'items-stretch',
		);
	}
	return cn(
		'relative flex min-w-0 max-w-full flex-1 flex-col gap-1 pb-10 w-full group last:pb-8.5',
		isUser ? 'items-end' : '',
	);
}

export function messageLabelClass(
	variant: AssistantMessageVariant,
	isUser: boolean,
): string {
	if (variant === 'english') {
		return cn(
			'message-md-wrap relative mb-5 flex min-w-0 max-w-full select-text rounded-md p-4 text-textcolor',
			isUser
				? 'w-fit max-w-[min(100%,36rem)] border border-teal-500/5 bg-teal-500/8 px-4 pt-2 pb-2.5'
				: 'w-full border border-theme/5 bg-theme-secondary/60 py-3',
		);
	}
	return cn(
		'message-md-wrap relative flex min-w-0 max-w-full rounded-md p-3 select-text text-textcolor mb-5',
		isUser
			? 'w-fit max-w-full self-end bg-teal-600/5 border border-teal-500/5 text-end pt-2 pb-2.5 px-3'
			: 'flex-1 bg-theme/5 border border-theme/5',
	);
}

export function messageUserContentClass(
	variant: AssistantMessageVariant,
): string {
	if (variant === 'english') {
		return 'min-w-0 max-w-full text-left [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full [&_.markdown-body]:overflow-x-auto';
	}
	return 'text-left min-w-0 max-w-full [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full [&_.markdown-body]:overflow-x-auto';
}

export function messageAssistantContentClass(
	variant: AssistantMessageVariant,
): string | undefined {
	if (variant === 'english') return undefined;
	return 'min-w-0 w-full max-w-full [&_.streaming-md-body]:min-w-0 [&_.markdown-mermaid-wrap]:max-w-full';
}
