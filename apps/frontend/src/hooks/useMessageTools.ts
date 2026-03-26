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

/**
 * 单条消息的「展示形态」：与历史 `getFormatMessages` 逐字段一致（含 `timestamp: new Date(createdAt)`），
 * 但不扩散 `id` / 原始 `createdAt` 等与列表渲染无关的字段。
 *
 * 阶段一：`buildMessageList` 在 push 时直接调用本函数，等价于旧路径
 * `getFormatMessages(buildMessageList(...))`，省掉整表第二次 map。
 * `getFormatMessages` 仍保留对外导出，供其它调用方或兼容旧代码；内部委托到本函数，并对缺失的 sibling 字段做 `??` 兜底。
 */
const formatMessageForDisplay = (
	m: Message,
	siblingIndex: number,
	siblingCount: number,
): Message => ({
	chatId: m.chatId,
	content: m.content,
	attachments: m.attachments,
	role: m.role as 'user' | 'assistant',
	timestamp: new Date(m.createdAt as Date),
	parentId: m.parentId,
	childrenIds: m.childrenIds,
	siblingIndex,
	siblingCount,
	thinkContent: m.thinkContent,
	isStreaming: m.isStreaming,
	isStopped: m.isStopped,
	currentChatId: m.currentChatId,
	finishReason: m.finishReason,
});

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

		// 此处已含格式化，调用方无需再套一层 getFormatMessages
		result.push(
			formatMessageForDisplay(currentMessage, siblingIndex, siblingCount),
		);

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

/**
 * 将已有 Message 数组统一成展示用字段（例如从 Store 拉取的节点可能已带 siblingIndex）。
 * 若输入来自 `buildMessageList`，通常已是格式化结果，再调本函数会得到结构相同的拷贝。
 */
const getFormatMessages = (messages: Message[]) => {
	return messages.map((msg) =>
		formatMessageForDisplay(msg, msg.siblingIndex ?? 0, msg.siblingCount ?? 1),
	);
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
