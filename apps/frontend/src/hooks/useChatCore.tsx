import { Toast } from '@ui/index';
import {
	Dispatch,
	SetStateAction,
	useCallback,
	useEffect,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { useChatCoreContext } from '@/contexts';
import { createSession, stopSse } from '@/service';
import useStore from '@/store';
import { UploadedFile } from '@/types';
import { ChatRequestParams, Message } from '@/types/chat';
import { streamFetch } from '@/utils/sse';
import { useMessageTools } from './useMessageTools';

interface UseChatCoreOptions {
	apiEndpoint?: string;
	onScrollTo?: (position: string, behavior?: 'smooth' | 'auto') => void;
}

interface UseChatCoreReturn {
	// 状态
	input: string;
	setInput: (input: string) => void;
	uploadedFiles: UploadedFile[];
	setUploadedFiles: Dispatch<SetStateAction<UploadedFile[]>>;
	editMessage: Message | null;
	setEditMessage: (message: Message | null) => void;

	// 方法
	sendMessage: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: UploadedFile[] | null,
	) => Promise<void>;
	clearChat: (targetSessionId?: string) => void;
	stopGenerating: (
		targetSessionId?: string,
		isUnmount?: boolean,
	) => Promise<void>;
	onContinue: () => Promise<void>;

	// 内部方法
	handleEditChange: (
		e: React.ChangeEvent<HTMLTextAreaElement> | string,
	) => void;
}

export const useChatCore = (
	options: UseChatCoreOptions = {},
): UseChatCoreReturn => {
	const { apiEndpoint = '/chat/sse', onScrollTo } = options;
	const { chatStore } = useStore();

	// 从 Context 获取共享的 Refs
	const {
		stopRequestMapRef,
		requestSnapshotMapRef,
		hasReceivedStreamDataMapRef,
		currentAssistantMessageMapRef,
	} = useChatCoreContext();

	// 状态
	const [input, setInput] = useState('');
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	const [editMessage, setEditMessage] = useState<Message | null>(null);
	const [currentChatId, setCurrentChatId] = useState<string>('');

	const navigate = useNavigate();

	const {
		createAssistantMessage,
		createUserMessage,
		findLastAssistantMessage,
		updateParentChildrenIds,
		buildMessageList,
		getFormatMessages,
	} = useMessageTools();

	// 获取当前选择的分支映射
	const getSelectedChildMap = useCallback(() => {
		return (
			chatStore.getSessionBranchSelection(chatStore.activeSessionId) ||
			new Map()
		);
	}, [chatStore]);

	// 设置选择的分支映射
	const setSelectedChildMap = useCallback(
		(map: Map<string, string>) => {
			if (chatStore.activeSessionId) {
				chatStore.saveSessionBranchSelection(chatStore.activeSessionId, map);
			}
		},
		[chatStore],
	);

	// 获取当前显示的消息列表（根据 selectedChildMap 过滤）
	const getDisplayMessages = useCallback(() => {
		const selectedChildMap = getSelectedChildMap();
		const sortedMessages = buildMessageList(
			chatStore.messages,
			selectedChildMap,
		);
		return getFormatMessages(sortedMessages);
	}, [chatStore, getSelectedChildMap, buildMessageList, getFormatMessages]);

	// 更新 Store 消息
	const updateStoreMessages = useCallback(
		(updater: (prevMessages: Message[]) => Message[]) => {
			const updatedMessages = updater(chatStore.messages);
			chatStore.setAllMessages(
				updatedMessages,
				chatStore.activeSessionId || '',
				false,
			);
		},
		[chatStore],
	);

	// 监听消息变化，更新 currentChatId
	useEffect(() => {
		const displayMessages = getDisplayMessages();

		if (displayMessages.length > 0) {
			const lastMsg = displayMessages[displayMessages.length - 1];
			setCurrentChatId((prevChatId) => {
				const newChatId = lastMsg.chatId;
				return prevChatId !== newChatId ? newChatId : prevChatId;
			});
		} else {
			setCurrentChatId((prevChatId) => {
				return prevChatId !== '' ? '' : prevChatId;
			});
		}
	}, [chatStore.messages, getDisplayMessages]);

	// 获取会话信息
	const getSessionInfo = useCallback(async () => {
		const res = await createSession(chatStore.activeSessionId);
		if (res.success) {
			chatStore.setActiveSessionId(res.data);
		}
		return res.data;
	}, [chatStore]);

	// 流式处理器
	const onSseFetch = useCallback(
		async (
			api: string,
			assistantMessageId: string,
			userMessage?: Message,
			assistantMessage?: Message,
			isRegenerate?: boolean,
			branchMap?: Map<string, string>,
		) => {
			let session_Id = chatStore.activeSessionId;

			if (!session_Id) {
				try {
					session_Id = await getSessionInfo();
				} catch (_) {
					clearChat();
					return;
				}
			}

			hasReceivedStreamDataMapRef.current.set(session_Id, false);
			currentAssistantMessageMapRef.current.set(session_Id, assistantMessageId);

			const selectedChildMap = getSelectedChildMap();
			const branchMapToSave = branchMap || selectedChildMap;
			chatStore.setSessionLoading(session_Id, true);
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
							chatStore.setSessionLoading(session_Id, false);
							Toast({
								type: type || 'error',
								title: err?.message || String(err) || '发送失败',
							});
							const snapshot = requestSnapshotMapRef.current.get(session_Id);
							const hasReceivedData =
								hasReceivedStreamDataMapRef.current.get(session_Id);

							if (snapshot && hasReceivedData === false) {
								chatStore.removeStreamingMessage(snapshot.assistantMessageId);
								chatStore.restoreState(
									snapshot.messages,
									snapshot.selectedChildMap,
									snapshot.sessionId,
								);
								requestSnapshotMapRef.current.delete(session_Id);
							}

							currentAssistantMessageMapRef.current.delete(session_Id);
						},
						onComplete: () => {
							chatStore.setSessionLoading(session_Id, false);
							chatStore.updateMessage(assistantMessageId, {
								isStreaming: false,
							});
							chatStore.deleteStreamingBranchMap(assistantMessageId);
							stopRequestMapRef.current.delete(session_Id);
							requestSnapshotMapRef.current.delete(session_Id);
							hasReceivedStreamDataMapRef.current.delete(session_Id);
							currentAssistantMessageMapRef.current.delete(session_Id);
						},
					},
				});

				stopRequestMapRef.current.set(session_Id, stop);
			} catch (_error) {
				chatStore.setSessionLoading(session_Id, false);
				Toast({
					type: 'error',
					title: '发送消息失败',
				});

				const snapshot = requestSnapshotMapRef.current.get(session_Id);
				const hasReceivedData =
					hasReceivedStreamDataMapRef.current.get(session_Id);

				if (snapshot && hasReceivedData === false) {
					chatStore.removeStreamingMessage(snapshot.assistantMessageId);
					chatStore.restoreState(
						snapshot.messages,
						snapshot.selectedChildMap,
						snapshot.sessionId,
					);
					requestSnapshotMapRef.current.delete(session_Id);
				}

				currentAssistantMessageMapRef.current.delete(session_Id);
			}
		},
		[
			chatStore,
			getSessionInfo,
			getSelectedChildMap,
			currentChatId,
			hasReceivedStreamDataMapRef,
			currentAssistantMessageMapRef,
			requestSnapshotMapRef,
			stopRequestMapRef,
		],
	);

	// 发送新消息
	const handleNewMessage = useCallback(
		async (content: string, files: UploadedFile[]) => {
			const userMsgId = uuidv4();
			const assistantMessageId = uuidv4();

			const displayMessages = getDisplayMessages();
			let parentId: string | undefined;
			const lastMsg = displayMessages[displayMessages.length - 1];
			if (lastMsg) {
				parentId = lastMsg.chatId;
			}

			const userMessageToUse = createUserMessage({
				chatId: userMsgId,
				content,
				parentId,
				currentChatId,
				attachments: files?.length ? files : undefined,
			});

			userMessageToUse.childrenIds = [assistantMessageId];

			const assistantMessage = createAssistantMessage({
				chatId: assistantMessageId,
				parentId: userMsgId,
				currentChatId,
			});

			const selectedChildMap = getSelectedChildMap();
			const newSelectedChildMap = new Map(selectedChildMap);
			if (!userMessageToUse.parentId) {
				newSelectedChildMap.set('root', userMsgId);
			} else {
				newSelectedChildMap.set(userMessageToUse.parentId, userMsgId);
			}

			const currentSessionId = chatStore.activeSessionId;
			requestSnapshotMapRef.current.set(currentSessionId || 'new', {
				messages: [...chatStore.messages],
				selectedChildMap: new Map(selectedChildMap),
				assistantMessageId,
				userMessageId: userMsgId,
				sessionId: currentSessionId || '',
			});

			setSelectedChildMap(newSelectedChildMap);

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

			navigate('/chat/c');

			onSseFetch(
				apiEndpoint,
				assistantMessageId,
				userMessageToUse,
				assistantMessage,
				false,
				newSelectedChildMap,
			);
		},
		[
			getDisplayMessages,
			currentChatId,
			createUserMessage,
			createAssistantMessage,
			getSelectedChildMap,
			chatStore,
			setSelectedChildMap,
			updateStoreMessages,
			updateParentChildrenIds,
			onSseFetch,
			apiEndpoint,
			requestSnapshotMapRef,
			navigate,
		],
	);

	// 编辑消息
	const handleEditMessage = useCallback(
		async (
			editMsg: Message,
			content?: string,
			attachments?: UploadedFile[] | null,
		) => {
			const userMsgId = uuidv4();
			const assistantMessageId = uuidv4();
			let userMessageToUse: Message | null = null;
			let assistantMessage: Message | null = null;

			const selectedChildMap = getSelectedChildMap();
			const newSelectedChildMap = new Map(selectedChildMap);

			const currentSessionId = chatStore.activeSessionId;
			requestSnapshotMapRef.current.set(currentSessionId || 'new', {
				messages: [...chatStore.messages],
				selectedChildMap: new Map(selectedChildMap),
				assistantMessageId,
				userMessageId: userMsgId,
				sessionId: currentSessionId || '',
			});

			updateStoreMessages((prevAll) => {
				const editedMsg = prevAll.find((m) => m.chatId === editMsg.chatId);
				if (!editedMsg) return prevAll.map((i) => ({ ...i, isStopped: false }));

				const parentId = editedMsg.parentId;
				const userMsg = createUserMessage({
					chatId: userMsgId,
					content: content || editMsg?.content.trim(),
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
					newSelectedChildMap,
				);
				setEditMessage(null);
			}
		},
		[
			getSelectedChildMap,
			chatStore,
			updateStoreMessages,
			createUserMessage,
			createAssistantMessage,
			currentChatId,
			updateParentChildrenIds,
			setSelectedChildMap,
			onSseFetch,
			apiEndpoint,
			requestSnapshotMapRef,
		],
	);

	// 重新生成消息
	const handleRegenerateMessage = useCallback(
		async (index: number) => {
			const assistantMessageId = uuidv4();

			let userMessageToUse: Message | null = null;
			let assistantMessage: Message | null = null;
			let newSelectedChildMap: Map<string, string> | null = null;

			const displayMessages = getDisplayMessages();
			const currentAssistantMsg = displayMessages[index];
			if (!currentAssistantMsg) return;

			const currentSessionId = chatStore.activeSessionId;
			requestSnapshotMapRef.current.set(currentSessionId || 'new', {
				messages: [...chatStore.messages],
				selectedChildMap: new Map(getSelectedChildMap()),
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

				const childMap = new Map(getSelectedChildMap());
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
					newSelectedChildMap,
				);
			}
		},
		[
			getDisplayMessages,
			chatStore,
			getSelectedChildMap,
			updateStoreMessages,
			currentChatId,
			createAssistantMessage,
			setSelectedChildMap,
			onSseFetch,
			apiEndpoint,
			requestSnapshotMapRef,
		],
	);

	const onContinue = useCallback(async () => {
		let userMsgForApi: Message | null = null;
		let assistantMsgForApi: Message | null = null;
		let lastMsgId: string | null = null;

		const displayMessages = getDisplayMessages();

		if (displayMessages.length > 0) {
			const lastMsg = displayMessages[displayMessages.length - 1];
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
	}, [getDisplayMessages, chatStore, onSseFetch]);

	// 发送消息
	const sendMessage = useCallback(
		async (
			content?: string,
			index?: number,
			isEdit?: boolean,
			attachments?: UploadedFile[] | null,
		) => {
			if ((!content && !input.trim()) || chatStore.isCurrentSessionLoading)
				return;

			onScrollTo?.('down', 'auto');
			console.log('111111', onScrollTo);

			const isRegenerate =
				content !== undefined && index !== undefined && !isEdit;
			const isEditMode = isEdit === true;

			if (isEditMode && editMessage) {
				await handleEditMessage(editMessage, content, attachments);
			} else if (isRegenerate) {
				await handleRegenerateMessage(index!);
			} else {
				await handleNewMessage(content || input.trim(), uploadedFiles);
			}

			setInput('');
			setUploadedFiles([]);
		},
		[
			input,
			chatStore.isCurrentSessionLoading,
			onScrollTo,
			editMessage,
			uploadedFiles,
			handleEditMessage,
			handleRegenerateMessage,
			handleNewMessage,
		],
	);

	// 停止生成
	const stopGenerating = useCallback(
		async (targetSessionId?: string, isUnmount = false) => {
			const session_id = targetSessionId || chatStore.activeSessionId;
			if (!session_id) return;

			const stopFn = stopRequestMapRef.current.get(session_id);

			if (stopFn) {
				await stopSse(session_id);
				stopFn();
				stopRequestMapRef.current.delete(session_id);
			}

			chatStore.setSessionLoading(session_id, false);

			const snapshot = requestSnapshotMapRef.current.get(session_id);
			const hasReceivedData =
				hasReceivedStreamDataMapRef.current.get(session_id);

			const assistantMessageId =
				currentAssistantMessageMapRef.current.get(session_id);

			if (snapshot && hasReceivedData === false) {
				chatStore.removeStreamingMessage(snapshot.assistantMessageId);
				chatStore.restoreState(
					snapshot.messages,
					snapshot.selectedChildMap,
					snapshot.sessionId,
				);

				requestSnapshotMapRef.current.delete(session_id);

				if (!isUnmount) {
					Toast({
						type: 'info',
						title: '已取消发送，恢复到发送前状态',
					});
				}
			} else if (assistantMessageId) {
				chatStore.updateMessage(assistantMessageId, {
					isStreaming: false,
					isStopped: true,
				});
			} else {
				const lastAssistantMsg = findLastAssistantMessage(chatStore.messages);
				if (lastAssistantMsg?.isStreaming) {
					chatStore.updateMessage(lastAssistantMsg.chatId, {
						isStreaming: false,
						isStopped: true,
					});
				}
			}

			chatStore.clearSessionStreamingBranchMaps(session_id);

			requestSnapshotMapRef.current.delete(session_id);
			hasReceivedStreamDataMapRef.current.delete(session_id);
			currentAssistantMessageMapRef.current.delete(session_id);
		},
		[
			chatStore,
			findLastAssistantMessage,
			stopRequestMapRef,
			requestSnapshotMapRef,
			hasReceivedStreamDataMapRef,
			currentAssistantMessageMapRef,
		],
	);

	// 清除聊天
	const clearChat = useCallback(
		(targetSessionId?: string) => {
			// 获取正在流式输出的会话ID列表
			const streamingSessionIds = chatStore.getStreamingSessionIds();
			// 判断 targetSessionId 是否是正在流式输出的会话
			const isTargetStreaming =
				targetSessionId && streamingSessionIds.includes(targetSessionId);

			setInput('');
			setUploadedFiles([]);
			setEditMessage(null);

			// 清空当前显示的消息列表
			chatStore.setAllMessages([], '', true);

			// 清除分支选择：只有当 targetSessionId 不是正在流式输出的会话时，才清除
			if (!isTargetStreaming) {
				chatStore.clearSessionBranchSelection(
					targetSessionId || chatStore.activeSessionId,
				);
			}

			// 清除引用：只有当 targetSessionId 不是正在流式输出的会话时，才清除
			if (targetSessionId) {
				if (!isTargetStreaming) {
					requestSnapshotMapRef.current.delete(targetSessionId);
					hasReceivedStreamDataMapRef.current.delete(targetSessionId);
					stopRequestMapRef.current.delete(targetSessionId);
					currentAssistantMessageMapRef.current.delete(targetSessionId);
					chatStore.clearSessionStreamingBranchMaps(targetSessionId);
				}
			} else {
				// 没有指定 targetSessionId 时，只清除非流式输出会话的引用
				// 遍历所有引用，删除不在 streamingSessionIds 中的
				const allSessionIds = new Set([
					...requestSnapshotMapRef.current.keys(),
					...hasReceivedStreamDataMapRef.current.keys(),
					...stopRequestMapRef.current.keys(),
					...currentAssistantMessageMapRef.current.keys(),
				]);

				allSessionIds.forEach((sessionId) => {
					if (!streamingSessionIds.includes(sessionId)) {
						requestSnapshotMapRef.current.delete(sessionId);
						hasReceivedStreamDataMapRef.current.delete(sessionId);
						stopRequestMapRef.current.delete(sessionId);
						currentAssistantMessageMapRef.current.delete(sessionId);
					}
				});

				// 清除非流式输出会话的 streamingBranchMaps
				chatStore.clearNonStreamingBranchMaps(streamingSessionIds);
			}

			chatStore.setActiveSessionId('');
		},
		[
			chatStore,
			stopRequestMapRef,
			requestSnapshotMapRef,
			hasReceivedStreamDataMapRef,
			currentAssistantMessageMapRef,
		],
	);

	// 处理编辑内容变化
	const handleEditChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement> | string) => {
			const content = typeof e === 'string' ? e : e.target.value;
			setEditMessage((prev: any) => {
				if (prev) {
					return {
						...prev,
						content,
					};
				}
				return prev;
			});
		},
		[],
	);

	return {
		input,
		setInput,
		uploadedFiles,
		setUploadedFiles,
		editMessage,
		setEditMessage,
		sendMessage,
		clearChat,
		stopGenerating,
		onContinue,
		handleEditChange,
	};
};
