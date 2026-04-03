import ChatTextArea from '@design/ChatTextArea';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { useMemo } from 'react';
import { getChatMarkdownHighlightTheme } from '@/constant';
import { useTheme } from '@/hooks/theme';
import { cn } from '@/lib/utils';
import { UploadedFile } from '@/types';
import { Message } from '@/types/chat';

interface UserMessageProps {
	message: Message;
	editMessage?: Message | null;
	editInputRef?: React.RefObject<HTMLTextAreaElement | null>;
	input?: string;
	setInput?: (value: string) => void;
	setEditMessage?: (message: Message | null) => void;
	isLoading?: boolean;
	handleEditChange?: (
		e: React.ChangeEvent<HTMLTextAreaElement> | string,
	) => void;
	sendMessage?: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: UploadedFile[] | null,
	) => void;
	className?: string;
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
	className,
}: UserMessageProps) => {
	const { theme: appTheme } = useTheme();
	const isEditing = editMessage?.chatId === message.chatId;

	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
			}),
		[appTheme],
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
					className={cn(
						`max-w-none text-left [&_.markdown-body]:text-textcolor/90!`,
						className,
					)}
					dangerouslySetInnerHTML={{
						__html: parser.render(message.content),
					}}
				/>
			)}
		</>
	);
};

export default ChatUserMessage;
