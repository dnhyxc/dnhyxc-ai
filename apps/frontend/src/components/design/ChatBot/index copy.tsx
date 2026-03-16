import ChatAnchorNav from '@design/ChatAnchorNav';
import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatControls from '@design/ChatControls';
import ChatEntry from '@design/ChatEntry';
import ChatFileList from '@design/ChatFileList';
import ChatMessageActions from '@design/ChatMessageActions';
import ChatUserMessage from '@design/ChatUserMessage';
import { ScrollArea, Toast } from '@ui/index';
import { motion } from 'framer-motion';
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
import { v4 as uuidv4 } from 'uuid';
import { useBranchManage } from '@/hooks/useBranchManage';
import { useMessageTools } from '@/hooks/useMessageTools';
import { useSessionLoading } from '@/hooks/useSessionLoading';
import { cn } from '@/lib/utils';
import { createSession, stopSse, uploadFiles } from '@/service';
import useStore from '@/store';
import { FileWithPreview, UploadedFile } from '@/types';
import { ChatBotProps, ChatRequestParams, Message } from '@/types/chat';
import { streamFetch } from '@/utils/sse';

// 定义快照类型
interface RequestSnapshot {
	messages: Message[];
	selectedChildMap: Map<string, string>;
	assistantMessageId: string;
	userMessageId: string;
	sessionId: string;
}

// 定义暴露给父组件的方法类型
export interface ChatBotRef {
	clearChat: (targetSessionId?: string) => void;
	stopGenerating: (
		targetSessionId?: string,
		isUnmount?: boolean,
	) => Promise<void>;
}

const ChatBot = observer(
	forwardRef<ChatBotRef, ChatBotProps>(function ChatBot(props, ref) {
		const {
			className,
			// apiEndpoint = '/chat/zhipu-stream',
			apiEndpoint = '/chat/sse',
			showAvatar = false,
			onBranchChange,
		} = props;
		const { chatStore } = useStore();

		// allMessages 存储完整树（包含所有分支和流式消息）- 使用chatStore
		// 使用useState同步store变化，确保React重新渲染
		const [allMessages, setAllMessages] = useState<Message[]>(
			chatStore.messages,
		);
		const [messages, setMessages] = useState<Message[]>([]);
		const [input, setInput] = useState('');
		const [autoScroll, setAutoScroll] = useState(true);
		const [isShowThinkContent, setIsShowThinkContent] = useState(true);
		const [isCopyedId, setIsCopyedId] = useState('');
		const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
		const [selectedChildMap, setSelectedChildMap] = useState<
			Map<string, string>
		>(new Map());
		const [currentChatId, setCurrentChatId] = useState<string>('');
		const [editMessage, setEditMessage] = useState<Message | null>(null);
		const [scrollTop, setScrollTop] = useState<number>(0);
		const [hasScrollbar, setHasScrollbar] = useState<boolean>(false);

		// ========== 核心修复：将单例 ref 改为 Map 结构 ==========
		// 保存每个会话的请求停止函数：sessionId -> stop function
		const stopRequestMapRef = useRef<Map<string, () => void>>(new Map());
		// 保存每个会话的请求前状态快照：sessionId -> RequestSnapshot
		const requestSnapshotMapRef = useRef<Map<string, RequestSnapshot>>(
			new Map(),
		);
		// 标记每个会话是否已接收到流式数据：sessionId -> boolean
		const hasReceivedStreamDataMapRef = useRef<Map<string, boolean>>(new Map());
		// 保存每个会话当前流式输出的 assistantMessageId：sessionId -> assistantMessageId
		const currentAssistantMessageMapRef = useRef<Map<string, string>>(
			new Map(),
		);
		// ========== 核心修复结束 ==========

		const scrollContainerRef = useRef<HTMLDivElement>(null);
		const editInputRef = useRef<HTMLTextAreaElement>(null);
		const chatInputRef = useRef<HTMLTextAreaElement>(null);
		const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

		const SCROLL_THRESHOLD = 5;

		useImperativeHandle(
			ref,
			() => ({
				clearChat,
				stopGenerating,
			}),
			[],
		);

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

		// 使用会话加载状态 hook
		const {
			isCurrentSessionLoading,
			setSessionLoading,
			clearAllSessionLoading,
		} = useSessionLoading();

		const {
			createAssistantMessage,
			createUserMessage,
			findLastAssistantMessage,
			findSiblings,
			updateParentChildrenIds,
			buildMessageList,
			getFormatMessages,
		} = useMessageTools();

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

				// 注意：不要在这里重置 isStopped 状态，否则会影响"继续生成"按钮的显示
			} else {
				setSelectedChildMap(new Map());
			}

			scrollTimer.current = setTimeout(() => {
				onScrollTo('down', 'auto');
			}, 50);

			// 重置输入状态
			setInput('');
			setUploadedFiles([]);
			setEditMessage(null);
		}, [chatStore.activeSessionId]);

		/**
		 * 核心逻辑：根据 allMessages 和 selectedChildMap 推导当前显示的 messages，
		 * 流式消息始终在 allMessages 中更新，视图根据 selectedChildMap 显示
		 */
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

		// 修改自动滚动逻辑
		useEffect(() => {
			if (scrollContainerRef.current) {
				const { scrollHeight, clientHeight } = scrollContainerRef.current;
				setHasScrollbar(scrollHeight > clientHeight);
			}
			// 判断当前分支是否有流式输出：检查最后一条消息是否为助手消息且正在流式传输
			const lastMessage = messages[messages.length - 1];
			const isCurrentlyStreaming =
				lastMessage?.role === 'assistant' && lastMessage?.isStreaming;

			// 只有当 autoScroll 为 true 且当前有流式输出时，才执行自动滚动
			if (autoScroll && isCurrentlyStreaming && scrollContainerRef.current) {
				onScrollTo('down', 'auto');
			}
		}, [messages, autoScroll]);

		// 清理逻辑
		useEffect(() => {
			return () => {
				if (scrollTimer.current) {
					clearTimeout(scrollTimer.current);
					scrollTimer.current = null;
				}
				if (copyTimerRef.current) {
					clearTimeout(copyTimerRef.current);
					copyTimerRef.current = null;
				}
				if (focusTimerRef.current) {
					clearTimeout(focusTimerRef.current);
					focusTimerRef.current = null;
				}
				// 组件卸载时，停止所有正在进行的请求
				stopGenerating(undefined, true);
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
			setScrollTop(scrollTop);
			setHasScrollbar(scrollHeight > clientHeight);
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

		// 流式处理器
		const onSseFetch = async (
			api: string = apiEndpoint,
			assistantMessageId: string,
			userMessage?: Message,
			assistantMessage?: Message,
			isRegenerate?: boolean,
			branchMap?: Map<string, string>, // 可选的分支映射参数
		) => {
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

			// ========== 核心修复：使用 sessionId 为 key 存储状态 ==========
			// 重置该会话的数据接收标记
			hasReceivedStreamDataMapRef.current.set(session_Id, false);
			// 保存当前会话的 assistantMessageId
			currentAssistantMessageMapRef.current.set(session_Id, assistantMessageId);

			// 在发起请求前设置 loading 状态并保存分支映射
			// 使用传入的 branchMap 或当前的 selectedChildMap
			const branchMapToSave = branchMap || selectedChildMap;
			setSessionLoading(session_Id, true);
			chatStore.saveStreamingBranchMap(
				assistantMessageId,
				session_Id,
				branchMapToSave,
			);

			const parentId = isRegenerate
				? userMessage?.chatId
				: userMessage?.parentId;

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
						onThinking: (thinking) => {
							if (typeof thinking === 'string') {
								// 标记该会话已收到数据
								hasReceivedStreamDataMapRef.current.set(session_Id, true);
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
								// 标记该会话已收到数据
								hasReceivedStreamDataMapRef.current.set(session_Id, true);
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
							// 清除该会话的加载状态
							setSessionLoading(session_Id, false);
							Toast({
								type: type || 'error',
								title: err?.message || String(err) || '发送失败',
							});
							const snapshot = requestSnapshotMapRef.current.get(session_Id);
							const hasReceivedData =
								hasReceivedStreamDataMapRef.current.get(session_Id);

							if (snapshot && hasReceivedData === false) {
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

								// 清除该会话的快照
								requestSnapshotMapRef.current.delete(session_Id);
							}

							// 清理该会话的 ref
							currentAssistantMessageMapRef.current.delete(session_Id);
						},
						onComplete: () => {
							// 清除该会话的加载状态
							setSessionLoading(session_Id, false);
							// 标记流式结束
							chatStore.updateMessage(assistantMessageId, {
								isStreaming: false,
							});
							// 流结束时清除该消息的流式分支选择状态
							chatStore.deleteStreamingBranchMap(assistantMessageId);
							// 清理该会话的 ref
							stopRequestMapRef.current.delete(session_Id);
							requestSnapshotMapRef.current.delete(session_Id);
							hasReceivedStreamDataMapRef.current.delete(session_Id);
							currentAssistantMessageMapRef.current.delete(session_Id);
						},
					},
				});

				// ========== 核心修复：使用 sessionId 存储 stop 函数 ==========
				stopRequestMapRef.current.set(session_Id, stop);
			} catch (_error) {
				// 清除该会话的加载状态
				setSessionLoading(session_Id, false);
				Toast({
					type: 'error',
					title: '发送消息失败',
				});

				const snapshot = requestSnapshotMapRef.current.get(session_Id);
				const hasReceivedData =
					hasReceivedStreamDataMapRef.current.get(session_Id);

				if (snapshot && hasReceivedData === false) {
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

					// 清除该会话的快照
					requestSnapshotMapRef.current.delete(session_Id);
				}

				// 清理该会话的 ref
				currentAssistantMessageMapRef.current.delete(session_Id);
			}
		};

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

		// 保存快照并发送新消息
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

			// 在更新 Store 之前保存快照
			const currentSessionId = chatStore.activeSessionId;
			// ========== 核心修复：使用 sessionId 存储 snapshot ==========
			requestSnapshotMapRef.current.set(currentSessionId || 'new', {
				messages: [...chatStore.messages],
				selectedChildMap: new Map(selectedChildMap),
				assistantMessageId,
				userMessageId: userMsgId,
				sessionId: currentSessionId || '',
			});

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
				newSelectedChildMap, // 传递新创建的分支映射
			);
		};

		// 保存快照并编辑消息
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

			// 在更新 Store 之前保存快照
			const currentSessionId = chatStore.activeSessionId;
			// ========== 核心修复：使用 sessionId 存储 snapshot ==========
			requestSnapshotMapRef.current.set(currentSessionId || 'new', {
				messages: [...chatStore.messages],
				selectedChildMap: new Map(selectedChildMap),
				assistantMessageId,
				userMessageId: userMsgId,
				sessionId: currentSessionId || '',
			});

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
					// 传递新创建的分支映射
					newSelectedChildMap,
				);
				setEditMessage(null);
			}
		};

		// 保存快照并重新生成
		const handleRegenerateMessage = async (_content: string, index: number) => {
			const assistantMessageId = uuidv4();

			let userMessageToUse: Message | null = null;
			let assistantMessage: Message | null = null;
			let newSelectedChildMap: Map<string, string> | null = null;

			const currentAssistantMsg = messages[index];
			if (!currentAssistantMsg) return;

			// 在更新 Store 之前保存快照
			const currentSessionId = chatStore.activeSessionId;
			// ========== 核心修复：使用 sessionId 存储 snapshot ==========
			requestSnapshotMapRef.current.set(currentSessionId || 'new', {
				messages: [...chatStore.messages],
				selectedChildMap: new Map(selectedChildMap),
				assistantMessageId,
				userMessageId: currentAssistantMsg.parentId || '',
				sessionId: currentSessionId || '',
			});

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
					newSelectedChildMap, // 传递新创建的分支映射
				);
			}
		};

		// 重新生成
		const onReGenerate = (index: number) => {
			if (index > 0) {
				const userMsg = messages[index - 1];
				if (userMsg && userMsg.role === 'user') {
					sendMessage(userMsg.content, index);
				}
			}
		};

		// 继续生成
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
				// loading 状态和分支映射在 onSseFetch 中统一处理
				if (userMsgForApi && assistantMsgForApi) {
					onSseFetch(
						'/chat/continueSse',
						lastMsgId,
						userMsgForApi,
						assistantMsgForApi,
						false,
					);
				} else {
					onSseFetch(
						'/chat/continueSse',
						lastMsgId,
						undefined,
						undefined,
						false,
					);
				}
			}
		};

		// 发送消息
		const sendMessage = async (
			content?: string,
			index?: number,
			isEdit?: boolean,
			attachments?: UploadedFile[] | null,
		) => {
			if ((!content && !input.trim()) || isCurrentSessionLoading()) return;

			// 发送消息时自动滚动到底部
			onScrollTo('down');

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

		// ========== 核心修复：stopGenerating 支持指定会话 ==========
		const stopGenerating = async (
			targetSessionId?: string,
			isUnmount = false,
		) => {
			const session_id = targetSessionId || chatStore.activeSessionId;
			if (!session_id) return;

			// 1. 停止指定会话的网络请求
			const stopFn = stopRequestMapRef.current.get(session_id);
			if (stopFn) {
				await stopSse(session_id);
				stopFn();
				stopRequestMapRef.current.delete(session_id);
			}

			// 2. 清除指定会话的加载状态
			setSessionLoading(session_id, false);

			// 3. 获取指定会话的快照和数据接收状态
			const snapshot = requestSnapshotMapRef.current.get(session_id);
			const hasReceivedData =
				hasReceivedStreamDataMapRef.current.get(session_id);

			// 获取当前会话的 assistantMessageId
			const assistantMessageId =
				currentAssistantMessageMapRef.current.get(session_id);

			// 4. 判断是否需要回滚
			// 修复：只有明确标记为 false 时才认为没有收到数据，需要回滚
			// undefined 表示请求已完成或未开始，不需要回滚
			if (snapshot && hasReceivedData === false) {
				// 清理流式跟踪，防止恢复后流式消息又冒出来
				chatStore.removeStreamingMessage(snapshot.assistantMessageId);

				// 恢复 Store 状态
				chatStore.restoreState(
					snapshot.messages,
					snapshot.selectedChildMap,
					snapshot.sessionId,
				);

				// 恢复本地 State（仅当恢复的是当前活动会话时）
				if (session_id === chatStore.activeSessionId) {
					setAllMessages([...snapshot.messages]);
					setSelectedChildMap(new Map(snapshot.selectedChildMap));
				}

				// 清除该会话的快照
				requestSnapshotMapRef.current.delete(session_id);

				// 如果是手动停止，给个提示
				if (!isUnmount) {
					Toast({
						type: 'info',
						title: '已取消发送，恢复到发送前状态',
					});
				}
			} else if (assistantMessageId) {
				// 5. 常规停止逻辑（已收到数据，只标记停止）
				// 使用保存的 assistantMessageId 直接更新消息状态
				chatStore.updateMessage(assistantMessageId, {
					isStreaming: false,
					isStopped: true,
				});
			} else {
				// 6. 如果没有 assistantMessageId，尝试从消息列表中查找
				// 这种情况不应该发生，但作为兜底逻辑
				const lastAssistantMsg = findLastAssistantMessage(chatStore.messages);
				if (lastAssistantMsg?.isStreaming) {
					chatStore.updateMessage(lastAssistantMsg.chatId, {
						isStreaming: false,
						isStopped: true,
					});
				}
			}

			// 7. 只清除指定会话的流式分支映射
			chatStore.clearSessionStreamingBranchMaps(session_id);

			// 8. 清理该会话的 ref
			requestSnapshotMapRef.current.delete(session_id);
			hasReceivedStreamDataMapRef.current.delete(session_id);
			currentAssistantMessageMapRef.current.delete(session_id);
		};

		const clearChat = (targetSessionId?: string) => {
			// [修复] 检查是否有正在接收流的会话
			const hasActiveStreaming = chatStore.getStreamingMessages().length > 0;
			const currentSessionId = chatStore.activeSessionId;

			setInput('');

			// [修复] 如果当前会话正在接收流，不要清空消息，保留已接收的内容
			// 只有当没有正在进行的流式传输时，才清空消息
			if (!hasActiveStreaming) {
				chatStore.setAllMessages([], '', true);
			}

			// 删除存储的每个会话的分支选择状态：sessionId -> selectedChildMap
			// [修复] 如果当前会话正在接收流，不要清除其分支选择状态
			if (!(hasActiveStreaming && !targetSessionId)) {
				chatStore.clearSessionBranchSelection(
					targetSessionId || chatStore.activeSessionId,
				);
			}

			// 只清除指定会话的加载状态
			if (targetSessionId) {
				setSessionLoading(targetSessionId, false);
			} else {
				clearAllSessionLoading();
			}

			// [修复] 如果当前会话正在接收流，不要清除 activeSessionId
			// 这样用户可以继续看到流式输出的内容
			if (!hasActiveStreaming) {
				chatStore.setActiveSessionId('');
			}

			// [修复] 如果当前会话正在接收流，不要重置 selectedChildMap
			if (!hasActiveStreaming) {
				setSelectedChildMap(new Map());
			}

			// 清除指定会话的 ref
			if (targetSessionId) {
				requestSnapshotMapRef.current.delete(targetSessionId);
				hasReceivedStreamDataMapRef.current.delete(targetSessionId);
				stopRequestMapRef.current.delete(targetSessionId);
				currentAssistantMessageMapRef.current.delete(targetSessionId);
				chatStore.clearSessionStreamingBranchMaps(targetSessionId);
			} else {
				// [修复] 如果当前会话正在接收流，不要清除其 ref
				// 只清除非当前会话的 ref
				if (hasActiveStreaming && currentSessionId) {
					// 保留当前会话的 ref，只清除其他的
					const keysToDelete: string[] = [];
					requestSnapshotMapRef.current.forEach((_, key) => {
						if (key !== currentSessionId) {
							keysToDelete.push(key);
						}
					});
					keysToDelete.forEach((key) => {
						requestSnapshotMapRef.current.delete(key);
						hasReceivedStreamDataMapRef.current.delete(key);
						stopRequestMapRef.current.delete(key);
						currentAssistantMessageMapRef.current.delete(key);
					});
					chatStore.clearAllStreamingBranchMaps();
				} else {
					// 如果没有正在进行的流式传输，清除所有
					requestSnapshotMapRef.current.clear();
					hasReceivedStreamDataMapRef.current.clear();
					stopRequestMapRef.current.clear();
					currentAssistantMessageMapRef.current.clear();
					chatStore.clearAllStreamingBranchMaps();
				}
			}
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

		// 复制消息内容
		const onCopy = (value: string, id: string) => {
			navigator.clipboard.writeText(value);
			setIsCopyedId(id);
			copyTimerRef.current = setTimeout(() => {
				setIsCopyedId('');
			}, 500);
		};

		// 编辑消息
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

		// 分支切换处理
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

		// 计算是否在底部
		const isAtBottom = useMemo(() => {
			if (!scrollContainerRef.current) return false;
			const { scrollHeight, clientHeight } = scrollContainerRef.current;
			return scrollHeight - scrollTop - clientHeight < 5;
		}, [scrollTop]);

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
							{messages.length === 0 ? (
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									className="flex flex-col items-center justify-center h-110 text-textcolor"
								>
									<Bot className="w-16 h-16 mb-4" />
									<p className="text-2xl">欢迎来到 dnhyxc-ai 智能聊天</p>
									<p className="text-lg mt-2">有什么我可以帮您的？</p>
								</motion.div>
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
														isLoading={isCurrentSessionLoading()}
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

											{/* 消息操作组件 */}
											<ChatMessageActions
												message={message}
												index={index}
												messagesLength={messages.length}
												isCopyedId={isCopyedId}
												isLoading={isCurrentSessionLoading()}
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
					{/* 消息锚点导航 */}
					<ChatAnchorNav
						messages={messages}
						scrollContainerRef={scrollContainerRef}
					/>
					{/* 回到最新分支/回到正在输出分支/回到底部按钮 */}
					<ChatControls
						isCurrentSessionLoading={isCurrentSessionLoading()}
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
	}),
);

export default ChatBot as React.FC<ChatBotProps> &
	((props: { ref?: React.Ref<ChatBotRef> } & ChatBotProps) => JSX.Element);
