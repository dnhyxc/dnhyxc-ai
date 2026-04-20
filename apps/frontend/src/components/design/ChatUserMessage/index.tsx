import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatTextArea from '@design/ChatTextArea';
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
	const isEditing = editMessage?.chatId === message.chatId;

	return (
		// 与 Label 上 w-fit 一致：随 Markdown 内容变宽，max-w-full 继承会话列上限，min-w-0 便于长行在气泡内横向滚动
		<div className="w-fit min-w-0 max-w-full">
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
				<ChatAssistantMessage
					message={message}
					className={cn(
						'text-left min-w-0 max-w-full [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full [&_.markdown-body]:overflow-x-auto [&_.markdown-body]:text-textcolor/90!',
						className,
					)}
				/>
			)}
		</div>
	);
};

export default ChatUserMessage;
