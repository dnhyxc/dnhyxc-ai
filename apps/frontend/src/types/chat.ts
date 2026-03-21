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
	max_tokens?: number;
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
