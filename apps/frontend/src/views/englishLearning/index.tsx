/**
 * 英语学习（LangChain Agent + english_learning）
 * 布局：横向 ResizablePanelGroup（与 Monaco 分栏一致）+ 左侧单词区由容器查询自适应。
 */
import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatEntry from '@design/ChatEntry';
import { Button, ScrollArea } from '@ui/index';
import { BookOpen } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type RefObject,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useSearchParams } from 'react-router';
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import englishAgentStore from '@/store/englishAgent';
import type { ChatI18nT, Message } from '@/types/chat';
import { stopAllEnglishPlayback } from '@/utils/englishTts';
import { ClassicQuotesSection } from './ClassicQuotesSection';
import { EnglishLearningToolbar } from './LearningToolbar';
import { VocabularyPackSection } from './VocabularySection';

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
					'message-md-wrap relative flex min-w-0 max-w-full select-auto rounded-md p-3.5 text-textcolor shadow-sm',
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
			<div className="flex min-h-0 h-full w-full flex-col">
				<div className="box-border flex h-full min-h-0 w-full flex-col p-5 pt-0">
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-md bg-theme/5 p-8 text-center">
						<p className="text-textcolor/75 max-w-sm text-sm leading-relaxed">
							{englishAgentStore.loadError}
						</p>
						<Button type="button" variant="dynamic" onClick={() => onNewChat()}>
							{t('englishLearning.newChat')}
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5 pt-0">
				{/* 与知识库页 ScrollArea 一致：外层 p-5 pt-0；内壳与 Monaco 根容器一致 rounded-md bg-theme/5 */}
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md">
					<ResizablePanelGroup
						id="english-learning-split"
						orientation="horizontal"
						className="h-full min-h-0 min-w-0 max-w-full flex-1"
					>
						<ResizablePanel
							id="english-sidebar"
							defaultSize="35%"
							// minSize="16%"
							// maxSize="42%"
							className="min-h-0 min-w-0"
						>
							<aside
								className={cn(
									'flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-theme-background',
								)}
							>
								<div className="my-4 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
									<EnglishLearningToolbar />
									<VocabularyPackSection />
									<ClassicQuotesSection />
								</div>
							</aside>
						</ResizablePanel>
						<ResizableHandle withHandle className="w-0" />
						<ResizablePanel
							id="english-chat"
							defaultSize="65%"
							// minSize="45%"
							className="min-h-0 min-w-0"
						>
							<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
								<main
									className={cn(
										'relative flex min-h-0 min-w-0 flex-1 flex-col bg-theme-background border-l border-theme/10',
										'h-full',
									)}
								>
									<div className="relative flex min-h-0 flex-1 flex-col">
										{englishAgentStore.isHydrating ? (
											<div className="text-textcolor/55 flex flex-1 flex-col items-center justify-center gap-2 py-16 text-sm">
												<div className="border-theme/20 size-8 animate-spin rounded-full border-2 border-t-teal-500" />
												{t('englishLearning.loading')}
											</div>
										) : englishAgentStore.messages.length === 0 ? (
											<div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
												<div className="border-theme/12 bg-theme-secondary/40 max-w-md rounded-md border p-6 text-center shadow-sm">
													<div className="bg-teal-500/12 mx-auto mb-4 flex size-14 items-center justify-center rounded-md border border-teal-500/20">
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

									<div className="border-theme/10 bg-theme-background/45 shrink-0 border-t px-3 pb-1 pt-2 sm:px-4">
										<div className="mx-auto w-full max-w-3xl">
											<ChatEntry
												t={t}
												input={input}
												setInput={setInput}
												className="w-full border-0 px-0 pb-3 pt-1"
												textareaClassName="min-h-11 rounded-md"
												sendMessage={sendMessage}
												clearChat={onNewChat}
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
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>
			</div>
		</div>
	);
});

export default EnglishLearning;
