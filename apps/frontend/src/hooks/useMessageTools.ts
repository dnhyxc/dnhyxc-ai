import { CreateUserMessageParams, Message } from '@/types/chat';

// 纯函数工具集放在模块级，保证引用稳定，避免 useChatCore / ChatBot 中 useCallback、useEffect 被无意义地失效
const createUserMessage = (params: CreateUserMessageParams): Message => ({
	id: params.chatId,
	chatId: params.chatId,
	content: params.content.trim(),
	role: params?.role || 'user',
	timestamp: new Date(),
	createdAt: new Date(),
	parentId: params.parentId,
	childrenIds: [],
	currentChatId: params.currentChatId,
	attachments: params.attachments,
});

const createAssistantMessage = (params: {
	chatId: string;
	parentId: string;
	currentChatId: string;
	role?: 'assistant' | 'system' | 'system';
}): Message => ({
	id: params.chatId,
	chatId: params.chatId,
	content: '',
	thinkContent: '',
	role: params?.role || 'assistant',
	timestamp: new Date(),
	createdAt: new Date(),
	isStreaming: true,
	parentId: params.parentId,
	childrenIds: [],
	currentChatId: params.currentChatId,
});

const updateSingleMessage = (
	allMessages: Message[],
	messageId: string,
	updates: Partial<Message>,
) => {
	return allMessages.map((msg) =>
		msg.chatId === messageId ? { ...msg, ...updates } : msg,
	);
};

const updateParentChildrenIds = (params: {
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

const findLastAssistantMessage = (allMessages: Message[]): Message | null => {
	for (let i = allMessages.length - 1; i >= 0; i--) {
		if (allMessages[i].role === 'assistant') {
			return allMessages[i];
		}
	}
	return null;
};

const findSiblings = (allMessages: Message[], messageId: string): Message[] => {
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
		siblings = allMessages.filter((m) => {
			const isNotChild = !allChildren.has(m.chatId);
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

const buildMessageList = (
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

	let rootMessages = messages.filter((msg) => !msg.parentId);
	if (rootMessages.length === 0 && messages.length > 0) {
		const allChildren = new Set<string>();
		messages.forEach((m) => {
			m.childrenIds?.forEach((c) => {
				allChildren.add(c);
			});
		});
		rootMessages = messages.filter((m) => {
			const isNotChild = !allChildren.has(m.chatId);
			const hasNoParent = !m.parentId;
			return isNotChild && hasNoParent;
		});
	}

	const result: Message[] = [];

	const currentRootId = selectedChildMap.get('root');
	let currentMessage = rootMessages.find((m) => m.chatId === currentRootId);

	if (!currentMessage && rootMessages.length > 0) {
		currentMessage = rootMessages[rootMessages.length - 1];
	}

	while (currentMessage) {
		let siblingIndex = 0;
		let siblingCount = 1;

		if (currentMessage.parentId) {
			const siblings = childrenMap.get(currentMessage.parentId) || [];
			siblings.sort(
				(a, b) =>
					(a.createdAt
						? new Date(a.createdAt).getTime()
						: new Date(a.timestamp).getTime()) -
					(b.createdAt
						? new Date(b.createdAt).getTime()
						: new Date(b.timestamp).getTime()),
			);
			siblingCount = siblings.length;
			siblingIndex = siblings.findIndex(
				(m) => m.chatId === currentMessage?.chatId,
			);
		} else {
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
			let nextId = selectedChildMap.get(currentMessage.chatId);
			if (!nextId || !messageMap.has(nextId)) {
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

const getFormatMessages = (messages: Message[]) => {
	return messages.map((msg) => ({
		chatId: msg.chatId,
		content: msg.content,
		attachments: msg.attachments,
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
		finishReason: msg.finishReason,
	}));
};

const MESSAGE_TOOLS = {
	createUserMessage,
	createAssistantMessage,
	updateSingleMessage,
	updateParentChildrenIds,
	findLastAssistantMessage,
	findSiblings,
	buildMessageList,
	getFormatMessages,
};

export const useMessageTools = () => MESSAGE_TOOLS;
