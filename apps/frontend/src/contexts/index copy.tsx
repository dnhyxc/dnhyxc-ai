import { createContext, ReactNode, useContext, useRef } from 'react';
import { UploadedFile } from '@/types';
import { Message } from '@/types/chat';

// 定义快照类型
interface RequestSnapshot {
	messages: Message[];
	selectedChildMap: Map<string, string>;
	assistantMessageId: string;
	userMessageId: string;
	sessionId: string;
}

// 定义 ChatBot 操作方法接口
export interface ChatBotActions {
	sendMessage: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: UploadedFile[] | null,
	) => Promise<void>;
	clearChat: (targetSessionId?: string) => void;
	stopGenerating: (
		targetSessionId?: string,
		isUnmount?: boolean,
	) => Promise<void>;
	isCurrentSessionLoading: () => boolean;
}

interface ChatCoreContextValue {
	// 共享的 Refs
	stopRequestMapRef: React.RefObject<Map<string, () => void>>;
	requestSnapshotMapRef: React.RefObject<Map<string, RequestSnapshot>>;
	hasReceivedStreamDataMapRef: React.RefObject<Map<string, boolean>>;
	currentAssistantMessageMapRef: React.RefObject<Map<string, string>>;
	onScrollToRef: React.RefObject<
		((position: string, behavior?: 'smooth' | 'auto') => void) | null
	>;
	isSharing: React.RefObject<boolean>;
	checkedMessages: React.RefObject<Map<string, string>>;
	setCheckedMessage: (message: Message) => void;

	// 操作方法注册
	actionsRef: React.RefObject<ChatBotActions | null>;
	registerActions: (actions: ChatBotActions) => void;
	unregisterActions: () => void;
}

const ChatCoreContext = createContext<ChatCoreContextValue | null>(null);

export const ChatCoreProvider = ({ children }: { children: ReactNode }) => {
	// 共享的 Refs - 所有使用 useChatCore 的组件共享这些状态
	const stopRequestMapRef = useRef<Map<string, () => void>>(new Map());
	const requestSnapshotMapRef = useRef<Map<string, RequestSnapshot>>(new Map());
	const hasReceivedStreamDataMapRef = useRef<Map<string, boolean>>(new Map());
	const currentAssistantMessageMapRef = useRef<Map<string, string>>(new Map());
	const onScrollToRef = useRef<
		((position: string, behavior?: 'smooth' | 'auto') => void) | null
	>(null);

	// 操作方法注册
	const actionsRef = useRef<ChatBotActions | null>(null);

	// 是否开启分享
	const isSharing = useRef<boolean>(false);

	// 选中的消息
	const checkedMessages = useRef<Map<string, string>>(new Map());

	const onCheckedMessage = (id1: string, id2: string) => {
		if (checkedMessages.current.has(id1) || checkedMessages.current.has(id2)) {
			checkedMessages.current.delete(id1);
			checkedMessages.current.delete(id2);
		} else {
			checkedMessages.current.set(id1, id1);
			checkedMessages.current.set(id2, id2);
		}
	};

	const setCheckedMessage = (message: Message) => {
		const { chatId, parentId } = message;
		if (message.role === 'assistant') {
			if (!parentId) return;
			onCheckedMessage(chatId, parentId);
		} else {
			if (!message?.childrenIds?.length) return;
			onCheckedMessage(
				chatId,
				message.childrenIds?.[message.childrenIds.length - 1],
			);
		}
	};

	const registerActions = (actions: ChatBotActions) => {
		actionsRef.current = actions;
	};

	const unregisterActions = () => {
		actionsRef.current = null;
	};

	return (
		<ChatCoreContext.Provider
			value={{
				stopRequestMapRef,
				requestSnapshotMapRef,
				hasReceivedStreamDataMapRef,
				currentAssistantMessageMapRef,
				onScrollToRef,
				actionsRef,
				registerActions,
				unregisterActions,
				isSharing,
				checkedMessages,
				setCheckedMessage,
			}}
		>
			{children}
		</ChatCoreContext.Provider>
	);
};

export const useChatCoreContext = () => {
	const context = useContext(ChatCoreContext);
	if (!context) {
		throw new Error('useChatCoreContext must be used within ChatCoreProvider');
	}
	return context;
};
