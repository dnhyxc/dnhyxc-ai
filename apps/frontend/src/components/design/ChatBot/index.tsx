import { Button, ScrollArea, Spinner, Textarea, Toast } from '@ui/index';
import { motion } from 'framer-motion';
import {
	Bot,
	CheckCircle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CirclePlus,
	Copy,
	Link,
	PencilLine,
	Rocket,
	RotateCw,
	StopCircle,
	User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { stopSse, uploadFile } from '@/service';
import { FileWithPreview, UploadedFile } from '@/types';
import { streamFetch } from '@/utils/sse';
import { buildMessageList, getFormatMessages } from '@/views/chat/tools';
import MarkdownPreview from '../Markdown';
import Upload from '../Upload';
import FileInfo from './FileInfo';

export interface Message {
	chatId: string;
	content: string;
	role: 'user' | 'assistant';
	timestamp: Date;
	id?: string;
	createdAt?: Date;
	file?: UploadedFile | null;
	thinkContent?: string;
	isStreaming?: boolean;
	isStopped?: boolean;
	parentId?: string;
	childrenIds?: string[];
	siblingIndex?: number;
	siblingCount?: number;
	currentChatId?: string; // 当前活跃分支的最后一条消息的chatId
}

interface ChatRequestParams {
	messages: { role: 'user' | 'assistant'; content: string; noSave?: boolean }[];
	sessionId: string;
	stream?: boolean;
	filePaths?: string[];
	isRegenerate?: boolean;
	parentId?: string;
	userMessage?: Message;
	assistantMessage?: Message;
	currentChatId?: string; // 当前活跃分支的最后一条消息的chatId
}

interface ChatBotProps {
	className?: string;
	initialMessages?: Message[];
	apiEndpoint?: string;
	maxHistory?: number;
	showAvatar?: boolean;
	onBranchChange?: (msgId: string, direction: 'prev' | 'next') => void;
}

const ChatBot: React.FC<ChatBotProps> = ({
	className,
	initialMessages = [],
	apiEndpoint = '/chat/sse',
	// apiEndpoint = '/chat/zhipu-stream',
	showAvatar = false,
	onBranchChange,
}) => {
	// allMessages存储所有消息（包括所有分支），通过setAllMessages的回调访问
	const [, setAllMessages] = useState<Message[]>(initialMessages);
	const [messages, setMessages] = useState<Message[]>(initialMessages);
	const [sessionId, setSessionId] = useState('');
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const [isComposing, setIsComposing] = useState(false);
	const [isShowThinkContent, setIsShowThinkContent] = useState(true);
	const [isCopyedId, setIsCopyedId] = useState('');
	const [uploadedFile, setUploadedFile] = useState<UploadedFile>({
		filename: '',
		mimetype: '',
		originalname: '',
		path: '',
		size: 0,
	});
	const [selectedChildMap, setSelectedChildMap] = useState<Map<string, string>>(
		new Map(),
	);
	const [currentChatId, setCurrentChatId] = useState<string>(''); // 当前活跃分支的最后一条消息的chatId
	const [editMessage, setEditMessage] = useState<Message | null>(null);

	const stopRequestRef = useRef<(() => void) | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const editInputRef = useRef<HTMLTextAreaElement>(null);

	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	const navigate = useNavigate();

	useEffect(() => {
		setAllMessages(initialMessages);
		setMessagesWithCurrentChatId(initialMessages);
		// 重置选中状态
		setSelectedChildMap(new Map());
	}, [initialMessages]);

	// 自动滚动到底部
	useEffect(() => {
		if (autoScroll && scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop =
				scrollContainerRef.current.scrollHeight;
		}
	}, [messages, autoScroll]);

	// 聚焦输入框
	useEffect(() => {
		inputRef.current?.focus();

		return () => {
			if (copyTimer) {
				clearTimeout(copyTimer);
				copyTimer = null;
			}
			stopGenerating();
		};
	}, []);

	// 输入内容变化时自动滚动到底部
	useEffect(() => {
		if (inputRef.current) {
			const textarea = inputRef.current;
			textarea.scrollTop = textarea.scrollHeight;
		}
	}, [input]);

	// 滚动事件处理
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

	// 工具函数：更新消息显示
	const updateMessagesDisplay = (
		allMessages: Message[],
		childMap?: Map<string, string>,
	) => {
		const sortedMessages = buildMessageList(
			allMessages,
			childMap || selectedChildMap,
		);
		const formattedMessages = getFormatMessages(sortedMessages);
		// 使用函数式更新确保立即应用
		setMessagesWithCurrentChatId(() => formattedMessages);
	};

	// 工具函数：更新单个消息
	const updateSingleMessage = (
		allMessages: Message[],
		messageId: string,
		updates: Partial<Message>,
	) => {
		return allMessages.map((msg) =>
			msg.chatId === messageId ? { ...msg, ...updates } : msg,
		);
	};

	// 工具函数：创建用户消息
	const createUserMessage = (
		chatId: string,
		content: string,
		parentId?: string,
		file?: UploadedFile,
	): Message => ({
		id: chatId,
		chatId,
		content: content.trim(),
		role: 'user',
		timestamp: new Date(),
		parentId,
		childrenIds: [],
		currentChatId,
		file,
	});

	// 工具函数：创建助手消息
	const createAssistantMessage = (
		chatId: string,
		parentId: string,
	): Message => ({
		id: chatId,
		chatId,
		content: '',
		thinkContent: '',
		role: 'assistant',
		timestamp: new Date(),
		isStreaming: true,
		parentId,
		childrenIds: [],
		currentChatId,
	});

	// 工具函数：更新父消息的 childrenIds
	const updateParentChildrenIds = (
		allMessages: Message[],
		parentId: string,
		childId: string,
	): Message[] => {
		const parentIndex = allMessages.findIndex((m) => m.chatId === parentId);
		if (parentIndex === -1) return allMessages;

		const newAllMessages = [...allMessages];
		const parentMsg = { ...newAllMessages[parentIndex] };
		const pChildrenIds = parentMsg.childrenIds
			? [...parentMsg.childrenIds]
			: [];

		if (!pChildrenIds.includes(childId)) {
			pChildrenIds.push(childId);
		}

		parentMsg.childrenIds = pChildrenIds;
		newAllMessages[parentIndex] = parentMsg;
		return newAllMessages;
	};

	// 工具函数：查找最后一条助手消息
	const findLastAssistantMessage = (allMessages: Message[]): Message | null => {
		for (let i = allMessages.length - 1; i >= 0; i--) {
			if (allMessages[i].role === 'assistant') {
				return allMessages[i];
			}
		}
		return null;
	};

	// 工具函数：查找兄弟节点
	const findSiblings = (
		allMessages: Message[],
		messageId: string,
	): Message[] => {
		const currentMsg = allMessages.find((m) => m.chatId === messageId);
		if (!currentMsg) return [];

		const parentId = currentMsg.parentId;
		let siblings: Message[] = [];

		if (parentId) {
			siblings = allMessages.filter((m) => m.parentId === parentId);
		} else {
			// Root siblings
			const allChildren = new Set<string>();
			allMessages.forEach((m) => {
				m.childrenIds?.forEach((c) => {
					allChildren.add(c);
				});
			});
			siblings = allMessages.filter((m) => !allChildren.has(m.chatId));
		}

		// 按照创建时间排序
		return siblings.sort(
			(a, b) =>
				new Date(a.createdAt as Date).getTime() -
				new Date(b.createdAt as Date).getTime(),
		);
	};

	// 更新currentChatId的函数
	const updateCurrentChatId = (msgs: Message[]) => {
		setCurrentChatId((prevChatId) => {
			if (msgs.length > 0) {
				const lastMsg = msgs[msgs.length - 1];
				const newChatId = lastMsg.chatId;
				// 只在chatId实际变化时更新，避免不必要的重新渲染
				return prevChatId !== newChatId ? newChatId : prevChatId;
			} else {
				// 只在currentChatId不为空时更新
				return prevChatId !== '' ? '' : prevChatId;
			}
		});
	};

	// 包装setMessages，同时更新currentChatId
	const setMessagesWithCurrentChatId = (
		msgs: Message[] | ((prev: Message[]) => Message[]),
	) => {
		if (typeof msgs === 'function') {
			setMessages((prev) => {
				const newMsgs = msgs(prev);
				updateCurrentChatId(newMsgs);
				return newMsgs;
			});
		} else {
			setMessages(msgs);
			updateCurrentChatId(msgs);
		}
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
		// 使用传递的 selectedChildMap 参数，如果没有则使用当前状态
		const currentSelectedChildMap = selectedChildMapParam
			? new Map(selectedChildMapParam)
			: new Map(selectedChildMap);
		// 对于重新生成，确保使用新的 assistant 消息
		if (isRegenerate && userMessage) {
			currentSelectedChildMap.set(userMessage.chatId, assistantMessageId);
		}

		// 调用流式 API
		const messages: ChatRequestParams = {
			messages: [
				{
					role: 'user',
					content: isRegenerate
						? `重新生成“${userMessage?.content}”的答案，不要与之前答案重复`
						: userMessage?.content || '',
					noSave: isRegenerate,
				},
			],
			sessionId,
			stream: true,
			isRegenerate,
			parentId,
			userMessage,
			assistantMessage,
			currentChatId, // 传递当前活跃分支的最后一条消息的chatId
		};
		if (userMessage?.file) {
			messages.filePaths = [userMessage?.file?.path || ''];
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
						// 移除失败的流式消息
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
						// 更新消息状态，结束流式传输
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
			setMessagesWithCurrentChatId((prev) =>
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

	// 处理编辑消息
	const handleEditMessage = async (content?: string) => {
		if (!editMessage) return;

		const userMsgId = uuidv4();
		const assistantMessageId = uuidv4();
		let userMessageToUse: Message;
		let assistantMessage: Message;

		setAllMessages((prevAll) => {
			const editedMsg = prevAll.find((m) => m.chatId === editMessage.chatId);
			if (!editedMsg) return prevAll;

			const parentId = editedMsg.parentId;
			userMessageToUse = createUserMessage(
				userMsgId,
				content || editMessage?.content.trim(),
				parentId,
			);
			userMessageToUse.childrenIds = [assistantMessageId];

			assistantMessage = createAssistantMessage(assistantMessageId, userMsgId);

			let newAllMessages = [...prevAll];
			if (parentId) {
				newAllMessages = updateParentChildrenIds(
					newAllMessages,
					parentId,
					userMsgId,
				);
			}

			newAllMessages.push(userMessageToUse, assistantMessage);
			updateMessagesDisplay(newAllMessages);
			return newAllMessages;
		});

		setTimeout(() => {
			onSseFetch(
				apiEndpoint,
				assistantMessageId,
				userMessageToUse,
				assistantMessage,
				false,
				selectedChildMap, // 传递当前的 selectedChildMap
			);
			setEditMessage(null);
		}, 0);
	};

	// 处理重新生成消息
	const handleRegenerateMessage = async (_content: string, index: number) => {
		const assistantMessageId = uuidv4();

		setAllMessages((prevAll) => {
			const currentAssistantMsg = messages[index];
			if (!currentAssistantMsg) return prevAll;

			const userMsg = prevAll.find(
				(m) => m.chatId === currentAssistantMsg.parentId,
			);
			if (!userMsg) return prevAll;

			const userMessageToUse = { ...userMsg };
			const childrenIds = userMsg.childrenIds ? [...userMsg.childrenIds] : [];
			if (!childrenIds.includes(assistantMessageId)) {
				childrenIds.push(assistantMessageId);
			}
			userMessageToUse.childrenIds = childrenIds;
			userMessageToUse.currentChatId = currentChatId;

			const assistantMessage = createAssistantMessage(
				assistantMessageId,
				userMessageToUse.chatId,
			);

			const newAllMessages = prevAll.map((msg) =>
				msg.chatId === userMessageToUse.chatId ? userMessageToUse : msg,
			);
			newAllMessages.push(assistantMessage);

			// 更新 selectedChildMap
			const newSelectedChildMap = new Map(selectedChildMap);
			newSelectedChildMap.set(userMessageToUse.chatId, assistantMessageId);

			// 先更新 selectedChildMap 状态
			setSelectedChildMap(newSelectedChildMap);

			updateMessagesDisplay(newAllMessages, newSelectedChildMap);

			// 在状态更新后立即调用 onSseFetch，传递新的 selectedChildMap
			setTimeout(() => {
				onSseFetch(
					apiEndpoint,
					assistantMessageId,
					userMessageToUse,
					assistantMessage,
					true,
					newSelectedChildMap, // 传递更新后的 selectedChildMap
				);
			}, 0);

			return newAllMessages;
		});
	};

	// 处理新消息
	const handleNewMessage = async (content: string) => {
		const userMsgId = uuidv4();
		const assistantMessageId = uuidv4();

		let parentId: string | undefined;
		const lastMsg = messages[messages.length - 1];
		if (lastMsg) {
			parentId = lastMsg.chatId;
		}

		const userMessageToUse = createUserMessage(
			userMsgId,
			content,
			parentId,
			uploadedFile.path ? uploadedFile : undefined,
		);
		userMessageToUse.childrenIds = [assistantMessageId];

		const assistantMessage = createAssistantMessage(
			assistantMessageId,
			userMsgId,
		);

		setAllMessages((prevAll) => {
			let newAllMessages = [...prevAll];
			if (userMessageToUse.parentId) {
				newAllMessages = updateParentChildrenIds(
					newAllMessages,
					userMessageToUse.parentId,
					userMsgId,
				);
			}
			newAllMessages.push(userMessageToUse, assistantMessage);
			updateMessagesDisplay(newAllMessages);
			return newAllMessages;
		});

		onSseFetch(
			apiEndpoint,
			assistantMessageId,
			userMessageToUse,
			assistantMessage,
			false,
			selectedChildMap, // 传递当前的 selectedChildMap
		);
	};

	// 发送消息
	const sendMessage = async (
		content?: string,
		index?: number,
		isEdit?: boolean,
	) => {
		if ((!content && !input.trim()) || loading) return;

		const isRegenerate =
			content !== undefined && index !== undefined && !isEdit;
		const isEditMode = isEdit === true;

		if (isEditMode) {
			await handleEditMessage(content);
		} else if (isRegenerate) {
			await handleRegenerateMessage(content!, index);
		} else {
			await handleNewMessage(content || input.trim());
		}

		setInput('');
		setUploadedFile({
			filename: '',
			mimetype: '',
			originalname: '',
			path: '',
			size: 0,
		});
		setAutoScroll(true);
	};

	const onContinue = async () => {
		setAllMessages((prevAll) => {
			const newAllMessages = prevAll.map((msg) => ({
				...msg,
				isStopped: false,
			}));
			updateMessagesDisplay(newAllMessages);

			// 获取最后一条 assistant 消息
			const formattedMessages = messages;
			if (formattedMessages.length > 0) {
				const lastMsg = formattedMessages[formattedMessages.length - 1];
				if (lastMsg.role === 'assistant' && lastMsg.isStopped) {
					// 找到最后一条 assistant 消息对应的 user 消息
					const userMsg = prevAll.find((m) => m.chatId === lastMsg.parentId);
					if (userMsg) {
						// 更新原来的 assistant 消息状态，准备继续生成
						const updatedAllMessages = newAllMessages.map((msg) =>
							msg.chatId === lastMsg.chatId
								? {
										...msg,
										isStreaming: true,
										isStopped: false,
									}
								: msg,
						);

						// 更新显示的消息
						const sortedMessages = buildMessageList(
							updatedAllMessages,
							selectedChildMap,
						);
						const newFormattedMessages = getFormatMessages(sortedMessages);
						setMessagesWithCurrentChatId(newFormattedMessages);

						// 发送继续生成请求
						setTimeout(() => {
							// 确保 userMsg 包含必要的字段
							const userMsgForApi: Message = {
								...userMsg,
								isStopped: false,
							};
							// 传递原来的 assistant 消息，不是创建新的
							const assistantMsgForApi: Message = {
								...lastMsg,
								isStreaming: true,
								isStopped: false,
							};
							onSseFetch(
								'/chat/continueSse',
								lastMsg.chatId, // 使用原来的 assistant 消息 ID
								userMsgForApi, // 传递 user 消息
								assistantMsgForApi, // 传递原来的 assistant 消息
								false, // isRegenerate: 继续生成不是重新生成
								selectedChildMap, // 传递当前的 selectedChildMap
							);
						}, 0);

						return updatedAllMessages;
					} else {
						// 如果没有找到 user 消息，使用原来的逻辑
						onSseFetch(
							'/chat/continueSse',
							lastMsg.chatId,
							undefined,
							undefined,
							false,
							selectedChildMap,
						);
					}
				}
			}
			return newAllMessages;
		});
	};

	// 停止生成
	const stopGenerating = async () => {
		if (stopRequestRef.current) {
			await stopSse(sessionId);
			stopRequestRef.current();
			stopRequestRef.current = null;
			setLoading(false);

			// 更新最后一条助手消息状态
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

	// 清除对话
	const clearChat = () => {
		setInput('');
		setAllMessages([]);
		setMessagesWithCurrentChatId([]);
		stopRequestRef.current?.();
		stopRequestRef.current = null;
		setLoading(false);
		setSessionId('');
		setSelectedChildMap(new Map());
		navigate('/chat');
	};

	// 处理输入框变化
	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
	};

	// 发送重新编辑的消息
	const onSendMessage = () => {
		sendMessage(editMessage?.content, undefined, true);
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

	// 插入换行符的辅助函数
	const insertNewline = (
		e: React.KeyboardEvent<HTMLTextAreaElement>,
		isEdit?: boolean,
	) => {
		e.preventDefault();
		const textarea = e.currentTarget;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		if (isEdit) {
			const newValue = `${editMessage?.content?.substring(0, start)}\n${editMessage?.content?.substring(end)}`;
			handleEditChange(newValue);
		} else {
			const newValue = `${input.substring(0, start)}\n${input.substring(end)}`;
			setInput(newValue);
		}

		// 移动光标到插入位置后
		textarea.selectionStart = textarea.selectionEnd = start + 1;
	};

	// 处理输入框按键
	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLTextAreaElement>,
		isEdit?: boolean,
	) => {
		if (e.key === 'Enter') {
			// 检查是否按下了修饰键
			const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;

			// 组合输入状态下（中文输入法）
			// 使用原生事件的 isComposing 属性，这是最可靠的方法
			const isCurrentlyComposing =
				(e.nativeEvent as KeyboardEvent).isComposing || isComposing;

			if (isCurrentlyComposing) {
				// 如果按下了 Ctrl/Cmd + Enter，即使在组合输入状态下也插入换行
				if (e.ctrlKey || e.metaKey) {
					insertNewline(e, isEdit);
				}
				// 其他情况允许默认行为（中文输入法选择候选词）
				return;
			}

			// 非组合输入状态下
			if (e.ctrlKey || e.metaKey) {
				// Ctrl/Cmd + Enter: 插入换行符
				insertNewline(e, isEdit);
			} else if (e.shiftKey) {
				// Shift + Enter: 也插入换行符（常见约定）
				insertNewline(e, isEdit);
			} else if (!hasModifier) {
				e.preventDefault();
				// 纯 Enter（没有任何修饰键）: 发送消息
				sendMessage(isEdit ? editMessage?.content : '');
			}
		}
	};

	// 处理组合输入开始
	const handleCompositionStart = () => {
		setIsComposing(true);
	};

	// 处理组合输入结束
	const handleCompositionEnd = () => {
		// 延迟设置 isComposing 为 false，确保 keydown 事件能检测到组合状态
		setTimeout(() => {
			setIsComposing(false);
		}, 0);
	};

	const onToggleThinkContent = () => {
		setIsShowThinkContent(!isShowThinkContent);
	};

	const onUploadFile = async (data: FileWithPreview | FileWithPreview[]) => {
		const res = await uploadFile((data as FileWithPreview).file);
		if (res.success) {
			setUploadedFile({
				...res.data,
				path: import.meta.env.VITE_DEV_DOMAIN + res.data.path,
			});
			inputRef.current?.focus();
		}
	};

	const onCopy = (value: string, id: string) => {
		navigator.clipboard.writeText(value);
		setIsCopyedId(id);
		copyTimer = setTimeout(() => {
			setIsCopyedId('');
		}, 500);
	};

	const onEdit = (message: Message) => {
		setEditMessage(message);
	};

	const onReGenerate = (index: number) => {
		// index 是当前显示的 assistant 消息的索引
		// 我们需要获取对应的用户消息内容
		if (index > 0) {
			const userMsg = messages[index - 1];
			if (userMsg && userMsg.role === 'user') {
				sendMessage(userMsg.content, index);
			}
		}
	};

	const handleBranchChange = (msgId: string, direction: 'prev' | 'next') => {
		onBranchChange?.(msgId, direction);

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
				updateMessagesDisplay(prevAll, newSelectedChildMap);
			}

			return prevAll;
		});
	};

	return (
		<div className={cn('flex flex-col h-full w-full', className)}>
			{/* 聊天消息区域 */}
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
								<p className="text-lg mt-2">有什么我可以帮您的?</p>
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
											'relative flex-1 flex flex-col gap-1 pb-6 w-full group',
											message.role === 'user' ? 'items-end' : '',
										)}
									>
										{message.file && message.role === 'user' && (
											<FileInfo data={message.file} />
										)}
										<div
											className={cn(
												'flex-1 rounded-md p-3',
												message.role === 'user'
													? 'bg-blue-500/10 border border-blue-500/20 text-end pt-2 pb-2.5 px-3'
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
													<div className="flex flex-col w-full">
														<Textarea
															ref={editInputRef}
															value={editMessage.content}
															onChange={handleEditChange}
															onKeyDown={(e) => handleKeyDown(e, true)}
															onCompositionStart={handleCompositionStart}
															onCompositionEnd={handleCompositionEnd}
															placeholder="请输入您的问题"
															spellCheck={false}
															className="flex-1 min-h-16 resize-none border-none shadow-none focus-visible:ring-transparent"
															disabled={loading}
														/>
														<div className="flex justify-end gap-2">
															<Button
																variant="secondary"
																onClick={() => setEditMessage(null)}
															>
																取消
															</Button>
															<Button
																variant="secondary"
																onClick={onSendMessage}
															>
																发送
															</Button>
														</div>
													</div>
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
										{(message.siblingCount || 0) > 1 && (
											<div className="flex items-center gap-1 -mt-1 text-xs text-textcolor/50 select-none">
												<ChevronLeft
													className={cn(
														'w-4 h-4 cursor-pointer hover:text-textcolor',
														(message.siblingIndex || 0) <= 0 &&
															'opacity-30 cursor-not-allowed hover:text-textcolor/50',
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
													className={cn(
														'w-4 h-4 cursor-pointer hover:text-textcolor',
														(message.siblingIndex || 0) >=
															(message.siblingCount || 0) - 1 &&
															'opacity-30 cursor-not-allowed hover:text-textcolor/50',
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
												className={`absolute bottom-0 right-2 gap-3 ${index !== messages.length - 1 ? 'hidden group-hover:flex' : `${loading ? 'hidden' : 'flex items-center'}`} ${message.role === 'user' ? 'justify-end' : 'left-2'}`}
											>
												<div className="cursor-pointer flex items-center justify-center">
													{isCopyedId !== message.chatId ? (
														<Copy
															size={18}
															onClick={() =>
																onCopy(message.content, message.chatId)
															}
														/>
													) : (
														<div className="flex items-center justify-center text-green-400 rounded-full box-border">
															<CheckCircle size={18} />
														</div>
													)}
												</div>
												{message.role === 'user' && (
													<div className="cursor-pointer">
														<PencilLine
															size={18}
															onClick={() => onEdit(message)}
														/>
													</div>
												)}
												{message.role !== 'user' && (
													<div className="cursor-pointer">
														<RotateCw
															size={18}
															onClick={() => onReGenerate(index)}
														/>
													</div>
												)}
											</div>
										)}
									</div>
								</motion.div>
							))
						)}
					</div>
				</div>
			</ScrollArea>

			{/* 输入区域 */}
			<div className="p-5.5 pt-5 backdrop-blur-sm">
				<div className="max-w-3xl mx-auto flex gap-5">
					<div className="flex-1 relative overflow-hidden">
						<div className="flex flex-col overflow-y-auto rounded-md bg-theme/5 border border-theme-white/10">
							{uploadedFile.originalname && (
								<FileInfo data={uploadedFile} showInfo />
							)}
							<Textarea
								ref={inputRef}
								value={input}
								onChange={handleChange}
								onKeyDown={(e) => handleKeyDown(e)}
								onCompositionStart={handleCompositionStart}
								onCompositionEnd={handleCompositionEnd}
								placeholder="请输入您的问题"
								spellCheck={false}
								className="flex-1 min-h-16 resize-none border-none shadow-none focus-visible:ring-transparent"
								disabled={loading}
							/>
							<div className="flex items-center justify-between h-10 p-2.5 mb-1 mt-2.5">
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										className="flex items-center text-sm bg-theme/5 mb-1 h-8 rounded-md"
										onClick={clearChat}
									>
										<CirclePlus className="w-4 h-4" />
										新对话
									</Button>
									<Upload
										uploadType="button"
										className="w-auto h-auto"
										validTypes={[
											'application/pdf',
											'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
											'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
										]}
										onUpload={onUploadFile}
									>
										<div className="flex items-center">
											<Link className="w-4 h-4 mr-2" />
											上传附件
										</div>
									</Upload>
								</div>
								{loading ? (
									<Button
										variant="ghost"
										onClick={stopGenerating}
										className="h-8 w-8 mb-1 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
									>
										<StopCircle />
									</Button>
								) : (
									<Button
										variant="ghost"
										onClick={() => sendMessage()}
										disabled={!input.trim()}
										className="h-8 w-8 mb-1 flex items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-cyan-500"
									>
										<Rocket className="-rotate-45" />
									</Button>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatBot;
