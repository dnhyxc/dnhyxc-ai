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
	const [allMessages, setAllMessages] = useState<Message[]>(initialMessages);
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

	const onSseFetch = async (
		api: string = apiEndpoint,
		assistantMessageId: string,
		userMessage?: Message,
		assistantMessage?: Message,
		isRegenerate?: boolean,
	) => {
		const parentId = isRegenerate ? userMessage?.chatId : userMessage?.parentId;
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
								const newAllMessages = prevAll.map((msg) =>
									msg.chatId === assistantMessageId
										? {
												...msg,
												thinkContent: (msg.thinkContent || '') + thinking,
												isStreaming: true,
											}
										: msg,
								);

								// 使用函数式更新获取最新的 selectedChildMap
								setSelectedChildMap((currentSelectedChildMap) => {
									// 更新显示的消息
									const sortedMessages = buildMessageList(
										newAllMessages,
										currentSelectedChildMap,
									);

									const formattedMessages = getFormatMessages(sortedMessages);

									setMessagesWithCurrentChatId(formattedMessages);
									return currentSelectedChildMap;
								});

								return newAllMessages;
							});
						}
					},
					onData: (chunk) => {
						if (typeof chunk === 'string') {
							setAllMessages((prevAll) => {
								const newAllMessages = prevAll.map((msg) =>
									msg.chatId === assistantMessageId
										? {
												...msg,
												content: (msg.content || '') + chunk,
												isStreaming: true,
											}
										: msg,
								);

								// 使用函数式更新获取最新的 selectedChildMap
								setSelectedChildMap((currentSelectedChildMap) => {
									// 更新显示的消息
									const sortedMessages = buildMessageList(
										newAllMessages,
										currentSelectedChildMap,
									);

									const formattedMessages = getFormatMessages(sortedMessages);

									setMessagesWithCurrentChatId(formattedMessages);
									return currentSelectedChildMap;
								});

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

							// 使用函数式更新获取最新的 selectedChildMap
							setSelectedChildMap((currentSelectedChildMap) => {
								// 更新显示的消息
								const sortedMessages = buildMessageList(
									newAllMessages,
									currentSelectedChildMap,
								);

								const formattedMessages = getFormatMessages(sortedMessages);

								setMessagesWithCurrentChatId(formattedMessages);
								return currentSelectedChildMap;
							});

							return newAllMessages;
						});
					},
					onComplete: () => {
						setLoading(false);
						// 更新消息状态，结束流式传输
						setAllMessages((prevAll) => {
							const newAllMessages = prevAll.map((msg) =>
								msg.chatId === assistantMessageId
									? { ...msg, isStreaming: false }
									: msg,
							);

							// 使用函数式更新获取最新的 selectedChildMap
							setSelectedChildMap((currentSelectedChildMap) => {
								// 更新显示的消息
								const sortedMessages = buildMessageList(
									newAllMessages,
									currentSelectedChildMap,
								);

								const formattedMessages = getFormatMessages(sortedMessages);

								setMessagesWithCurrentChatId(formattedMessages);
								return currentSelectedChildMap;
							});

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

	// 发送消息
	const sendMessage = async (
		content?: string,
		index?: number,
		isEdit?: boolean,
	) => {
		if ((!content && !input.trim()) || loading) return;

		// 生成 ID
		const userMsgId = uuidv4();
		const assistantMessageId = uuidv4();

		// 区分模式：重新生成 vs 新消息 vs 编辑消息
		const isRegenerate =
			content !== undefined && index !== undefined && !isEdit;
		const isEditMode = isEdit === true;

		if (isEditMode) {
			// 编辑模式：创建新的分支，不删除原始消息
			// 需要找到被编辑的 user 消息，获取它的 parentId
			if (!editMessage) return;

			let userMessageToUse: Message;
			let assistantMessage: Message;

			setAllMessages((prevAll) => {
				// 找到被编辑的 user 消息
				const editedMsg = prevAll.find((m) => m.chatId === editMessage.chatId);
				if (!editedMsg) return prevAll;

				// 获取被编辑消息的 parentId（即上一条 assistant 消息的 id）
				const parentId = editedMsg.parentId;

				// 创建新的 user 消息（编辑后的版本）
				userMessageToUse = {
					id: userMsgId,
					chatId: userMsgId,
					content: content || editMessage?.content.trim(),
					role: 'user',
					timestamp: new Date(),
					parentId,
					childrenIds: [assistantMessageId],
					currentChatId,
				};

				// 创建 Assistant 消息
				assistantMessage = {
					id: assistantMessageId,
					chatId: assistantMessageId,
					content: '',
					thinkContent: '',
					role: 'assistant',
					timestamp: new Date(),
					isStreaming: true,
					parentId: userMessageToUse.chatId,
					childrenIds: [],
					currentChatId: currentChatId,
				};

				// 更新父消息（assistant）的 childrenIds，添加新的 user 消息
				const newAllMessages = [...prevAll];
				if (parentId) {
					const parentIndex = newAllMessages.findIndex(
						(m) => m.chatId === parentId,
					);
					if (parentIndex !== -1) {
						const parentMsg = { ...newAllMessages[parentIndex] };
						const pChildrenIds = parentMsg.childrenIds
							? [...parentMsg.childrenIds]
							: [];
						if (!pChildrenIds.includes(userMsgId)) {
							pChildrenIds.push(userMsgId);
						}
						parentMsg.childrenIds = pChildrenIds;
						newAllMessages[parentIndex] = parentMsg;
					}
				}

				// 添加新的 user 消息和 assistant 消息
				newAllMessages.push(userMessageToUse);
				newAllMessages.push(assistantMessage);

				// 更新显示的消息
				const sortedMessages = buildMessageList(
					newAllMessages,
					selectedChildMap,
				);
				const formattedMessages = getFormatMessages(sortedMessages);
				setMessagesWithCurrentChatId(formattedMessages);

				return newAllMessages;
			});
			// 发送消息到后端（在状态更新后）
			setTimeout(() => {
				onSseFetch(
					apiEndpoint,
					assistantMessageId,
					userMessageToUse,
					assistantMessage,
					false, // isRegenerate: 编辑不是重新生成
				);
				setEditMessage(null); // 清除编辑状态
			}, 0);
		} else if (isRegenerate) {
			// 重新生成模式：复用已有的 User 消息
			// 注意：index 是当前显示的 assistant 消息的索引
			// 我们需要从 allMessages 中找到对应的 user 消息
			let userMessageToUse: Message;
			let assistantMessage: Message;

			setAllMessages((prevAll) => {
				// 找到当前显示的 assistant 消息
				const currentAssistantMsg = messages[index];
				if (!currentAssistantMsg) return prevAll;

				// 找到对应的 user 消息
				const userMsg = prevAll.find(
					(m) => m.chatId === currentAssistantMsg.parentId,
				);
				if (!userMsg) return prevAll;

				userMessageToUse = { ...userMsg };

				// 更新 user 消息的 childrenIds
				const childrenIds = userMsg.childrenIds ? [...userMsg.childrenIds] : [];
				if (!childrenIds.includes(assistantMessageId)) {
					childrenIds.push(assistantMessageId);
				}
				userMessageToUse.childrenIds = childrenIds;
				userMessageToUse.currentChatId = currentChatId; // 传递当前活跃分支的最后一条消息的chatId

				// 创建新的 assistant 消息
				assistantMessage = {
					id: assistantMessageId,
					chatId: assistantMessageId,
					content: '',
					thinkContent: '',
					role: 'assistant',
					timestamp: new Date(),
					isStreaming: true,
					parentId: userMessageToUse.chatId,
					childrenIds: [],
					currentChatId, // 传递当前活跃分支的最后一条消息的chatId
				};

				// 更新 allMessages：添加新的 assistant 消息，更新 user 消息
				const newAllMessages = prevAll.map((msg) =>
					msg.chatId === userMessageToUse.chatId ? userMessageToUse : msg,
				);

				newAllMessages.push(assistantMessage);

				// 更新 selectedChildMap 以选择新的 assistant 消息
				const newSelectedChildMap = new Map(selectedChildMap);
				newSelectedChildMap.set(userMessageToUse.chatId, assistantMessageId);

				// 先更新 selectedChildMap
				setSelectedChildMap(newSelectedChildMap);

				// 然后更新显示的消息
				const sortedMessages = buildMessageList(
					newAllMessages,
					newSelectedChildMap,
				);

				const formattedMessages = getFormatMessages(sortedMessages);

				setMessagesWithCurrentChatId(formattedMessages);

				return newAllMessages;
			});

			// 使用 setTimeout 确保状态更新后再调用流式 API
			setTimeout(() => {
				console.log(messages, 'message');
				onSseFetch(
					apiEndpoint,
					assistantMessageId,
					userMessageToUse,
					assistantMessage,
					isRegenerate,
				);
			}, 0);
		} else {
			// 新消息模式：计算 parentId
			// 使用当前显示的消息列表（messages）的最后一条消息，而不是所有消息列表（allMessages）
			// 这样当用户切换分支时，新消息会添加到当前活跃分支
			let parentId: string | undefined;
			const lastMsg = messages[messages.length - 1];
			if (lastMsg) {
				parentId = lastMsg.chatId;
			}

			const userMessageToUse: Message = {
				id: userMsgId,
				chatId: userMsgId,
				content: content || input.trim(),
				role: 'user',
				timestamp: new Date(),
				parentId: parentId,
				childrenIds: [assistantMessageId],
				currentChatId, // 传递当前活跃分支的最后一条消息的chatId
			};

			if (uploadedFile.path) {
				userMessageToUse.file = uploadedFile;
			}

			// 创建 Assistant 消息
			const assistantMessage: Message = {
				id: assistantMessageId,
				chatId: assistantMessageId,
				content: '',
				thinkContent: '',
				role: 'assistant',
				timestamp: new Date(),
				isStreaming: true,
				parentId: userMessageToUse.chatId,
				childrenIds: [],
				currentChatId, // 传递当前活跃分支的最后一条消息的chatId
			};

			setAllMessages((prevAll) => {
				const newAllMessages = [...prevAll];

				// 更新父节点 childrenIds
				if (userMessageToUse.parentId) {
					const parentIndex = newAllMessages.findIndex(
						(m) => m.chatId === userMessageToUse.parentId,
					);
					if (parentIndex !== -1) {
						const parentMsg = { ...newAllMessages[parentIndex] };
						const pChildrenIds = parentMsg.childrenIds
							? [...parentMsg.childrenIds]
							: [];
						if (!pChildrenIds.includes(userMsgId)) {
							pChildrenIds.push(userMsgId);
						}
						parentMsg.childrenIds = pChildrenIds;
						newAllMessages[parentIndex] = parentMsg;
					}
				}

				// 添加 User 消息和 Assistant 消息
				newAllMessages.push(userMessageToUse);
				newAllMessages.push(assistantMessage);

				// 更新显示的消息
				const sortedMessages = buildMessageList(
					newAllMessages,
					selectedChildMap,
				);

				const formattedMessages = getFormatMessages(sortedMessages);

				console.log(formattedMessages, 'formattedMessages');

				setMessagesWithCurrentChatId(formattedMessages);

				return newAllMessages;
			});

			console.log(messages, 'message---222222');

			onSseFetch(
				apiEndpoint,
				assistantMessageId,
				userMessageToUse,
				assistantMessage,
			);
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

			// 更新显示的消息
			const sortedMessages = buildMessageList(newAllMessages, selectedChildMap);

			const formattedMessages = getFormatMessages(sortedMessages);

			setMessagesWithCurrentChatId(formattedMessages);

			// 获取最后一条 assistant 消息的 ID
			if (formattedMessages.length > 0) {
				const lastMsg = formattedMessages[formattedMessages.length - 1];
				if (lastMsg.role === 'assistant') {
					onSseFetch('/chat/continueSse', lastMsg.chatId);
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
				// 找到最后一条 assistant 消息
				let lastAssistantIndex = -1;
				for (let i = prevAll.length - 1; i >= 0; i--) {
					if (prevAll[i].role === 'assistant') {
						lastAssistantIndex = i;
						break;
					}
				}

				if (lastAssistantIndex !== -1) {
					const newAllMessages = [...prevAll];
					newAllMessages[lastAssistantIndex] = {
						...newAllMessages[lastAssistantIndex],
						isStreaming: false,
						isStopped: true,
					};

					// 更新显示的消息
					const sortedMessages = buildMessageList(
						newAllMessages,
						selectedChildMap,
					);

					const formattedMessages = getFormatMessages(sortedMessages);

					setMessagesWithCurrentChatId(formattedMessages);
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
		console.log(message, 'message');
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
		// 首先调用父组件的回调（如果存在）
		onBranchChange?.(msgId, direction);

		setAllMessages((prevAll) => {
			const currentMsg = prevAll.find((m) => m.chatId === msgId);
			if (!currentMsg) return prevAll;

			const parentId = currentMsg.parentId;

			// 找到所有兄弟节点
			let siblings: Message[] = [];

			if (parentId) {
				siblings = prevAll.filter((m) => m.parentId === parentId);
			} else {
				// Root siblings
				const allChildren = new Set<string>();
				prevAll.forEach((m) => {
					m.childrenIds?.forEach((c) => {
						allChildren.add(c);
					});
				});
				siblings = prevAll.filter((m) => !allChildren.has(m.chatId));
			}

			// 按照创建时间排序
			siblings.sort(
				(a, b) =>
					new Date(a.createdAt as Date).getTime() -
					new Date(b.createdAt as Date).getTime(),
			);

			const currentIndex = siblings.findIndex((m) => m.chatId === msgId);
			const nextIndex =
				direction === 'next' ? currentIndex + 1 : currentIndex - 1;

			if (nextIndex >= 0 && nextIndex < siblings.length) {
				const nextMsg = siblings[nextIndex];
				// 更新选中状态
				const newSelectedChildMap = new Map(selectedChildMap);
				if (parentId) {
					newSelectedChildMap.set(parentId, nextMsg.chatId);
				} else {
					newSelectedChildMap.set('root', nextMsg.chatId);
				}
				setSelectedChildMap(newSelectedChildMap);

				// 更新显示的消息
				const sortedMessages = buildMessageList(prevAll, newSelectedChildMap);

				const formattedMessages = getFormatMessages(sortedMessages);

				setMessagesWithCurrentChatId(formattedMessages);
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
												showAvatar ? 'max-w-[calc(768px-105px)]' : 'w-auto',
											)}
										>
											{message.role === 'user' ? (
												editMessage?.chatId === message.chatId ? (
													<div className="w-full">
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
														<div>
															<Button onClick={() => setEditMessage(null)}>
																取消
															</Button>
															<Button onClick={onSendMessage}>发送</Button>
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
														console.log(
															'click left',
															message,
															message.siblingIndex,
														);
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
