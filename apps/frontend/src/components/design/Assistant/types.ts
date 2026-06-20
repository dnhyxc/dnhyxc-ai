import type {
	Dispatch,
	ReactNode,
	RefObject,
	SetStateAction,
	UIEventHandler,
} from 'react';
import type { StickToBottomScrollViewportHandlers } from '@/hooks/useStickToBottomScroll';
import type { ChatI18nT, Message } from '@/types/chat';

export type AssistantShareSessionType = 'assistant' | 'agent' | 'ebook';

export type AssistantShareSelectionState = {
	checkedMessages: Set<string>;
	selectedPairCount: number;
	replaceCheckedMessages: (ids: string[]) => void;
	isAllChecked: (messages?: Message[]) => boolean;
	setAllCheckedMessages: (messages?: Message[]) => void;
	clearAllCheckedMessages: () => void;
};

export type AssistantShareFlowControls = {
	onCancelShare: () => void;
};

export type AssistantShareBarProps = {
	messages: Message[];
	shareSelection: AssistantShareSelectionState;
	shareFlow: AssistantShareFlowControls;
	setShareModelVisible: Dispatch<SetStateAction<boolean>>;
	/** Checkbox / label 的 htmlFor，各场景需唯一 id */
	checkboxId?: string;
	/** 默认 chat.share.selectAll */
	selectAllLabelKey?: string;
	/** 默认 chat.share.createLink */
	createLinkLabelKey?: string;
	className?: string;
};

export type UseAssistantShareResult = {
	allowAiShare: boolean;
	/** 含 onCancelShare 等；ShareBar 仅依赖 onCancelShare */
	shareFlow: AssistantShareFlowControls;
	shareSelection: AssistantShareSelectionState & {
		isSharing: boolean;
		setIsSharing: (v: boolean) => void;
	};
	onShare: (message?: Message) => void;
	shareModelVisible: boolean;
	setShareModelVisible: Dispatch<SetStateAction<boolean>>;
	onCloseShareModel: () => void;
	shareChatNode: ReactNode | null;
};

export type ScrollFabMode = 'hidden' | 'toBottom' | 'toTop';

export type ScrollFabProps = {
	mode: ScrollFabMode;
	onClick: () => void;
	toBottomLabel: string;
	toTopLabel: string;
	/** 英语学习 footer 使用 bottom-full；默认知识库/电子书使用 calc 定位 */
	variant?: 'default' | 'english';
};

export type AssistantShellProps = {
	className?: string;
	t?: ChatI18nT;
	showCodeFloatingToolbar?: boolean;
	isLoading?: boolean;
	loadingText?: string;
	emptyState?: ReactNode;
	hasMessages: boolean;
	viewportRef: RefObject<HTMLDivElement | null>;
	scrollAreaHandlers: StickToBottomScrollViewportHandlers;
	messageList: ReactNode;
	/** 消息列表下方（如知识库流式后快捷条） */
	listFooter?: ReactNode;
	/** ScrollArea 与输入区之间（如 Agent toolStatus） */
	afterScroll?: ReactNode;
	messageContainerClassName?: string;
	scrollAreaClassName?: string;
	/** 底部输入区（单一挂载点，避免空态/有消息切换时 remount 历史抽屉） */
	footer?: ReactNode;
};

export type AssistantFooterProps = {
	/** 嵌入会话列底部时为 shrink-0 */
	embedded?: boolean;
	containerClassName?: string;
	showScrollFab?: boolean;
	scrollFab?: ScrollFabProps;
	children: ReactNode;
};

export type SelectMessageByChatId = (chatId: string) => Message | undefined;

export type AssistantShareSelection = {
	isSharing: boolean;
	checkedMessages: Set<string>;
	setCheckedMessage?: (message: Message) => void;
};

/** default = 知识库/电子书；english = 英语学习 Agent */
export type AssistantMessageVariant = 'default' | 'english';

export type AssistantMessageRowProps = {
	selectMessageByChatId: SelectMessageByChatId;
	chatId: string;
	index: number;
	messagesLength: number;
	isCopyedId: string;
	onCopy: (content: string, chatId: string) => void;
	scrollViewportRef: RefObject<HTMLElement | null>;
	variant?: AssistantMessageVariant;
	isLoading?: boolean;
	onSaveToKnowledge?: (message: Message) => void;
	allowAiShare?: boolean;
	shareSelection?: AssistantShareSelection;
	onShare?: (message?: Message) => void;
	className?: string;
	t?: ChatI18nT;
};

export type AssistantMessageBubbleProps = {
	message: Message;
	/** 由 observer 层传入，避免在非 observer 子组件内丢失 MobX 订阅 */
	msgRev: string;
	index: number;
	messagesLength: number;
	isCopyedId: string;
	onCopy: (content: string, chatId: string) => void;
	scrollViewportRef: RefObject<HTMLElement | null>;
	variant: AssistantMessageVariant;
	isLoading?: boolean;
	onSaveToKnowledge?: (message: Message) => void;
	allowAiShare: boolean;
	shareSelection?: AssistantShareSelection;
	onShare?: (message?: Message) => void;
	className?: string;
	t?: ChatI18nT;
};

export type AssistantSessionRow = {
	sessionId: string;
	title?: string | null;
	updatedAt?: string | number | Date | null;
};

export type AssistantHistoryDrawerActions = {
	activeSessionId: string | null;
	isSessionStreaming: (sessionId: string) => boolean;
	onSwitchSession: (sessionId: string) => void | Promise<void>;
	onViewportScroll?: UIEventHandler<HTMLDivElement>;
	/** 切换会话前关闭抽屉（英语学习防抖动） */
	closeDrawerBeforeSwitch?: boolean;
};

export type AssistantEntryToolbarHistoryState = {
	sessionList: AssistantSessionRow[];
	showInitialPlaceholder: boolean;
	showLoadMoreHint: boolean;
	showEmptyHint: boolean;
};

export type AssistantEntryToolbarHistoryInject = {
	isSessionSwitcherLocked: boolean;
	isHistoryDrawerOpen: boolean;
	setIsHistoryDrawerOpen: Dispatch<SetStateAction<boolean>>;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: (options?: { force?: boolean }) => void;
	setDeleteTargetSessionId: Dispatch<SetStateAction<string | null>>;
	setDeleteConfirmOpen: Dispatch<SetStateAction<boolean>>;
} & AssistantEntryToolbarHistoryState;

/** knowledge = 知识库/电子书；english = 英语学习 Agent 按钮顺序与样式 */
export type AssistantEntryToolbarLayout = 'knowledge' | 'english';

export type AssistantEntryToolbarProps = {
	/** 是否展示工具条区域（如未登录可隐藏） */
	visible?: boolean;
	/** 是否展示「历史 + 新对话」（知识库 AI 模式等与 visible 可分离） */
	showSessionActions?: boolean;
	isSessionSwitcherLocked: boolean;
	isHistoryDrawerOpen: boolean;
	setIsHistoryDrawerOpen: Dispatch<SetStateAction<boolean>>;
	enableStreamStickToBottom: () => void;
	flushScrollToBottom: (options?: { force?: boolean }) => void;
	history: AssistantEntryToolbarHistoryState;
	onNewConversation: () => void | Promise<void>;
	onDeleteSession: (sessionId: string) => void | Promise<void>;
	historyActions: AssistantHistoryDrawerActions;
	layout?: AssistantEntryToolbarLayout;
	historyAriaLabel: string;
	historyLockedToast?: string;
	newConversationLockedToast?: string;
	/** english 布局：历史按钮旁文案（可选） */
	historyButtonLabel?: string;
	/** 扩展区：如 AI/RAG 模式切换 */
	extraActions?: ReactNode;
};
