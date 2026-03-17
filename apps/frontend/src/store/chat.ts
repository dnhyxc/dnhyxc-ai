import { action, computed, makeAutoObservable, observable } from 'mobx';
import { Message, SessionData } from '@/types/chat';

// 流式更新缓冲区类型
interface StreamingBuffer {
	content: string;
	thinkContent: string;
	lastUpdateTime: number;
	pendingUpdate: boolean;
}

class ChatStore {
	constructor() {
		makeAutoObservable(this);
	}

	messages: Message[] = [];
	sessionData: SessionData = {
		list: [],
		total: 0,
	};
	activeSessionId: string = '';

	// ========== 流式更新优化：缓冲区 ==========
	// 存储每个消息的流式更新缓冲
	private streamingBuffers: Map<string, StreamingBuffer> = new Map();
	// 节流更新定时器
	private updateThrottleTimer: ReturnType<typeof requestAnimationFrame> | null =
		null;
	// 批量更新的消息ID集合
	private pendingUpdateIds: Set<string> = new Set();

	// ========== loading 状态管理 ==========
	@observable loadingSessions = observable.set<string>();

	@action
	setSessionLoading = (sessionId: string, loading: boolean) => {
		if (loading) {
			this.loadingSessions.add(sessionId);
		} else {
			this.loadingSessions.delete(sessionId);
		}
	};

	@action
	clearLoadingSessions() {
		this.loadingSessions.clear();
	}

	@computed
	get isCurrentSessionLoading() {
		return this.loadingSessions.has(this.activeSessionId);
	}

	// 全局跟踪所有会话中的流式消息
	streamingMessages: Map<string, Message> = new Map();

	// 存储每个会话的分支选择状态：sessionId -> selectedChildMap
	sessionBranchSelections: Map<string, Map<string, string>> = new Map();

	// 存储每个流式消息的分支选择状态：assistantMessageId -> { sessionId, branchMap }
	streamingBranchMaps: Map<
		string,
		{ sessionId: string; branchMap: Map<string, string> }
	> = new Map();

	addLoadingSession(sessionId: string) {
		this.loadingSessions.add(sessionId);
	}

	delLoadingSession(sessionId: string) {
		this.loadingSessions.delete(sessionId);
	}

	setActiveSessionId(sessionId: string) {
		this.activeSessionId = sessionId;
	}

	setAllMessages(
		messages: Message[],
		activeSessionId: string,
		isNewSession: boolean = false,
	) {
		this.messages.forEach((msg) => {
			if (msg.isStreaming) {
				this.streamingMessages.set(msg.chatId, { ...msg });
			}
		});

		messages.forEach((msg) => {
			if (msg.isStreaming) {
				this.streamingMessages.set(msg.chatId, { ...msg });
			}
		});

		if (isNewSession) {
			const streamingMsgsToKeep = Array.from(
				this.streamingMessages.values(),
			).filter((msg) => msg.isStreaming);
			if (streamingMsgsToKeep.length > 0) {
				this.messages = streamingMsgsToKeep;
			} else {
				this.messages = [];
			}

			const entries = Array.from(this.streamingMessages.entries());
			for (const [chatId, message] of entries) {
				if (!message.isStreaming) {
					this.streamingMessages.delete(chatId);
					this.streamingBranchMaps.delete(chatId);
				}
			}
			return;
		}

		const mergedMessages = [...messages];

		this.streamingMessages.forEach((streamingMsg, chatId) => {
			const existingIndex = mergedMessages.findIndex(
				(m) => m.chatId === chatId,
			);
			if (existingIndex >= 0) {
				mergedMessages[existingIndex] = {
					...mergedMessages[existingIndex],
					isStreaming: streamingMsg.isStreaming,
					isStopped: streamingMsg.isStopped,
					content:
						streamingMsg.content || mergedMessages[existingIndex].content,
					thinkContent:
						streamingMsg.thinkContent ||
						mergedMessages[existingIndex].thinkContent,
				};
			} else {
				mergedMessages.push(streamingMsg);
			}
		});

		const finalMessages = mergedMessages.map((msg) => ({
			...msg,
			isStopped: false,
		}));

		this.messages = finalMessages;

		this.sessionData.list.forEach((item) => {
			if (item.id === activeSessionId) {
				item.messages = [...finalMessages];
			}
		});

		this.cleanupCompletedStreamingMessages();
	}

	setSessionData(sessionData: SessionData) {
		this.sessionData = sessionData;
	}

	updateSessionData(sessionId: string) {
		const list = this.sessionData.list.filter((i) => i.id !== sessionId);
		this.sessionData = {
			...this.sessionData,
			list,
		};
	}

	/**
	 * 【优化】流式更新消息 - 高性能版本
	 * 使用缓冲区和节流机制，减少不必要的渲染
	 */
	appendStreamingContent(
		chatId: string,
		chunk: string,
		type: 'content' | 'thinkContent' = 'content',
	) {
		// 1. 获取或创建缓冲区
		let buffer = this.streamingBuffers.get(chatId);
		if (!buffer) {
			buffer = {
				content: '',
				thinkContent: '',
				lastUpdateTime: 0,
				pendingUpdate: false,
			};
			this.streamingBuffers.set(chatId, buffer);
		}

		// 2. 累积内容到缓冲区
		if (type === 'content') {
			buffer.content += chunk;
		} else {
			buffer.thinkContent += chunk;
		}

		// 3. 标记为待更新
		this.pendingUpdateIds.add(chatId);

		// 4. 使用 requestAnimationFrame 节流更新
		this.scheduleThrottledUpdate();
	}

	/**
	 * 调度节流更新
	 */
	private scheduleThrottledUpdate() {
		if (this.updateThrottleTimer !== null) {
			return; // 已有待处理的更新
		}

		this.updateThrottleTimer = requestAnimationFrame(() => {
			this.flushStreamingUpdates();
			this.updateThrottleTimer = null;
		});
	}

	/**
	 * 执行批量更新
	 */
	@action
	private flushStreamingUpdates() {
		if (this.pendingUpdateIds.size === 0) return;

		const updatesToApply = new Map<
			string,
			{ content?: string; thinkContent?: string }
		>();

		// 收集所有待更新的内容
		this.pendingUpdateIds.forEach((chatId) => {
			const buffer = this.streamingBuffers.get(chatId);
			if (buffer) {
				const update: { content?: string; thinkContent?: string } = {};
				if (buffer.content) {
					update.content = buffer.content;
					buffer.content = ''; // 清空缓冲区
				}
				if (buffer.thinkContent) {
					update.thinkContent = buffer.thinkContent;
					buffer.thinkContent = '';
				}
				if (Object.keys(update).length > 0) {
					updatesToApply.set(chatId, update);
				}
			}
		});

		// 清空待更新集合
		this.pendingUpdateIds.clear();

		// 批量应用更新
		if (updatesToApply.size > 0) {
			this.applyBatchUpdates(updatesToApply);
		}
	}

	/**
	 * 批量应用更新到消息列表
	 */
	@action
	private applyBatchUpdates(
		updates: Map<string, { content?: string; thinkContent?: string }>,
	) {
		// 创建消息映射以快速查找
		const messageMap = new Map<string, { index: number; message: Message }>();
		this.messages.forEach((msg, index) => {
			messageMap.set(msg.chatId, { index, message: msg });
		});

		// 应用更新
		updates.forEach((update, chatId) => {
			const entry = messageMap.get(chatId);
			if (entry) {
				const { index, message } = entry;
				const updatedMessage = {
					...message,
					...(update.content !== undefined && {
						content: message.content + update.content,
					}),
					...(update.thinkContent !== undefined && {
						thinkContent: (message.thinkContent || '') + update.thinkContent,
					}),
					isStreaming: true,
				};
				messageMap.set(chatId, { index, message: updatedMessage });
			}
		});

		// 一次性更新数组
		const newMessages = [...this.messages];
		messageMap.forEach(({ index, message }) => {
			newMessages[index] = message;
		});
		this.messages = newMessages;

		// 更新流式消息缓存
		messageMap.forEach(({ message }) => {
			if (message.isStreaming) {
				this.streamingMessages.set(message.chatId, message);
			}
		});
	}

	/**
	 * 立即刷新指定消息的更新（用于流式结束时）
	 */
	@action
	flushMessageUpdate(chatId: string) {
		const buffer = this.streamingBuffers.get(chatId);
		if (buffer && (buffer.content || buffer.thinkContent)) {
			// 立即应用剩余内容
			const update: Partial<Message> = { isStreaming: false };

			const messageIndex = this.messages.findIndex((m) => m.chatId === chatId);
			if (messageIndex >= 0) {
				const currentMessage = this.messages[messageIndex];
				if (buffer.content) {
					update.content = currentMessage.content + buffer.content;
				}
				if (buffer.thinkContent) {
					update.thinkContent =
						(currentMessage.thinkContent || '') + buffer.thinkContent;
				}

				this.messages = [
					...this.messages.slice(0, messageIndex),
					{ ...currentMessage, ...update },
					...this.messages.slice(messageIndex + 1),
				];
			}
		}

		// 清理缓冲区
		this.streamingBuffers.delete(chatId);
		this.pendingUpdateIds.delete(chatId);
	}

	/**
	 * 更新指定 chatId 的消息内容（非流式场景使用）
	 */
	updateMessage(chatId: string, updates: Partial<Message>) {
		// 如果是流式更新，使用优化的方法
		if (
			updates.isStreaming === true &&
			(updates.content || updates.thinkContent)
		) {
			const content = updates.content || '';
			const thinkContent = updates.thinkContent || '';

			if (content) {
				this.appendStreamingContent(chatId, content, 'content');
			}
			if (thinkContent) {
				this.appendStreamingContent(chatId, thinkContent, 'thinkContent');
			}
			return;
		}

		// 非流式更新：直接更新
		const messageIndex = this.messages.findIndex((m) => m.chatId === chatId);

		if (messageIndex >= 0) {
			const updatedMessage = {
				...this.messages[messageIndex],
				...updates,
			};

			this.messages = [
				...this.messages.slice(0, messageIndex),
				updatedMessage,
				...this.messages.slice(messageIndex + 1),
			];

			if (updates.isStreaming !== false) {
				this.streamingMessages.set(chatId, updatedMessage);
			} else if (updates.isStreaming === false) {
				// 流式结束，刷新缓冲区
				this.flushMessageUpdate(chatId);

				const existingStreamingMsg = this.streamingMessages.get(chatId);
				if (existingStreamingMsg) {
					this.streamingMessages.set(chatId, {
						...existingStreamingMsg,
						isStreaming: false,
						...updates,
					});
				} else {
					this.streamingMessages.set(chatId, updatedMessage);
				}
			}

			// 只更新受影响的 session
			this.updateSessionMessage(chatId, updatedMessage);
		} else {
			const existingStreamingMsg = this.streamingMessages.get(chatId);
			const updatedMessage = existingStreamingMsg
				? { ...existingStreamingMsg, ...updates }
				: ({ chatId, ...updates } as Message);

			if (updates.isStreaming !== false || existingStreamingMsg) {
				this.streamingMessages.set(chatId, updatedMessage);
			}

			this.updateSessionMessage(chatId, updatedMessage);
		}
	}

	/**
	 * 优化：只更新受影响的 session
	 */
	private updateSessionMessage(chatId: string, updatedMessage: Message) {
		this.sessionData.list.forEach((session) => {
			if (session.messages && session.messages.length > 0) {
				const sessionMessageIndex = session.messages.findIndex(
					(m) => m.chatId === chatId,
				);
				if (sessionMessageIndex >= 0) {
					session.messages = [
						...session.messages.slice(0, sessionMessageIndex),
						updatedMessage,
						...session.messages.slice(sessionMessageIndex + 1),
					];
				}
			}
		});
	}

	// 从流式跟踪中移除指定消息，用于回滚
	removeStreamingMessage(chatId: string) {
		this.streamingMessages.delete(chatId);
		this.streamingBranchMaps.delete(chatId);
		this.streamingBuffers.delete(chatId);
		this.pendingUpdateIds.delete(chatId);
	}

	// [新增] 恢复之前的状态（用于回滚）
	restoreState(
		messages: Message[],
		selectedChildMap: Map<string, string>,
		sessionId: string,
	) {
		this.messages = [...messages];
		this.sessionBranchSelections.set(sessionId, new Map(selectedChildMap));

		this.sessionData.list.forEach((item) => {
			if (item.id === sessionId) {
				item.messages = [...messages];
			}
		});
	}

	cleanupCompletedStreamingMessages() {
		const entries = Array.from(this.streamingMessages.entries());
		for (const [chatId, message] of entries) {
			if (!message.isStreaming) {
				this.streamingMessages.delete(chatId);
				this.streamingBranchMaps.delete(chatId);
				this.streamingBuffers.delete(chatId);
			}
		}
	}

	saveSessionBranchSelection(
		sessionId: string,
		selectedChildMap: Map<string, string>,
	) {
		if (sessionId) {
			this.sessionBranchSelections.set(sessionId, new Map(selectedChildMap));
		}
	}

	getSessionBranchSelection(
		sessionId: string,
	): Map<string, string> | undefined {
		if (!sessionId) return undefined;
		const selection = this.sessionBranchSelections.get(sessionId);
		return selection ? new Map(selection) : undefined;
	}

	clearSessionBranchSelection(sessionId?: string) {
		if (sessionId) {
			this.sessionBranchSelections.delete(sessionId);
		}
	}

	getStreamingMessages(): Message[] {
		return Array.from(this.streamingMessages.values()).filter(
			(msg) => msg.isStreaming,
		);
	}

	getStreamingSessionIds(): string[] {
		const sessionIds = new Set<string>();
		this.streamingBranchMaps.forEach((value) => {
			sessionIds.add(value.sessionId);
		});
		return Array.from(sessionIds);
	}

	getCurrentSessionStreamingMessages(): Message[] {
		const currentSessionId = this.activeSessionId;
		if (!currentSessionId) return [];

		return Array.from(this.streamingMessages.values()).filter(
			(msg) => msg.isStreaming,
		);
	}

	saveStreamingBranchMap(
		assistantMessageId: string,
		sessionId: string,
		branchMap: Map<string, string>,
	) {
		this.streamingBranchMaps.set(assistantMessageId, {
			sessionId,
			branchMap: new Map(branchMap),
		});
	}

	getStreamingBranchMap(
		assistantMessageId: string,
	): Map<string, string> | undefined {
		const data = this.streamingBranchMaps.get(assistantMessageId);
		return data?.branchMap ? new Map(data.branchMap) : undefined;
	}

	deleteStreamingBranchMap(assistantMessageId: string) {
		this.streamingBranchMaps.delete(assistantMessageId);
	}

	clearSessionStreamingBranchMaps(sessionId: string) {
		const keysToDelete: string[] = [];
		this.streamingBranchMaps.forEach((value, key) => {
			if (value.sessionId === sessionId) {
				keysToDelete.push(key);
			}
		});
		keysToDelete.forEach((key) => {
			this.streamingBranchMaps.delete(key);
		});
	}

	clearAllStreamingBranchMaps() {
		this.streamingBranchMaps.clear();
	}

	clearNonStreamingBranchMaps(streamingSessionIds: string[]) {
		const keysToDelete: string[] = [];
		this.streamingBranchMaps.forEach((value, key) => {
			if (!streamingSessionIds.includes(value.sessionId)) {
				keysToDelete.push(key);
			}
		});
		keysToDelete.forEach((key) => {
			this.streamingBranchMaps.delete(key);
		});
	}
}

export default new ChatStore();
