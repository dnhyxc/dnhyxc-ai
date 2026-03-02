import { UploadedFile } from '@/types';

export interface Message {
	chatId: string;
	content: string;
	role: 'user' | 'assistant';
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
}

export interface ChatRequestParams {
	messages: { role: 'user' | 'assistant'; content: string; noSave?: boolean }[];
	sessionId: string | undefined;
	stream?: boolean;
	attachments?: UploadedFile[];
	isRegenerate?: boolean;
	parentId?: string;
	userMessage?: Message;
	assistantMessage?: Message;
	currentChatId?: string;
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
}

export interface CreateUserMessageParams {
	chatId: string;
	content: string;
	currentChatId: string;
	parentId?: string;
	attachments?: UploadedFile[] | null;
}

export interface InsertNewlineParams {
	e: React.KeyboardEvent<HTMLTextAreaElement>;
	editMessage: Message | null;
	input: string;
	setEditInputValue: (value: string) => void;
	setInputValue: (value: string) => void;
	isEdit?: boolean;
}
