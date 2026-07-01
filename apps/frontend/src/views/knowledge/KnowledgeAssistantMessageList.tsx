import { observer } from 'mobx-react';
import type { RefObject } from 'react';
import {
	AssistantMessageRow,
	type AssistantShareSelection,
	type SelectMessageByChatId,
} from '@/components/design/Assistant';
import assistantStore from '@/store/assistant';
import knowledgeRagQaStore from '@/store/knowledgeRagQa';
import type { Message } from '@/types/chat';

const selectAssistantMessageByChatId: SelectMessageByChatId = (chatId) =>
	assistantStore.messages.find((m) => m.chatId === chatId);

const selectRagMessageByChatId: SelectMessageByChatId = (chatId) =>
	knowledgeRagQaStore.messages.find((m) => m.chatId === chatId);

type KnowledgeAssistantMessageListProps = {
	isRagMode: boolean;
	isCopyedId: string | undefined;
	onCopy: (content: string, chatId: string) => void;
	onSaveToKnowledge: (message: Message) => void;
	allowAiShare: boolean;
	shareSelection: AssistantShareSelection;
	onShare: (message?: Message) => void;
	scrollViewportRef: RefObject<HTMLElement | null>;
	t: (key: string, params?: Record<string, unknown>) => string;
};

/** 单独订阅 messages：流式 chunk 只重渲染消息列，不带动 Markdown 左栏 */
export const KnowledgeAssistantMessageList = observer(
	function KnowledgeAssistantMessageList({
		isRagMode,
		isCopyedId,
		onCopy,
		onSaveToKnowledge,
		allowAiShare,
		shareSelection,
		onShare,
		scrollViewportRef,
		t,
	}: KnowledgeAssistantMessageListProps) {
		const messages = isRagMode
			? knowledgeRagQaStore.messages
			: assistantStore.messages;

		return messages.map((message, index) => (
			<AssistantMessageRow
				key={message.chatId}
				selectMessageByChatId={
					isRagMode ? selectRagMessageByChatId : selectAssistantMessageByChatId
				}
				t={t}
				chatId={message.chatId}
				index={index}
				messagesLength={messages.length}
				isCopyedId={isCopyedId ?? ''}
				onCopy={onCopy}
				onSaveToKnowledge={onSaveToKnowledge}
				allowAiShare={allowAiShare}
				shareSelection={shareSelection}
				onShare={onShare}
				scrollViewportRef={scrollViewportRef}
			/>
		));
	},
);
