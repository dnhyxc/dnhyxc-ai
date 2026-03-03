import { CreateUserMessageParams, Message } from '@/types/chat';

export const createUserMessage = (
	params: CreateUserMessageParams,
): Message => ({
	id: params.chatId,
	chatId: params.chatId,
	content: params.content.trim(),
	role: 'user',
	timestamp: new Date(),
	createdAt: new Date(),
	parentId: params.parentId,
	childrenIds: [],
	currentChatId: params.currentChatId,
	attachments: params.attachments,
});

export const createAssistantMessage = (params: {
	chatId: string;
	parentId: string;
	currentChatId: string;
}): Message => ({
	id: params.chatId,
	chatId: params.chatId,
	content: '',
	thinkContent: '',
	role: 'assistant',
	timestamp: new Date(),
	createdAt: new Date(),
	isStreaming: true,
	parentId: params.parentId,
	childrenIds: [],
	currentChatId: params.currentChatId,
});

export const updateSingleMessage = (
	allMessages: Message[],
	messageId: string,
	updates: Partial<Message>,
) => {
	return allMessages.map((msg) =>
		msg.chatId === messageId ? { ...msg, ...updates } : msg,
	);
};

export const updateParentChildrenIds = (params: {
	allMessages: Message[];
	parentId: string;
	childId: string;
}): Message[] => {
	const parentIndex = params.allMessages.findIndex(
		(m) => m.chatId === params.parentId,
	);
	if (parentIndex === -1) return params.allMessages;

	const newAllMessages = [...params.allMessages];
	const parentMsg = { ...newAllMessages[parentIndex] };
	const pChildrenIds = parentMsg.childrenIds ? [...parentMsg.childrenIds] : [];

	if (!pChildrenIds.includes(params.childId)) {
		pChildrenIds.push(params.childId);
	}

	parentMsg.childrenIds = pChildrenIds;
	newAllMessages[parentIndex] = parentMsg;
	return newAllMessages;
};

export const findLastAssistantMessage = (
	allMessages: Message[],
): Message | null => {
	for (let i = allMessages.length - 1; i >= 0; i--) {
		if (allMessages[i].role === 'assistant') {
			return allMessages[i];
		}
	}
	return null;
};

export const findSiblings = (
	allMessages: Message[],
	messageId: string,
): Message[] => {
	const currentMsg = allMessages.find((m) => m.chatId === messageId);
	if (!currentMsg) return [];

	const parentId = currentMsg.parentId;
	let siblings: Message[] = [];

	if (parentId) {
		siblings = allMessages.filter((m) => m.parentId === parentId);
	} else {
		const allChildren = new Set<string>();
		allMessages.forEach((m) => {
			m.childrenIds?.forEach((c) => {
				allChildren.add(c);
			});
		});
		// 过滤出所有不是任何消息子节点的消息（即根消息）
		// 同时确保消息的 parentId 为 undefined 或空
		siblings = allMessages.filter((m) => {
			// 不是任何消息的子节点
			const isNotChild = !allChildren.has(m.chatId);
			// 并且没有父节点（parentId 为 undefined 或空）
			const hasNoParent = !m.parentId;
			return isNotChild && hasNoParent;
		});
	}

	return siblings.sort(
		(a, b) =>
			(a.createdAt
				? new Date(a.createdAt).getTime()
				: new Date(a.timestamp).getTime()) -
			(b.createdAt
				? new Date(b.createdAt).getTime()
				: new Date(b.timestamp).getTime()),
	);
};
