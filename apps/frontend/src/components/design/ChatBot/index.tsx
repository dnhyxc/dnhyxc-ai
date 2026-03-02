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
import { stopSse, uploadFiles } from '@/service';
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

interface ChatRequestParams {
	messages: { role: 'user' | 'assistant'; content: string; noSave?: boolean }[];
	sessionId: string | undefined;
	stream?: boolean;
	attachments?: UploadedFile[];
	isRegenerate?: boolean;
	parentId?: string;
	userMessage?: Message;
	assistantMessage?: Message;
	currentChatId?: string;
}

interface ChatBotProps {
	className?: string;
	initialMessages?: Message[];
	apiEndpoint?: string;
	maxHistory?: number;
	showAvatar?: boolean;
	onBranchChange?: (msgId: string, direction: 'prev' | 'next') => void;
	activeSessionId?: string;
	setActiveSessionId?: (id: string) => void;
}

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
	const [isComposing, setIsComposing] = useState(false);
	const [isShowThinkContent, setIsShowThinkContent] = useState(true);
	const [isCopyedId, setIsCopyedId] = useState('');
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	// selectedChildMap 管理当前会话的分支选择状态
	const [selectedChildMap, setSelectedChildMap] = useState<Map<string, string>>(
		new Map(),
	);
	const [currentChatId, setCurrentChatId] = useState<string>('');
	const [editMessage, setEditMessage] = useState<Message | null>(null);

	const stopRequestRef = useRef<(() => void) | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const editInputRef = useRef<HTMLTextAreaElement>(null);

	let copyTimer: ReturnType<typeof setTimeout> | null = null;
	let focusTimer: ReturnType<typeof setTimeout> | null = null;

	const navigate = useNavigate();

	// 修改：初始化逻辑
	useEffect(() => {
		// 只有当 initialMessages 有变化且不为空时才更新，避免内部状态更新导致的循环
		// 这里 initialMessages 传入的是完整树
		if (initialMessages && initialMessages.length > 0) {
			setAllMessages(initialMessages);
			// 如果是新会话切换（通过 key 控制组件卸载重装，这里主要是初始挂载）
			// 我们基于完整树计算初始显示路径
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
		inputRef.current?.focus();
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

	useEffect(() => {
		if (inputRef.current) {
			const textarea = inputRef.current;
			textarea.scrollTop = textarea.scrollHeight;
		}
	}, [input]);

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
	// 关键修改：确保始终使用 allMessages (完整树) 来构建显示列表
	const updateMessagesDisplay = (
		currentAllMessages: Message[],
		childMap?: Map<string, string>,
	) => {
		const sortedMessages = buildMessageList(
			currentAllMessages, // 使用完整树
			childMap || selectedChildMap,
		);
		const formattedMessages = getFormatMessages(sortedMessages);
		setMessages(formattedMessages);
		updateCurrentChatId(sortedMessages);
	};

	const updateSingleMessage = (
		allMessages: Message[],
		messageId: string,
		updates: Partial<Message>,
	) => {
		return allMessages.map((msg) =>
			msg.chatId === messageId ? { ...msg, ...updates } : msg,
		);
	};

	const createUserMessage = (
		chatId: string,
		content: string,
		parentId?: string,
		attachments?: UploadedFile[] | null,
	): Message => ({
		id: chatId,
		chatId,
		content: content.trim(),
		role: 'user',
		timestamp: new Date(),
		parentId,
		childrenIds: [],
		currentChatId,
		attachments,
	});

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

	const findLastAssistantMessage = (allMessages: Message[]): Message | null => {
		for (let i = allMessages.length - 1; i >= 0; i--) {
			if (allMessages[i].role === 'assistant') {
				return allMessages[i];
			}
		}
		return null;
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
							// 修改：操作 allMessages
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
								// 基于完整树更新显示
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

	// 确保这些函数都更新 allMessages，并调用 updateMessagesDisplay
	// 确保这些函数都更新 allMessages，并调用 updateMessagesDisplay
	const handleEditMessage = async (
		content?: string,
		attachments?: UploadedFile[] | null,
	) => {
		if (!editMessage) return;

		const userMsgId = uuidv4();
		const assistantMessageId = uuidv4();
		let userMessageToUse: Message | null = null;
		let assistantMessage: Message | null = null;

		// 【修复关键 1】预先创建新的分支映射表副本
		const newSelectedChildMap = new Map(selectedChildMap);

		setAllMessages((prevAll) => {
			const editedMsg = prevAll.find((m) => m.chatId === editMessage.chatId);
			if (!editedMsg) return prevAll.map((i) => ({ ...i, isStopped: false }));

			const parentId = editedMsg.parentId;
			const userMsg = createUserMessage(
				userMsgId,
				content || editMessage?.content.trim(),
				parentId,
				attachments,
			);
			userMsg.childrenIds = [assistantMessageId];

			const assistantMsg = createAssistantMessage(
				assistantMessageId,
				userMsgId,
			);

			let newAllMessages = [...prevAll];
			if (parentId) {
				newAllMessages = updateParentChildrenIds(
					newAllMessages,
					parentId,
					userMsgId,
				);
				// 【修复关键 2】如果是普通节点，更新父节点指向新的用户消息
				newSelectedChildMap.set(parentId, userMsgId);
			} else {
				// 【修复关键 3】如果是根节点（第一条消息），更新 'root' 指向新的用户消息
				newSelectedChildMap.set('root', userMsgId);
			}

			newAllMessages.push(userMsg, assistantMsg);

			userMessageToUse = userMsg;
			assistantMessage = assistantMsg;

			// 【修复关键 4】将新的 Map 传递给显示更新函数，确保 UI 立即切换到新分支
			updateMessagesDisplay(newAllMessages, newSelectedChildMap);
			return newAllMessages.map((i) => ({ ...i, isStopped: false }));
		});

		// 同步 React 状态
		setSelectedChildMap(newSelectedChildMap);

		if (userMessageToUse && assistantMessage) {
			// 【修复关键 5】将新的 Map 传递给 SSE 请求，确保流式更新时路径正确
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

		// 修改：基于 allMessages 查找，而不是 messages (显示路径)
		// 注意：这里的 index 是显示路径的 index，需要映射回 allMessages 中的消息
		// 但通常 regenerate 是针对当前显示的最后一条 assistant 消息
		// 为了安全，我们通过 messages 状态找到目标消息，然后在 allMessages 中更新
		const currentAssistantMsg = messages[index];
		if (!currentAssistantMsg) return;

		setAllMessages((prevAll) => {
			// 在完整树中找到对应的用户消息
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

			const assistantMsg = createAssistantMessage(
				assistantMessageId,
				userMsgCopy.chatId,
			);

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
			// 基于完整树更新显示
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
		// 修改：基于 allMessages 获取最后一条消息，确保分支连接正确
		// 如果 allMessages 为空，则 parentId 为 undefined
		// 如果希望基于当前显示路径的最后一条，可以用 messages
		// 这里假设是基于当前活跃分支的最后一条，即 messages 的最后一条
		const lastMsg = messages[messages.length - 1];
		if (lastMsg) {
			parentId = lastMsg.chatId;
		}

		const userMessageToUse = createUserMessage(
			userMsgId,
			content,
			parentId,
			uploadedFiles?.length ? uploadedFiles : undefined,
		);

		userMessageToUse.childrenIds = [assistantMessageId];

		const assistantMessage = createAssistantMessage(
			assistantMessageId,
			userMsgId,
		);

		setAllMessages((prevAll) => {
			let newAllMessages = [
				...prevAll.map((i) => ({ ...i, isStopped: false })),
			] as Message[];
			if (userMessageToUse.parentId) {
				newAllMessages = updateParentChildrenIds(
					newAllMessages,
					userMessageToUse.parentId,
					userMsgId,
				);
			}
			newAllMessages.push(userMessageToUse, assistantMessage);
			// 基于完整树更新显示
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
			// 基于完整树更新显示
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

						// 更新显示的消息
						const sortedMessages = buildMessageList(
							updatedAllMessages,
							selectedChildMap,
						);
						const newFormattedMessages = getFormatMessages(sortedMessages);
						setMessages(newFormattedMessages);
						updateCurrentChatId(sortedMessages);

						// 存储数据用于后续调用
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
						// 如果没有找到 user 消息，使用原来的逻辑
						lastMsgId = lastMsg.chatId;
					}
				}
			}
			return newAllMessages;
		});

		// 在状态更新后发送继续生成请求
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
		setMessages([]);
		stopRequestRef.current?.();
		stopRequestRef.current = null;
		setLoading(false);
		setSessionId('');
		setActiveSessionId?.('');
		setSelectedChildMap(new Map());
		navigate('/chat');
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
	};

	const onSendMessage = (message?: Message) => {
		sendMessage(editMessage?.content, undefined, true, message?.attachments);
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
		message?: Message,
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
				isEdit
					? sendMessage(
							editMessage?.content,
							undefined,
							true,
							message?.attachments,
						)
					: sendMessage();
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

	const onFocusEditInput = () => {
		focusTimer = setTimeout(() => {
			if (editInputRef.current) {
				editInputRef.current.focus();
				// 将光标定位在文本内容的最后面
				editInputRef.current.setSelectionRange(
					editInputRef.current.value.length,
					editInputRef.current.value.length,
				);
			}
		}, 0);
	};

	const onEdit = (message: Message) => {
		setEditMessage(message);
		onFocusEditInput();
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
			const allChildren = new Set<string>();
			allMessages.forEach((m) => {
				m.childrenIds?.forEach((c) => {
					allChildren.add(c);
				});
			});
			siblings = allMessages.filter((m) => !allChildren.has(m.chatId));
		}

		return siblings.sort(
			(a, b) =>
				new Date(a.createdAt as Date).getTime() -
				new Date(b.createdAt as Date).getTime(),
		);
	};

	const handleBranchChange = (msgId: string, direction: 'prev' | 'next') => {
		onBranchChange?.(msgId, direction);

		// 修改：基于 allMessages 查找兄弟节点
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
																<FileInfo
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
															onKeyDown={(e) => handleKeyDown(e, true, message)}
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
																onClick={() => onSendMessage(message)}
																disabled={loading}
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

			{/* 输入区域 */}
			<div className="p-5.5 pt-5 backdrop-blur-sm">
				<div className="max-w-3xl mx-auto flex">
					<div className="flex-1 relative overflow-hidden">
						<div className="flex flex-col overflow-y-auto rounded-md bg-theme/5 border border-theme-white/10">
							{uploadedFiles?.length > 0 ? (
								<div className="my-2.5 mx-3 text-sm text-textcolor/70">
									只识别附件中的文字
								</div>
							) : null}
							{uploadedFiles?.length > 0 ? (
								<div className="w-full flex flex-wrap gap-3 px-3 mb-2">
									{uploadedFiles.map((i, index) => (
										<FileInfo
											key={i.id || index}
											data={i}
											showDelete
											setUploadedFiles={setUploadedFiles}
										/>
									))}
								</div>
							) : null}
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
										maxSize={20 * 1024 * 1024}
										multiple
										countValidText="最多只能支持 5 个文件"
										uploadedCount={uploadedFiles?.length}
										disabled={uploadedFiles?.length >= 5}
										validTypes={[
											'application/pdf',
											'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
											'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
										]}
										showTooltip
										tooltipContent="仅支持PDF、DOCX、XLSX格式，最多同时支持 5 个文件，每个文件最大 20 MB"
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
