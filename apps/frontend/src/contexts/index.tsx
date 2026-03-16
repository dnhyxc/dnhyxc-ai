import {
	createContext,
	MutableRefObject,
	ReactNode,
	useContext,
	useRef,
} from 'react';
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
	stopRequestMapRef: MutableRefObject<Map<string, () => void>>;
	requestSnapshotMapRef: MutableRefObject<Map<string, RequestSnapshot>>;
	hasReceivedStreamDataMapRef: MutableRefObject<Map<string, boolean>>;
	currentAssistantMessageMapRef: MutableRefObject<Map<string, string>>;

	// 操作方法注册
	actionsRef: MutableRefObject<ChatBotActions | null>;
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

	// 操作方法注册
	const actionsRef = useRef<ChatBotActions | null>(null);

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
				actionsRef,
				registerActions,
				unregisterActions,
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
