import { makeAutoObservable } from 'mobx';
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

	// 全局跟踪所有会话中的流式消息
	streamingMessages: Map<string, Message> = new Map();

	// 存储每个会话的分支选择状态：sessionId -> selectedChildMap
	sessionBranchSelections: Map<string, Map<string, string>> = new Map();

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

		// 2. 如果是新会话，清空当前消息
		if (isNewSession) {
			this.messages = [];
			const activeSession = this.sessionData.list.find((s) => s.isActive);
			if (activeSession) {
				activeSession.messages = [];
			}
			this.cleanupCompletedStreamingMessages();
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

	updateMessage(chatId: string, updates: Partial<Message>) {
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
			const existingStreamingMsg = this.streamingMessages.get(chatId);
			const updatedMessage = existingStreamingMsg
				? { ...existingStreamingMsg, ...updates }
				: ({ chatId, ...updates } as Message);

			if (updates.isStreaming !== false || existingStreamingMsg) {
				this.streamingMessages.set(chatId, updatedMessage);
			}
		}
	}

	// [新增] 从流式跟踪中移除指定消息，用于回滚
	removeStreamingMessage(chatId: string) {
		this.streamingMessages.delete(chatId);
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
}

export default new ChatStore();
