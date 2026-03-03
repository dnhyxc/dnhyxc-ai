import ChatEntry from '@design/ChatEntry';
import ChatFileList from '@design/ChatFileList';
import ChatTextArea from '@design/ChatTextArea';
import MarkdownPreview from '@design/Markdown';
import { Button, ScrollArea, Spinner, Toast } from '@ui/index';
import { motion } from 'framer-motion';
import {
	Bot,
	CheckCircle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Copy,
	PencilLine,
	RotateCw,
	User,
} from 'lucide-react';
import * as mobx from 'mobx';
import { observer } from 'mobx-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { stopSse, uploadFiles } from '@/service';
import useStore from '@/store';
import { FileWithPreview, UploadedFile } from '@/types';
import { ChatBotProps, ChatRequestParams, Message } from '@/types/chat';
import { streamFetch } from '@/utils/sse';
import { buildMessageList, getFormatMessages } from '@/views/chat/tools';
import {
	createAssistantMessage,
	createUserMessage,
	findLastAssistantMessage,
	findSiblings,
	updateParentChildrenIds,
} from './tools';

const ChatBot = observer(function ChatBot(props: ChatBotProps) {
	const {
		className,
		apiEndpoint = '/chat/sse',
		showAvatar = false,
		onBranchChange,
		activeSessionId,
		setActiveSessionId,
	} = props;
	const { chatStore } = useStore();

	// allMessages 存储完整树（包含所有分支和流式消息）- 使用chatStore
	// 使用useState同步store变化，确保React重新渲染
	const [allMessages, setAllMessages] = useState<Message[]>(chatStore.messages);
	// messages 存储当前显示的路径（由 selectedChildMap 决定）
	const [messages, setMessages] = useState<Message[]>([]);
	const [sessionId, setSessionId] = useState('');
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const [isShowThinkContent, setIsShowThinkContent] = useState(true);
	const [isCopyedId, setIsCopyedId] = useState('');
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	const [selectedChildMap, setSelectedChildMap] = useState<Map<string, string>>(
		new Map(),
	);
	const [currentChatId, setCurrentChatId] = useState<string>('');
	const [editMessage, setEditMessage] = useState<Message | null>(null);
	// 跟踪当前正在流式的消息 ID（用于持续更新，不影响视图）
	const [streamingMessageId, setStreamingMessageId] = useState<string | null>(
		null,
	);
	// 记录流式开始时的分支路径（用于切换回来时恢复）
	const [streamingPathMap, setStreamingPathMap] = useState<Map<string, string>>(
		new Map(),
	);

	// 辅助函数：更新store中的消息
	const updateStoreMessages = (
		updater: (prevMessages: Message[]) => Message[],
	) => {
		const updatedMessages = updater(chatStore.messages);
		chatStore.setAllMessages(updatedMessages, activeSessionId || '');
	};

	const stopRequestRef = useRef<(() => void) | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const editInputRef = useRef<HTMLTextAreaElement>(null);
	const chatInputRef = useRef<HTMLTextAreaElement>(null);

	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const navigate = useNavigate();

	// 监听store变化，同步到本地状态
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

	// 初始化逻辑 - 当 activeSessionId 变化时重置状态
	useEffect(() => {
		// 注意：切换会话时不停止流式输出，让它在后台继续

		if (chatStore.messages.length > 0) {
			setSelectedChildMap(new Map());
			const streamingMsg = chatStore.messages.find((m) => m.isStreaming);
			if (streamingMsg) {
				setStreamingMessageId(streamingMsg.chatId);
				// 保存当前路径
				const pathMap = new Map(selectedChildMap);
				setStreamingPathMap(pathMap);
			} else {
				setStreamingMessageId(null);
				setStreamingPathMap(new Map());
			}
		} else {
			setSelectedChildMap(new Map());
			setStreamingMessageId(null);
			setStreamingPathMap(new Map());
		}

		// 重置输入状态
		setInput('');
		setUploadedFiles([]);
		setEditMessage(null);
	}, [activeSessionId]);

	// 核心逻辑：根据 allMessages 和 selectedChildMap 推导当前显示的 messages
	// 流式消息始终在 allMessages 中更新，视图根据 selectedChildMap 显示
	useEffect(() => {
		const sortedMessages = buildMessageList(allMessages, selectedChildMap);
		const formattedMessages = getFormatMessages(sortedMessages);
		setMessages(formattedMessages);

		setCurrentChatId((prevChatId) => {
			if (formattedMessages.length > 0) {
				const lastMsg = formattedMessages[formattedMessages.length - 1];
				const newChatId = lastMsg.chatId;
				return prevChatId !== newChatId ? newChatId : prevChatId;
			} else {
				return prevChatId !== '' ? '' : prevChatId;
			}
		});
	}, [allMessages, selectedChildMap]);

	// 自动滚动逻辑
	useEffect(() => {
		if (autoScroll && scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop =
				scrollContainerRef.current.scrollHeight;
		}
	}, [messages, autoScroll, streamingMessageId]);

	// 清理逻辑
	useEffect(() => {
		return () => {
			if (copyTimerRef.current) {
				clearTimeout(copyTimerRef.current);
				copyTimerRef.current = null;
			}
			if (focusTimerRef.current) {
				clearTimeout(focusTimerRef.current);
				focusTimerRef.current = null;
			}
			stopGenerating();
		};
	}, []);

	useEffect(() => {
		console.log(chatStore.messages, 'chatStore.messages');
	}, [chatStore.messages]);

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const element = e.currentTarget;
		if (!scrollContainerRef.current) {
			scrollContainerRef.current = element;
		}
		const { scrollTop, scrollHeight, clientHeight } = element;
		const SCROLL_THRESHOLD = 5;
		const isAtBottom =
			scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
		if (isAtBottom) {
			setAutoScroll(true);
		} else {
			setAutoScroll(false);
		}
	};

	const onSseFetch = async (
		api: string = apiEndpoint,
		assistantMessageId: string,
		userMessage?: Message,
		assistantMessage?: Message,
		isRegenerate?: boolean,
	) => {
		const parentId = isRegenerate ? userMessage?.chatId : userMessage?.parentId;

		// 设置流式消息跟踪
		setStreamingMessageId(assistantMessageId);
		// 保存当前分支路径
		setStreamingPathMap(new Map(selectedChildMap));

		const messages: ChatRequestParams = {
			messages: [
				{
					role: 'user',
					content: isRegenerate
						? `重新生成"${userMessage?.content}"的答案，不要与之前答案重复`
						: userMessage?.content || '',
					noSave: isRegenerate,
				},
			],
			sessionId: sessionId || activeSessionId,
			stream: true,
			isRegenerate,
			parentId,
			userMessage,
			assistantMessage,
			currentChatId,
		};
		if (userMessage?.attachments?.length) {
			messages.attachments = userMessage?.attachments;
		}
		try {
			const stop = await streamFetch({
				api,
				options: {
					body: JSON.stringify(messages),
				},
				callbacks: {
					onStart: () => {
						setLoading(true);
					},
					onThinking: (thinking) => {
						if (typeof thinking === 'string') {
							// 使用新的 updateMessage 方法，确保流式消息在后台继续更新
							const currentMessage = chatStore.messages.find(
								(m) => m.chatId === assistantMessageId,
							);
							chatStore.updateMessage(assistantMessageId, {
								thinkContent: (currentMessage?.thinkContent || '') + thinking,
								isStreaming: true,
							});
						}
					},
					onData: (chunk) => {
						if (typeof chunk === 'string') {
							// 使用新的 updateMessage 方法，确保流式消息在后台继续更新
							const currentMessage = chatStore.messages.find(
								(m) => m.chatId === assistantMessageId,
							);
							chatStore.updateMessage(assistantMessageId, {
								content: (currentMessage?.content || '') + chunk,
								isStreaming: true,
							});
						}
					},
					getSessionId: (sessionId) => {
						setSessionId(sessionId);
						navigate(`/chat/${sessionId}`);
					},
					onError: (err, type) => {
						setLoading(false);
						setStreamingMessageId(null);
						Toast({
							type: type || 'error',
							title: err?.message || String(err) || '发送失败',
						});
						// 移除空的流式消息
						const currentMessage = chatStore.messages.find(
							(m) => m.chatId === assistantMessageId,
						);
						if (
							currentMessage &&
							(!currentMessage.content || currentMessage.content === '') &&
							(!currentMessage.thinkContent ||
								currentMessage.thinkContent === '')
						) {
							chatStore.setAllMessages(
								chatStore.messages.filter(
									(m) => m.chatId !== assistantMessageId,
								),
								activeSessionId || '',
							);
						} else {
							// 标记流式结束
							chatStore.updateMessage(assistantMessageId, {
								isStreaming: false,
								isStopped: true,
							});
						}
					},
					onComplete: () => {
						setLoading(false);
						setStreamingMessageId(null);
						// 标记流式结束
						chatStore.updateMessage(assistantMessageId, {
							isStreaming: false,
						});
					},
				},
			});

			stopRequestRef.current = stop;
		} catch (_error) {
			setLoading(false);
			setStreamingMessageId(null);
			Toast({
				type: 'error',
				title: '发送消息失败',
			});
			updateStoreMessages((prev) =>
				prev.filter(
					(msg) =>
						!(
							msg.chatId === assistantMessageId &&
							msg.content === '' &&
							msg.thinkContent === ''
						),
				),
			);
		}
	};

	const handleEditMessage = async (
		content?: string,
		attachments?: UploadedFile[] | null,
	) => {
		if (!editMessage) return;

		const userMsgId = uuidv4();
		const assistantMessageId = uuidv4();
		let userMessageToUse: Message | null = null;
		let assistantMessage: Message | null = null;

		const newSelectedChildMap = new Map(selectedChildMap);

		updateStoreMessages((prevAll) => {
			const editedMsg = prevAll.find((m) => m.chatId === editMessage.chatId);
			if (!editedMsg) return prevAll.map((i) => ({ ...i, isStopped: false }));

			const parentId = editedMsg.parentId;
			const userMsg = createUserMessage({
				chatId: userMsgId,
				content: content || editMessage?.content.trim(),
				parentId,
				attachments,
				currentChatId,
			});
			userMsg.childrenIds = [assistantMessageId];

			const assistantMsg = createAssistantMessage({
				chatId: assistantMessageId,
				parentId: userMsgId,
				currentChatId,
			});

			let newAllMessages = [...prevAll];
			if (parentId) {
				newAllMessages = updateParentChildrenIds({
					allMessages: newAllMessages,
					parentId,
					childId: userMsgId,
				});
				newSelectedChildMap.set(parentId, userMsgId);
			} else {
				newSelectedChildMap.set('root', userMsgId);
			}

			newAllMessages.push(userMsg, assistantMsg);

			userMessageToUse = userMsg;
			assistantMessage = assistantMsg;

			return newAllMessages.map((i) => ({ ...i, isStopped: false }));
		});

		setSelectedChildMap(newSelectedChildMap);

		if (userMessageToUse && assistantMessage) {
			onSseFetch(
				apiEndpoint,
				assistantMessageId,
				userMessageToUse,
				assistantMessage,
				false,
			);
			setEditMessage(null);
		}
	};

	const handleRegenerateMessage = async (_content: string, index: number) => {
		const assistantMessageId = uuidv4();

		let userMessageToUse: Message | null = null;
		let assistantMessage: Message | null = null;
		let newSelectedChildMap: Map<string, string> | null = null;

		const currentAssistantMsg = messages[index];
		if (!currentAssistantMsg) return;

		updateStoreMessages((prevAll) => {
			const userMsg = prevAll.find(
				(m) => m.chatId === currentAssistantMsg.parentId,
			);
			if (!userMsg) return prevAll.map((i) => ({ ...i, isStopped: false }));

			const userMsgCopy = { ...userMsg };
			const childrenIds = userMsg.childrenIds ? [...userMsg.childrenIds] : [];
			if (!childrenIds.includes(assistantMessageId)) {
				childrenIds.push(assistantMessageId);
			}
			userMsgCopy.childrenIds = childrenIds;
			userMsgCopy.currentChatId = currentChatId;

			const assistantMsg = createAssistantMessage({
				chatId: assistantMessageId,
				parentId: userMsgCopy.chatId,
				currentChatId,
			});

			const newAllMessages = prevAll.map((msg) =>
				msg.chatId === userMsgCopy.chatId ? userMsgCopy : msg,
			);
			newAllMessages.push(assistantMsg);

			const childMap = new Map(selectedChildMap);
			childMap.set(userMsgCopy.chatId, assistantMessageId);

			userMessageToUse = userMsgCopy;
			assistantMessage = assistantMsg;
			newSelectedChildMap = childMap;

			setSelectedChildMap(childMap);

			return newAllMessages.map((i) => ({ ...i, isStopped: false }));
		});

		if (userMessageToUse && assistantMessage && newSelectedChildMap) {
			onSseFetch(
				apiEndpoint,
				assistantMessageId,
				userMessageToUse,
				assistantMessage,
				true,
			);
		}
	};

	const handleNewMessage = async (content: string) => {
		const userMsgId = uuidv4();
		const assistantMessageId = uuidv4();

		let parentId: string | undefined;
		const lastMsg = messages[messages.length - 1];
		if (lastMsg) {
			parentId = lastMsg.chatId;
		}

		const userMessageToUse = createUserMessage({
			chatId: userMsgId,
			content,
			parentId,
			currentChatId,
			attachments: uploadedFiles?.length ? uploadedFiles : undefined,
		});

		userMessageToUse.childrenIds = [assistantMessageId];

		const assistantMessage = createAssistantMessage({
			chatId: assistantMessageId,
			parentId: userMsgId,
			currentChatId,
		});

		updateStoreMessages((prevAll) => {
			let newAllMessages = [
				...prevAll.map((i) => ({ ...i, isStopped: false })),
			] as Message[];
			if (userMessageToUse.parentId) {
				newAllMessages = updateParentChildrenIds({
					allMessages: newAllMessages,
					parentId: userMessageToUse.parentId,
					childId: userMsgId,
				});
			}
			newAllMessages.push(userMessageToUse, assistantMessage);
			return newAllMessages.map((i) => ({ ...i, isStopped: false }));
		});

		onSseFetch(
			apiEndpoint,
			assistantMessageId,
			userMessageToUse,
			assistantMessage,
			false,
		);
	};

	const sendMessage = async (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: UploadedFile[] | null,
	) => {
		if ((!content && !input.trim()) || loading) return;

		const isRegenerate =
			content !== undefined && index !== undefined && !isEdit;
		const isEditMode = isEdit === true;

		if (isEditMode) {
			await handleEditMessage(content, attachments);
		} else if (isRegenerate) {
			await handleRegenerateMessage(content!, index);
		} else {
			await handleNewMessage(content || input.trim());
		}

		setInput('');
		setUploadedFiles([]);
		setAutoScroll(true);
	};

	const onContinue = async () => {
		let userMsgForApi: Message | null = null;
		let assistantMsgForApi: Message | null = null;
		let lastMsgId: string | null = null;

		const formattedMessages = messages;
		if (formattedMessages.length > 0) {
			const lastMsg = formattedMessages[formattedMessages.length - 1];
			if (lastMsg.role === 'assistant' && lastMsg.isStopped) {
				const userMsg = chatStore.messages.find(
					(m) => m.chatId === lastMsg.parentId,
				);
				if (userMsg) {
					// 更新消息状态
					chatStore.updateMessage(lastMsg.chatId, {
						isStreaming: true,
						isStopped: false,
					});

					userMsgForApi = {
						...userMsg,
						isStopped: false,
					};
					assistantMsgForApi = {
						...lastMsg,
						isStreaming: true,
						isStopped: false,
					};
					lastMsgId = lastMsg.chatId;
				} else {
					lastMsgId = lastMsg.chatId;
				}
			}
		}

		if (lastMsgId) {
			if (userMsgForApi && assistantMsgForApi) {
				onSseFetch(
					'/chat/continueSse',
					lastMsgId,
					userMsgForApi,
					assistantMsgForApi,
					false,
				);
			} else {
				onSseFetch('/chat/continueSse', lastMsgId, undefined, undefined, false);
			}
		}
	};

	const stopGenerating = async () => {
		if (stopRequestRef.current) {
			await stopSse(sessionId);
			stopRequestRef.current();
			stopRequestRef.current = null;
			setLoading(false);
			setStreamingMessageId(null);

			// 使用新的 updateMessage 方法
			const lastAssistantMsg = findLastAssistantMessage(chatStore.messages);
			if (lastAssistantMsg) {
				chatStore.updateMessage(lastAssistantMsg.chatId, {
					isStreaming: false,
					isStopped: true,
				});
			}
		}
	};

	const clearChat = () => {
		setInput('');
		chatStore.setAllMessages([], '');
		setMessages([]);
		stopRequestRef.current?.();
		stopRequestRef.current = null;
		setLoading(false);
		setStreamingMessageId(null);
		setStreamingPathMap(new Map());
		setSessionId('');
		setActiveSessionId?.('');
		setSelectedChildMap(new Map());
		navigate('/chat');
	};

	const handleEditChange = (
		e: React.ChangeEvent<HTMLTextAreaElement> | string,
	) => {
		const content = typeof e === 'string' ? e : e.target.value;
		setEditMessage((prev) => {
			if (prev) {
				return {
					...prev,
					content,
				};
			}
			return prev;
		});
	};

	const onToggleThinkContent = () => {
		setIsShowThinkContent(!isShowThinkContent);
	};

	const onUploadFile = async (data: FileWithPreview | FileWithPreview[]) => {
		const files = Array.isArray(data) ? data : [data];
		const fileList = files.map((item) => item.file);
		const res = await uploadFiles(fileList);
		if (res.success) {
			setUploadedFiles((prev) => {
				return [
					...prev,
					...res.data.map((item: UploadedFile) => ({
						...item,
						path: import.meta.env.VITE_DEV_DOMAIN + item.path,
						uuid: uuidv4(),
					})),
				];
			});
			chatInputRef.current?.focus();
		}
	};

	const onCopy = (value: string, id: string) => {
		navigator.clipboard.writeText(value);
		setIsCopyedId(id);
		copyTimerRef.current = setTimeout(() => {
			setIsCopyedId('');
		}, 500);
	};

	const onFocusEditInput = () => {
		focusTimerRef.current = setTimeout(() => {
			if (editInputRef.current) {
				editInputRef.current.focus();
				const len = editInputRef.current.value.length;
				editInputRef.current.setSelectionRange(len, len);
			}
		}, 0);
	};

	const onEdit = (message: Message) => {
		setEditMessage(message);
		onFocusEditInput();
	};

	const onReGenerate = (index: number) => {
		if (index > 0) {
			const userMsg = messages[index - 1];
			if (userMsg && userMsg.role === 'user') {
				sendMessage(userMsg.content, index);
			}
		}
	};

	// 分支切换 - 支持流式输出时切换，流式消息在后台继续更新
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
			// 流式消息继续在 allMessages 中更新，不受视图切换影响
		}
	};

	// 快速返回到流式消息所在的分支
	const handleBackToStreaming = () => {
		if (streamingPathMap.size > 0) {
			setSelectedChildMap(new Map(streamingPathMap));
		}
	};

	return (
		<div className={cn('flex flex-col h-full w-full', className)}>
			<ScrollArea
				ref={scrollContainerRef}
				className="flex-1 overflow-hidden w-full backdrop-blur-sm"
				onScroll={handleScroll}
			>
				<div className="max-w-3xl m-auto overflow-y-auto">
					<div className="mx-auto space-y-6 overflow-hidden">
						{messages.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-110 text-textcolor">
								<Bot className="w-16 h-16 mb-4" />
								<p className="text-2xl">欢迎来到 dnhyxc-ai 智能聊天</p>
								<p className="text-lg mt-2">有什么我可以帮您的？</p>
							</div>
						) : (
							messages.map((message, index) => (
								<motion.div
									key={message.chatId}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
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
												<div className="flex flex-wrap justify-end gap-3 mb-2">
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
										<div
											className={cn(
												'flex-1 rounded-md p-3',
												message.role === 'user'
													? `bg-blue-500/10 border border-blue-500/20 text-end pt-2 pb-2.5 px-3 ${editMessage?.chatId === message.chatId ? 'p-0 pr-2.5 pb-2.5' : ''}`
													: 'bg-theme/5 border border-theme-white/10',
												showAvatar
													? 'max-w-[calc(768px-105px)]'
													: editMessage?.chatId === message.chatId
														? 'w-full bg-theme/5 border-theme-white/10'
														: 'w-auto',
											)}
										>
											{message.role === 'user' ? (
												editMessage?.chatId === message.chatId ? (
													<ChatTextArea
														ref={editInputRef}
														mode="edit"
														input={input}
														setInput={setInput}
														editMessage={editMessage}
														setEditMessage={setEditMessage}
														loading={loading}
														handleEditChange={handleEditChange}
														sendMessage={sendMessage}
													/>
												) : (
													<div
														className="prose prose-invert max-w-none"
														dangerouslySetInnerHTML={{
															__html: message.content,
														}}
													/>
												)
											) : (
												<div className="w-full h-auto">
													<div className="w-full">
														{message?.thinkContent ? (
															<div
																className="mb-2 flex items-center cursor-pointer select-none"
																onClick={onToggleThinkContent}
															>
																思考过程
																{isShowThinkContent ? (
																	<ChevronDown
																		size={20}
																		className="ml-2 mt-0.5"
																	/>
																) : (
																	<ChevronRight
																		size={20}
																		className="ml-2 mt-0.5"
																	/>
																)}
															</div>
														) : null}
														{message.thinkContent && isShowThinkContent && (
															<MarkdownPreview
																value={message.thinkContent || '思考中...'}
																theme="dark"
																className="h-auto p-0"
																background="transparent"
																padding="0"
															/>
														)}
													</div>
													<MarkdownPreview
														value={
															message.content ||
															(message?.thinkContent ? '' : '思考中...')
														}
														theme="dark"
														className="h-auto p-0"
														background="transparent"
														padding="0"
													/>
												</div>
											)}
											{message.isStreaming && (
												<div className="mt-1 flex items-center">
													<Spinner className="w-4 h-4 mr-2 text-textcolor/50" />
													<span className="text-sm text-textcolor/50">
														正在生成中...
													</span>
												</div>
											)}
											{message.isStopped && (
												<div className="flex items-center justify-end">
													<div
														className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300"
														onClick={onContinue}
													>
														继续生成
													</div>
												</div>
											)}
										</div>
										<div
											className={`absolute bottom-2 right-2 h-5 flex items-center ${message.role === 'user' ? 'justify-end' : 'left-2'}`}
										>
											{(message.siblingCount || 0) > 1 && (
												<div
													className={`${message.role === 'user' ? 'order-last ml-5 -mr-3.5' : 'order-first mr-5 -ml-3.5'} flex items-center gap-1 text-textcolor/70 select-none`}
												>
													<ChevronLeft
														size={22}
														className={cn(
															'cursor-pointer hover:text-textcolor',
															(message.siblingIndex || 0) <= 0 &&
																'opacity-30 cursor-not-allowed hover:text-textcolor/60',
														)}
														onClick={() => {
															if ((message.siblingIndex || 0) > 0) {
																handleBranchChange(message.chatId, 'prev');
															}
														}}
													/>
													<span className="min-w-10 text-center">
														{(message.siblingIndex || 0) + 1} /{' '}
														{message.siblingCount}
													</span>
													<ChevronRight
														size={22}
														className={cn(
															'cursor-pointer hover:text-textcolor',
															(message.siblingIndex || 0) >=
																(message.siblingCount || 0) - 1 &&
																'opacity-30 cursor-not-allowed hover:text-textcolor/60',
														)}
														onClick={() => {
															if (
																(message.siblingIndex || 0) <
																(message.siblingCount || 0) - 1
															) {
																handleBranchChange(message.chatId, 'next');
															}
														}}
													/>
												</div>
											)}
											{message.content && (
												<div
													className={`gap-3 text-textcolor/70 ${message.role === 'user' ? '-mr-2' : '-ml-2'} ${index !== messages.length - 1 ? `hidden ${loading ? 'group-hover:hidden' : 'group-hover:flex'}` : `${loading ? 'hidden' : 'flex items-center'}`}`}
												>
													<div className="cursor-pointer flex items-center justify-center">
														{isCopyedId !== message.chatId ? (
															<Copy
																size={16}
																className="hover:text-textcolor"
																onClick={() =>
																	onCopy(message.content, message.chatId)
																}
															/>
														) : (
															<div className="flex items-center justify-center text-green-400 rounded-full box-border">
																<CheckCircle size={16} />
															</div>
														)}
													</div>
													{message.role === 'user' && (
														<div className="cursor-pointer hover:text-textcolor mt-0.5">
															<PencilLine
																size={16}
																onClick={() => onEdit(message)}
															/>
														</div>
													)}
													{message.role !== 'user' && (
														<div className="cursor-pointer hover:text-textcolor">
															<RotateCw
																size={16}
																onClick={() => onReGenerate(index)}
															/>
														</div>
													)}
												</div>
											)}
										</div>
									</div>
								</motion.div>
							))
						)}
					</div>
				</div>
			</ScrollArea>

			{/* 流式输出时的提示条 */}
			{streamingMessageId && (
				<div className="flex items-center justify-center py-2 bg-theme/10 border-t border-theme-white/10">
					<Spinner className="w-4 h-4 mr-2 text-cyan-400" />
					<span className="text-sm text-textcolor/70">正在生成回复中...</span>
					{selectedChildMap !== streamingPathMap && (
						<Button
							onClick={handleBackToStreaming}
							className="ml-4 px-3 py-1 text-sm bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-md transition-colors"
						>
							返回当前回复
						</Button>
					)}
				</div>
			)}

			<ChatEntry
				chatInputRef={chatInputRef}
				input={input}
				setInput={setInput}
				uploadedFiles={uploadedFiles}
				setUploadedFiles={setUploadedFiles}
				loading={loading}
				editMessage={editMessage}
				setEditMessage={setEditMessage}
				handleEditChange={handleEditChange}
				sendMessage={sendMessage}
				onUploadFile={onUploadFile}
				clearChat={clearChat}
				stopGenerating={stopGenerating}
			/>
		</div>
	);
});

export default ChatBot as React.FC<ChatBotProps>;
