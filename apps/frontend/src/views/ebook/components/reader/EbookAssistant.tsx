import { Sparkles } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type RefObject,
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
import ChatEntry from '@/components/design/ChatEntry';
import Loading from '@/components/design/Loading';
import { useAssistantSelectionSpeak } from '@/components/design/SelectionSpeak';
import { Toast } from '@/components/ui';
import { useI18n } from '@/hooks';
import { useAssistantCopy } from '@/hooks/useAssistantCopy';
import { useAssistantScroll } from '@/hooks/useAssistantScroll';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import ebookAssistantStore from '@/store/ebookAssistant';
import type { Message } from '@/types/chat';
import { EPUB_ASSISTANT_INPUT_ID } from '../../utils/common/epubThoughtComposeInput';
import {
	epubReaderChromeTextareaClass,
	epubReaderSurfaceOverlayClass,
} from '../../utils/epub/reader/epubReaderSettings';

export type EbookAssistantProps = {
	bookId: string;
	bookTitle: string;
	input?: string;
	onInputChange?: (value: string) => void;
	/** 选区朗读开播前（听书页用来先停章节听书） */
	onBeforeSelectionSpeak?: () => void;
	/** 向外暴露 stop，供听书开播前停问书朗读 */
	selectionSpeakStopRef?: RefObject<(() => void) | null>;
};

const selectEbookMessageByChatId: SelectMessageByChatId = (chatId) =>
	ebookAssistantStore.messages.find((m) => m.chatId === chatId);

const EbookAssistantInner = observer(function EbookAssistantInner({
	bookId,
	bookTitle,
	input: inputProp,
	onInputChange,
	onBeforeSelectionSpeak,
	selectionSpeakStopRef,
}: EbookAssistantProps) {
	const { userStore, knowledgeStore } = useStore();
	const navigate = useNavigate();
	const { t } = useI18n();
	const [internalInput, setInternalInput] = useState('');
	const input = inputProp ?? internalInput;
	const setInput = onInputChange ?? setInternalInput;
	const { isCopyedId, onCopy } = useAssistantCopy();
	const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
	const selectionSpeak = useAssistantSelectionSpeak({
		onBeforeStart: onBeforeSelectionSpeak,
		initialWidth: 344,
	});

	useEffect(() => {
		if (!selectionSpeakStopRef) return;
		selectionSpeakStopRef.current = selectionSpeak.stop;
		return () => {
			selectionSpeakStopRef.current = null;
		};
	}, [selectionSpeak.stop, selectionSpeakStopRef]);

	const isLoggedIn = Boolean(userStore.userInfo?.id);
	const aiMessages = ebookAssistantStore.messages;

	const {
		allowAiShare,
		shareFlow,
		shareSelection,
		onShare,
		setShareModelVisible,
		shareChatNode,
	} = useAssistantShare({
		messages: aiMessages,
		sessionId: ebookAssistantStore.activeSessionId,
		sessionType: 'ebook',
		enabled: isLoggedIn && Boolean(ebookAssistantStore.activeSessionId),
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

	const aiIdleFlushKey = useMemo((): string | null => {
		if (ebookAssistantStore.isHistoryLoading) return null;
		if (aiMessages.length === 0) return null;
		return `${bookId}-${ebookAssistantStore.activeSessionId ?? ''}-${aiMessages.length}`;
	}, [
		bookId,
		ebookAssistantStore.activeSessionId,
		ebookAssistantStore.isHistoryLoading,
		aiMessages.length,
	]);

	const {
		viewportRef: scrollViewportRef,
		scrollAreaHandlers,
		enableStickToBottom: enableStreamStickToBottom,
		flushScrollToBottom,
		scrollFabMode,
		onScrollFabClick,
	} = useAssistantScroll({
		messages: aiMessages,
		isStreaming: ebookAssistantStore.isStreaming,
		resetKey: bookId
			? `${bookId}:session:${ebookAssistantStore.activeSessionId ?? 'none'}`
			: undefined,
		idleFlushKey: aiIdleFlushKey,
		codeToolbarLayoutDeps: [bookId],
	});

	useEffect(() => {
		if (!bookId) return;
		void ebookAssistantStore.activateForBook(bookId);
	}, [bookId]);

	// 换书 / 切会话时停掉选区朗读，避免串台
	useEffect(() => {
		selectionSpeak.stop();
	}, [bookId, ebookAssistantStore.activeSessionId, selectionSpeak.stop]);

	useEffect(() => {
		if (!isHistoryDrawerOpen) return;
		void ebookAssistantStore.refreshSessionListForCurrentBook();
	}, [isHistoryDrawerOpen]);

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
			await ebookAssistantStore.sendMessage(text, {
				bookId,
				extraUserContentForModel: t('ebook.read.assistant.systemHint', {
					title: bookTitle,
				}),
			});
		},
		[
			input,
			setInput,
			isLoggedIn,
			enableStreamStickToBottom,
			bookId,
			bookTitle,
			t,
		],
	);

	const stopGenerating = useCallback(() => {
		ebookAssistantStore.stopGenerating();
	}, []);

	const showSessionActions = isLoggedIn;

	const isSessionSwitcherLocked =
		showSessionActions && ebookAssistantStore.isEbookSessionSwitcherLocked;

	const conversationColumnActive = !(
		ebookAssistantStore.isHistoryLoading || aiMessages.length === 0
	);

	const assistantFooter = (
		<AssistantFooter
			showScrollFab={conversationColumnActive && scrollFabMode !== 'hidden'}
			scrollFab={{
				mode: scrollFabMode,
				onClick: onScrollFabClick,
				toBottomLabel: t('knowledge.assistant.scrollToBottom'),
				toTopLabel: t('knowledge.assistant.scrollToTop'),
				variant: 'english',
			}}
			floatAbove={selectionSpeak.floatAbove}
		>
			{allowAiShare && shareSelection.isSharing ? (
				<AssistantShareBar
					messages={aiMessages}
					checkboxId="ebook-assistant-share-all"
					shareSelection={shareSelection}
					shareFlow={shareFlow}
					setShareModelVisible={setShareModelVisible}
				/>
			) : (
				<ChatEntry
					t={t}
					textareaId={EPUB_ASSISTANT_INPUT_ID}
					input={input}
					setInput={setInput}
					className="w-full px-0 pb-4"
					textareaClassName={cn('min-h-12', epubReaderChromeTextareaClass)}
					inputWrapClassName="border border-theme/10"
					sendMessage={sendMessage}
					placeholder={t('ebook.read.assistant.placeholder')}
					disableTextInput={false}
					loading={ebookAssistantStore.isSending}
					stopGenerating={
						ebookAssistantStore.isStreaming ? stopGenerating : undefined
					}
					entryChildren={
						<AssistantSessionEntryToolbar
							store="ebook"
							visible={isLoggedIn}
							showSessionActions={showSessionActions}
							isSessionSwitcherLocked={isSessionSwitcherLocked}
							isHistoryDrawerOpen={isHistoryDrawerOpen}
							setIsHistoryDrawerOpen={setIsHistoryDrawerOpen}
							enableStreamStickToBottom={enableStreamStickToBottom}
							flushScrollToBottom={flushScrollToBottom}
						/>
					}
				/>
			)}
			{shareChatNode}
		</AssistantFooter>
	);

	const historyLoading = ebookAssistantStore.isHistoryLoading;

	return (
		<div className="relative flex h-full min-h-0 w-full flex-col">
			<AssistantShell
				t={t}
				isLoading={false}
				hasMessages={aiMessages.length > 0}
				emptyState={
					<div className="relative flex min-h-0 w-full flex-1 flex-col pt-4">
						{historyLoading ? (
							<div
								className={cn(
									'absolute inset-0 z-10 flex items-center justify-center text-sm text-textcolor',
									epubReaderSurfaceOverlayClass,
								)}
							>
								<Loading text={t('knowledge.assistant.loadingConversation')} />
							</div>
						) : null}
						<div className="text-textcolor/70 flex justify-center items-start text-sm">
							<div className="max-w-3xl w-full mx-auto pl-4 pr-4">
								<div className="flex w-full justify-between rounded-md border border-theme/10 p-2">
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
					</div>
				}
				viewportRef={scrollViewportRef}
				scrollAreaHandlers={scrollAreaHandlers}
				messageList={aiMessages.map((message, index) => (
					<AssistantMessageRow
						key={message.chatId}
						selectMessageByChatId={selectEbookMessageByChatId}
						t={t}
						chatId={message.chatId}
						index={index}
						messagesLength={aiMessages.length}
						isCopyedId={isCopyedId}
						onCopy={onCopy}
						isLoading={ebookAssistantStore.isSending}
						onSaveToKnowledge={onSaveToKnowledge}
						allowAiShare={allowAiShare}
						shareSelection={shareSelection}
						onShare={onShare}
						scrollViewportRef={
							scrollViewportRef as RefObject<HTMLElement | null>
						}
						getSelectionContextMenuItems={
							selectionSpeak.getSelectionContextMenuItems
						}
						onSpeakContent={selectionSpeak.start}
					/>
				))}
				footer={assistantFooter}
			/>
		</div>
	);
});

export function EbookAssistant(props: EbookAssistantProps) {
	if (!props.bookId) return null;
	return <EbookAssistantInner {...props} />;
}
