import { action, computed, makeAutoObservable, observable } from 'mobx';
import { Message, SessionData, WebSearchSourceItem } from '@/types/chat';

class ChatStore {
	constructor() {
		makeAutoObservable(this, {
			// 纯查询，不包成 action，避免在 computed 等上下文中误用 action 语义
			firstMessageIndexByChatId: false,
		});
	}

	/** 与 findIndex(m => m.chatId === chatId) 一致：首个匹配下标，无则 -1；for 循环避免回调分配 */
	firstMessageIndexByChatId(chatId: string): number {
		for (let i = 0; i < this.messages.length; i++) {
			if (this.messages[i].chatId === chatId) return i;
		}
		return -1;
	}

	messages: Message[] = [];
	sessionData: SessionData = {
		list: [],
		total: 0,
	};
	activeSessionId: string = '';

	// 存储每个消息的流式更新缓冲
	streamingBuffers: Map<
		string,
		{
			content: string;
			thinkContent: string;
			lastUpdateTime: number;
			pendingUpdate: boolean;
		}
	> = new Map();
	// 节流更新定时器
	updateThrottleTimer: ReturnType<typeof requestAnimationFrame> | null = null;
	// 批量更新的消息ID集合
	pendingUpdateIds: Set<string> = new Set();

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

	// 存储每条消息的停止状态：chatId -> { sessionId, stoppedAt }
	// 使用独立的 Map 来管理停止状态，避免在 setAllMessages 中被意外清空
	stoppedMessages: Map<string, { sessionId: string; stoppedAt: number }> =
		new Map();

	/** 输入栏「联网搜索」开关（与 ChatEntry、useChatCore 共享） */
	webSearchEnabled = false;

	@action
	setWebSearchEnabled(value: boolean) {
		this.webSearchEnabled = value;
	}

	@action
	setMessageWebSearchSources(chatId: string, sources: WebSearchSourceItem[]) {
		const idx = this.firstMessageIndexByChatId(chatId);
		if (idx >= 0) {
			this.messages[idx].webSearchSources = sources;
			delete this.messages[idx].webSearchError;
		}
	}

	@action
	setMessageWebSearchError(chatId: string, message: string) {
		const idx = this.firstMessageIndexByChatId(chatId);
		if (idx >= 0) {
			this.messages[idx].webSearchError = message;
			delete this.messages[idx].webSearchSources;
		}
	}

	/**
	 * 设置消息的停止状态
	 * @param chatId 消息ID
	 * @param sessionId 会话ID
	 */
	@action
	setStoppedMessage(chatId: string, sessionId: string) {
		this.stoppedMessages.set(chatId, {
			sessionId,
			stoppedAt: Date.now(),
		});
	}

	/**
	 * 清空单条消息的停止状态
	 * @param chatId 消息ID
	 */
	@action
	clearStoppedMessage(chatId: string) {
		this.stoppedMessages.delete(chatId);
	}

	/**
	 * 清空分支链路上所有消息的停止状态
	 * @param branchPath 分支链路上的所有消息 chatId 集合
	 */
	@action
	clearStoppedMessageByBranchPath(branchPath: Set<string>) {
		branchPath.forEach((chatId) => {
			this.stoppedMessages.delete(chatId);
		});
	}

	/**
	 * 检查消息是否处于停止状态
	 * @param chatId 消息ID
	 * @returns 是否处于停止状态
	 */
	isMessageStopped(chatId: string): boolean {
		return this.stoppedMessages.has(chatId);
	}

	/**
	 * 获取消息的停止状态信息
	 * @param chatId 消息ID
	 * @returns 停止状态信息
	 */
	getStoppedMessageInfo(
		chatId: string,
	): { sessionId: string; stoppedAt: number } | undefined {
		return this.stoppedMessages.get(chatId);
	}

	/**
	 * 清空指定会话的所有停止状态
	 * @param sessionId 会话ID
	 */
	@action
	clearStoppedMessageBySession(sessionId: string) {
		const keysToDelete: string[] = [];
		this.stoppedMessages.forEach((value, key) => {
			if (value.sessionId === sessionId) {
				keysToDelete.push(key);
			}
		});
		keysToDelete.forEach((key) => {
			this.stoppedMessages.delete(key);
		});
	}

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
		// 用 chatId -> 下标 替代每条流式消息都 findIndex 全表扫描；合并结果与原先一致，仅降低 O(n×流式条数) 为 O(n+流式条数)。
		const mergedIndexByChatId = new Map<string, number>();
		for (let i = 0; i < mergedMessages.length; i++) {
			const id = mergedMessages[i].chatId;
			// 与 findIndex 一致：重复 chatId 时取第一次出现，避免 Map 后写覆盖改变合并目标下标
			if (!mergedIndexByChatId.has(id)) {
				mergedIndexByChatId.set(id, i);
			}
		}

		this.streamingMessages.forEach((streamingMsg, chatId) => {
			const existingIndex = mergedIndexByChatId.get(chatId);
			if (existingIndex !== undefined) {
				// 增加 shouldMergeStreamContent 判断，防止在发送新消息时，导致上一条消息内容丢失
				const shouldMergeStreamContent = streamingMsg.isStreaming;

				mergedMessages[existingIndex] = {
					...mergedMessages[existingIndex],
					isStreaming: streamingMsg.isStreaming,
					// 只有在流式进行中才覆盖 content，否则保留 existing 内容
					content: shouldMergeStreamContent
						? streamingMsg.content || mergedMessages[existingIndex].content
						: mergedMessages[existingIndex].content,
					// thinkContent 同理
					thinkContent: shouldMergeStreamContent
						? streamingMsg.thinkContent ||
							mergedMessages[existingIndex].thinkContent
						: mergedMessages[existingIndex].thinkContent,
				};
			} else {
				if (streamingMsg.isStreaming) {
					mergedMessages.push(streamingMsg);
					mergedIndexByChatId.set(chatId, mergedMessages.length - 1);
				}
			}
		});

		// 注意：不再强制设置 isStopped: false，停止状态由 stoppedMessages Map 独立管理
		const finalMessages = mergedMessages.map((msg) => ({
			...msg,
			// 从 stoppedMessages Map 获取停止状态
			isStopped: this.stoppedMessages.has(msg.chatId),
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

	updateSessionData(sessionId: string, title?: string) {
		if (title) {
			const list = this.sessionData.list.map((item) => {
				if (item.id === sessionId) {
					return {
						...item,
						title,
					};
				}
				return item;
			});
			this.sessionData = {
				...this.sessionData,
				list,
			};
		} else {
			const list = this.sessionData.list.filter((i) => i.id !== sessionId);
			this.sessionData = {
				...this.sessionData,
				list,
			};
		}
	}

	/**
	 * 流式更新消息 - 使用缓冲区和节流机制，减少不必要的渲染
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
		}

		// 2. 累积内容到缓冲区
		if (type === 'content') {
			buffer.content += chunk;
		} else {
			buffer.thinkContent += chunk;
		}

		// ⚠️ 更新 streamingBuffers，防止丢失第一个 chunk
		this.streamingBuffers.set(chatId, buffer);

		// 3. 标记为待更新
		this.pendingUpdateIds.add(chatId);

		// 4. 使用 requestAnimationFrame 节流更新
		this.scheduleThrottledUpdate();
	}

	/**
	 * 调度节流更新
	 */
	scheduleThrottledUpdate() {
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
	flushStreamingUpdates() {
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
				const contentToFlush = buffer.content;
				const thinkContentToFlush = buffer.thinkContent;
				// 立即清空缓冲区，防止数据被重复处理
				buffer.content = '';
				buffer.thinkContent = '';
				// 使用保存的局部变量来构建 update
				if (contentToFlush) {
					update.content = contentToFlush;
				}
				if (thinkContentToFlush) {
					update.thinkContent = thinkContentToFlush;
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
	applyBatchUpdates(
		updates: Map<string, { content?: string; thinkContent?: string }>,
	) {
		// 与原先 forEach 写 messageMap 一致：同一 chatId 多次出现时保留最后一次下标（覆盖 set）
		const indexByChatId = new Map<string, number>();
		this.messages.forEach((msg, index) => {
			indexByChatId.set(msg.chatId, index);
		});

		const newMessages = [...this.messages];

		updates.forEach((update, chatId) => {
			const index = indexByChatId.get(chatId);
			if (index === undefined) return;
			const message = newMessages[index];
			const updatedMessage = {
				...message,
				...(update.content !== undefined && {
					content: message.content + update.content,
				}),
				...(update.thinkContent !== undefined && {
					thinkContent: message.thinkContent + update.thinkContent,
				}),
				isStreaming: true,
				isStopped: this.stoppedMessages.has(chatId),
			};
			newMessages[index] = updatedMessage;
		});

		this.messages = newMessages;

		// 与原先 messageMap.forEach 一致：对每个「唯一 chatId」对应的当前行（末次出现下标）若仍在流式则写回缓存，条数=去重后 id 数而非全数组长度
		indexByChatId.forEach((index, chatId) => {
			const message = newMessages[index];
			if (message.isStreaming) {
				this.streamingMessages.set(chatId, message);
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

			const messageIndex = this.firstMessageIndexByChatId(chatId);
			if (messageIndex >= 0) {
				const currentMessage = this.messages[messageIndex];
				if (buffer.content) {
					update.content = currentMessage.content + buffer.content;
				}
				if (buffer.thinkContent) {
					update.thinkContent =
						currentMessage.thinkContent + buffer.thinkContent;
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
		const messageIndex = this.firstMessageIndexByChatId(chatId);

		if (messageIndex >= 0) {
			const updatedMessage = {
				...this.messages[messageIndex],
				...updates,
				// 保持停止状态由 stoppedMessages Map 管理
				isStopped: this.stoppedMessages.has(chatId),
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
						// 保持停止状态由 stoppedMessages Map 管理
						isStopped: this.stoppedMessages.has(chatId),
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
				? {
						...existingStreamingMsg,
						...updates,
						isStopped: this.stoppedMessages.has(chatId),
					}
				: ({
						chatId,
						...updates,
						isStopped: this.stoppedMessages.has(chatId),
					} as Message);

			if (updates.isStreaming !== false || existingStreamingMsg) {
				this.streamingMessages.set(chatId, updatedMessage);
			}

			this.updateSessionMessage(chatId, updatedMessage);
		}
	}

	/**
	 * 优化：只更新受影响的 session
	 */
	updateSessionMessage(chatId: string, updatedMessage: Message) {
		this.sessionData.list.forEach((session) => {
			if (!session.messages?.length) return;
			// findIndex 只认首次出现的 chatId；建「首下标」映射避免每条 session 对长列表 O(n) 扫描
			const firstIndexById = new Map<string, number>();
			for (let i = 0; i < session.messages.length; i++) {
				const id = session.messages[i].chatId;
				if (!firstIndexById.has(id)) {
					firstIndexById.set(id, i);
				}
			}
			const sessionMessageIndex = firstIndexById.get(chatId);
			if (sessionMessageIndex !== undefined) {
				session.messages = [
					...session.messages.slice(0, sessionMessageIndex),
					updatedMessage,
					...session.messages.slice(sessionMessageIndex + 1),
				];
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
		// Set.has O(1) 替代 Array.includes O(k)，删除条件与原先相同
		const keepSessionIds = new Set(streamingSessionIds);
		const keysToDelete: string[] = [];
		this.streamingBranchMaps.forEach((value, key) => {
			if (!keepSessionIds.has(value.sessionId)) {
				keysToDelete.push(key);
			}
		});
		keysToDelete.forEach((key) => {
			this.streamingBranchMaps.delete(key);
		});
	}

	// 存储每个消息的 finishReason：chatId -> finishReason
	finishReasonMap: Map<
		string,
		{
			type: 'finish';
			reason: 'stop' | 'length' | null;
			maxTokensReached: boolean;
			sessionId: string;
		}
	> = new Map();

	/**
	 * 设置消息的 finishReason
	 */
	@action
	setFinishReason(
		chatId: string,
		finishReason: {
			type: 'finish';
			reason: 'stop' | 'length' | null;
			maxTokensReached: boolean;
			sessionId: string;
		},
	) {
		this.finishReasonMap.set(chatId, finishReason);

		// 优化：直接找到消息对象并修改属性，避免数组展开
		// 同时更新 Message 对象中的 finishReason 字段
		const idx = this.firstMessageIndexByChatId(chatId);
		if (idx >= 0) {
			this.messages[idx].finishReason = finishReason;
		}
	}

	/**
	 * 获取消息的 finishReason
	 */
	getFinishReason(chatId: string) {
		return this.finishReasonMap.get(chatId);
	}

	/**
	 * 清空指定消息的 finishReason
	 */
	@action
	clearFinishReason(chatId: string) {
		this.finishReasonMap.delete(chatId);

		// 同时清空 Message 对象中的 finishReason 字段
		// 优化：直接找到消息对象并删除属性
		const idx = this.firstMessageIndexByChatId(chatId);
		const message = idx >= 0 ? this.messages[idx] : undefined;
		if (message?.finishReason) {
			delete message.finishReason;
		}
	}

	/**
	 * 清空指定分支链路上所有消息的 finishReason
	 * @param branchPath 分支链路上的所有消息 chatId 集合
	 */
	@action
	clearFinishReasonByBranchPath(branchPath: Set<string>) {
		branchPath.forEach((chatId) => {
			this.finishReasonMap.delete(chatId);
		});

		// 批量更新消息列表
		// 优化：直接遍历修改属性，避免数组 map 操作
		this.messages.forEach((msg) => {
			if (branchPath.has(msg.chatId) && msg?.finishReason) {
				delete msg.finishReason;
			}
		});
	}

	/**
	 * 构建从指定消息到根节点的分支链路
	 * @param chatId 起始消息的 chatId
	 * @returns 分支链路上所有消息的 chatId 集合
	 */
	buildBranchPath(chatId: string): Set<string> {
		// 沿 parentId 向上遍历时，每次 find 为 O(n)；先建 chatId->Message 映射后每步 O(1)
		// 与 find 一致：重复 chatId 只认第一次出现，避免后写覆盖改变 parentId 链（旧实现是 find 取首条）
		const byChatId = new Map<string, Message>();
		for (let i = 0; i < this.messages.length; i++) {
			const m = this.messages[i];
			if (!byChatId.has(m.chatId)) {
				byChatId.set(m.chatId, m);
			}
		}

		const path = new Set<string>();
		let currentId: string | undefined = chatId;

		while (currentId) {
			path.add(currentId);
			const msg = byChatId.get(currentId);
			currentId = msg?.parentId;
		}

		return path;
	}
}

export default new ChatStore();
