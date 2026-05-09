/**
 * 英语学习（LangChain Agent + english_learning）
 * 布局：大屏左侧工具栏 + 单词包，右侧对话与输入；小屏纵向堆叠。
 */
import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatEntry from '@design/ChatEntry';
import { Button, ScrollArea } from '@ui/index';
import { BookOpen, MessageCircle } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useSearchParams } from 'react-router';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import englishAgentStore from '@/store/englishAgent';
import type { ChatI18nT, Message } from '@/types/chat';
import { stopAllEnglishPlayback } from '@/utils/englishTts';
import { EnglishLearningToolbar } from './EnglishLearningToolbar';
import { VocabularyPackSection } from './VocabularyPackSection';

function selectMessageByChatId(chatId: string): Message | undefined {
	return englishAgentStore.messages.find((m) => m.chatId === chatId);
}

const EnglishLearningMessageRow = observer(function EnglishLearningMessageRow({
	chatId,
	scrollViewportRef,
	t,
}: {
	chatId: string;
	scrollViewportRef: RefObject<HTMLElement | null>;
	t: ChatI18nT;
}) {
	const message = selectMessageByChatId(chatId);
	if (!message) return null;
	const streamRev =
		message.role === 'assistant'
			? `${message.content.length}:${message.thinkContent?.length ?? 0}:${message.isStreaming ? 1 : 0}`
			: `${message.content.length}`;

	return (
		<div
			className={cn(
				'relative flex w-full min-w-0 max-w-full flex-1 flex-col gap-1.5 pb-5',
				message.role === 'user' ? 'items-end' : 'items-stretch',
			)}
			data-msg-rev={streamRev}
		>
			{/*
			 * 勿用 Radix Label 包裹整段消息：无 htmlFor 时浏览器会把点击交给「第一个可标签控件」
			 *（如底部「n 个网页」按钮），导致点击正文/胶囊附近也打开联网抽屉。
			 */}
			<div
				className={cn(
					'message-md-wrap relative flex min-w-0 max-w-full select-auto rounded-2xl p-3.5 text-textcolor shadow-sm',
					message.role === 'user'
						? 'w-fit max-w-[min(100%,36rem)] border border-teal-500/20 bg-teal-500/8 px-4 py-3'
						: 'w-full border border-theme/12 bg-theme-secondary/60',
				)}
			>
				<ChatAssistantMessage
					message={message}
					scrollViewportRef={scrollViewportRef}
					t={t}
					className={
						message.role === 'user'
							? 'min-w-0 max-w-full text-left [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full'
							: undefined
					}
				/>
			</div>
		</div>
	);
});

const EnglishLearning = observer(function EnglishLearning() {
	const { t } = useI18n();
	const [searchParams, setSearchParams] = useSearchParams();
	const [input, setInput] = useState('');
	const scrollViewportRef = useRef<HTMLDivElement>(null);

	const sessionQ = searchParams.get('session');

	useEffect(() => {
		if (!sessionQ) return;
		if (englishAgentStore.sessionId === sessionQ) return;
		void englishAgentStore.hydrateSession(sessionQ);
	}, [sessionQ]);

	const onNewChat = useCallback(() => {
		stopAllEnglishPlayback();
		englishAgentStore.resetConversation();
		setSearchParams({}, { replace: true });
	}, [setSearchParams]);

	const titleFallback = t('route.englishLearning.title');

	const sendMessage = useCallback(async () => {
		const text = input.trim();
		if (!text) return;
		setInput('');
		await englishAgentStore.sendMessage(text, { titleFallback });
		if (englishAgentStore.sessionId) {
			setSearchParams(
				{ session: englishAgentStore.sessionId },
				{ replace: true },
			);
		}
	}, [input, setSearchParams, titleFallback]);

	if (englishAgentStore.loadError) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
				<p className="text-textcolor/75 max-w-sm text-sm leading-relaxed">
					{englishAgentStore.loadError}
				</p>
				<Button type="button" variant="dynamic" onClick={() => onNewChat()}>
					{t('englishLearning.newChat')}
				</Button>
			</div>
		);
	}

	return (
		<div
			className={cn(
				'flex h-full min-h-0 w-full flex-col',
				'lg:grid lg:min-h-0 lg:grid-cols-[minmax(272px,300px)_minmax(0,1fr)] xl:grid-cols-[minmax(288px,320px)_minmax(0,1fr)]',
				'lg:divide-x lg:divide-theme/10',
			)}
		>
			{/* 左侧：设置 + 单词包（大屏固定宽度可滚动） */}
			<aside
				className={cn(
					'flex max-h-[42vh] min-h-0 shrink-0 flex-col border-b border-theme/10 lg:max-h-none lg:h-full lg:min-h-0 lg:w-full lg:border-b-0',
					'bg-theme-secondary/25 lg:bg-theme-secondary/35',
				)}
			>
				<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5">
					<EnglishLearningToolbar onNewChat={onNewChat} />
					<VocabularyPackSection layout={'sidebar'} />
				</div>
			</aside>

			{/* 右侧：对话 + 输入 */}
			<main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
				<div className="border-theme/8 bg-theme-background/80 flex shrink-0 items-center gap-2 border-b px-4 py-2.5 sm:px-5">
					<MessageCircle
						className="text-textcolor/45 size-4 shrink-0"
						aria-hidden
					/>
					<span className="text-textcolor/70 text-xs font-medium tracking-wide">
						{t('englishLearning.conversationTitle')}
					</span>
				</div>

				<div className="relative flex min-h-0 flex-1 flex-col">
					{englishAgentStore.isHydrating ? (
						<div className="text-textcolor/55 flex flex-1 flex-col items-center justify-center gap-2 py-16 text-sm">
							<div className="border-theme/20 size-8 animate-spin rounded-full border-2 border-t-teal-500" />
							{t('englishLearning.loading')}
						</div>
					) : englishAgentStore.messages.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
							<div className="border-theme/12 bg-theme-secondary/40 max-w-md rounded-2xl border p-6 text-center shadow-sm">
								<div className="bg-teal-500/12 mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-teal-500/20">
									<BookOpen
										className="size-7 text-teal-600 dark:text-teal-400"
										aria-hidden
									/>
								</div>
								<p className="text-textcolor/80 text-sm leading-relaxed">
									{t('englishLearning.intro')}
								</p>
							</div>
						</div>
					) : (
						<ScrollArea
							className="min-h-0 flex-1 border-0"
							viewportClassName="pb-2 [overflow-anchor:none]"
							ref={scrollViewportRef}
						>
							<div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col px-4 pt-5 pb-2 sm:px-5">
								{englishAgentStore.messages.map((m) => (
									<EnglishLearningMessageRow
										key={m.chatId}
										chatId={m.chatId}
										scrollViewportRef={
											scrollViewportRef as RefObject<HTMLElement | null>
										}
										t={t}
									/>
								))}
							</div>
						</ScrollArea>
					)}
				</div>

				{englishAgentStore.toolStatus ? (
					<div className="border-theme/10 bg-theme/5 text-textcolor/60 shrink-0 border-t px-4 py-2 text-center text-[11px]">
						{englishAgentStore.toolStatus}
					</div>
				) : null}

				<div className="border-theme/10 bg-theme-secondary/30 shrink-0 border-t px-3 pb-3 pt-2 sm:px-5">
					<div className="mx-auto w-full max-w-3xl">
						<ChatEntry
							t={t}
							input={input}
							setInput={setInput}
							className="w-full border-0 px-0 pb-3 pt-1"
							textareaClassName="min-h-11 rounded-xl"
							sendMessage={sendMessage}
							placeholder={t('englishLearning.placeholder')}
							disableTextInput={false}
							loading={englishAgentStore.isSending}
							stopGenerating={
								englishAgentStore.isStreaming
									? () => englishAgentStore.stopGenerating()
									: undefined
							}
						/>
					</div>
				</div>
			</main>
		</div>
	);
});

export default EnglishLearning;
