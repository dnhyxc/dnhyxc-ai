import { ScrollArea } from '@ui/index';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatFileList from '@/components/design/ChatFileList';
import ChatUserMessage from '@/components/design/ChatUserMessage';
import { useTheme } from '@/hooks';
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
	// 分享路由不在 Layout 内，需自行初始化主题（含 URL ?theme= 与本地 store）
	useTheme();

	const [chatData, setChatData] = useState<Session>();

	useEffect(() => {
		if (params?.shareId) {
			getShareData(params.shareId);
		}
	}, [params?.shareId]);

	const getShareData = async (id: string) => {
		const res = await getShare<Session>(id);
		if (res.success) {
			setChatData(res.data);
		}
	};

	return (
		// ScrollArea 视口为 size-full，祖先必须固定高度（min-h-screen 会随内容变高 → 无法滚动）
		<div className="flex h-dvh w-full flex-col overflow-hidden bg-theme-background">
			<ScrollArea className="min-h-0 flex-1" viewportClassName="pt-10 pb-8">
				<div
					className={cn(
						'max-w-3xl mx-auto relative flex w-full flex-col select-none px-4',
					)}
				>
					{chatData?.messages.map((message) => (
						<div
							key={message.id}
							className={cn(
								'relative flex-1 flex flex-col gap-1 pb-10 w-full group',
								message.role === 'user' ? 'items-end' : '',
							)}
						>
							{!!message.attachments?.length && (
								<div className="flex flex-wrap justify-end gap-1.5 mb-2">
									{message.role === 'user'
										? message.attachments.map((i) => (
												<ChatFileList
													key={i.id || i.uuid}
													data={i}
													showDownload
												/>
											))
										: null}
								</div>
							)}
							<div
								id="message-md-wrap"
								className={cn(
									'flex-1 rounded-md p-3 select-auto text-textcolor',
									message.role === 'user'
										? 'bg-blue-500/10 border border-blue-500/20 text-end pt-2 pb-2.5 px-3'
										: 'bg-theme/5 border border-theme/20',
								)}
							>
								{message.role === 'user' ? (
									<ChatUserMessage message={message} />
								) : (
									<ChatAssistantMessage message={message} />
								)}
							</div>
						</div>
					))}
				</div>
			</ScrollArea>
		</div>
	);
};

export default SessionShare;
