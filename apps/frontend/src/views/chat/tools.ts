import { Message } from '@design/ChatBot';

export const buildMessageList = (
	messages: Message[],
	selectedChildMap: Map<string, string>,
): Message[] => {
	const messageMap = new Map<string, Message>();
	const childrenMap = new Map<string, Message[]>();

	messages.forEach((msg) => {
		messageMap.set(msg.chatId, msg);
		if (msg.parentId) {
			if (!childrenMap.has(msg.parentId)) {
				childrenMap.set(msg.parentId, []);
			}
			childrenMap.get(msg.parentId)?.push(msg);
		}
	});

	// 找出所有的 root messages
	let rootMessages = messages.filter((msg) => !msg.parentId);
	// 如果通过 parentId 找不到，尝试通过排除法
	if (rootMessages.length === 0 && messages.length > 0) {
		const allChildren = new Set<string>();
		messages.forEach((m) => {
			m.childrenIds?.forEach((c) => {
				allChildren.add(c);
			});
		});
		rootMessages = messages.filter((m) => !allChildren.has(m.chatId));
	}

	// 对 rootMessages 进行排序
	rootMessages.sort(
		(a, b) =>
			new Date(a.createdAt as Date).getTime() -
			new Date(b.createdAt as Date).getTime(),
	);

	const result: Message[] = [];

	// 确定当前的 root message
	const currentRootId = selectedChildMap.get('root');
	let currentMessage = rootMessages.find((m) => m.chatId === currentRootId);

	// 如果没找到，默认选最新的一个
	if (!currentMessage && rootMessages.length > 0) {
		currentMessage = rootMessages[rootMessages.length - 1];
	}

	while (currentMessage) {
		// 查找当前消息的兄弟节点
		let siblingIndex = 0;
		let siblingCount = 1;

		if (currentMessage.parentId) {
			const siblings = childrenMap.get(currentMessage.parentId) || [];
			// 按照创建时间排序，确保 siblingIndex 正确
			siblings.sort(
				(a, b) =>
					new Date(a.createdAt as Date).getTime() -
					new Date(b.createdAt as Date).getTime(),
			);
			siblingCount = siblings.length;
			siblingIndex = siblings.findIndex(
				(m) => m.chatId === currentMessage?.chatId,
			);
		} else {
			// Root 节点的兄弟就是 rootMessages
			siblingCount = rootMessages.length;
			siblingIndex = rootMessages.findIndex(
				(m) => m.chatId === currentMessage?.chatId,
			);
		}

		result.push({
			...currentMessage,
			siblingIndex,
			siblingCount,
		});

		if (currentMessage.childrenIds && currentMessage.childrenIds.length > 0) {
			// 优先使用用户选择的子节点
			let nextId = selectedChildMap.get(currentMessage.chatId);
			if (!nextId || !messageMap.has(nextId)) {
				// 默认使用最后一个子节点
				nextId =
					currentMessage.childrenIds[currentMessage.childrenIds.length - 1];
			}
			currentMessage = messageMap.get(nextId);
		} else {
			currentMessage = undefined;
		}
	}
	return result;
};

export const getFormatMessages = (messages: Message[]) => {
	return messages.map((msg) => ({
		chatId: msg.chatId,
		content: msg.content,
		role: msg.role as 'user' | 'assistant',
		timestamp: new Date(msg.createdAt as Date),
		parentId: msg.parentId,
		childrenIds: msg.childrenIds,
		siblingIndex: msg.siblingIndex,
		siblingCount: msg.siblingCount,
		thinkContent: msg.thinkContent,
		isStreaming: msg.isStreaming,
		isStopped: msg.isStopped,
		currentChatId: msg.currentChatId,
	}));
};
