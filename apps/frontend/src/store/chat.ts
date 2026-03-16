import { action, computed, makeAutoObservable, observable } from 'mobx';
import { Message, SessionData } from '@/types/chat';

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

	// ========== 修复：使用 observable.set 代替普通 Set ==========
	// 这样 MobX 可以正确追踪 Set 的变化，触发 React 组件重新渲染
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

	clearLoadingSessions() {
		this.loadingSessions.clear();
	}

	setActiveSessionId(sessionId: string) {
		this.activeSessionId = sessionId;
	}

	setAllMessages(
		messages: Message[],
		activeSessionId: string,
		isNewSession: boolean = false,
	) {
		// 1. 首先保存当前所有的流式消息到全局跟踪器 (保持原有逻辑)
		this.messages.forEach((msg) => {
			if (msg.isStreaming) {
				this.streamingMessages.set(msg.chatId, { ...msg });
			}
		});

		// [新增] 也要检查传入的 messages 参数中的流式消息
		// 这样新创建的流式消息会立即被跟踪
		messages.forEach((msg) => {
			if (msg.isStreaming) {
				this.streamingMessages.set(msg.chatId, { ...msg });
			}
		});

		// 2. 如果是新会话，清空当前消息
		if (isNewSession) {
			// [修复] 在清空消息之前，保留正在流式传输的消息
			// 这样当用户切换回正在接收流的会话时，已接收的内容不会丢失
			const streamingMsgsToKeep = Array.from(
				this.streamingMessages.values(),
			).filter((msg) => msg.isStreaming);

			// 如果有正在流式传输的消息，保留它们而不是完全清空
			if (streamingMsgsToKeep.length > 0) {
				this.messages = streamingMsgsToKeep;
			} else {
				this.messages = [];
			}

			// [修复] 只清理已完成的流式消息（isStreaming: false），保留正在进行的
			// 原来的 cleanupCompletedStreamingMessages 会清理所有 isStreaming: false 的消息
			// 但我们已经在上面保留了正在流式传输的消息，所以这里只需要清理缓存中已完成的
			const entries = Array.from(this.streamingMessages.entries());
			for (const [chatId, message] of entries) {
				if (!message.isStreaming) {
					this.streamingMessages.delete(chatId);
					this.streamingBranchMaps.delete(chatId);
				}
			}
			return;
		}

		// 3. 合并消息：从参数加载的消息 + 全局流式消息
		const mergedMessages = [...messages];

		// 4. 将全局流式消息合并到当前会话的消息中
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
	 * 更新指定 chatId 的消息内容
	 * 1. 优先在 this.messages 中查找并更新
	 * 2. 若未找到，则尝试在流式消息缓存中更新或新建
	 * 3. 同步更新 sessionData 中对应会话的消息列表
	 * 4. 根据 isStreaming 状态维护 streamingMessages 缓存
	 *
	 * @param chatId - 要更新的消息唯一标识
	 * @param updates - 需要合并的字段（Partial<Message>）
	 */
	updateMessage(chatId: string, updates: Partial<Message>) {
		// 在本地消息列表中查找目标消息
		const messageIndex = this.messages.findIndex((m) => m.chatId === chatId);

		if (messageIndex >= 0) {
			// 场景 A：消息已存在于 this.messages
			const updatedMessage = {
				...this.messages[messageIndex],
				...updates,
			};

			// 使用不可变方式替换数组中的消息
			this.messages = [
				...this.messages.slice(0, messageIndex),
				updatedMessage,
				...this.messages.slice(messageIndex + 1),
			];

			// 维护流式消息缓存：
			// - 若 updates.isStreaming !== false，表示仍在流式输出，更新缓存
			// - 若 updates.isStreaming === false，表示流式结束，同步状态到缓存
			if (updates.isStreaming !== false) {
				this.streamingMessages.set(chatId, updatedMessage);
			} else if (updates.isStreaming === false) {
				const existingStreamingMsg = this.streamingMessages.get(chatId);
				if (existingStreamingMsg) {
					// 缓存中已存在，合并更新
					this.streamingMessages.set(chatId, {
						...existingStreamingMsg,
						isStreaming: false,
						...updates,
					});
				} else {
					// 缓存中不存在，直接写入
					this.streamingMessages.set(chatId, updatedMessage);
				}
			}

			// 同步更新 sessionData 中所有会话的对应消息
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
		} else {
			// 场景 B：消息不存在于 this.messages
			// 尝试从流式缓存中拿历史数据，否则新建消息对象
			const existingStreamingMsg = this.streamingMessages.get(chatId);
			const updatedMessage = existingStreamingMsg
				? { ...existingStreamingMsg, ...updates }
				: ({ chatId, ...updates } as Message);

			// 只要仍在流式或缓存中已存在，就更新缓存
			if (updates.isStreaming !== false || existingStreamingMsg) {
				this.streamingMessages.set(chatId, updatedMessage);
			}
		}
	}

	// 从流式跟踪中移除指定消息，用于回滚
	removeStreamingMessage(chatId: string) {
		this.streamingMessages.delete(chatId);
		this.streamingBranchMaps.delete(chatId);
	}

	// [新增] 恢复之前的状态（用于回滚）
	restoreState(
		messages: Message[],
		selectedChildMap: Map<string, string>,
		sessionId: string,
	) {
		// 1. 直接设置消息列表，不合并流式消息（因为回滚意味着流式消息不应存在）
		this.messages = [...messages];

		// 2. 恢复分支选择
		this.sessionBranchSelections.set(sessionId, new Map(selectedChildMap));

		// 3. 同步更新 sessionData
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

	// 获取当前正在流式输出的消息
	getStreamingMessages(): Message[] {
		return Array.from(this.streamingMessages.values()).filter(
			(msg) => msg.isStreaming,
		);
	}

	// 获取当前会话的流式消息
	getCurrentSessionStreamingMessages(): Message[] {
		const currentSessionId = this.activeSessionId;
		if (!currentSessionId) return [];

		return Array.from(this.streamingMessages.values()).filter(
			(msg) => msg.isStreaming,
		);
	}

	// 保存流式消息的分支映射
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

	// 获取流式消息的分支映射
	getStreamingBranchMap(
		assistantMessageId: string,
	): Map<string, string> | undefined {
		const data = this.streamingBranchMaps.get(assistantMessageId);
		return data?.branchMap ? new Map(data.branchMap) : undefined;
	}

	// 删除流式消息的分支映射
	deleteStreamingBranchMap(assistantMessageId: string) {
		this.streamingBranchMaps.delete(assistantMessageId);
	}

	// 清除指定会话的所有流式分支映射
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

	// 清除所有流式分支映射
	clearAllStreamingBranchMaps() {
		this.streamingBranchMaps.clear();
	}
}

export default new ChatStore();
