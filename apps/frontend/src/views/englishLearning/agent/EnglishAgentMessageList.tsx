import { observer } from 'mobx-react';
import { memo, type RefObject } from 'react';
import {
	AssistantMessageRow,
	type AssistantShareSelection,
	type SelectMessageByChatId,
} from '@/components/design/Assistant';
import type { SelectionContextMenuItemsFn } from '@/components/design/ContextMenu';
import englishAgentStore from '@/store/englishAgent';
import type { Message } from '@/types/chat';

const selectEnglishMessageByChatId: SelectMessageByChatId = (chatId) =>
	englishAgentStore.messages.find((m) => m.chatId === chatId);

type EnglishAgentMessageListProps = {
	isCopyedId: string | undefined;
	onCopy: (content: string, chatId: string) => void;
	onSaveToKnowledge: (message: Message) => void;
	allowAiShare: boolean;
	shareSelection: AssistantShareSelection;
	onShare: (message?: Message) => void;
	scrollViewportRef: RefObject<HTMLElement | null>;
	isLoading: boolean;
	t: (key: string, params?: Record<string, unknown>) => string;
	getSelectionContextMenuItems?: SelectionContextMenuItemsFn;
};

/** 单独订阅 messages：流式 chunk 只重渲染消息列，不带动 ChatEntry / 左侧栏 */
export const EnglishAgentMessageList = memo(
	observer(function EnglishAgentMessageList({
		isCopyedId,
		onCopy,
		onSaveToKnowledge,
		allowAiShare,
		shareSelection,
		onShare,
		scrollViewportRef,
		isLoading,
		t,
		getSelectionContextMenuItems,
	}: EnglishAgentMessageListProps) {
		const messages = englishAgentStore.messages;

		return messages.map((m, index) => (
			<AssistantMessageRow
				key={m.chatId}
				selectMessageByChatId={selectEnglishMessageByChatId}
				chatId={m.chatId}
				index={index}
				messagesLength={messages.length}
				isCopyedId={isCopyedId ?? ''}
				onCopy={onCopy}
				isLoading={isLoading}
				onSaveToKnowledge={onSaveToKnowledge}
				allowAiShare={allowAiShare}
				shareSelection={shareSelection}
				onShare={onShare}
				scrollViewportRef={scrollViewportRef}
				variant="english"
				t={t}
				getSelectionContextMenuItems={getSelectionContextMenuItems}
			/>
		));
	}),
);
