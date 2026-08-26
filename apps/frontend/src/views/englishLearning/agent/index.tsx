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
	sendMessage: () => void | Promise<void>;
	onNewChat: () => void;
};

const getEnglishMessages = () => englishAgentStore.messages;

/**
 * English Agent 空态 Logo：纯 2D 点亮效果
 *
 *  - 静止：完全保持原静态样式（text-teal-500 + opacity-10/15），不变
 *  - 点亮：所有高亮色均由项目情调色 --brand-accent 通过 color-mix 派生
 *
 *  关键两点（解决「改宽度被切方形」+「光晕高亮不同步」）：
 *   1) 图标外层包一个「padding buffer」盒子，
 *      每个方向的 padding 都大于最大 drop-shadow 半径，
 *      所有发光完全落在盒子内部，外层多少层 overflow:hidden 都切不到方形；
 *   2) color / opacity / filter 全部写在 Vegan 同一个 style 上、同一条 transition，
 *      过渡完全同步，不会出现「图标先亮、光晕后亮」的错位。
 */
function EnglishAgentLogo() {
	const [hovered, setHovered] = useState(false);
	const ICON_SIZE = 180; // 避免窄屏贴到上段介绍卡

	// 光晕最大模糊半径：24px  →  padding 每个方向都 ≥ 40px（1.6 倍安全余量）
	// 确保最外圈模糊完全落在盒内，外层任何裁切都碰不到发光像素
	const BUFFER_PAD = '35px 56px 10px'; // 上下 40 / 左右 56（左右稍多更保险）

	return (
		<div
			className="w-full h-full flex flex-col items-center justify-center cursor-pointer select-none"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{/* 包装层：padding buffer + 整体 scale
			 * 这里只负责布局、放大动画；发光/颜色过渡全部在 Vegan 自己身上
			 */}
			<motion.div
				className="flex items-center justify-center"
				style={{ padding: BUFFER_PAD }}
				initial={false}
				animate={{ scale: hovered ? 1.06 : 1, y: hovered ? -5.5 : 0 }}
				transition={{ duration: 0.4, ease: 'easeOut' }}
			>
				<Vegan
					size={ICON_SIZE}
					style={{
						// ——— 颜色 + 透明度（静止=原样式，hover=点亮）———
						color: hovered
							? 'color-mix(in oklch, var(--brand-accent) 52%, white)'
							: 'var(--color-teal-500)',
						opacity: hovered ? 1 : 0.1,

						// ——— 沿轮廓发光（全部 drop-shadow，半径严格 ≤ 24 < buffer 40，安全）———
						// 静止：无任何发光
						// 点亮：浮雕(1px深阴影) → 近距5px → 中距12px → 远距22px
						//       光晕沿 Vegan 路径 alpha 自然扩散，不是方形块
						filter: hovered
							? // 浮雕：底色 accent-dark（浓度略减）
								'drop-shadow(0 0.8px 0 color-mix(in oklch, var(--brand-accent) 72%, black))' +
								// 微层：次深色软投影
								' drop-shadow(0 0.5px 0.5px rgba(2,44,34,0.45))' +
								// 近距：7px，浓度 55%（颜色更浅更透亮）
								' drop-shadow(0 0 5px color-mix(in oklch, var(--brand-accent-light) 55%, transparent))' +
								// 中距：16px，浓度 43%
								' drop-shadow(0 0 20px color-mix(in oklch, var(--brand-accent) 43%, transparent))' +
								// 远距：28px，浓度 28%（更浅更柔）
								' drop-shadow(0 0 10px color-mix(in oklch, var(--brand-accent-soft) 28%, transparent))'
							: 'none',

						// ——— 统一过渡：color/opacity/filter 同时触发，绝对同步 ———
						transition:
							'color 0.4s ease-out, opacity 0.4s ease-out, filter 0.4s ease-out',
					}}
				/>
			</motion.div>

			{/* 文字：静止=原样式；hover=点亮（渐变全部基于 brand-accent 派生）
			 * 文字同样统一过渡同步：background渐变 + filter发光 同一条 transition */}
			<motion.div
				initial={false}
				animate={{
					scale: hovered ? 1.02 : 1,
					y: hovered ? 5.5 : 0,
				}}
				transition={{ duration: 0.4, ease: 'easeOut', delay: 0.04 }}
				className="mt-2 text-center"
			>
				{/* 静止：完全还原原 emptyState — text-teal-500 opacity-15 */}
				{!hovered ? (
					<div
						className="flex flex-col text-2xl font-bold text-teal-500"
						style={{ opacity: 0.15 }}
					>
						ENGLISH AGENT
						<span>DNHYXC</span>
					</div>
				) : (
					// 点亮：颜色与图标主体严格对齐（图标主色= accent 52% + 白）
					//   - 背景渐变：全部围绕「图标主色 ± 一点白」，不引入深绿/暗底
					//   - drop-shadow：浮雕/近/中三层浓度和图标一致 (72% / 55% / 43%)
					<div
						className="text-2xl font-bold flex flex-col"
						style={{
							background:
								'linear-gradient(180deg, ' +
								// 顶部：比图标主色再多 10% 白（极轻微提亮，保持同色）
								'color-mix(in oklch, var(--brand-accent) 42%, white) 0%, ' +
								// 中部 55%：= 图标主色 accent 52% 白
								'color-mix(in oklch, var(--brand-accent) 52%, white) 55%, ' +
								// 底部：= 图标主色，不引入 accent+black 深绿
								'color-mix(in oklch, var(--brand-accent) 52%, white) 100%)',
							WebkitBackgroundClip: 'text',
							WebkitTextFillColor: 'transparent',
							backgroundClip: 'text',
							// 文字发光：和图标用同一套浓度比例，颜色严格一致
							filter:
								'drop-shadow(0 0.8px 0 color-mix(in oklch, var(--brand-accent) 72%, black))' +
								' drop-shadow(0 0 6.5px color-mix(in oklch, var(--brand-accent-light) 65%, transparent))' +
								' drop-shadow(0 0 9px color-mix(in oklch, var(--brand-accent) 35%, transparent))',
							transition:
								'filter 0.4s ease-out, color 0.4s ease-out, background 0.4s ease-out, opacity 0.4s ease-out',
						}}
					>
						ENGLISH AGENT
						<span>DNHYXC</span>
					</div>
				)}
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
		<div className="max-w-3xl px-4.5 py-3">
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
				emptyState={
					<div className="text-textcolor/70 mx-auto flex max-w-3xl w-full flex-1 flex-col justify-between self-stretch px-4.5 text-sm">
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
						<div className="flex-1 w-full mb-4.5 pb-8 bg-theme/3 border-l border-r border-b border-theme/5 rounded-b-md">
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
						showScrollFab={
							conversationColumnActive && scrollFabMode !== 'hidden'
						}
						scrollFab={{
							mode: scrollFabMode,
							onClick: onScrollFabClick,
							toBottomLabel: t('englishLearning.assistant.scrollToBottom'),
							toTopLabel: t('englishLearning.assistant.scrollToTop'),
							variant: 'english',
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
