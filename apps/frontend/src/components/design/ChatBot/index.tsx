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
import * as mobx from 'mobx';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { createSession, stopSse, uploadFiles } from '@/service';
import useStore from '@/store';
import { FileWithPreview, UploadedFile } from '@/types';
import { ChatBotProps, ChatRequestParams, Message } from '@/types/chat';
import { streamFetch } from '@/utils/sse';
import { buildMessageList, getFormatMessages } from '@/views/chat/tools';
import {
	createAssistantMessage,
	createUserMessage,
	findLastAssistantMessage,
	findLatestBranchSelection,
	findSiblings,
	updateParentChildrenIds,
} from './tools';

// 定义快照类型
interface RequestSnapshot {
	messages: Message[];
	selectedChildMap: Map<string, string>;
	assistantMessageId: string;
	userMessageId: string;
	sessionId: string;
}

const ChatBot = observer(function ChatBot(props: ChatBotProps) {
	const {
		className,
		apiEndpoint = '/chat/sse',
		showAvatar = false,
		onBranchChange,
	} = props;
	const { chatStore } = useStore();

	// allMessages 存储完整树（包含所有分支和流式消息）- 使用chatStore
	// 使用useState同步store变化，确保React重新渲染
	const [allMessages, setAllMessages] = useState<Message[]>(chatStore.messages);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');

	const [autoScroll, setAutoScroll] = useState(true);
	const [isShowThinkContent, setIsShowThinkContent] = useState(true);
	const [isCopyedId, setIsCopyedId] = useState('');
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	const [selectedChildMap, setSelectedChildMap] = useState<Map<string, string>>(
		new Map(),
	);
	const [currentChatId, setCurrentChatId] = useState<string>('');
	const [editMessage, setEditMessage] = useState<Message | null>(null);

	// [新增] 保存请求前的状态快照，用于回滚
	const requestSnapshotRef = useRef<RequestSnapshot | null>(null);
	// [新增] 标记是否已接收到流式数据 (Thinking 或 Content)
	const hasReceivedStreamDataRef = useRef(false);

	const updateStoreMessages = (
		updater: (prevMessages: Message[]) => Message[],
	) => {
		const updatedMessages = updater(chatStore.messages);
		chatStore.setAllMessages(
			updatedMessages,
			chatStore.activeSessionId || '',
			false,
		);
	};

	const stopRequestRef = useRef<(() => void) | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const editInputRef = useRef<HTMLTextAreaElement>(null);
	const chatInputRef = useRef<HTMLTextAreaElement>(null);

	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

	// 判断当前会话是否正在加载
	const isCurrentSessionLoading = useCallback(() => {
		const currentSessionId = chatStore.activeSessionId;
		if (!currentSessionId) return false;
		return chatStore.loadingSessions.has(currentSessionId);
	}, [chatStore.activeSessionId]);

	// 设置会话加载状态
	const setSessionLoading = useCallback(
		(sessionId: string, isLoading: boolean) => {
			if (isLoading) {
				chatStore.addLoadingSession(sessionId);
			} else {
				chatStore.delLoadingSession(sessionId);
			}
		},
		[],
	);

	// 清除所有会话的加载状态
	const clearAllSessionLoading = useCallback(() => {
		chatStore.clearLoadingSessions();
	}, []);

	useEffect(() => {
		// 注意：切换会话时不停止流式输出，让它在后台继续
		// 如果 activeSessionId 为空，表示是新会话，清空所有状态
		if (!chatStore.activeSessionId) {
			setSelectedChildMap(new Map());
			setInput('');
			setUploadedFiles([]);
			setEditMessage(null);
			return;
		}

		// 尝试从store恢复之前保存的分支选择状态
		const savedSelection = chatStore.getSessionBranchSelection(
			chatStore.activeSessionId,
		);

		if (chatStore.messages.length > 0) {
			if (savedSelection) {
				// 恢复之前保存的分支选择
				setSelectedChildMap(savedSelection);
			} else {
				// 没有保存的状态，检查是否需要自动选择最新分支
				const latestBranchMap = findLatestBranchSelection(chatStore.messages);
				if (latestBranchMap) {
					setSelectedChildMap(latestBranchMap);
					// 保存这个自动选择的状态
					chatStore.saveSessionBranchSelection(
						chatStore.activeSessionId,
						latestBranchMap,
					);
				} else {
					setSelectedChildMap(new Map());
				}
			}

			// 重置所有消息的 isStopped 状态，避免显示"继续生成"按钮
			chatStore.messages.forEach((msg) => {
				if (msg.isStopped) {
					chatStore.updateMessage(msg.chatId, {
						isStopped: false,
					});
				}
			});
		} else {
			setSelectedChildMap(new Map());
		}

		// 重置输入状态
		setInput('');
		setUploadedFiles([]);
		setEditMessage(null);
	}, [chatStore.activeSessionId]);

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
	}, [messages, autoScroll]);

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
			// 组件卸载时，如果正在请求且未收到数据，也应当清理
			stopGenerating(true);
			// 清理所有会话的加载状态
			clearAllSessionLoading();
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

	const getSessionInfo = async () => {
		const res = await createSession(chatStore.activeSessionId);
		if (res.success) {
			chatStore.setActiveSessionId(res.data);
		}
		return res.data;
	};

	const onSseFetch = async (
		api: string = apiEndpoint,
		assistantMessageId: string,
		userMessage?: Message,
		assistantMessage?: Message,
		isRegenerate?: boolean,
	) => {
		// [新增] 重置数据接收标记
		hasReceivedStreamDataRef.current = false;

		let session_Id = chatStore.activeSessionId;

		if (!session_Id) {
			try {
				session_Id = await getSessionInfo();
			} catch (_) {
				// 接口调用失败，说明还没有创建 session，则清空会话
				clearChat();
				// 直接 return，禁止后续逻辑
				return;
			}
		}

		const parentId = isRegenerate ? userMessage?.chatId : userMessage?.parentId;

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
			sessionId: session_Id,
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
						// 设置当前会话的加载状态
						setSessionLoading(session_Id, true);
					},
					onThinking: (thinking) => {
						if (typeof thinking === 'string') {
							// [新增] 标记已收到数据
							hasReceivedStreamDataRef.current = true;
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
							// [新增] 标记已收到数据
							hasReceivedStreamDataRef.current = true;
							const currentMessage = chatStore.messages.find(
								(m) => m.chatId === assistantMessageId,
							);
							chatStore.updateMessage(assistantMessageId, {
								content: (currentMessage?.content || '') + chunk,
								isStreaming: true,
							});
						}
					},
					onError: (err, type) => {
						// 清除当前会话的加载状态
						setSessionLoading(session_Id, false);
						Toast({
							type: type || 'error',
							title: err?.message || String(err) || '发送失败',
						});
						if (
							requestSnapshotRef.current &&
							!hasReceivedStreamDataRef.current
						) {
							const snapshot = requestSnapshotRef.current;

							// 清理流式跟踪，防止恢复后流式消息又冒出来
							chatStore.removeStreamingMessage(snapshot.assistantMessageId);

							// 恢复 Store 状态
							chatStore.restoreState(
								snapshot.messages,
								snapshot.selectedChildMap,
								snapshot.sessionId,
							);

							// 恢复本地 State
							setAllMessages([...snapshot.messages]);
							setSelectedChildMap(new Map(snapshot.selectedChildMap));

							// 清除快照
							requestSnapshotRef.current = null;
						}
					},
					onComplete: () => {
						// 清除当前会话的加载状态
						setSessionLoading(session_Id, false);
						// 标记流式结束
						chatStore.updateMessage(assistantMessageId, {
							isStreaming: false,
						});
					},
				},
			});

			stopRequestRef.current = stop;
		} catch (_error) {
			// 清除当前会话的加载状态
			setSessionLoading(session_Id, false);
			Toast({
				type: 'error',
				title: '发送消息失败',
			});

			if (requestSnapshotRef.current && !hasReceivedStreamDataRef.current) {
				const snapshot = requestSnapshotRef.current;

				// 清理流式跟踪，防止恢复后流式消息又冒出来
				chatStore.removeStreamingMessage(snapshot.assistantMessageId);

				// 恢复 Store 状态
				chatStore.restoreState(
					snapshot.messages,
					snapshot.selectedChildMap,
					snapshot.sessionId,
				);

				// 恢复本地 State
				setAllMessages([...snapshot.messages]);
				setSelectedChildMap(new Map(snapshot.selectedChildMap));

				// 清除快照
				requestSnapshotRef.current = null;
			}
		}
	};

	// [修改] 保存快照并发送新消息
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

		const newSelectedChildMap = new Map(selectedChildMap);
		if (!userMessageToUse.parentId) {
			newSelectedChildMap.set('root', userMsgId);
		} else {
			newSelectedChildMap.set(userMessageToUse.parentId, userMsgId);
		}

		// [新增] 在更新 Store 之前保存快照
		const currentSessionId = chatStore.activeSessionId;
		requestSnapshotRef.current = {
			messages: [...chatStore.messages],
			selectedChildMap: new Map(selectedChildMap),
			assistantMessageId,
			userMessageId: userMsgId,
			sessionId: currentSessionId,
		};

		setSelectedChildMap(newSelectedChildMap);
		if (chatStore.activeSessionId) {
			chatStore.saveSessionBranchSelection(
				chatStore.activeSessionId,
				newSelectedChildMap,
			);
		}

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

	// [修改] 保存快照并编辑消息
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

		// [新增] 在更新 Store 之前保存快照
		const currentSessionId = chatStore.activeSessionId;
		requestSnapshotRef.current = {
			messages: [...chatStore.messages],
			selectedChildMap: new Map(selectedChildMap),
			assistantMessageId,
			userMessageId: userMsgId,
			sessionId: currentSessionId,
		};

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
		// 保存分支选择状态
		if (chatStore.activeSessionId) {
			chatStore.saveSessionBranchSelection(
				chatStore.activeSessionId,
				newSelectedChildMap,
			);
		}

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

	// [修改] 保存快照并重新生成
	const handleRegenerateMessage = async (_content: string, index: number) => {
		const assistantMessageId = uuidv4();

		let userMessageToUse: Message | null = null;
		let assistantMessage: Message | null = null;
		let newSelectedChildMap: Map<string, string> | null = null;

		const currentAssistantMsg = messages[index];
		if (!currentAssistantMsg) return;

		// [新增] 在更新 Store 之前保存快照
		const currentSessionId = chatStore.activeSessionId;
		requestSnapshotRef.current = {
			messages: [...chatStore.messages],
			selectedChildMap: new Map(selectedChildMap),
			assistantMessageId,
			userMessageId: currentAssistantMsg.parentId || '',
			sessionId: currentSessionId,
		};

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
			// 保存分支选择状态
			if (chatStore.activeSessionId) {
				chatStore.saveSessionBranchSelection(
					chatStore.activeSessionId,
					childMap,
				);
			}

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

	const sendMessage = async (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: UploadedFile[] | null,
	) => {
		if ((!content && !input.trim()) || isCurrentSessionLoading()) return;

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

	// [修改] 停止生成逻辑：支持回滚
	const stopGenerating = async (isUnmount = false) => {
		const session_id = chatStore.activeSessionId;

		// 1. 停止网络请求
		if (stopRequestRef.current) {
			await stopSse(session_id);
			stopRequestRef.current();
			stopRequestRef.current = null;
		}

		// 清除当前会话的加载状态
		setSessionLoading(session_id, false);

		// 2. 判断是否需要回滚
		// 条件：有快照 且 未收到任何流式数据 且 (是手动停止 或 组件卸载)
		if (requestSnapshotRef.current && !hasReceivedStreamDataRef.current) {
			const snapshot = requestSnapshotRef.current;

			// 清理流式跟踪，防止恢复后流式消息又冒出来
			chatStore.removeStreamingMessage(snapshot.assistantMessageId);

			// 恢复 Store 状态
			chatStore.restoreState(
				snapshot.messages,
				snapshot.selectedChildMap,
				snapshot.sessionId,
			);

			// 恢复本地 State
			setAllMessages([...snapshot.messages]);
			setSelectedChildMap(new Map(snapshot.selectedChildMap));

			// 清除快照
			requestSnapshotRef.current = null;

			// 如果是手动停止，给个提示
			if (!isUnmount) {
				Toast({
					type: 'info',
					title: '已取消发送，恢复到发送前状态',
				});
			}
		} else {
			// 3. 常规停止逻辑（已收到数据，只标记停止）
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
		chatStore.setAllMessages([], '', true);
		chatStore.clearSessionBranchSelection(chatStore.activeSessionId);
		setMessages([]);
		// 不再停止接口调用
		// stopRequestRef.current?.();
		// stopRequestRef.current = null;
		clearAllSessionLoading();
		chatStore.setActiveSessionId('');
		setSelectedChildMap(new Map());
		requestSnapshotRef.current = null;
		hasReceivedStreamDataRef.current = false;
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
			// 保存分支选择状态
			if (chatStore.activeSessionId) {
				chatStore.saveSessionBranchSelection(
					chatStore.activeSessionId,
					newSelectedChildMap,
				);
			}
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
														loading={isCurrentSessionLoading()}
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
													className={`gap-3 text-textcolor/70 ${message.role === 'user' ? '-mr-2' : '-ml-2'} ${index !== messages.length - 1 ? `hidden ${isCurrentSessionLoading() ? 'group-hover:hidden' : 'group-hover:flex'}` : `${isCurrentSessionLoading() ? 'hidden' : 'flex items-center'}`}`}
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

			<ChatEntry
				chatInputRef={chatInputRef}
				input={input}
				setInput={setInput}
				uploadedFiles={uploadedFiles}
				setUploadedFiles={setUploadedFiles}
				loading={isCurrentSessionLoading()}
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
