/**
 * 英语学习页右侧 Agent 对话区：布局与交互对齐知识库「KnowledgeAssistant」
 *（贴底滚动、代码块浮动工具栏、角落上/下滚动、空态卡片、双段 footer + ChatEntry）。
 *
 * 流式时消息列与输入区解耦：streamTick 只驱动滚动壳，ChatEntry 元素引用保持稳定，避免输入卡顿。
 */
import ChatEntry from '@design/ChatEntry';
import { Toast } from '@ui/index';
import { motion } from 'framer-motion';
import { Atom, Vegan } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type Dispatch,
	type ReactNode,
	type RefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import {
	AssistantFooter,
	AssistantSessionEntryToolbar,
	AssistantShareBar,
	AssistantShell,
	useAssistantShare,
} from '@/components/design/Assistant';
import { useAssistantSelectionSpeak } from '@/components/design/SelectionSpeak';
import { useI18n } from '@/hooks';
import { useAssistantCopy } from '@/hooks/useAssistantCopy';
import { useAssistantScroll } from '@/hooks/useAssistantScroll';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import englishAgentStore from '@/store/englishAgent';
import type { Message } from '@/types/chat';
import { EnglishAgentMessageList } from './EnglishAgentMessageList';
import {
	useEnglishAgentIsHydrating,
	useEnglishAgentIsSending,
	useEnglishAgentIsStreaming,
	useEnglishAgentMessageCount,
	useEnglishAgentSessionId,
	useEnglishAgentStreamTick,
	useEnglishAgentToolStatus,
} from './useEnglishAgentSignals';

export type AgentPanelProps = {
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	chatInputRef: RefObject<HTMLTextAreaElement | null>;
	/** 递增时 ChatEntry 聚焦并将光标置于末尾（快捷意图预填） */
	focusInputAtEndKey?: number;
	sendMessage: () => void | Promise<void>;
	onNewChat: () => void;
};

const getEnglishMessages = () => englishAgentStore.messages;

/** 英语学习 Agent 最大宽度 */
const AGENT_MAX_WIDTH = 'max-w-5xl';

/**
 * English Agent 空态 Logo：hover 点亮
 *
 * 避免「黑边 / 卡顿」：
 *  - 不用 background-clip:text + filter:drop-shadow（裁切后滤镜易出黑晕且过渡难插值）
 *  - 不用 color-mix(..., black) 浮雕阴影
 *  - 文字/图标始终同一套 DOM，只过渡 color / opacity / text-shadow
 *  - 图标光晕用模糊副本 + opacity（比多层 drop-shadow 更顺）
 */
function EnglishAgentLogo() {
	const [hovered, setHovered] = useState(false);
	const ICON_SIZE = 180;
	const lit = 'color-mix(in oklch, var(--brand-accent) 48%, white)';
	const dim = 'var(--color-teal-500)';

	return (
		<div
			className="flex h-full w-full cursor-pointer select-none flex-col items-center justify-center"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<motion.div
				className="relative flex items-center justify-center"
				style={{ padding: '35px 56px 10px' }}
				initial={false}
				animate={{ scale: hovered ? 1.06 : 1, y: hovered ? -5.5 : 0 }}
				transition={{ type: 'spring', stiffness: 320, damping: 28 }}
			>
				{/* 光晕层：模糊实心副本，仅用 opacity 淡入，无 filter 黑边 */}
				<Vegan
					size={ICON_SIZE}
					aria-hidden
					className="pointer-events-none absolute transition-opacity duration-300 ease-out"
					style={{
						color: lit,
						opacity: hovered ? 0.45 : 0,
						filter: 'blur(14px)',
						transform: 'scale(1.04)',
					}}
				/>
				<Vegan
					size={ICON_SIZE}
					className="relative transition-[color,opacity] duration-300 ease-out"
					style={{
						color: hovered ? lit : dim,
						opacity: hovered ? 1 : 0.1,
					}}
				/>
			</motion.div>

			<motion.div
				initial={false}
				animate={{ scale: hovered ? 1.02 : 1, y: hovered ? 5.5 : 0 }}
				transition={{
					type: 'spring',
					stiffness: 320,
					damping: 28,
					delay: 0.02,
				}}
				className="mt-2 text-center"
			>
				<div
					className="flex flex-col text-2xl font-bold transition-[color,opacity,text-shadow] duration-300 ease-out"
					style={{
						color: hovered ? lit : dim,
						opacity: hovered ? 1 : 0.15,
						textShadow: hovered
							? '0 0 14px color-mix(in oklch, var(--brand-accent-light) 50%, transparent), 0 0 32px color-mix(in oklch, var(--brand-accent) 28%, transparent)'
							: 'none',
					}}
				>
					ENGLISH AGENT
					<span>DNHYXC</span>
				</div>
			</motion.div>
		</div>
	);
}

type ScrollControls = {
	enableStickToBottom: () => void;
	flushScrollToBottom: (options?: { force?: boolean }) => void;
};

const EnglishAgentShareBar = observer(function EnglishAgentShareBar({
	shareSelection,
	shareFlow,
	setShareModelVisible,
}: {
	shareSelection: ReturnType<typeof useAssistantShare>['shareSelection'];
	shareFlow: ReturnType<typeof useAssistantShare>['shareFlow'];
	setShareModelVisible: Dispatch<SetStateAction<boolean>>;
}) {
	return (
		<AssistantShareBar
			messages={englishAgentStore.messages}
			checkboxId="english-learning-agent-share-all"
			shareSelection={shareSelection}
			shareFlow={shareFlow}
			setShareModelVisible={setShareModelVisible}
		/>
	);
});

function EnglishAgentScrollShell({
	scrollControlsRef,
	footerBody,
	shareChatNode,
	floatAbove,
	selectionSpeakGetItems,
	onSpeakContent,
	isCopyedId,
	onCopy,
	onSaveToKnowledge,
	allowAiShare,
	shareSelection,
	onShare,
	isSending,
	t,
}: {
	scrollControlsRef: RefObject<ScrollControls>;
	footerBody: ReactNode;
	shareChatNode: ReactNode;
	floatAbove: ReactNode;
	selectionSpeakGetItems: ReturnType<
		typeof useAssistantSelectionSpeak
	>['getSelectionContextMenuItems'];
	onSpeakContent?: (content: string) => void;
	isCopyedId: string | undefined;
	onCopy: (content: string, chatId: string) => void;
	onSaveToKnowledge: (message: Message) => void;
	allowAiShare: boolean;
	shareSelection: ReturnType<typeof useAssistantShare>['shareSelection'];
	onShare: (message?: Message) => void;
	isSending: boolean;
	t: (key: string, params?: Record<string, unknown>) => string;
}) {
	const streamTick = useEnglishAgentStreamTick();
	const messageCount = useEnglishAgentMessageCount();
	const isStreaming = useEnglishAgentIsStreaming();
	const isHydrating = useEnglishAgentIsHydrating();
	const sessionId = useEnglishAgentSessionId();
	const toolStatus = useEnglishAgentToolStatus();

	const idleFlushKey = useMemo((): string | null => {
		if (isHydrating) return null;
		if (messageCount === 0) return null;
		return `${sessionId ?? 'none'}-${messageCount}`;
	}, [isHydrating, sessionId, messageCount]);

	const {
		viewportRef: scrollViewportRef,
		scrollAreaHandlers,
		enableStickToBottom: enableStreamStickToBottom,
		flushScrollToBottom,
		scrollFabMode,
		onScrollFabClick,
	} = useAssistantScroll({
		contentRevision: streamTick,
		messageCount,
		isStreaming,
		resetKey: `english-learning:${sessionId ?? 'none'}`,
		idleFlushKey,
		scrollBehavior: 'auto',
	});

	scrollControlsRef.current.enableStickToBottom = enableStreamStickToBottom;
	scrollControlsRef.current.flushScrollToBottom = flushScrollToBottom;

	const conversationColumnActive = !isHydrating && messageCount > 0;

	const toolStatusBlock = toolStatus ? (
		<div className={cn('px-4.5 py-3', AGENT_MAX_WIDTH)}>
			<div className="w-full border border-theme/10 rounded-md bg-theme/5 text-textcolor/60 shrink-0 px-4 py-2 text-center text-sm">
				{toolStatus}
			</div>
		</div>
	) : null;

	return (
		<div
			className={cn(
				'relative flex h-full w-full flex-col overflow-hidden bg-theme-background',
			)}
		>
			<AssistantShell
				t={t}
				isLoading={isHydrating}
				loadingText={t('englishLearning.loading')}
				hasMessages={messageCount > 0}
				maxWidth={AGENT_MAX_WIDTH}
				emptyState={
					<div
						className={cn(
							AGENT_MAX_WIDTH,
							'text-textcolor/70 mx-auto flex w-full flex-1 flex-col justify-between self-stretch px-4.5 text-sm',
						)}
					>
						{/* 上段：Atom 介绍卡（保留原独立卡片样式） */}
						<div className="bg-theme/5 flex w-full gap-2 rounded-t-md border border-theme/5 p-3">
							<Atom
								size={18}
								className="mt-[3px] shrink-0 text-textcolor opacity-65"
								aria-hidden
							/>
							<div className="flex-1 text-sm leading-6">
								{t('englishLearning.intro')}
							</div>
						</div>
						{/* 下段：Logo 区域（透明！完全无背景/边框/圆角）
						 * 这里刻意不设任何背景、边框、rounded-b，让光晕与页面主背景自然融为一体，
						 * 避免容器边界和光晕产生方形对比；
						 * mt-4 保证图标距上段介绍卡有安全距离，避免发光贴边
						 */}
						<div
							className={cn(
								AGENT_MAX_WIDTH,
								'flex-1 w-full mb-4.5 pb-8 bg-theme/3 border-l border-r border-b border-theme/5 rounded-b-md',
							)}
						>
							<EnglishAgentLogo />
						</div>
					</div>
				}
				viewportRef={scrollViewportRef}
				scrollAreaHandlers={scrollAreaHandlers}
				className="mt-4.5"
				messageContainerClassName="px-4.5 pt-0"
				messageList={
					<EnglishAgentMessageList
						isCopyedId={isCopyedId}
						onCopy={onCopy}
						onSaveToKnowledge={onSaveToKnowledge}
						allowAiShare={allowAiShare}
						shareSelection={shareSelection}
						onShare={onShare}
						scrollViewportRef={
							scrollViewportRef as RefObject<HTMLElement | null>
						}
						isLoading={isSending}
						t={t}
						getSelectionContextMenuItems={selectionSpeakGetItems}
						onSpeakContent={onSpeakContent}
					/>
				}
				afterScroll={toolStatusBlock}
				footer={
					<AssistantFooter
						embedded={conversationColumnActive}
						containerClassName="px-4.5"
						maxWidth={AGENT_MAX_WIDTH}
						showScrollFab={
							conversationColumnActive && scrollFabMode !== 'hidden'
						}
						scrollFab={{
							mode: scrollFabMode,
							onClick: onScrollFabClick,
							toBottomLabel: t('englishLearning.assistant.scrollToBottom'),
							toTopLabel: t('englishLearning.assistant.scrollToTop'),
							variant: 'panel',
						}}
						floatAbove={floatAbove}
					>
						{footerBody}
						{shareChatNode}
					</AssistantFooter>
				}
			/>
			{!conversationColumnActive && toolStatus ? (
				<div className="border-theme/10 bg-theme/5 text-textcolor/60 shrink-0 border-t px-4 py-2 text-center text-sm">
					{toolStatus}
				</div>
			) : null}
		</div>
	);
}

/** observer 仅用于 userStore 等非流式字段；勿在 render 读 messages / content */
export const AgentPanel = observer(function AgentPanel({
	input,
	setInput,
	chatInputRef,
	focusInputAtEndKey = 0,
	sendMessage,
	onNewChat,
}: AgentPanelProps) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const { knowledgeStore, userStore } = useStore();
	const isLoggedIn = Boolean(userStore.userInfo?.id);
	const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
	const { isCopyedId, onCopy } = useAssistantCopy();
	const selectionSpeak = useAssistantSelectionSpeak();
	const isSending = useEnglishAgentIsSending();
	const isStreaming = useEnglishAgentIsStreaming();
	const sessionId = useEnglishAgentSessionId();
	const scrollControlsRef = useRef<ScrollControls>({
		enableStickToBottom: () => {},
		flushScrollToBottom: () => {},
	});

	useEffect(() => {
		if (!isLoggedIn) return;
		void englishAgentStore.refreshSessionList();
	}, [isLoggedIn]);

	useEffect(() => {
		if (!isHistoryDrawerOpen) return;
		void englishAgentStore.refreshSessionList();
	}, [isHistoryDrawerOpen]);

	const {
		allowAiShare,
		shareFlow,
		shareSelection,
		onShare,
		setShareModelVisible,
		shareChatNode,
	} = useAssistantShare({
		getAllMessages: getEnglishMessages,
		sessionId,
		sessionType: 'agent',
		enabled: isLoggedIn && Boolean(sessionId),
	});

	const onSaveToKnowledge = useCallback(
		(message: Message) => {
			const body = (message.content ?? '').trim();
			if (!body) {
				Toast({
					type: 'warning',
					title: t('knowledge.assistant.noBodyToWrite'),
				});
				return;
			}
			const cur = knowledgeStore.markdown.trimEnd();
			const next = cur ? `${cur}\n\n${body}\n` : `${body}\n`;
			knowledgeStore.setMarkdown(next);
			navigate('/knowledge');
		},
		[knowledgeStore, navigate, t],
	);

	const handleSendMessage = useCallback(async () => {
		scrollControlsRef.current.enableStickToBottom();
		await sendMessage();
	}, [sendMessage]);

	const handleNewChat = useCallback(() => {
		selectionSpeak.stop();
		onNewChat();
	}, [onNewChat, selectionSpeak.stop]);

	const enableStickToBottomStable = useCallback(() => {
		scrollControlsRef.current.enableStickToBottom();
	}, []);

	const flushScrollToBottomStable = useCallback(
		(options?: { force?: boolean }) => {
			scrollControlsRef.current.flushScrollToBottom(options);
		},
		[],
	);

	const footerBody = useMemo(() => {
		if (allowAiShare && shareSelection.isSharing) {
			return (
				<EnglishAgentShareBar
					shareSelection={shareSelection}
					shareFlow={shareFlow}
					setShareModelVisible={setShareModelVisible}
				/>
			);
		}
		return (
			<ChatEntry
				t={t}
				chatInputRef={chatInputRef}
				input={input}
				setInput={setInput}
				focusInputAtEndKey={focusInputAtEndKey}
				maxWidth={AGENT_MAX_WIDTH}
				className="w-full px-0 pb-4.5"
				textareaClassName="min-h-12 rounded-md"
				inputWrapClassName="border-theme/5 bg-theme/5"
				sendMessage={handleSendMessage}
				placeholder={t('englishLearning.placeholder')}
				disableTextInput={false}
				loading={isSending}
				stopGenerating={
					isStreaming ? () => englishAgentStore.stopGenerating() : undefined
				}
				entryChildren={
					<AssistantSessionEntryToolbar
						store="english"
						visible={isLoggedIn}
						showSessionActions
						isSessionSwitcherLocked={false}
						isHistoryDrawerOpen={isHistoryDrawerOpen}
						setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
						enableStreamStickToBottom={enableStickToBottomStable}
						flushScrollToBottom={flushScrollToBottomStable}
						onNewConversation={handleNewChat}
					/>
				}
			/>
		);
	}, [
		allowAiShare,
		shareSelection,
		shareFlow,
		setShareModelVisible,
		t,
		chatInputRef,
		input,
		setInput,
		focusInputAtEndKey,
		handleSendMessage,
		isSending,
		isStreaming,
		isLoggedIn,
		isHistoryDrawerOpen,
		enableStickToBottomStable,
		flushScrollToBottomStable,
		handleNewChat,
	]);

	return (
		<EnglishAgentScrollShell
			scrollControlsRef={scrollControlsRef}
			footerBody={footerBody}
			shareChatNode={shareChatNode}
			floatAbove={selectionSpeak.floatAbove}
			selectionSpeakGetItems={selectionSpeak.getSelectionContextMenuItems}
			onSpeakContent={selectionSpeak.start}
			isCopyedId={isCopyedId}
			onCopy={onCopy}
			onSaveToKnowledge={onSaveToKnowledge}
			allowAiShare={allowAiShare}
			shareSelection={shareSelection}
			onShare={onShare}
			isSending={isSending}
			t={t}
		/>
	);
});
