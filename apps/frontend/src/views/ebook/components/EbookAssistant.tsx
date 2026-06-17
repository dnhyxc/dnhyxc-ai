import Loading from '@design/Loading';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type RefObject,
	type UIEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import ChatEntry from '@/components/design/ChatEntry';
import { ScrollArea, Toast } from '@/components/ui';
import { useI18n, useStickToBottomScroll } from '@/hooks';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import assistantStore from '@/store/assistant';
import { KnowledgeAssistantEntryToolbar } from '@/views/knowledge/KnowledgeAssistantEntryToolbar';
import {
	KnowledgeMessageBubble,
	type SelectMessageByChatId,
} from '@/views/knowledge/KnowledgeMessageBubble';

export type EbookAssistantProps = {
	bookId: string;
	bookTitle: string;
	/** 右栏可见时激活会话（与知识库助手分栏一致，折叠时保留状态） */
	active?: boolean;
	input?: string;
	onInputChange?: (value: string) => void;
};

type EbookAssistantScrollCornerFabMode = 'hidden' | 'toBottom' | 'toTop';

export function ebookDocumentKey(bookId: string): string {
	return `ebook:${bookId}`;
}

const selectAssistantMessageByChatId: SelectMessageByChatId = (chatId) =>
	assistantStore.messages.find((m) => m.chatId === chatId);

const EbookAssistantInner = observer(function EbookAssistantInner({
	bookId,
	bookTitle,
	active = true,
	input: inputProp,
	onInputChange,
}: EbookAssistantProps) {
	const { userStore } = useStore();
	const { t } = useI18n();
	const documentKey = useMemo(() => ebookDocumentKey(bookId), [bookId]);
	const [internalInput, setInternalInput] = useState('');
	const input = inputProp ?? internalInput;
	const setInput = onInputChange ?? setInternalInput;
	const [isCopyedId, setIsCopyedId] = useState('');
	const [scrollCornerFabMode, setScrollCornerFabMode] =
		useState<EbookAssistantScrollCornerFabMode>('hidden');
	const scrollCornerFabModeRef =
		useRef<EbookAssistantScrollCornerFabMode>('hidden');
	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [isAiHistoryDrawerOpen, setIsAiHistoryDrawerOpen] = useState(false);

	const isLoggedIn = Boolean(userStore.userInfo?.id);
	const aiMessages = assistantStore.messages;
	const lastMsg = aiMessages[aiMessages.length - 1];
	const streamScrollTick =
		lastMsg != null
			? `${aiMessages.length}:${lastMsg.chatId}:${lastMsg.content.length}:${lastMsg.thinkContent?.length ?? 0}:${lastMsg.isStreaming ? 1 : 0}`
			: String(aiMessages.length);

	const aiIdleFlushKey = useMemo((): string | null => {
		if (assistantStore.isHistoryLoading) return null;
		if (aiMessages.length === 0) return null;
		const first = aiMessages[0];
		const last = aiMessages[aiMessages.length - 1];
		return `${documentKey}-${assistantStore.activeSessionId ?? ''}-${aiMessages.length}-${first?.chatId ?? ''}-${last?.chatId ?? ''}`;
	}, [
		documentKey,
		assistantStore.activeSessionId,
		assistantStore.isHistoryLoading,
		aiMessages.length,
		aiMessages[0]?.chatId,
		aiMessages[aiMessages.length - 1]?.chatId,
	]);

	const {
		viewportRef: scrollViewportRef,
		scrollViewportHandlers,
		enableStickToBottom: enableStreamStickToBottom,
		disableStickToBottom: disableStreamStickToBottom,
		flushScrollToBottom,
	} = useStickToBottomScroll({
		isStreaming: assistantStore.isStreaming,
		contentRevision: streamScrollTick,
		resetKey: documentKey
			? `${documentKey}:session:${assistantStore.activeSessionId ?? 'none'}`
			: undefined,
		idleFlushKey: aiIdleFlushKey,
	});

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
		};
	}, []);

	useEffect(() => {
		if (!active || !bookId) return;
		assistantStore.setKnowledgeAssistantPersistenceAllowed(true);
		void assistantStore.activateForDocument(documentKey);
	}, [active, bookId, documentKey]);

	useEffect(() => {
		if (!isAiHistoryDrawerOpen) return;
		void assistantStore.refreshSessionListForCurrentDocument();
	}, [isAiHistoryDrawerOpen]);

	const refreshScrollCornerFab = useCallback(() => {
		const vp = scrollViewportRef.current;
		if (!vp) return;
		const { scrollTop, scrollHeight, clientHeight } = vp;
		const maxScroll = scrollHeight - clientHeight;
		let nextMode: EbookAssistantScrollCornerFabMode = 'hidden';
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

	const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
		scrollViewportRef as RefObject<HTMLElement | null>,
		{
			layoutDeps: [streamScrollTick, documentKey, aiMessages.length],
			passiveScrollLayout: true,
			passiveScrollDeps: [
				documentKey,
				aiMessages.length,
				streamScrollTick,
				assistantStore.isStreaming,
			],
		},
	);

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
		documentKey,
		aiMessages.length,
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
				behavior: 'smooth',
			});
		} else if (scrollCornerFabMode === 'toTop') {
			disableStreamStickToBottom();
			vp.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}, [
		scrollViewportRef,
		enableStreamStickToBottom,
		disableStreamStickToBottom,
		scrollCornerFabMode,
	]);

	const onCopy = useCallback((content: string, chatId: string) => {
		navigator.clipboard.writeText(content);
		setIsCopyedId(chatId);
		copyTimerRef.current = setTimeout(() => {
			setIsCopyedId('');
		}, 500);
	}, []);

	const sendMessage = useCallback(
		async (content?: string) => {
			const text = (content ?? input).trim();
			if (!text) return;
			if (!isLoggedIn) {
				Toast({
					type: 'warning',
					title: t('knowledge.assistant.loginToUse'),
				});
				return;
			}
			setInput('');
			enableStreamStickToBottom();
			await assistantStore.sendMessage(text, {
				extraUserContentForModel: t('ebook.read.assistant.systemHint', {
					title: bookTitle,
				}),
			});
		},
		[input, setInput, isLoggedIn, enableStreamStickToBottom, bookTitle, t],
	);

	const stopGenerating = useCallback(() => {
		void assistantStore.stopGenerating();
	}, []);

	const showAiSessionActions =
		isLoggedIn &&
		assistantStore.knowledgeAssistantPersistenceAllowed &&
		Boolean(assistantStore.sessionListForActiveDocument);

	const isAiSessionSwitcherLocked =
		showAiSessionActions && assistantStore.isAssistantSessionSwitcherLocked;

	const conversationColumnActive = !(
		assistantStore.isHistoryLoading || aiMessages.length === 0
	);

	const renderAssistantFooter = (embeddedInConversationColumn: boolean) => (
		<div
			className={cn(
				'min-w-0 w-full',
				embeddedInConversationColumn && 'shrink-0',
			)}
		>
			<div className="relative mx-auto min-w-0 w-full max-w-3xl pl-4 pr-4">
				{aiMessages.length > 0 && scrollCornerFabMode !== 'hidden' ? (
					<button
						type="button"
						className="absolute bottom-[calc(100%+1.2rem)] right-4 z-10 flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/70 backdrop-blur-[2px] hover:bg-theme/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40"
						aria-label={
							scrollCornerFabMode === 'toBottom'
								? t('knowledge.assistant.scrollToBottom')
								: t('knowledge.assistant.scrollToTop')
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
				<ChatEntry
					t={t}
					input={input}
					setInput={setInput}
					className="w-full px-0 pb-4.5"
					textareaClassName="min-h-9"
					inputWrapClassName="border-theme/5"
					sendMessage={sendMessage}
					placeholder={t('ebook.read.assistant.placeholder')}
					disableTextInput={false}
					loading={assistantStore.isSending || assistantStore.isHistoryLoading}
					stopGenerating={
						assistantStore.isStreaming ? stopGenerating : undefined
					}
					entryChildren={
						<KnowledgeAssistantEntryToolbar
							showEntryToolbar={isLoggedIn}
							showAiSessionActions={showAiSessionActions}
							isAiSessionSwitcherLocked={isAiSessionSwitcherLocked}
							isAiHistoryDrawerOpen={isAiHistoryDrawerOpen}
							setIsAiHistoryDrawerOpen={setIsAiHistoryDrawerOpen}
							enableStreamStickToBottom={enableStreamStickToBottom}
							flushScrollToBottom={flushScrollToBottom}
							assistantMode="ai"
							setAssistantMode={() => {}}
							showAssistantModeSwitch={false}
						/>
					}
				/>
			</div>
		</div>
	);

	return (
		<div className="relative flex h-full w-full flex-col overflow-hidden">
			<ChatCodeFloatingToolbar t={t} />
			{assistantStore.isHistoryLoading ? (
				<div className="text-textcolor/70 flex flex-1 items-center justify-center text-sm">
					<Loading text={t('knowledge.assistant.loadingConversation')} />
				</div>
			) : !aiMessages.length ? (
				<div className="text-textcolor/70 flex flex-1 justify-center items-start text-sm pt-4">
					<div className="max-w-3xl w-full mx-auto pl-4 pr-4">
						<div className="flex w-full justify-between rounded-md border border-theme/5 bg-theme/2 p-2">
							<Sparkles
								size={18}
								className="mr-2 mt-0.5 shrink-0 text-teal-500"
							/>
							<div className="flex-1 leading-relaxed">
								{t('ebook.read.assistant.intro', { title: bookTitle })}
							</div>
						</div>
					</div>
				</div>
			) : (
				<div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
					<ScrollArea
						ref={scrollViewportRef}
						className="min-h-0 min-w-0 w-full flex-1 mb-0.5"
						viewportClassName="pb-1 [overflow-anchor:none]"
						{...scrollAreaHandlers}
					>
						<div className="relative mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-col px-3.5 pt-4 select-none">
							{aiMessages.map((message, index) => (
								<KnowledgeMessageBubble
									key={message.chatId}
									selectMessageByChatId={selectAssistantMessageByChatId}
									t={t}
									chatId={message.chatId}
									index={index}
									messagesLength={aiMessages.length}
									isCopyedId={isCopyedId}
									onCopy={onCopy}
									scrollViewportRef={
										scrollViewportRef as RefObject<HTMLElement | null>
									}
								/>
							))}
						</div>
					</ScrollArea>
					{isLoggedIn ? renderAssistantFooter(true) : null}
				</div>
			)}
			{isLoggedIn && !conversationColumnActive
				? renderAssistantFooter(false)
				: null}
		</div>
	);
});

export function EbookAssistant(props: EbookAssistantProps) {
	if (!props.bookId) return null;
	return <EbookAssistantInner {...props} />;
}
