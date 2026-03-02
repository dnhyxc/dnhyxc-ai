import ChatEntry from '@design/ChatEntry';
import ChatFileList from '@design/ChatFileList';
import ChatTextArea from '@design/ChatTextArea';
import MarkdownPreview from '@design/Markdown';
import { ScrollArea, Spinner, Toast } from '@ui/index';
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
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { stopSse, uploadFiles } from '@/service';
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
	updateSingleMessage,
} from './tools';

const ChatBot: React.FC<ChatBotProps> = ({
	className,
	initialMessages = [],
	apiEndpoint = '/chat/sse',
	showAvatar = false,
	onBranchChange,
	activeSessionId,
	setActiveSessionId,
}) => {
	// allMessages 存储完整树
	const [, setAllMessages] = useState<Message[]>(initialMessages);
	// messages 存储当前显示的路径
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

	const stopRequestRef = useRef<(() => void) | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	// 创建 ref 用于获取编辑模式下的 textarea
	const editInputRef = useRef<HTMLTextAreaElement>(null);
	// 底部输入框如果需要自动聚焦也可以创建一个 ref，这里主要关注编辑模式
	const chatInputRef = useRef<HTMLTextAreaElement>(null);

	let copyTimer: ReturnType<typeof setTimeout> | null = null;
	let focusTimer: ReturnType<typeof setTimeout> | null = null;

	const navigate = useNavigate();

	// 初始化逻辑
	useEffect(() => {
		if (initialMessages && initialMessages.length > 0) {
			setAllMessages(initialMessages);
			const sortedMessages = buildMessageList(initialMessages, new Map());
			const formattedMessages = getFormatMessages(sortedMessages);
			setMessages(formattedMessages);
			updateCurrentChatId(sortedMessages);
		}
	}, [initialMessages]);

	useEffect(() => {
		if (autoScroll && scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop =
				scrollContainerRef.current.scrollHeight;
		}
	}, [messages, autoScroll]);

	useEffect(() => {
		// 焦点逻辑现在由 ChatTextArea 内部处理，或者通过 ref 回调
		// 这里保留原有逻辑结构，但实际焦点由组件内部管理
		return () => {
			if (copyTimer) {
				clearTimeout(copyTimer);
				copyTimer = null;
			}
			if (focusTimer) {
				clearTimeout(focusTimer);
				focusTimer = null;
			}
			stopGenerating();
		};
	}, []);

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

	const updateMessagesDisplay = (
		currentAllMessages: Message[],
		childMap?: Map<string, string>,
	) => {
		const sortedMessages = buildMessageList(
			currentAllMessages,
			childMap || selectedChildMap,
		);
		const formattedMessages = getFormatMessages(sortedMessages);
		setMessages(formattedMessages);
		updateCurrentChatId(sortedMessages);
	};

	const updateCurrentChatId = (msgs: Message[]) => {
		setCurrentChatId((prevChatId) => {
			if (msgs.length > 0) {
				const lastMsg = msgs[msgs.length - 1];
				const newChatId = lastMsg.chatId;
				return prevChatId !== newChatId ? newChatId : prevChatId;
			} else {
				return prevChatId !== '' ? '' : prevChatId;
			}
		});
	};

	const onSseFetch = async (
		api: string = apiEndpoint,
		assistantMessageId: string,
		userMessage?: Message,
		assistantMessage?: Message,
		isRegenerate?: boolean,
		selectedChildMapParam?: Map<string, string>,
	) => {
		const parentId = isRegenerate ? userMessage?.chatId : userMessage?.parentId;
		const currentSelectedChildMap = selectedChildMapParam
			? new Map(selectedChildMapParam)
			: new Map(selectedChildMap);

		if (isRegenerate && userMessage) {
			currentSelectedChildMap.set(userMessage.chatId, assistantMessageId);
		}

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
							setAllMessages((prevAll) => {
								const assistantChat = prevAll.find(
									(m) => m.chatId === assistantMessageId,
								);
								const newAllMessages = updateSingleMessage(
									prevAll,
									assistantMessageId,
									{
										thinkContent:
											(assistantChat?.thinkContent || '') + thinking,
										isStreaming: true,
									},
								);
								updateMessagesDisplay(newAllMessages, currentSelectedChildMap);
								return newAllMessages;
							});
						}
					},
					onData: (chunk) => {
						if (typeof chunk === 'string') {
							setAllMessages((prevAll) => {
								const newAllMessages = updateSingleMessage(
									prevAll,
									assistantMessageId,
									{
										content:
											(prevAll.find((m) => m.chatId === assistantMessageId)
												?.content || '') + chunk,
										isStreaming: true,
									},
								);
								updateMessagesDisplay(newAllMessages, currentSelectedChildMap);
								return newAllMessages;
							});
						}
					},
					getSessionId: (sessionId) => {
						setSessionId(sessionId);
						navigate(`/chat/${sessionId}`);
					},
					onError: (err, type) => {
						setLoading(false);
						Toast({
							type: type || 'error',
							title: err?.message || String(err) || '发送失败',
						});
						setAllMessages((prevAll) => {
							const newAllMessages = prevAll.filter(
								(msg) =>
									!(
										msg.chatId === assistantMessageId &&
										(!msg.content || msg.content === '') &&
										(!msg.thinkContent || msg.thinkContent === '')
									),
							);
							updateMessagesDisplay(newAllMessages, currentSelectedChildMap);
							return newAllMessages;
						});
					},
					onComplete: () => {
						setLoading(false);
						setAllMessages((prevAll) => {
							const newAllMessages = updateSingleMessage(
								prevAll,
								assistantMessageId,
								{
									isStreaming: false,
								},
							);
							updateMessagesDisplay(newAllMessages, currentSelectedChildMap);
							return newAllMessages;
						});
					},
				},
			});

			stopRequestRef.current = stop;
		} catch (_error) {
			setLoading(false);
			Toast({
				type: 'error',
				title: '发送消息失败',
			});
			setAllMessages((prev) =>
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

		setAllMessages((prevAll) => {
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

			updateMessagesDisplay(newAllMessages, newSelectedChildMap);
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
				newSelectedChildMap,
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

		setAllMessages((prevAll) => {
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
			updateMessagesDisplay(newAllMessages, childMap);

			return newAllMessages.map((i) => ({ ...i, isStopped: false }));
		});

		if (userMessageToUse && assistantMessage && newSelectedChildMap) {
			onSseFetch(
				apiEndpoint,
				assistantMessageId,
				userMessageToUse,
				assistantMessage,
				true,
				newSelectedChildMap,
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

		setAllMessages((prevAll) => {
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
			updateMessagesDisplay(newAllMessages);
			return newAllMessages.map((i) => ({ ...i, isStopped: false }));
		});

		onSseFetch(
			apiEndpoint,
			assistantMessageId,
			userMessageToUse,
			assistantMessage,
			false,
			selectedChildMap,
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

		setAllMessages((prevAll) => {
			const newAllMessages = prevAll.map((msg) => ({
				...msg,
				isStopped: false,
			}));
			updateMessagesDisplay(newAllMessages);

			const formattedMessages = messages;
			if (formattedMessages.length > 0) {
				const lastMsg = formattedMessages[formattedMessages.length - 1];
				if (lastMsg.role === 'assistant' && lastMsg.isStopped) {
					const userMsg = prevAll.find((m) => m.chatId === lastMsg.parentId);
					if (userMsg) {
						const updatedAllMessages = newAllMessages.map((msg) =>
							msg.chatId === lastMsg.chatId
								? {
										...msg,
										isStreaming: true,
										isStopped: false,
									}
								: msg,
						);

						const sortedMessages = buildMessageList(
							updatedAllMessages,
							selectedChildMap,
						);
						const newFormattedMessages = getFormatMessages(sortedMessages);
						setMessages(newFormattedMessages);
						updateCurrentChatId(sortedMessages);

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

						return updatedAllMessages;
					} else {
						lastMsgId = lastMsg.chatId;
					}
				}
			}
			return newAllMessages;
		});

		if (lastMsgId) {
			if (userMsgForApi && assistantMsgForApi) {
				onSseFetch(
					'/chat/continueSse',
					lastMsgId,
					userMsgForApi,
					assistantMsgForApi,
					false,
					selectedChildMap,
				);
			} else {
				onSseFetch(
					'/chat/continueSse',
					lastMsgId,
					undefined,
					undefined,
					false,
					selectedChildMap,
				);
			}
		}
	};

	const stopGenerating = async () => {
		if (stopRequestRef.current) {
			await stopSse(sessionId);
			stopRequestRef.current();
			stopRequestRef.current = null;
			setLoading(false);

			setAllMessages((prevAll) => {
				const lastAssistantMsg = findLastAssistantMessage(prevAll);
				if (lastAssistantMsg) {
					const newAllMessages = updateSingleMessage(
						prevAll,
						lastAssistantMsg.chatId,
						{
							isStreaming: false,
							isStopped: true,
						},
					);
					updateMessagesDisplay(newAllMessages);
					return newAllMessages;
				}
				return prevAll;
			});
		}
	};

	const clearChat = () => {
		setInput('');
		setAllMessages([]);
		setMessages([]);
		stopRequestRef.current?.();
		stopRequestRef.current = null;
		setLoading(false);
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
			// 上传文件后，将焦点设置回输入框
			chatInputRef.current?.focus();
		}
	};

	const onCopy = (value: string, id: string) => {
		navigator.clipboard.writeText(value);
		setIsCopyedId(id);
		copyTimer = setTimeout(() => {
			setIsCopyedId('');
		}, 500);
	};

	// 编辑 user 消息时，在输入框获得焦点时，将光标定位在文本内容的最后面
	const onFocusEditInput = () => {
		focusTimer = setTimeout(() => {
			if (editInputRef.current) {
				editInputRef.current.focus();
				// 将光标定位在文本内容的最后面
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
		// index 是当前显示的 assistant 消息的索引，我们需要获取对应的用户消息内容
		if (index > 0) {
			const userMsg = messages[index - 1];
			if (userMsg && userMsg.role === 'user') {
				sendMessage(userMsg.content, index);
			}
		}
	};

	// 分支切换
	const handleBranchChange = (msgId: string, direction: 'prev' | 'next') => {
		onBranchChange?.(msgId, direction);

		// 基于 allMessages 查找兄弟节点
		setAllMessages((prevAll) => {
			const siblings = findSiblings(prevAll, msgId);
			const currentIndex = siblings.findIndex((m) => m.chatId === msgId);
			const nextIndex =
				direction === 'next' ? currentIndex + 1 : currentIndex - 1;

			if (nextIndex >= 0 && nextIndex < siblings.length) {
				const nextMsg = siblings[nextIndex];
				const currentMsg = prevAll.find((m) => m.chatId === msgId);
				const parentId = currentMsg?.parentId;

				const newSelectedChildMap = new Map(selectedChildMap);
				if (parentId) {
					newSelectedChildMap.set(parentId, nextMsg.chatId);
				} else {
					newSelectedChildMap.set('root', nextMsg.chatId);
				}
				setSelectedChildMap(newSelectedChildMap);
				// 基于完整树更新显示
				updateMessagesDisplay(prevAll, newSelectedChildMap);
			}

			return prevAll;
		});
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
									{/* 头像 */}
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

									{/* 消息内容 */}
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

			{/* 使用封装后的底部输入栏组件 */}
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
};

export default ChatBot;
