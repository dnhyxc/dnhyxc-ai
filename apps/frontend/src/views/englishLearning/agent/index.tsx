/**
 * 英语学习页右侧 Agent 对话区：布局与交互对齐知识库「KnowledgeAssistant」
 *（贴底滚动、代码块浮动工具栏、角落上/下滚动、空态卡片、双段 footer + ChatEntry）。
 */
import ChatEntry from '@design/ChatEntry';
import { Toast } from '@ui/index';
import { Atom, Vegan } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import {
	AssistantFooter,
	AssistantMessageRow,
	AssistantSessionEntryToolbar,
	AssistantShareBar,
	AssistantShell,
	type SelectMessageByChatId,
	useAssistantShare,
} from '@/components/design/Assistant';
import { useAssistantCopy, useAssistantScroll, useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import englishAgentStore from '@/store/englishAgent';
import type { Message } from '@/types/chat';

export type AgentPanelProps = {
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	chatInputRef: RefObject<HTMLTextAreaElement | null>;
	sendMessage: () => void | Promise<void>;
	onNewChat: () => void;
};

const selectEnglishMessageByChatId: SelectMessageByChatId = (chatId) =>
	englishAgentStore.messages.find((m) => m.chatId === chatId);

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
	} = useAssistantShare({
		messages,
		sessionId: englishAgentStore.sessionId,
		sessionType: 'agent',
		enabled: isLoggedIn && Boolean(englishAgentStore.sessionId),
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

	const idleFlushKey = useMemo((): string | null => {
		if (isHydrating) return null;
		if (messages.length === 0) return null;
		return `${englishAgentStore.sessionId ?? 'none'}-${messages.length}`;
	}, [isHydrating, englishAgentStore.sessionId, messages.length]);

	const {
		viewportRef: scrollViewportRef,
		scrollAreaHandlers,
		enableStickToBottom: enableStreamStickToBottom,
		flushScrollToBottom,
		scrollFabMode,
		onScrollFabClick,
	} = useAssistantScroll({
		messages,
		isStreaming: englishAgentStore.isStreaming,
		resetKey: `english-learning:${englishAgentStore.sessionId ?? 'none'}`,
		idleFlushKey,
		scrollBehavior: 'auto',
	});

	const handleSendMessage = useCallback(async () => {
		enableStreamStickToBottom();
		await sendMessage();
	}, [sendMessage, enableStreamStickToBottom]);

	const conversationColumnActive = !isHydrating && messages.length > 0;

	const assistantFooter = (
		<AssistantFooter
			embedded={conversationColumnActive}
			containerClassName="px-4.5"
			showScrollFab={conversationColumnActive && scrollFabMode !== 'hidden'}
			scrollFab={{
				mode: scrollFabMode,
				onClick: onScrollFabClick,
				toBottomLabel: t('englishLearning.assistant.scrollToBottom'),
				toTopLabel: t('englishLearning.assistant.scrollToTop'),
				variant: 'english',
			}}
		>
			{allowAiShare && shareSelection.isSharing ? (
				<AssistantShareBar
					messages={messages}
					checkboxId="english-learning-agent-share-all"
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
					className="w-full px-0 pb-4.5"
					textareaClassName="min-h-12 rounded-md"
					inputWrapClassName="border-theme/5 bg-theme/5"
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
						<AssistantSessionEntryToolbar
							store="english"
							visible={isLoggedIn}
							showSessionActions
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
		</AssistantFooter>
	);

	const toolStatusBlock = englishAgentStore.toolStatus ? (
		<div className="max-w-3xl px-4.5 py-3">
			<div className="w-full border border-theme/10 rounded-md bg-theme/5 text-textcolor/60 shrink-0 px-4 py-2 text-center text-sm">
				{englishAgentStore.toolStatus}
			</div>
		</div>
	) : null;

	return (
		<div
			className={cn(
				'relative flex h-full w-full flex-col overflow-hidden border-l border-theme/10 bg-theme-background',
			)}
		>
			<AssistantShell
				t={t}
				isLoading={isHydrating}
				loadingText={t('englishLearning.loading')}
				hasMessages={messages.length > 0}
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
				messageList={messages.map((m, index) => (
					<AssistantMessageRow
						key={m.chatId}
						selectMessageByChatId={selectEnglishMessageByChatId}
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
						variant="english"
						t={t}
					/>
				))}
				afterScroll={toolStatusBlock}
				footer={assistantFooter}
			/>
			{!conversationColumnActive && englishAgentStore.toolStatus ? (
				<div className="border-theme/10 bg-theme/5 text-textcolor/60 shrink-0 border-t px-4 py-2 text-center text-sm">
					{englishAgentStore.toolStatus}
				</div>
			) : null}
		</div>
	);
});
