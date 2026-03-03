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
	private streamingMessages: Map<string, Message> = new Map();

	setAllMessages(messages: Message[], activeSessionId: string) {
		// 1. 首先保存当前所有的流式消息到全局跟踪器
		this.messages.forEach((msg) => {
			if (msg.isStreaming) {
				this.streamingMessages.set(msg.chatId, { ...msg });
			}
		});

		// 2. 合并消息：从服务器加载的消息 + 全局流式消息
		const mergedMessages = [...messages];

		// 3. 将全局流式消息合并到当前会话的消息中
		this.streamingMessages.forEach((streamingMsg, chatId) => {
			const existingIndex = mergedMessages.findIndex(
				(m) => m.chatId === chatId,
			);
			if (existingIndex >= 0) {
				// 如果已存在，更新流式状态和内容
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
				// 如果不存在，检查是否属于当前会话
				// 注意：流式消息可能属于其他会话，我们只添加属于当前会话的流式消息
				// 通过检查消息的 session 关联性（这里简化处理，实际可能需要更复杂的逻辑）
				mergedMessages.push(streamingMsg);
			}
		});

		// 直接赋值新数组，触发 MobX 响应式更新
		this.messages = mergedMessages;

		// 4. 更新 sessionData 中的消息
		this.sessionData.list.forEach((item) => {
			if (item.id === activeSessionId) {
				// 创建新数组引用，确保响应式更新
				item.messages = [...mergedMessages];
			}
		});
	}

	// 更新单个消息（用于流式更新）
	updateMessage(chatId: string, updates: Partial<Message>) {
		const messageIndex = this.messages.findIndex((m) => m.chatId === chatId);

		if (messageIndex >= 0) {
			// 使用对象扩展来创建新对象
			const updatedMessage = {
				...this.messages[messageIndex],
				...updates,
			};

			// 替换数组中的元素
			this.messages = [
				...this.messages.slice(0, messageIndex),
				updatedMessage,
				...this.messages.slice(messageIndex + 1),
			];

			// 如果是流式消息，更新全局跟踪器
			if (updates.isStreaming !== false) {
				this.streamingMessages.set(chatId, updatedMessage);
			} else {
				// 流式结束，从跟踪器中移除
				this.streamingMessages.delete(chatId);
			}

			// 更新 sessionData 中所有包含此消息的会话
			this.sessionData.list.forEach((session) => {
				if (session.messages && session.messages.length > 0) {
					const sessionMessageIndex = session.messages.findIndex(
						(m) => m.chatId === chatId,
					);
					if (sessionMessageIndex >= 0) {
						// 创建新数组来触发响应式更新
						session.messages = [
							...session.messages.slice(0, sessionMessageIndex),
							updatedMessage,
							...session.messages.slice(sessionMessageIndex + 1),
						];
					}
				}
			});
		} else {
			// 如果消息不在当前 messages 中，可能是其他会话的流式消息
			// 更新全局跟踪器，确保切换回该会话时能恢复状态
			if (updates.isStreaming !== false) {
				const existingStreamingMsg = this.streamingMessages.get(chatId);
				const updatedMessage = existingStreamingMsg
					? { ...existingStreamingMsg, ...updates }
					: ({ chatId, ...updates } as Message);
				this.streamingMessages.set(chatId, updatedMessage);
			}
		}
	}
}

export default new ChatStore();
