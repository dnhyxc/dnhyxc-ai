import { CreateUserMessageParams, InsertNewlineParams, Message } from './types';

export const createUserMessage = (
	params: CreateUserMessageParams,
): Message => ({
	id: params.chatId,
	chatId: params.chatId,
	content: params.content.trim(),
	role: 'user',
	timestamp: new Date(),
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

export const insertNewline = (params: InsertNewlineParams) => {
	const { e, isEdit, editMessage, input, setEditInputValue, setInputValue } =
		params;
	e.preventDefault();
	const textarea = e.currentTarget;
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	if (isEdit) {
		const newValue = `${editMessage?.content?.substring(0, start)}\n${editMessage?.content?.substring(end)}`;
		setEditInputValue(newValue);
	} else {
		const newValue = `${input.substring(0, start)}\n${input.substring(end)}`;
		setInputValue(newValue);
	}

	// 移动光标到插入位置后
	textarea.selectionStart = textarea.selectionEnd = start + 1;
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
		siblings = allMessages.filter((m) => !allChildren.has(m.chatId));
	}

	return siblings.sort(
		(a, b) =>
			new Date(a.createdAt as Date).getTime() -
			new Date(b.createdAt as Date).getTime(),
	);
};
