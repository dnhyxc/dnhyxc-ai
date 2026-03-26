import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import SimpleChatBotView from '@/components/design/ChatBot/SimpleChatBotView';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import { cn } from '@/lib/utils';
import { getShare } from '@/service';

export interface Session {
	id: string;
	content: string;
	role: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	messages: Message[];
	title: string;
}

export interface UploadedFile {
	id: string;
	uuid: string;
	filename: string;
	mimetype: string;
	originalname: string;
	path: string;
	size: number;
}

export interface Message {
	chatId: string;
	content: string;
	role: 'user' | 'assistant';
	timestamp: Date;
	id?: string;
	createdAt?: Date;
	attachments?: UploadedFile[] | null;
	thinkContent?: string;
	isStreaming?: boolean;
	isStopped?: boolean;
	parentId?: string;
	childrenIds?: string[];
	siblingIndex?: number;
	siblingCount?: number;
	currentChatId?: string;
}

const SessionShare = () => {
	const params = useParams();

	const [chatData, setChatData] = useState<Session>();

	useEffect(() => {
		if (params?.shareId) {
			getShareData(params.shareId);
		}
	}, [params?.shareId]);

	const getShareData = async (id: string) => {
		const res = await getShare<Session>(id);
		if (res) {
			setChatData(res.data);
		}
	};

	return (
		<div className={cn('relative flex flex-col h-full w-full select-none')}>
			<SimpleChatBotView
				messages={chatData?.messages || []}
				renderMessageActions={({
					message,
					index,
					messagesLength,
					isCopyedId,
					onCopy,
				}) => (
					<ChatMessageActions
						message={message}
						index={index}
						messagesLength={messagesLength}
						isCopyedId={isCopyedId}
						onCopy={onCopy}
					/>
				)}
			/>
		</div>
	);
};

export default SessionShare;
