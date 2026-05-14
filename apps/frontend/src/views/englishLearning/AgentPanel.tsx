/**
 * 英语学习页右侧 Agent 对话区：布局与交互对齐知识库「KnowledgeAssistant」
 *（贴底滚动、代码块浮动工具栏、角落上/下滚动、空态卡片、双段 footer + ChatEntry）。
 */
import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatEntry from '@design/ChatEntry';
import ChatMessageActions from '@design/ChatMessageActions';
import Loading from '@design/Loading';
import { Label, ScrollArea, Toast } from '@ui/index';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	type UIEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useI18n, useStickToBottomScroll } from '@/hooks';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import englishAgentStore from '@/store/englishAgent';
import type { ChatI18nT, Message } from '@/types/chat';
import { EntryToolbar } from './EntryToolbar';
import { ShareBar, useSessionShare } from './ShareBar';

type EnglishAgentScrollCornerFabMode = 'hidden' | 'toBottom' | 'toTop';

export type AgentPanelProps = {
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	chatInputRef: RefObject<HTMLTextAreaElement | null>;
	sendMessage: () => void | Promise<void>;
	onNewChat: () => void;
};

type EnglishAgentShareSelectionLike = {
	isSharing: boolean;
	checkedMessages: Set<string>;
	setCheckedMessage?: (message: Message) => void;
};

const EnglishLearningMessageRow = observer(function EnglishLearningMessageRow({
	chatId,
	index,
	messagesLength,
	isCopyedId,
	onCopy,
	isLoading,
	onSaveToKnowledge,
	allowAiShare,
	shareSelection,
	onShare,
	scrollViewportRef,
	t,
}: {
	chatId: string;
	index: number;
	messagesLength: number;
	isCopyedId: string;
	onCopy: (content: string, chatId: string) => void;
	isLoading: boolean;
	onSaveToKnowledge: (message: Message) => void;
	allowAiShare: boolean;
	shareSelection?: EnglishAgentShareSelectionLike;
	onShare?: (message?: Message) => void;
	scrollViewportRef: RefObject<HTMLElement | null>;
	t: ChatI18nT;
}) {
	const message = englishAgentStore.messages.find((m) => m.chatId === chatId);
	if (!message) return null;

	const isSharing = allowAiShare ? Boolean(shareSelection?.isSharing) : false;
	const checkedMessages = allowAiShare
		? (shareSelection?.checkedMessages ?? new Set<string>())
		: new Set<string>();
	const setCheckedMessage =
		allowAiShare && isSharing ? shareSelection?.setCheckedMessage : undefined;
	const needShare = allowAiShare && !isSharing;

	const streamRev =
		message.role === 'assistant'
			? `${message.content.length}:${message.thinkContent?.length ?? 0}:${message.isStreaming ? 1 : 0}`
			: `${message.content.length}`;

	return (
		<div
			className={cn(
				'relative flex w-full min-w-0 max-w-full flex-1 flex-col gap-1 pb-10 group last:pb-8.5',
				message.role === 'user' ? 'items-end' : 'items-stretch',
			)}
			data-msg-rev={streamRev}
		>
			<Label
				htmlFor={message.chatId}
				className={cn(
					'message-md-wrap relative mb-5 flex min-w-0 max-w-full select-auto rounded-md p-4 text-textcolor',
					message.role === 'user'
						? 'w-fit max-w-[min(100%,36rem)] border border-teal-500/20 bg-teal-500/8 px-4 pt-2 pb-2.5'
						: 'w-full border border-theme/12 bg-theme-secondary/60 py-3',
				)}
			>
				{message.role === 'user' ? (
					<ChatAssistantMessage
						message={message}
						t={t}
						className="min-w-0 max-w-full text-left [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full [&_.markdown-body]:overflow-x-auto"
					/>
				) : (
					<ChatAssistantMessage
						message={message}
						scrollViewportRef={scrollViewportRef}
						t={t}
					/>
				)}

				{!message.isStreaming ? (
					<div
						className={cn(
							'absolute -bottom-9',
							message.role === 'user' ? 'right-0' : 'left-0',
						)}
					>
						<ChatMessageActions
							message={message}
							index={index}
							isCopyedId={isCopyedId}
							messagesLength={messagesLength}
							isLoading={isLoading}
							needShare={needShare}
							onShare={needShare ? onShare : undefined}
							isSharing={isSharing}
							checkedMessages={checkedMessages}
							setCheckedMessage={setCheckedMessage}
							onCopy={onCopy}
							onSaveToKnowledge={onSaveToKnowledge}
							t={t}
						/>
					</div>
				) : null}
			</Label>
		</div>
	);
});

export const AgentPanel = observer(function AgentPanel({
	input,
	setInput,
	chatInputRef,
	sendMessage,
	onNewChat,
}: AgentPanelProps) {
	const { t } = useI18n();
	const { knowledgeStore, userStore } = useStore();
	const isLoggedIn = Boolean(userStore.userInfo?.id);
	const [scrollCornerFabMode, setScrollCornerFabMode] =
		useState<EnglishAgentScrollCornerFabMode>('hidden');
	const scrollCornerFabModeRef =
		useRef<EnglishAgentScrollCornerFabMode>('hidden');
	const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
	const [isCopyedId, setIsCopyedId] = useState('');
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!isLoggedIn) return;
		void englishAgentStore.refreshSessionList();
	}, [isLoggedIn]);

	useEffect(() => {
		if (!isHistoryDrawerOpen) return;
		void englishAgentStore.refreshSessionList();
	}, [isHistoryDrawerOpen]);

	const messages = englishAgentStore.messages;
	const isHydrating = englishAgentStore.isHydrating;

	const {
		allowAiShare,
		shareFlow,
		shareSelection,
		onShare,
		setShareModelVisible,
		shareChatNode,
	} = useSessionShare({
		messages,
		sessionId: englishAgentStore.sessionId,
		isLoggedIn,
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
			Toast({
				type: 'success',
				title: t('knowledge.assistant.appendedToCurrentDoc'),
			});
		},
		[knowledgeStore, t],
	);

	const lastMsg = messages[messages.length - 1];
	const streamScrollTick =
		lastMsg != null
			? `${messages.length}:${lastMsg.chatId}:${lastMsg.content.length}:${lastMsg.thinkContent?.length ?? 0}:${lastMsg.isStreaming ? 1 : 0}`
			: String(messages.length);

	const idleFlushKey = useMemo((): string | null => {
		if (isHydrating) return null;
		if (messages.length === 0) return null;
		const first = messages[0];
		const last = messages[messages.length - 1];
		return `${englishAgentStore.sessionId ?? 'none'}-${messages.length}-${first?.chatId ?? ''}-${last?.chatId ?? ''}`;
	}, [
		isHydrating,
		englishAgentStore.sessionId,
		messages.length,
		messages[0]?.chatId,
		messages[messages.length - 1]?.chatId,
	]);

	const {
		viewportRef: scrollViewportRef,
		scrollViewportHandlers,
		enableStickToBottom: enableStreamStickToBottom,
		disableStickToBottom: disableStreamStickToBottom,
		flushScrollToBottom,
	} = useStickToBottomScroll({
		isStreaming: englishAgentStore.isStreaming,
		contentRevision: streamScrollTick,
		resetKey: `english-learning:${englishAgentStore.sessionId ?? 'none'}`,
		idleFlushKey,
	});

	const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
		scrollViewportRef as RefObject<HTMLElement | null>,
		{
			layoutDeps: [
				streamScrollTick,
				messages.length,
				englishAgentStore.isStreaming,
			],
			passiveScrollLayout: true,
			passiveScrollDeps: [
				messages.length,
				streamScrollTick,
				englishAgentStore.isStreaming,
			],
		},
	);

	const refreshScrollCornerFab = useCallback(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;
		const { scrollTop, scrollHeight, clientHeight } = vp;
		const maxScroll = scrollHeight - clientHeight;
		let nextMode: EnglishAgentScrollCornerFabMode = 'hidden';
		if (maxScroll <= 4) {
			nextMode = 'hidden';
		} else {
			const threshold = 8;
			nextMode = scrollTop >= maxScroll - threshold ? 'toTop' : 'toBottom';
		}
		if (scrollCornerFabModeRef.current !== nextMode) {
			scrollCornerFabModeRef.current = nextMode;
			setScrollCornerFabMode(nextMode);
		}
	}, [scrollViewportRef]);

	const scrollAreaHandlers = useMemo(() => {
		const { onScroll: onViewportScroll, ...rest } = scrollViewportHandlers;
		return {
			...rest,
			onScroll: (e: UIEvent<HTMLDivElement>) => {
				onViewportScroll(e);
				relayoutCodeToolbar();
				refreshScrollCornerFab();
			},
		};
	}, [scrollViewportHandlers, relayoutCodeToolbar, refreshScrollCornerFab]);

	useEffect(() => {
		let ro: ResizeObserver | null = null;
		const tid = window.setTimeout(() => {
			refreshScrollCornerFab();
			requestAnimationFrame(() => refreshScrollCornerFab());
			const vp = scrollViewportRef.current;
			if (vp) {
				ro = new ResizeObserver(() => refreshScrollCornerFab());
				ro.observe(vp);
			}
		}, 0);
		return () => {
			window.clearTimeout(tid);
			ro?.disconnect();
		};
	}, [
		streamScrollTick,
		messages.length,
		refreshScrollCornerFab,
		scrollViewportRef,
	]);

	const onScrollCornerFabClick = useCallback(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;
		if (scrollCornerFabMode === 'toBottom') {
			enableStreamStickToBottom();
			vp.scrollTo({
				top: vp.scrollHeight - vp.clientHeight,
				behavior: 'auto',
			});
		} else if (scrollCornerFabMode === 'toTop') {
			disableStreamStickToBottom();
			vp.scrollTo({ top: 0, behavior: 'auto' });
		}
	}, [
		scrollViewportRef,
		enableStreamStickToBottom,
		disableStreamStickToBottom,
		scrollCornerFabMode,
	]);

	const handleSendMessage = useCallback(async () => {
		enableStreamStickToBottom();
		await sendMessage();
	}, [sendMessage, enableStreamStickToBottom]);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current != null) {
				clearTimeout(copyTimerRef.current);
			}
		};
	}, []);

	const onCopy = useCallback((content: string, chatId: string) => {
		void navigator.clipboard.writeText(content);
		setIsCopyedId(chatId);
		if (copyTimerRef.current != null) {
			clearTimeout(copyTimerRef.current);
		}
		copyTimerRef.current = setTimeout(() => setIsCopyedId(''), 500);
	}, []);

	const conversationColumnActive = !isHydrating && messages.length > 0;

	const renderAssistantFooter = (embeddedInConversationColumn: boolean) => (
		<div
			className={cn(
				'min-w-0 w-full',
				embeddedInConversationColumn && 'shrink-0',
			)}
		>
			<div className="relative mx-auto min-w-0 w-full max-w-3xl px-4.5">
				{messages.length > 0 && scrollCornerFabMode !== 'hidden' ? (
					<button
						type="button"
						className={cn(
							'absolute bottom-full right-4 z-10 mb-3.5 flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/70 backdrop-blur-[2px] hover:bg-theme/15',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
						)}
						aria-label={
							scrollCornerFabMode === 'toBottom'
								? t('englishLearning.assistant.scrollToBottom')
								: t('englishLearning.assistant.scrollToTop')
						}
						onClick={onScrollCornerFabClick}
					>
						{scrollCornerFabMode === 'toBottom' ? (
							<ChevronDown aria-hidden />
						) : (
							<ChevronUp aria-hidden />
						)}
					</button>
				) : null}
				{allowAiShare && shareSelection.isSharing ? (
					<ShareBar
						messages={messages}
						shareSelection={shareSelection}
						shareFlow={shareFlow}
						setShareModelVisible={setShareModelVisible}
					/>
				) : (
					<ChatEntry
						t={t}
						chatInputRef={chatInputRef}
						input={input}
						setInput={setInput}
						className="w-full px-0 pb-4.5 border-theme/10"
						textareaClassName="min-h-12 rounded-md"
						sendMessage={handleSendMessage}
						placeholder={t('englishLearning.placeholder')}
						disableTextInput={false}
						loading={englishAgentStore.isSending}
						stopGenerating={
							englishAgentStore.isStreaming
								? () => englishAgentStore.stopGenerating()
								: undefined
						}
						entryChildren={
							<EntryToolbar
								showSessionActions={isLoggedIn}
								isSessionSwitcherLocked={
									englishAgentStore.isEnglishSessionSwitcherLocked
								}
								isHistoryDrawerOpen={isHistoryDrawerOpen}
								setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
								enableStreamStickToBottom={enableStreamStickToBottom}
								flushScrollToBottom={flushScrollToBottom}
								onNewConversation={onNewChat}
							/>
						}
					/>
				)}
				{shareChatNode}
			</div>
		</div>
	);

	return (
		<div
			className={cn(
				'relative flex h-full w-full flex-col overflow-hidden border-l border-theme/10 bg-theme-background',
			)}
		>
			<ChatCodeFloatingToolbar t={t} />
			{isHydrating ? (
				<div className="text-textcolor/70 flex flex-1 items-center justify-center text-sm">
					<Loading text={t('englishLearning.loading')} />
				</div>
			) : messages.length === 0 ? (
				<div className="text-textcolor/70 mx-auto flex max-w-3xl w-full flex-1 items-start justify-center self-stretch pt-4.5 px-4.5 text-sm">
					<div className="border-theme/10 bg-theme/5 flex w-full gap-2 rounded-md border p-3">
						<BookOpen
							size={18}
							className="mt-[3px] shrink-0 text-teal-500"
							aria-hidden
						/>
						<div className="flex-1 text-sm leading-relaxed">
							{t('englishLearning.intro')}
						</div>
					</div>
				</div>
			) : (
				<div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
					{/*
							ScrollArea 占满面板宽度，滚动条贴右侧；max-w-3xl 仅约束内容区（与 KnowledgeAssistant 注释一致）。
						*/}
					<ScrollArea
						ref={scrollViewportRef}
						className="mb-0.5 min-h-0 min-w-0 w-full flex-1 border-0"
						viewportClassName="pb-1 [overflow-anchor:none]"
						{...scrollAreaHandlers}
					>
						<div className="relative mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-col select-none pt-4.5 px-4.5">
							{messages.map((m, index) => (
								<EnglishLearningMessageRow
									key={m.chatId}
									chatId={m.chatId}
									index={index}
									messagesLength={messages.length}
									isCopyedId={isCopyedId}
									onCopy={onCopy}
									isLoading={englishAgentStore.isSending}
									onSaveToKnowledge={onSaveToKnowledge}
									allowAiShare={allowAiShare}
									shareSelection={shareSelection}
									onShare={onShare}
									scrollViewportRef={
										scrollViewportRef as RefObject<HTMLElement | null>
									}
									t={t}
								/>
							))}
						</div>
					</ScrollArea>
					{englishAgentStore.toolStatus ? (
						<div className="border-theme/10 bg-theme/5 text-textcolor/60 shrink-0 border-t px-4 py-2 text-center text-sm">
							{englishAgentStore.toolStatus}
						</div>
					) : null}
					{renderAssistantFooter(true)}
				</div>
			)}
			{!conversationColumnActive && englishAgentStore.toolStatus ? (
				<div className="border-theme/10 bg-theme/5 text-textcolor/60 shrink-0 border-t px-4 py-2 text-center text-sm">
					{englishAgentStore.toolStatus}
				</div>
			) : null}
			{!conversationColumnActive ? renderAssistantFooter(false) : null}
		</div>
	);
});
