import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from 'react';
import { UploadedFile } from '@/types';

export interface Session {
	id: string;
	content: string;
	role: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	messages: Message[];
	title: string;
}

export interface SessionData {
	list: Session[];
	total: number;
}

export interface Message {
	chatId: string;
	content: string;
	role: 'user' | 'assistant' | 'system';
	timestamp: Date;
	id?: string;
	createdAt?: Date;
	attachments?: UploadedFile[] | null;
	thinkContent?: string;
	isStreaming?: boolean;
	isStopped?: boolean;
	parentId?: string;
	childrenIds?: string[];
	siblingIndex?: number;
	siblingCount?: number;
	currentChatId?: string;
	finishReason?: {
		type: 'finish';
		reason: 'length' | 'stop' | null;
		maxTokensReached: boolean;
		sessionId: string; // 新增：记录产生此 finishInfo 的会话 ID
	};
}

export interface ChatRequestParams {
	messages: {
		role: 'user' | 'assistant' | 'system';
		content: string;
		noSave?: boolean;
	}[];
	sessionId: string | undefined;
	stream?: boolean;
	attachments?: UploadedFile[];
	isRegenerate?: boolean;
	parentId?: string;
	userMessage?: Message;
	assistantMessage?: Message;
	currentChatId?: string;
	role?: 'user' | 'assistant' | 'system';
	maxTokens?: number;
	thinking?: 'enabled' | 'disabled';
	temperature?: number;
	stop?: boolean;
	isContinuation?: boolean;
}

export interface ChatBotProps {
	className?: string;
	initialMessages?: Message[];
	apiEndpoint?: string;
	maxHistory?: number;
	showAvatar?: boolean;
	onBranchChange?: (msgId: string, direction: 'prev' | 'next') => void;
	activeSessionId?: string;
	setActiveSessionId?: (id: string) => void;
	onStreamingStateChange?: (isStreaming: boolean, sessionId: string) => void;
}

/**
 * 通过 ref 暴露给父级的能力（发送、清空、停止）。
 * 抽到类型文件是为了让 ChatBot 连接层与 ChatBotView 纯 UI 层共用同一契约，避免循环依赖。
 */
export interface ChatBotRef {
	clearChat: (targetSessionId?: string) => void;
	stopGenerating: (
		targetSessionId?: string,
		isUnmount?: boolean,
	) => Promise<void>;
	sendMessage: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: UploadedFile[] | null,
	) => Promise<void>;
}

/**
 * 主项目里流式输出时的「分支条」依赖 MobX 里的 streaming 元数据。
 * 独立复用时若不传此对象，useBranchManage 会退化为「始终认为流式分支可见」，避免依赖 Store。
 */
export interface ChatStreamingBranchSource {
	getStreamingMessages: () => Message[];
	getStreamingMessageSessionId: (assistantChatId: string) => string | undefined;
	getStreamingBranchMap: (
		assistantMessageId: string,
	) => Map<string, string> | undefined;
}

/**
 * 纯渲染层入参：所有数据与副作用均由父组件 / 连接层注入，不引用 useStore、ChatCoreProvider。
 * 其它项目可复制 ChatBotView + 自行实现与 useChatCore 等价的状态机，或只读展示传入的 displayMessages。
 */
export interface ChatBotViewProps {
	className?: string;
	showAvatar?: boolean;
	onBranchChange?: (msgId: string, direction: 'prev' | 'next') => void;

	/** 完整消息树（含多分支），用于兄弟消息切换等；对应原先 chatStore.messages */
	flatMessages: Message[];
	selectedChildMap: Map<string, string>;
	onSelectedChildMapChange: (map: Map<string, string>) => void;
	activeSessionId: string | null;
	/**
	 * 用户切换分支时写入会话级持久化；主项目映射到 chatStore.saveSessionBranchSelection。
	 * 独立场景可不传，仅内存中的 selectedChildMap 生效。
	 */
	onPersistSessionBranchSelection?: (
		sessionId: string,
		map: Map<string, string>,
	) => void;
	streamingBranchSource?: ChatStreamingBranchSource;

	/** 当前选中分支下的展示列表（已 format），由父级用 buildMessageList + getFormatMessages 算出，保持与原 effect 两阶段一致 */
	displayMessages: Message[];

	input: string;
	setInput: (value: string) => void;
	editMessage: Message | null;
	setEditMessage: (message: Message | null) => void;
	sendMessage: ChatBotRef['sendMessage'];
	clearChat: ChatBotRef['clearChat'];
	stopGenerating: ChatBotRef['stopGenerating'];
	handleEditChange: (e: ChangeEvent<HTMLTextAreaElement> | string) => void;
	onContinue: () => Promise<void>;
	onContinueAnswering: (message?: Message) => Promise<void>;

	isCurrentSessionLoading: boolean;
	isMessageStopped: (chatId: string) => boolean;

	isSharing: boolean;
	setIsSharing: Dispatch<SetStateAction<boolean>>;
	checkedMessages: Set<string>;
	setCheckedMessage: (message: Message) => void;

	/**
	 * 将内部 scrollTo 注册给外层（如 ChatCoreContext.onScrollToRef）。
	 * 独立项目不需要上下文时可不传。
	 */
	onScrollToRegister?: (
		handler: ((position: string, behavior?: 'smooth' | 'auto') => void) | null,
	) => void;

	/** 无消息时的占位；默认使用内置 ChatNewSession */
	emptyState?: ReactNode;
}

export interface CreateUserMessageParams {
	chatId: string;
	content: string;
	currentChatId: string;
	parentId?: string;
	attachments?: UploadedFile[] | null;
	role?: 'user' | 'assistant' | 'system';
}

export interface InsertNewlineParams {
	e: React.KeyboardEvent<HTMLTextAreaElement>;
	editMessage: Message | null;
	input: string;
	setEditInputValue: (value: string) => void;
	setInputValue: (value: string) => void;
	isEdit?: boolean;
	textareaNode?: HTMLTextAreaElement;
}

export interface FinishInfo {
	type: 'finish';
	reason: 'length' | 'stop' | null;
	maxTokensReached: boolean;
	sessionId: string; // 新增：记录产生此 finishInfo 的会话 ID
}
