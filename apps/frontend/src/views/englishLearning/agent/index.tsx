/**
 * 英语学习页右侧 Agent 对话区：布局与交互对齐知识库「KnowledgeAssistant」
 *（贴底滚动、代码块浮动工具栏、角落上/下滚动、空态卡片、双段 footer + ChatEntry）。
 *
 * 流式时消息列与输入区解耦：streamTick 只驱动滚动壳，ChatEntry 元素引用保持稳定，避免输入卡顿。
 */
import ChatEntry from '@design/ChatEntry';
import { Toast } from '@ui/index';
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
						<div className="border-theme/5 bg-theme/5 flex w-full gap-2 rounded-md border p-3">
							<Atom
								size={18}
								className="mt-[3px] shrink-0 text-teal-500 opacity-80"
								aria-hidden
							/>
							<div className="flex-1 text-sm leading-relaxed">
								{t('englishLearning.intro')}
							</div>
						</div>
						<div className="flex-1 flex flex-col items-center justify-center">
							<Vegan className="size-50 text-teal-500 opacity-10" />
							<div className="text-3xl font-bold text-teal-500 opacity-15">
								ENGLISH AGENT
							</div>
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
