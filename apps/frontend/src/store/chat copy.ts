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

	// 全局跟踪所有会话中的最新消息（包括流式中和已完成的）
	private latestMessages: Map<string, Message> = new Map();

	setAllMessages(messages: Message[], activeSessionId: string) {
		// 1. 首先保存当前所有的消息到全局跟踪器（不仅仅是流式消息）
		this.messages.forEach((msg) => {
			this.latestMessages.set(msg.chatId, { ...msg });
		});

		// 2. 合并消息：从服务器加载的消息 + 全局最新消息
		const mergedMessages = [...messages];

		// 3. 将全局最新消息合并到当前会话的消息中
		this.latestMessages.forEach((latestMsg, chatId) => {
			const existingIndex = mergedMessages.findIndex(
				(m) => m.chatId === chatId,
			);
			if (existingIndex >= 0) {
				// 如果已存在，使用最新的内容（包括流式更新后的内容）
				const serverMsg = mergedMessages[existingIndex];
				const latestContent = latestMsg.content || serverMsg.content;
				const latestThinkContent =
					latestMsg.thinkContent || serverMsg.thinkContent;

				// 优先使用最新的内容，但保留服务器消息的其他属性
				mergedMessages[existingIndex] = {
					...serverMsg,
					content: latestContent,
					thinkContent: latestThinkContent,
					isStreaming: latestMsg.isStreaming,
					isStopped: latestMsg.isStopped,
				};
			} else {
				// 如果不存在，检查是否属于当前会话
				// 这里简化处理：如果消息的父消息在当前会话中，则添加
				const parentInSession = mergedMessages.some(
					(m) => m.chatId === latestMsg.parentId,
				);
				const isRootMessage = !latestMsg.parentId;

				if (parentInSession || isRootMessage) {
					mergedMessages.push(latestMsg);
				}
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

			// 更新全局最新消息跟踪器（始终保存最新状态）
			this.latestMessages.set(chatId, updatedMessage);

			// 如果是流式结束，标记消息需要持久化
			if (updates.isStreaming === false) {
				this.markMessageForPersistence(chatId, updatedMessage);
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
			// 如果消息不在当前 messages 中，可能是其他会话的消息
			// 更新全局跟踪器，确保切换回该会话时能恢复状态
			const existingLatestMsg = this.latestMessages.get(chatId);
			const updatedMessage = existingLatestMsg
				? { ...existingLatestMsg, ...updates }
				: ({ chatId, ...updates } as Message);
			this.latestMessages.set(chatId, updatedMessage);

			// 如果是流式结束，标记消息需要持久化
			if (updates.isStreaming === false) {
				this.markMessageForPersistence(chatId, updatedMessage);
			}
		}
	}

	// 标记消息需要持久化（在实际应用中，这里可以调用 API 保存到服务器）
	private markMessageForPersistence(chatId: string, message: Message) {
		// 这里可以添加逻辑将消息保存到服务器
		// 目前我们只是记录到控制台
		console.log(
			'Message completed, should be persisted:',
			chatId,
			message.content?.length,
		);
		console.log('latestMessages:', this.latestMessages.values());
	}
}

export default new ChatStore();
