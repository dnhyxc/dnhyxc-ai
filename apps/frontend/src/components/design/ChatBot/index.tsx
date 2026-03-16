import ChatAnchorNav from '@design/ChatAnchorNav';
import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatControls from '@design/ChatControls';
import ChatFileList from '@design/ChatFileList';
import ChatMessageActions from '@design/ChatMessageActions';
import ChatNewSession from '@design/ChatNewSession';
import ChatUserMessage from '@design/ChatUserMessage';
import { ScrollArea } from '@ui/index';
import { Bot, User } from 'lucide-react';
import * as mobx from 'mobx';
import { observer } from 'mobx-react';
import {
	forwardRef,
	JSX,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useBranchManage } from '@/hooks/useBranchManage';
import { useChatCore } from '@/hooks/useChatCore';
import { useMessageTools } from '@/hooks/useMessageTools';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import { UploadedFile } from '@/types';
import { ChatBotProps, Message } from '@/types/chat';

// 定义暴露给父组件的方法类型
export interface ChatBotRef {
	clearChat: (targetSessionId?: string) => void;
	stopGenerating: (
		targetSessionId?: string,
		isUnmount?: boolean,
	) => Promise<void>;
	sendMessage: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: UploadedFile[] | null,
	) => Promise<void>;
}

const ChatBot = observer(
	forwardRef<ChatBotRef, ChatBotProps>(function ChatBot(props, ref) {
		const {
			className,
			apiEndpoint = '/chat/sse',
			showAvatar = false,
			onBranchChange,
		} = props;

		const { chatStore } = useStore();

		// 使用 useChatCore hook（共享状态）
		const {
			input,
			setInput,
			setUploadedFiles,
			editMessage,
			setEditMessage,
			sendMessage,
			clearChat,
			stopGenerating,
			handleEditChange,
			onContinue, // 新增
		} = useChatCore({
			apiEndpoint,
			onScrollTo: (position, behavior) => {
				scrollContainerRef.current?.scrollTo({
					top:
						position === 'up'
							? 0
							: scrollContainerRef.current?.scrollHeight + 100,
					behavior: behavior || 'smooth',
				});
			},
		});

		// 消息状态
		const [allMessages, setAllMessages] = useState<Message[]>(
			chatStore.messages,
		);
		const [messages, setMessages] = useState<Message[]>([]);
		const [autoScroll, setAutoScroll] = useState(true);
		const [isShowThinkContent, setIsShowThinkContent] = useState(true);
		const [isCopyedId, setIsCopyedId] = useState('');
		const [selectedChildMap, setSelectedChildMap] = useState<
			Map<string, string>
		>(new Map());
		const [scrollTop, setScrollTop] = useState<number>(0);
		const [hasScrollbar, setHasScrollbar] = useState<boolean>(false);

		// Refs
		const scrollContainerRef = useRef<HTMLDivElement>(null);
		const editInputRef = useRef<HTMLTextAreaElement>(null);
		const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

		const SCROLL_THRESHOLD = 5;

		const onScrollTo = (position: string, behavior?: 'smooth' | 'auto') => {
			scrollContainerRef.current?.scrollTo({
				top:
					position === 'up'
						? 0
						: scrollContainerRef.current?.scrollHeight + 100,
				behavior: behavior || 'smooth',
			});
		};

		// 使用分支管理 hook
		const {
			isStreamingBranchVisible,
			isLatestBranch,
			switchToLatestBranch,
			switchToStreamingBranch,
			findLatestBranchSelection,
		} = useBranchManage({
			messages,
			selectedChildMap,
			setSelectedChildMap,
			onScrollTo,
		});

		const { findSiblings, buildMessageList, getFormatMessages } =
			useMessageTools();

		// 监听 store 变化
		useEffect(() => {
			const dispose = mobx.reaction(
				() => chatStore.messages,
				(newMessages) => {
					setAllMessages([...newMessages]);
				},
				{ fireImmediately: true },
			);
			return () => dispose();
		}, [chatStore]);

		// 监听 store 中 selectedChildMap 的变化
		useEffect(() => {
			const dispose = mobx.reaction(
				() => {
					if (chatStore.activeSessionId) {
						return chatStore.getSessionBranchSelection(
							chatStore.activeSessionId,
						);
					}
					return null;
				},
				(newSelectedChildMap) => {
					if (newSelectedChildMap) {
						setSelectedChildMap(new Map(newSelectedChildMap));
					}
				},
				{ fireImmediately: true },
			);
			return () => dispose();
		}, [chatStore]);

		// 切换会话时恢复状态
		useEffect(() => {
			if (!chatStore.activeSessionId) {
				setSelectedChildMap(new Map());
				setInput('');
				setUploadedFiles([]);
				setEditMessage(null);
				return;
			}

			const savedSelection = chatStore.getSessionBranchSelection(
				chatStore.activeSessionId,
			);

			if (chatStore.messages.length > 0) {
				if (savedSelection) {
					setSelectedChildMap(savedSelection);
				} else {
					const latestBranchMap = findLatestBranchSelection(chatStore.messages);
					if (latestBranchMap) {
						setSelectedChildMap(latestBranchMap);
						chatStore.saveSessionBranchSelection(
							chatStore.activeSessionId,
							latestBranchMap,
						);
					} else {
						setSelectedChildMap(new Map());
					}
				}
			} else {
				setSelectedChildMap(new Map());
			}

			scrollTimer.current = setTimeout(() => {
				onScrollTo('down', 'auto');
			}, 50);

			setInput('');
			setUploadedFiles([]);
			setEditMessage(null);
		}, [chatStore.activeSessionId]);

		// 构建消息列表
		useEffect(() => {
			const sortedMessages = buildMessageList(allMessages, selectedChildMap);
			const formattedMessages = getFormatMessages(sortedMessages);
			setMessages(formattedMessages);
		}, [allMessages, selectedChildMap]);

		// 自动滚动
		useEffect(() => {
			if (scrollContainerRef.current) {
				const { scrollHeight, clientHeight } = scrollContainerRef.current;
				setHasScrollbar(scrollHeight > clientHeight);
			}
			const lastMessage = messages[messages.length - 1];
			const isCurrentlyStreaming =
				lastMessage?.role === 'assistant' && lastMessage?.isStreaming;

			if (autoScroll && isCurrentlyStreaming && scrollContainerRef.current) {
				onScrollTo('down', 'auto');
			}
		}, [messages, autoScroll]);

		// 清理
		useEffect(() => {
			return () => {
				if (scrollTimer.current) {
					clearTimeout(scrollTimer.current);
				}
				if (copyTimerRef.current) {
					clearTimeout(copyTimerRef.current);
				}
				if (focusTimerRef.current) {
					clearTimeout(focusTimerRef.current);
				}
			};
		}, []);

		const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
			const element = e.currentTarget;
			if (!scrollContainerRef.current) {
				scrollContainerRef.current = element;
			}
			const { scrollTop, scrollHeight, clientHeight } = element;
			setScrollTop(scrollTop);
			setHasScrollbar(scrollHeight > clientHeight);
			const isAtBottom =
				scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
			setAutoScroll(isAtBottom);
		};

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

		const onEdit = (message: Message) => {
			setEditMessage(message);
			focusTimerRef.current = setTimeout(() => {
				if (editInputRef.current) {
					editInputRef.current.focus();
					const len = editInputRef.current.value.length;
					editInputRef.current.setSelectionRange(len, len);
				}
			}, 0);
		};

		const handleBranchChange = (msgId: string, direction: 'prev' | 'next') => {
			onBranchChange?.(msgId, direction);

			const siblings = findSiblings(chatStore.messages, msgId);
			const currentIndex = siblings.findIndex((m) => m.chatId === msgId);
			const nextIndex =
				direction === 'next' ? currentIndex + 1 : currentIndex - 1;

			if (nextIndex >= 0 && nextIndex < siblings.length) {
				const nextMsg = siblings[nextIndex];
				const currentMsg = chatStore.messages.find((m) => m.chatId === msgId);
				const parentId = currentMsg?.parentId;

				const newSelectedChildMap = new Map(selectedChildMap);
				if (parentId) {
					newSelectedChildMap.set(parentId, nextMsg.chatId);
				} else {
					newSelectedChildMap.set('root', nextMsg.chatId);
				}
				setSelectedChildMap(newSelectedChildMap);
				if (chatStore.activeSessionId) {
					chatStore.saveSessionBranchSelection(
						chatStore.activeSessionId,
						newSelectedChildMap,
					);
				}
			}
		};

		const onReGenerate = (index: number) => {
			if (index > 0) {
				const userMsg = messages[index - 1];
				if (userMsg && userMsg.role === 'user') {
					sendMessage(userMsg.content, index);
				}
			}
		};

		const getMessageClassName = useCallback(
			(message: Message) => {
				const isEdit = editMessage?.chatId === message.chatId;
				return cn(
					'flex-1 rounded-md p-3 select-auto',
					message.role === 'user'
						? `bg-blue-500/10 border border-blue-500/20 text-end pt-2 pb-2.5 px-3 ${isEdit ? 'p-0 pr-2.5 pb-2.5' : ''}`
						: 'bg-theme/5 border border-theme-white/10',
					showAvatar
						? 'max-w-[calc(768px-105px)]'
						: isEdit
							? 'w-full bg-theme/5 border-theme-white/10'
							: 'w-auto',
				);
			},
			[showAvatar, editMessage?.chatId],
		);

		const isAtBottom = useMemo(() => {
			if (!scrollContainerRef.current) return false;
			const { scrollHeight, clientHeight } = scrollContainerRef.current;
			return scrollHeight - scrollTop - clientHeight < 5;
		}, [scrollTop]);

		useImperativeHandle(
			ref,
			() => ({
				clearChat,
				stopGenerating,
				sendMessage,
			}),
			[clearChat, stopGenerating, sendMessage],
		);

		return (
			<div
				className={cn(
					'relative flex flex-col h-full w-full select-none',
					className,
				)}
			>
				<ScrollArea
					ref={scrollContainerRef}
					className="flex-1 overflow-hidden w-full backdrop-blur-sm pb-5"
					onScroll={handleScroll}
				>
					<div className="max-w-3xl m-auto overflow-y-auto">
						<div className="space-y-6 overflow-hidden">
							{!messages.length ? (
								<ChatNewSession />
							) : (
								messages.map((message, index) => (
									<div
										key={message.chatId}
										id={`message-${message.chatId}`}
										className={cn(
											'flex gap-3 w-full',
											message.role === 'user' ? 'flex-row-reverse' : '',
										)}
									>
										{showAvatar ? (
											<div
												className={cn(
													'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
													message.role === 'user'
														? 'bg-blue-500/20'
														: 'bg-purple-500/20',
												)}
											>
												{message.role === 'user' ? (
													<User className="w-5 h-5 text-blue-400" />
												) : (
													<Bot className="w-5 h-5 text-purple-400" />
												)}
											</div>
										) : null}

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
														editMessage={editMessage}
														editInputRef={editInputRef}
														input={input}
														setInput={setInput}
														setEditMessage={setEditMessage}
														isLoading={chatStore.isCurrentSessionLoading}
														handleEditChange={handleEditChange}
														sendMessage={sendMessage}
													/>
												) : (
													<ChatAssistantMessage
														message={message}
														isShowThinkContent={isShowThinkContent}
														onToggleThinkContent={onToggleThinkContent}
														onContinue={onContinue}
													/>
												)}
											</div>

											<ChatMessageActions
												message={message}
												index={index}
												messagesLength={messages.length}
												isCopyedId={isCopyedId}
												isLoading={chatStore.isCurrentSessionLoading}
												onBranchChange={handleBranchChange}
												onCopy={onCopy}
												onEdit={onEdit}
												onReGenerate={onReGenerate}
											/>
										</div>
									</div>
								))
							)}
						</div>
					</div>
					<ChatAnchorNav
						messages={messages}
						scrollContainerRef={scrollContainerRef}
					/>
					<ChatControls
						isLoading={chatStore.isCurrentSessionLoading}
						isStreamingBranchVisible={isStreamingBranchVisible()}
						isLatestBranch={isLatestBranch()}
						messagesLength={messages.length}
						switchToStreamingBranch={switchToStreamingBranch}
						switchToLatestBranch={switchToLatestBranch}
						hasScrollbar={hasScrollbar}
						isAtBottom={isAtBottom}
						onScrollTo={onScrollTo}
					/>
				</ScrollArea>
			</div>
		);
	}),
);

export default ChatBot as React.FC<ChatBotProps> &
	((props: { ref?: React.Ref<ChatBotRef> } & ChatBotProps) => JSX.Element);
