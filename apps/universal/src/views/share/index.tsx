import { ScrollArea } from '@ui/scroll-area';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatFileList from '@/components/design/ChatFileList';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import ChatUserMessage from '@/components/design/ChatUserMessage';
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
	const [_scrollTop, setScrollTop] = useState<number>(0);
	const [_hasScrollbar, setHasScrollbar] = useState<boolean>(false);
	const [isShowThinkContent, setIsShowThinkContent] = useState(true);
	const [isCopyedId, setIsCopyedId] = useState('');

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const editInputRef = useRef<HTMLTextAreaElement>(null);
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		console.log(params, 'params');
		if (params?.shareId) {
			getShareData(params.shareId);
		}
	}, [params?.shareId]);

	const getShareData = async (id: string) => {
		const res = await getShare<Session>(id);
		console.log(res.data, 'res');
		if (res) {
			setChatData(res.data);
		}
	};

	console.log(chatData, 'session');

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const element = e.currentTarget;
		if (!scrollContainerRef.current) {
			scrollContainerRef.current = element;
		}
		const { scrollTop, scrollHeight, clientHeight } = element;
		setScrollTop(scrollTop);
		setHasScrollbar(scrollHeight > clientHeight);
	};

	const getMessageClassName = useCallback((message: Message) => {
		return cn(
			'flex-1 rounded-md p-3 select-auto w-auto',
			message.role === 'user'
				? `bg-blue-500/10 border border-blue-500/20 text-end pt-2 pb-2.5 px-3`
				: 'bg-theme/5 border border-theme-white/10',
		);
	}, []);

	const onToggleThinkContent = () => {
		setIsShowThinkContent(!isShowThinkContent);
	};

	const onCopy = (value: string, id: string) => {
		navigator.clipboard.writeText(value);
		setIsCopyedId(id);
		copyTimerRef.current = setTimeout(() => {
			setIsCopyedId('');
		}, 500);
	};

	return (
		<div className={cn('relative flex flex-col h-full w-full select-none')}>
			<ScrollArea
				ref={scrollContainerRef}
				className="flex-1 overflow-hidden w-full backdrop-blur-sm pb-5"
				onScroll={handleScroll}
			>
				<div className="max-w-3xl m-auto overflow-y-auto">
					<div className="space-y-6 overflow-hidden">
						{chatData?.messages.length
							? chatData?.messages.map((message, index) => (
									<div
										key={message.chatId}
										id={`message-${message.chatId}`}
										className={cn(
											'flex gap-3 w-full',
											message.role === 'user' ? 'flex-row-reverse' : '',
										)}
									>
										<div
											className={cn(
												'relative flex-1 flex flex-col gap-1 pb-10 w-full group',
												message.role === 'user' ? 'items-end' : '',
											)}
										>
											{message?.attachments &&
												message?.attachments.length > 0 && (
													<div className="flex flex-wrap justify-end gap-1.5 mb-2">
														{message.role === 'user'
															? message?.attachments?.map((i) => (
																	<ChatFileList
																		key={i.id || i.uuid}
																		data={i}
																		showDownload
																	/>
																))
															: null}
													</div>
												)}
											<div className={getMessageClassName(message)}>
												{message.role === 'user' ? (
													<ChatUserMessage
														message={message}
														editInputRef={editInputRef}
													/>
												) : (
													<ChatAssistantMessage
														message={message}
														isShowThinkContent={isShowThinkContent}
														onToggleThinkContent={onToggleThinkContent}
													/>
												)}
											</div>

											<ChatMessageActions
												message={message}
												index={index}
												messagesLength={chatData?.messages.length}
												isCopyedId={isCopyedId}
												onCopy={onCopy}
											/>
										</div>
									</div>
								))
							: null}
					</div>
				</div>
				{/* <ChatControls
					isLoading={chatStore.isCurrentSessionLoading}
					isStreamingBranchVisible={isStreamingBranchVisible()}
					isLatestBranch={isLatestBranch()}
					messagesLength={messages.length}
					switchToStreamingBranch={switchToStreamingBranch}
					switchToLatestBranch={switchToLatestBranch}
					hasScrollbar={hasScrollbar}
					isAtBottom={isAtBottom}
					onScrollTo={onScrollTo}
				/> */}
			</ScrollArea>
		</div>
	);
};

export default SessionShare;
