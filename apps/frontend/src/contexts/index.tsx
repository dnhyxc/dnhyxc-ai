import { createContext, ReactNode, useContext, useRef, useState } from 'react';
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
	isSharing: boolean;
	setIsSharing: React.Dispatch<React.SetStateAction<boolean>>;
	checkedMessages: Set<string>;
	setCheckedMessage: (message: Message) => void;
	setAllCheckedMessages: (messages: Message[]) => void;
	clearAllCheckedMessages: () => void;
	isAllChecked: (messages: Message[]) => boolean;

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
	const [isSharing, setIsSharing] = useState<boolean>(false);

	// 选中的消息
	const [checkedMessages, setCheckedMessages] = useState<Set<string>>(
		new Set(),
	);

	const onCheckedMessage = (id1: string, id2: string) => {
		setCheckedMessages((prev) => {
			// 创建新 Set（不可变更新）
			const newSet = new Set(prev);
			if (newSet.has(id1) || newSet.has(id2)) {
				newSet.delete(id1);
				newSet.delete(id2);
			} else {
				newSet.add(id1);
				newSet.add(id2);
			}
			return newSet;
		});
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
				message.childrenIds[message.childrenIds.length - 1],
			);
		}
	};

	// 批量设置选中消息（全选）
	const setAllCheckedMessages = (messages: Message[]) => {
		setCheckedMessages((prev) => {
			const newSet = new Set(prev);
			messages.forEach((message) => {
				newSet.add(message.chatId);
			});
			return newSet;
		});
	};

	// 清除所有选中消息（取消全选）
	const clearAllCheckedMessages = () => {
		setCheckedMessages(new Set());
	};

	// 检查是否已全选
	const isAllChecked = (messages: Message[]): boolean => {
		if (!messages.length) return false;
		return messages.every((msg) => checkedMessages.has(msg.chatId));
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
				setIsSharing,
				checkedMessages,
				setCheckedMessage,
				setAllCheckedMessages,
				clearAllCheckedMessages,
				isAllChecked,
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
