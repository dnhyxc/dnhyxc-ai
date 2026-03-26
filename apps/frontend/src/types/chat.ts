import type {
	ChangeEvent,
	Dispatch,
	ReactNode,
	RefObject,
	SetStateAction,
} from 'react';
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

/** 传给自定义「单条消息操作区」的上下文；与内置 ChatMessageActions 所需数据、回调一致。 */
export interface ChatBotViewMessageActionsContext {
	message: Message;
	index: number;
	messagesLength: number;
	isCopyedId: string;
	isLoading: boolean;
	onBranchChange: (msgId: string, direction: 'prev' | 'next') => void;
	onCopy: (content: string, chatId: string) => void;
	onEdit: (message: Message) => void;
	onReGenerate: (index: number) => void;
	/** 进入分享勾选模式；内置条会在分享流程中配合 setCheckedMessage 使用 */
	onShare: () => void;
	isSharing: boolean;
	checkedMessages: Set<string>;
	setCheckedMessage: (message: Message) => void;
}

/**
 * 虚拟列表与左侧锚点导航的「契约」：主列表仅挂载视口附近节点时，`#message-{chatId}` 在离屏不存在，
 * 锚点组件不能再依赖 `document.getElementById` / `getBoundingClientRect` 遍历全部用户消息。
 *
 * ChatBotView 在开启 `virtualizeMessages` 时构造本适配器并下发给内置或自定义 `ChatAnchorNav`。
 * 自定义 `renderAnchorNav` 时应透传 `anchorScrollAdapter`，或自行实现等价滚动与高亮逻辑。
 */
export interface ChatAnchorScrollAdapter {
	/**
	 * 将指定用户/消息行滚入视口：内部应对应 TanStack Virtual 的 `scrollToIndex`（或等价实现），
	 * 并配合 `scrollPaddingStart` 等与旧版「距顶约 20px」视觉对齐。
	 */
	scrollToChatId: (chatId: string) => void;
	/**
	 * 根据当前滚动偏移 + 虚拟器 `measurementsCache` 推算「应对哪条用户消息高亮」。
	 * 算法需与 DOM 路径一致：以视口上约 1/3 处为参考线，从上到下最后一条满足「行顶 ≤ 参考线」的用户消息为当前锚点；
	 * 超过视口底边的行可提前 break 优化。
	 */
	resolveActiveUserAnchor: (
		scrollContainer: HTMLElement,
		userMessages: Message[],
	) => string;
}

/** 自定义左侧锚点导航时的上下文；与内置 ChatAnchorNav 一致。 */
export interface ChatBotViewAnchorNavContext {
	messages: Message[];
	scrollContainerRef: RefObject<HTMLDivElement | null>;
	/**
	 * 仅当 `ChatBotView` 开启消息虚拟列表时有值；内置 `ChatAnchorNav` 会自动切换为适配器路径。
	 * 自定义锚点若忽略此字段，长列表下点击侧栏/高亮可能错误。
	 */
	anchorScrollAdapter?: ChatAnchorScrollAdapter;
}

/** 自定义底部分支/滚动控制条时的上下文；布尔值已算好，避免重复调用分支检测函数。 */
export interface ChatBotViewChatControlsContext {
	isLoading: boolean;
	isStreamingBranchVisible: boolean;
	isLatestBranch: boolean;
	messagesLength: number;
	switchToStreamingBranch: () => void;
	switchToLatestBranch: () => void;
	hasScrollbar: boolean;
	isAtBottom: boolean;
	onScrollTo: (position: 'up' | 'down', behavior?: 'smooth' | 'auto') => void;
}

/**
 * 纯渲染层入参：凡直接决定「屏幕上消息长什么样」的数据须由调用方显式传入，避免无源渲染、隐式状态难以排查。
 *
 * 必填：`flatMessages`（全量树，无消息传 `[]`）、`selectedChildMap` + `onSelectedChildMapChange`（当前分支路径，空会话可 `new Map()` + setState）。
 * 可选：`displayMessages` 仅当你要完全覆盖内部推导的展示列时传入；否则由 `buildMessageList` 从 flat + map 直接产出展示列
 *（字段形态与原 `getFormatMessages` 一致，无需在 View 内二次 map）。
 * 交互类（发送、分享等）仍可省略，由空回调占位，便于只读壳。
 */
export interface ChatBotViewProps {
	className?: string;
	showAvatar?: boolean;
	onBranchChange?: (msgId: string, direction: 'prev' | 'next') => void;

	/**
	 * 完整消息树（含多分支）；兄弟切换、buildMessageList 均依赖此数据。空会话传 `[]`。
	 */
	flatMessages: Message[];
	/** 当前选中的子节点路径，与展示列表一一对应；须与 onSelectedChildMapChange 同步更新 */
	selectedChildMap: Map<string, string>;
	onSelectedChildMapChange: (map: Map<string, string>) => void;
	/** 省略为 null，不写会话级持久化时与原先「无 active 会话」行为一致 */
	activeSessionId?: string | null;
	/**
	 * 用户切换分支时写入会话级持久化；主项目映射到 chatStore.saveSessionBranchSelection。
	 * 独立场景可不传，仅内存中的 selectedChildMap 生效。
	 */
	onPersistSessionBranchSelection?: (
		sessionId: string,
		map: Map<string, string>,
	) => void;
	streamingBranchSource?: ChatStreamingBranchSource;

	/**
	 * 当前分支展示列表（字段形态与 buildMessageList / 原 getFormatMessages 一致）。省略则由内部根据 flatMessages + selectedChildMap 推导，
	 * 避免调用方重复维护两份数组（本仓库 ChatBot 连接层已改为依赖此行为）。
	 */
	displayMessages?: Message[];

	/**
	 * 是否对消息列表做虚拟滚动（TanStack Virtual + 动态 `measureElement`）。
	 * - `true`（默认）：仅挂载视口附近行，长会话 DOM 与布局计算量显著下降；左侧锚点通过 `anchorScrollAdapter` 驱动滚动与高亮。
	 * - `false`：恢复每条消息全量挂载，`ChatAnchorNav` 走 `getElementById`，便于对照调试或规避极端布局问题。
	 */
	virtualizeMessages?: boolean;

	/** 以下聊天交互字段省略时使用安全空实现，保证子组件可挂载；真正发消息/流式需由连接层或业务注入 */
	input?: string;
	setInput?: (value: string) => void;
	editMessage?: Message | null;
	setEditMessage?: (message: Message | null) => void;
	sendMessage?: ChatBotRef['sendMessage'];
	clearChat?: ChatBotRef['clearChat'];
	stopGenerating?: ChatBotRef['stopGenerating'];
	handleEditChange?: (e: ChangeEvent<HTMLTextAreaElement> | string) => void;
	onContinue?: () => Promise<void>;
	onContinueAnswering?: (message?: Message) => Promise<void>;

	isCurrentSessionLoading?: boolean;
	isMessageStopped?: (chatId: string) => boolean;

	isSharing?: boolean;
	setIsSharing?: Dispatch<SetStateAction<boolean>>;
	checkedMessages?: Set<string>;
	setCheckedMessage?: (message: Message) => void;

	/**
	 * 将内部 scrollTo 注册给外层（如 ChatCoreContext.onScrollToRef）。
	 * 独立项目不需要上下文时可不传。
	 */
	onScrollToRegister?: (
		handler: ((position: string, behavior?: 'smooth' | 'auto') => void) | null,
	) => void;

	/** 无消息时的占位；默认使用内置 ChatNewSession */
	emptyState?: ReactNode;

	/** 为 false 时不展示每条消息下的操作条（忽略 renderMessageActions）；默认 true */
	showMessageActions?: boolean;
	/** 为 false 时不展示左侧锚点导航（忽略 renderAnchorNav）；默认 true */
	showAnchorNav?: boolean;
	/** 为 false 时不展示底部分支/滚动控制（忽略 renderChatControls）；默认 true */
	showChatControls?: boolean;

	/**
	 * 自定义每条消息下的操作区（分支切换、复制、编辑、重生成、分享等）。
	 * 不传则渲染内置 ChatMessageActions；返回 null 表示不渲染该区域。
	 */
	renderMessageActions?: (ctx: ChatBotViewMessageActionsContext) => ReactNode;
	/**
	 * 自定义用户消息锚点导航；不传则渲染内置 ChatAnchorNav；返回 null 可隐藏。
	 */
	renderAnchorNav?: (ctx: ChatBotViewAnchorNavContext) => ReactNode;
	/**
	 * 自定义底部分支切换与滚动按钮；不传则渲染内置 ChatControls；返回 null 可隐藏。
	 */
	renderChatControls?: (ctx: ChatBotViewChatControlsContext) => ReactNode;
}

/**
 * `ChatBotSimpleView` 入参：相对 ChatBotView 省略 flatMessages / selectedChildMap / onSelectedChildMapChange，
 * 改为单一 `messages` 与可选 `initialSelectedChildMap`（仅首屏初始化）。分支状态在封装内用 useState 维护，
 * 不与 MobX 会话持久化对齐；需要与 Store 同步时请直接使用 ChatBotView。
 */
export type ChatBotSimpleViewProps = Omit<
	ChatBotViewProps,
	'flatMessages' | 'selectedChildMap' | 'onSelectedChildMapChange'
> & {
	messages: Message[];
	/** 仅 mount 时拷贝进内部 state；之后改此 prop 不会同步（避免与内部分支操作打架） */
	initialSelectedChildMap?: Map<string, string>;
};

/** 连接层 ChatBot 与 ChatBotView 共用的业务入口 props（含可选插槽）。 */
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
	showMessageActions?: ChatBotViewProps['showMessageActions'];
	showAnchorNav?: ChatBotViewProps['showAnchorNav'];
	showChatControls?: ChatBotViewProps['showChatControls'];
	renderMessageActions?: ChatBotViewProps['renderMessageActions'];
	renderAnchorNav?: ChatBotViewProps['renderAnchorNav'];
	renderChatControls?: ChatBotViewProps['renderChatControls'];
	/** 透传至 `ChatBotView`；省略时与 View 默认一致（虚拟列表开启） */
	virtualizeMessages?: ChatBotViewProps['virtualizeMessages'];
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
