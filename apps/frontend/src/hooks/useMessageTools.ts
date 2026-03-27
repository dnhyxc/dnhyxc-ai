import { CreateUserMessageParams, Message } from '@/types/chat';

/**
 * 性能：以下函数不依赖 Hook 闭包，全部放在模块级。
 * 原先在 useMessageTools() 内每次 render 都会新建函数引用，导致依赖 buildMessageList / findSiblings 等的
 * useCallback、useEffect 依赖比较永远认为「变了」，从而重复执行或让子组件认为 props 变了。
 * 抽成常量引用后，调用方可以稳定依赖这些函数，逻辑与之前完全一致（仍是同一套纯函数实现）。
 */
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

/**
 * 取单条消息用于「按时间线排序」的时间戳毫秒值。
 * 优先 createdAt，否则退化为 timestamp，与历史 buildMessageList 内联逻辑一致。
 */
const getMessageSortTime = (m: Message): number =>
	m.createdAt
		? new Date(m.createdAt).getTime() // 优先 ISO 字符串，与旧内联逻辑一致
		: new Date(m.timestamp).getTime(); // 仅 timestamp 时仍可排兄弟/根

/**
 * 原地按时间升序排序（早的在前），用于兄弟列表与根列表；
 * 与原先 while 循环里每一步 sort 相比，改为「每组兄弟只排一次」，降低长对话下的 CPU。
 */
const sortMessagesByTimeAsc = (arr: Message[]) => {
	arr.sort((a, b) => getMessageSortTime(a) - getMessageSortTime(b)); // 每组兄弟一次 sort，避免 walk 内重复排序
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

	sortMessagesByTimeAsc(siblings); // 与 buildMessageList 同一排序键，分支 next/prev 与 siblingIndex 一致
	return siblings;
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

	for (const siblings of childrenMap.values()) {
		sortMessagesByTimeAsc(siblings); // childrenMap 构建时无序；walk 里 findIndex 需有序兄弟
	}
	if (rootMessages.length > 1) {
		sortMessagesByTimeAsc(rootMessages); // 多根时「最后一个」默认取根；排序后=时间最晚
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
			const siblings = childrenMap.get(currentMessage.parentId) || []; // 兄弟已在循环外排好序，此处只读 index
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

/** 单例对象：useMessageTools() 始终返回同一引用，避免无意义的依赖链抖动 */
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
