import ChatTextArea from '@design/ChatTextArea';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { useMemo } from 'react';
import { CHAT_MARKDOWN_HIGHLIGHT_THEME } from '@/constant';
import { UploadedFile } from '@/types';
import { Message } from '@/types/chat';

interface UserMessageProps {
	message: Message;
	editMessage: Message | null;
	editInputRef: React.RefObject<HTMLTextAreaElement | null>;
	input: string;
	setInput: (value: string) => void;
	setEditMessage: (message: Message | null) => void;
	isLoading: boolean;
	handleEditChange: (
		e: React.ChangeEvent<HTMLTextAreaElement> | string,
	) => void;
	sendMessage: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: UploadedFile[] | null,
	) => void;
}

const ChatUserMessage = ({
	message,
	editMessage,
	editInputRef,
	input,
	setInput,
	setEditMessage,
	isLoading,
	handleEditChange,
	sendMessage,
}: UserMessageProps) => {
	const isEditing = editMessage?.chatId === message.chatId;

	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: CHAT_MARKDOWN_HIGHLIGHT_THEME,
			}),
		[],
	);

	return (
		<>
			{isEditing ? (
				<ChatTextArea
					ref={editInputRef}
					mode="edit"
					input={input}
					setInput={setInput}
					editMessage={editMessage}
					setEditMessage={setEditMessage}
					loading={isLoading}
					handleEditChange={handleEditChange}
					sendMessage={sendMessage}
				/>
			) : (
				<div
					className="max-w-none text-left [&_.markdown-body]:text-textcolor/90!"
					dangerouslySetInnerHTML={{
						__html: parser.render(message.content),
					}}
				/>
			)}
		</>
	);
};

export default ChatUserMessage;
