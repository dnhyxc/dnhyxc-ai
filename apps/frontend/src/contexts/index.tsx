import {
	createContext,
	Dispatch,
	ReactNode,
	SetStateAction,
	useContext,
	useRef,
	useState,
} from 'react';
import { useShareFlow } from '@/hooks';
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

	/** 联网搜索开关：Chat 输入区与 ChatBot 内重新生成/编辑共用，避免双份 useChatCore 状态不一致 */
	webSearchEnabled: boolean;
	setWebSearchEnabled: Dispatch<SetStateAction<boolean>>;

	// 操作方法注册
	actionsRef: React.RefObject<ChatBotActions | null>;
	registerActions: (actions: ChatBotActions) => void;
	unregisterActions: () => void;
}

const ChatCoreContext = createContext<ChatCoreContextValue | null>(null);

export const ChatCoreProvider = ({ children }: { children: ReactNode }) => {
	// 共享的 Refs - 所有使用 useChatCore 的组件共享这些状态
	const stopRequestMapRef = useRef<Map<string, () => void>>(new Map());
	// 存储每个会话的请求快照，用于停止对应的请求
	const requestSnapshotMapRef = useRef<Map<string, RequestSnapshot>>(new Map());
	// 记录每个会话是否已收到流式数据，用于没有收到流式数据立即停止时，控制是否会滚消息内容
	const hasReceivedStreamDataMapRef = useRef<Map<string, boolean>>(new Map());
	// 当前会话的助手消息ID，用户消息回滚
	const currentAssistantMessageMapRef = useRef<Map<string, string>>(new Map());
	const onScrollToRef = useRef<
		((position: string, behavior?: 'smooth' | 'auto') => void) | null
	>(null);

	// 操作方法注册
	const actionsRef = useRef<ChatBotActions | null>(null);

	// 联网搜索（与 useChatCore 共用，保证 ChatEntry 与 ChatBot 为同一状态）
	const [webSearchEnabled, setWebSearchEnabled] = useState(false);

	// 分享流程：抽成公共 hook，保持对外 context API 不变
	const { shareSelection } = useShareFlow<Message>({
		enabled: true,
		pairResolver: (message) => {
			const { chatId, parentId } = message;
			if (message.role === 'assistant') {
				if (!parentId) return null;
				// 顺序与消息流一致：user(parent) 在前，assistant 在后
				return [parentId, chatId];
			}
			if (!message?.childrenIds?.length) return null;
			return [chatId, message.childrenIds[message.childrenIds.length - 1]];
		},
	});

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
				isSharing: shareSelection.isSharing,
				setIsSharing: shareSelection.setIsSharing,
				checkedMessages: shareSelection.checkedMessages,
				setCheckedMessage: (m) => shareSelection.setCheckedMessage(m),
				setAllCheckedMessages: (messages) =>
					shareSelection.setAllCheckedMessages(messages),
				clearAllCheckedMessages: () => shareSelection.clearAllCheckedMessages(),
				isAllChecked: (messages) => shareSelection.isAllChecked(messages),
				webSearchEnabled,
				setWebSearchEnabled,
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
