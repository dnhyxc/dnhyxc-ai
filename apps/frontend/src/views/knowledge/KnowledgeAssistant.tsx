/**
 * 知识库右侧通用助手：维护 `knowledgeAssistantPersistenceAllowed` 与 `documentKey` 驱动的 `activateForDocument`。
 * 完整设计文档：`docs/knowledge/knowledge-assistant-complete.md`。
 */

import { Button, Toast } from '@ui/index';
import { BookOpen, CirclePlus, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	forwardRef,
	memo,
	type RefObject,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	AssistantMessageRow,
	AssistantShell,
	type SelectMessageByChatId,
	useAssistantShare,
} from '@/components/design/Assistant';
import { useAssistantCopy, useAssistantScroll, useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import assistantStore from '@/store/assistant';
import knowledgeRagQaStore from '@/store/knowledgeRagQa';
import type { Message } from '@/types/chat';
import {
	KNOWLEDGE_ASSISTANT_PROMPTS,
	type KnowledgeAssistantPanelMode,
	type KnowledgeAssistantPromptKind,
} from './constants';
import {
	KnowledgeAssistantChatFooter,
	type KnowledgeAssistantChatFooterHandle,
	KnowledgeAssistantFooterControls,
} from './KnowledgeAssistantChatFooter';
import {
	buildKnowledgeAssistantDocumentMessage,
	documentHasCanonicalTocHeading,
	documentHasLeadingToc,
	ensureTocHeadingAtDocumentTop,
	extractTocBlockFromAssistantReply,
	findCompletedOutlineAssistantReply,
	isKnowledgeLocalMarkdownId,
	prependTocToDocument,
} from './utils';

export type KnowledgeAssistantMode = KnowledgeAssistantPanelMode;

/** 供知识页从编辑器选区写入助手草稿，避免输入 state 提升到整页 */
export type KnowledgeAssistantHandle = KnowledgeAssistantChatFooterHandle;

interface KnowledgeAssistantProps {
	/** 与 MarkdownEditor `documentIdentity` 一致，用于绑定助手多轮会话 */
	documentKey: string;
	/**
	 * 外部受控输入框（可选）：用于从编辑器右键菜单等外部入口写入草稿。
	 * 若不传则组件内部维护 input state。
	 */
	input?: string;
	setInput?: import('react').Dispatch<import('react').SetStateAction<string>>;
	/**
	 * 外部受控 RAG 输入框（可选）：与 input 一致，供「复制选中内容到助手」写入 RAG 模式草稿。
	 */
	ragInput?: string;
	setRagInput?: import('react').Dispatch<
		import('react').SetStateAction<string>
	>;
	/** 递增时在 input 同步后聚焦输入框并将光标置于末尾（对齐 ebook） */
	focusInputAtEndKey?: number;
	/** 当前面板为 AI / RAG 时通知父级，便于外部写入对应输入框 */
	onAssistantModeChange?: (mode: KnowledgeAssistantMode) => void;
}

/** 仅 UI：助手模式偏好，写入 localStorage（与知识页父组件读取保持一致） */
export const KNOWLEDGE_ASSISTANT_MODE_STORAGE_KEY = 'knowledge-assistant-mode';

/** 与初次挂载时组件内 state 初始化逻辑一致，供父组件初始化「当前模式」ref */
export function readKnowledgeAssistantPanelMode(): KnowledgeAssistantPanelMode {
	if (typeof window === 'undefined') return 'ai';
	return localStorage.getItem(KNOWLEDGE_ASSISTANT_MODE_STORAGE_KEY) === 'rag'
		? 'rag'
		: 'ai';
}

const selectAssistantMessageByChatId: SelectMessageByChatId = (chatId) =>
	assistantStore.messages.find((m) => m.chatId === chatId);

const selectRagMessageByChatId: SelectMessageByChatId = (chatId) =>
	knowledgeRagQaStore.messages.find((m) => m.chatId === chatId);

const EMPTY_AI_MESSAGES: readonly Message[] = [];

const KnowledgeAssistantInner = observer(
	forwardRef<KnowledgeAssistantHandle, KnowledgeAssistantProps>(
		function KnowledgeAssistant(
			{
				documentKey,
				input: inputProp,
				setInput: setInputProp,
				ragInput: ragInputProp,
				setRagInput: setRagInputProp,
				focusInputAtEndKey: focusInputAtEndKeyProp = 0,
				onAssistantModeChange,
			},
			ref,
		) {
			const { knowledgeStore, userStore } = useStore();
			const { t } = useI18n();
			const chatFooterRef = useRef<KnowledgeAssistantChatFooterHandle>(null);

			const [assistantMode, setAssistantModeState] =
				useState<KnowledgeAssistantPanelMode>(readKnowledgeAssistantPanelMode);
			const setAssistantMode = useCallback((m: KnowledgeAssistantPanelMode) => {
				setAssistantModeState(m);
				if (typeof window !== 'undefined') {
					localStorage.setItem(KNOWLEDGE_ASSISTANT_MODE_STORAGE_KEY, m);
				}
			}, []);
			const isRagMode = assistantMode === 'rag';
			const { isCopyedId, onCopy } = useAssistantCopy();
			/** 用于检测「刚切入 RAG 模式」：仅在 false→true 时贴底，避免影响 AI 模式与其它渲染 */
			const wasRagModeRef = useRef(false);
			/** 「生成目录」快捷卡发送后，流式结束且成功时尝试写入编辑器文首 */
			const pendingOutlineTocApplyRef = useRef(false);
			const wasAssistantStreamingRef = useRef(false);

			const isLoggedIn = Boolean(userStore.userInfo?.id);
			const editorHasBody = knowledgeStore.markdownNonempty;

			useImperativeHandle(
				ref,
				() => ({
					appendInput: (text, mode) =>
						chatFooterRef.current?.appendInput(text, mode),
					clearInputs: () => chatFooterRef.current?.clearInputs(),
					focusInputAtEnd: () => chatFooterRef.current?.focusInputAtEnd(),
				}),
				[],
			);

			// 左侧当前文档身份变化时调用 activate
			// 未保存草稿的 key 形如 `draft-new__trash-*` 也必须走此处；若跳过则 `activeDocumentKey` 为空，发送时会提示「文档未就绪」。
			// 清空草稿后 `clearAssistantStateOnKnowledgeDraftReset(nextKey)` 已同步 activeDocumentKey；此时无正文不应再 activate，否则会二次清空并可能拉 `draft-new` 会话。
			useEffect(() => {
				if (!documentKey) return;
				if (
					assistantStore.activeDocumentKey === documentKey &&
					!editorHasBody
				) {
					return;
				}
				void assistantStore.activateForDocument(documentKey);
			}, [documentKey, editorHasBody, assistantStore.activeDocumentKey]);

			const assistantPersistenceAllowed = useMemo(() => {
				if (knowledgeStore.knowledgeTrashPreviewId != null) return true;
				const editingId = knowledgeStore.knowledgeEditingKnowledgeId;
				if (isKnowledgeLocalMarkdownId(editingId)) return true;
				if (editingId) return true;
				return false;
			}, [
				knowledgeStore.knowledgeTrashPreviewId,
				knowledgeStore.knowledgeEditingKnowledgeId,
			]);

			useEffect(() => {
				assistantStore.setKnowledgeAssistantPersistenceAllowed(
					assistantPersistenceAllowed,
				);
				return () => {
					assistantStore.setKnowledgeAssistantPersistenceAllowed(true);
				};
			}, [assistantPersistenceAllowed]);

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

			const aiMessages = assistantStore.messages;
			const ragMessages = knowledgeRagQaStore.messages;
			const messages = isRagMode ? ragMessages : aiMessages;

			/** AI 模式非流式就绪贴底签名（会话 + 条数；不含 chatId，避免流式落库换 id 误触发滚底） */
			const aiIdleFlushKey = useMemo((): string | null => {
				if (isRagMode) return null;
				if (assistantStore.isHistoryLoading) return null;
				if (aiMessages.length === 0) return null;
				return `${documentKey}-${assistantStore.activeSessionId ?? ''}-${aiMessages.length}`;
			}, [
				isRagMode,
				documentKey,
				assistantStore.activeSessionId,
				assistantStore.isHistoryLoading,
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
				messages,
				isStreaming: isRagMode
					? knowledgeRagQaStore.isStreaming
					: assistantStore.isStreaming,
				resetKey: isRagMode
					? 'knowledge-rag-qa-global'
					: documentKey
						? `${documentKey}:session:${assistantStore.activeSessionId ?? 'none'}`
						: undefined,
				idleFlushKey: aiIdleFlushKey,
				codeToolbarLayoutDeps: [isRagMode, documentKey],
			});

			// 切换到 RAG 助手时：将消息区滚到底部（仅在进入 RAG 的瞬间触发，不改变 AI 模式行为）
			useLayoutEffect(() => {
				if (!isRagMode) {
					wasRagModeRef.current = false;
					return;
				}
				const enteredRag = !wasRagModeRef.current;
				wasRagModeRef.current = true;
				if (!enteredRag) return;
				enableStreamStickToBottom();
				flushScrollToBottom();
				requestAnimationFrame(() => {
					flushScrollToBottom();
				});
			}, [isRagMode, enableStreamStickToBottom, flushScrollToBottom]);

			/** 流式/发送结束后展示「重新总结/润色」条带（跟在消息后，见下方 ScrollArea 内渲染） */
			const showPostStreamActions =
				!isRagMode &&
				isLoggedIn &&
				aiMessages.length > 0 &&
				editorHasBody &&
				!assistantStore.isHistoryLoading &&
				!assistantStore.isSending &&
				!assistantStore.isStreaming;

			/** RAG：本轮流式结束后展示「新对话」，仅影响 RAG store，不涉及 AI */
			const showRagNewConversation =
				isRagMode &&
				isLoggedIn &&
				ragMessages.length > 0 &&
				!knowledgeRagQaStore.isSending &&
				!knowledgeRagQaStore.isStreaming;

			// 条带插入后 scrollHeight 变化，须在布局后贴底，否则用户仍停在旧滚动位置
			useLayoutEffect(() => {
				if (!showPostStreamActions) return;
				flushScrollToBottom();
				requestAnimationFrame(() => flushScrollToBottom());
			}, [showPostStreamActions, flushScrollToBottom]);

			// RAG「新对话」条带出现后同样贴底，避免按钮把视口顶在旧位置
			useLayoutEffect(() => {
				if (!showRagNewConversation) return;
				flushScrollToBottom();
				requestAnimationFrame(() => flushScrollToBottom());
			}, [showRagNewConversation, flushScrollToBottom]);

			/** 首页快捷卡片：用户气泡仅显示标题，请求体携带当前文档全文 */
			const sendKnowledgePromptCard = useCallback(
				async (kind: KnowledgeAssistantPromptKind) => {
					if (isRagMode) return;
					if (!isLoggedIn) {
						Toast({
							type: 'warning',
							title: t('knowledge.assistant.loginToUse'),
						});
						return;
					}
					const md = (knowledgeStore.markdown ?? '').trim();
					if (!md) {
						Toast({
							type: 'warning',
							title: t('knowledge.assistant.enterBodyFirst'),
						});
						return;
					}
					if (
						assistantStore.isSending ||
						assistantStore.isHistoryLoading ||
						assistantStore.isStreaming
					) {
						Toast({
							type: 'warning',
							title: t('knowledge.assistant.waitForCurrentReply'),
						});
						return;
					}
					const { userMessageShort, extraUserContentForModel } =
						buildKnowledgeAssistantDocumentMessage(
							kind,
							knowledgeStore.markdown ?? '',
						);
					const messagesLenBefore = assistantStore.messages.length;
					if (kind === 'outline') {
						pendingOutlineTocApplyRef.current = true;
					}
					enableStreamStickToBottom();
					await assistantStore.sendMessage(userMessageShort, {
						extraUserContentForModel,
					});
					if (
						kind === 'outline' &&
						assistantStore.messages.length === messagesLenBefore
					) {
						pendingOutlineTocApplyRef.current = false;
					}
				},
				[
					isLoggedIn,
					knowledgeStore.markdown,
					enableStreamStickToBottom,
					isRagMode,
				],
			);

			/** 生成目录完成后：文首无目录则将助手输出的目录块插入编辑器顶部 */
			useEffect(() => {
				if (isRagMode) return;
				const streaming = assistantStore.isStreaming;
				const wasStreaming = wasAssistantStreamingRef.current;
				wasAssistantStreamingRef.current = streaming;

				if (!wasStreaming || streaming || !pendingOutlineTocApplyRef.current) {
					return;
				}
				pendingOutlineTocApplyRef.current = false;

				const assistant = findCompletedOutlineAssistantReply(
					assistantStore.messages,
				);
				if (!assistant) return;

				const currentMd = knowledgeStore.markdown ?? '';
				if (documentHasCanonicalTocHeading(currentMd)) {
					Toast({
						type: 'info',
						title: t('knowledge.assistant.tocAlreadyAtTop'),
					});
					return;
				}

				if (documentHasLeadingToc(currentMd)) {
					knowledgeStore.setMarkdown(ensureTocHeadingAtDocumentTop(currentMd));
					Toast({
						type: 'success',
						title: t('knowledge.assistant.tocPrependedToDoc'),
					});
					return;
				}

				const tocBlock = extractTocBlockFromAssistantReply(
					assistant.content ?? '',
				);
				if (!tocBlock) return;

				knowledgeStore.setMarkdown(prependTocToDocument(currentMd, tocBlock));
				Toast({
					type: 'success',
					title: t('knowledge.assistant.tocPrependedToDoc'),
				});
			}, [
				isRagMode,
				assistantStore.isStreaming,
				assistantStore.messages,
				knowledgeStore,
				t,
			]);

			const stopGenerating = useCallback(() => {
				if (isRagMode) {
					knowledgeRagQaStore.stopGenerating();
					return;
				}
				void assistantStore.stopGenerating();
			}, [isRagMode, isLoggedIn, knowledgeStore.markdown, t]);

			/** 工具条整体展示：登录后始终可见（含 AI/RAG 模式切换） */
			const showEntryToolbar = isLoggedIn;
			/** AI 多会话操作仅在 AI 模式展示；RAG 模式下隐藏“历史/新对话” */
			const showAiSessionActions =
				!isRagMode &&
				isLoggedIn &&
				assistantStore.knowledgeAssistantPersistenceAllowed &&
				Boolean(assistantStore.sessionListForActiveDocument);

			const isAiSessionSwitcherLocked =
				showAiSessionActions && assistantStore.isAssistantSessionSwitcherLocked;

			const {
				allowAiShare,
				shareFlow,
				shareSelection,
				onShare,
				setShareModelVisible,
				shareChatNode,
			} = useAssistantShare({
				messages: aiMessages,
				sessionId: assistantStore.activeSessionId,
				sessionType: 'assistant',
				enabled:
					!isRagMode &&
					isLoggedIn &&
					assistantStore.knowledgeAssistantPersistenceAllowed &&
					Boolean(assistantStore.activeSessionId),
			});

			/** 当前为「会话列表 + 底部输入」视图（与加载中 / 空状态引导互斥） */
			const conversationColumnActive = !(
				(!isRagMode && assistantStore.isHistoryLoading) ||
				(isRagMode && !ragMessages.length) ||
				(!isRagMode && !aiMessages.length)
			);

			const emptyState = isRagMode ? (
				<div className="max-w-3xl mx-auto text-textcolor/70 flex flex-1 justify-center items-start text-sm pt-4 pl-4 pr-4">
					<div className="w-full flex gap-2 border border-theme/5 bg-theme/2 p-3 rounded-md">
						<BookOpen size={18} className="mt-[3px] shrink-0 text-teal-500" />
						<div className="flex-1 text-sm leading-relaxed">
							{t('knowledge.assistant.ragIntro')}
						</div>
					</div>
				</div>
			) : (
				<div className="text-textcolor/70 flex flex-1 justify-center items-start text-sm pt-4">
					{knowledgeStore.markdownNonempty ? (
						<div className="max-w-3xl mx-auto w-full flex flex-col gap-2 justify-center items-center pl-4 pr-4">
							<div className="grid w-full grid-cols-2 gap-3">
								{KNOWLEDGE_ASSISTANT_PROMPTS.map((item) => (
									<button
										key={item.kind}
										type="button"
										className={cn(
											'flex-1 flex items-start gap-2 border border-theme/5 bg-theme/2 text-textcolor hover:bg-theme/15 pt-2 pb-3 pl-2 pr-2.5 rounded-md cursor-pointer text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-theme/40',
											(assistantStore.isSending ||
												assistantStore.isHistoryLoading ||
												assistantStore.isStreaming) &&
												'pointer-events-none opacity-50',
										)}
										onClick={() => void sendKnowledgePromptCard(item.kind)}
									>
										<item.icon className="text-teal-500 mt-0.5 shrink-0 size-5" />
										<div className="flex min-w-0 flex-1 flex-col gap-1">
											<span className="text-sm font-medium">
												{t(item.titleKey)}
											</span>
											<span className="text-xs text-textcolor/80">
												{t(item.descriptionKey)}
											</span>
										</div>
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="max-w-3xl w-full mx-auto pl-4 pr-4">
							<div className="w-full flex justify-between bg-theme/2 p-2 rounded-md border border-theme/5">
								<Sparkles size={18} className="mr-2 text-teal-500 mt-0.5" />
								<div className="flex-1">{t('knowledge.assistant.aiIntro')}</div>
							</div>
						</div>
					)}
				</div>
			);

			return (
				<AssistantShell
					t={t}
					isLoading={!isRagMode && assistantStore.isHistoryLoading}
					loadingText={t('knowledge.assistant.loadingConversation')}
					hasMessages={messages.length > 0}
					emptyState={emptyState}
					viewportRef={scrollViewportRef}
					scrollAreaHandlers={scrollAreaHandlers}
					messageList={messages.map((message, index) => (
						<AssistantMessageRow
							key={message.chatId}
							selectMessageByChatId={
								isRagMode
									? selectRagMessageByChatId
									: selectAssistantMessageByChatId
							}
							t={t}
							chatId={message.chatId}
							index={index}
							messagesLength={messages.length}
							isCopyedId={isCopyedId}
							onCopy={onCopy}
							onSaveToKnowledge={onSaveToKnowledge}
							allowAiShare={allowAiShare}
							shareSelection={shareSelection}
							onShare={onShare}
							scrollViewportRef={
								scrollViewportRef as RefObject<HTMLElement | null>
							}
						/>
					))}
					listFooter={
						<>
							{showRagNewConversation ? (
								<div className="mb-3 flex w-full min-w-0 justify-start">
									<Button
										size="sm"
										variant="dynamic"
										className="w-fit rounded-md border border-theme/5 bg-theme/5 px-3 py-1.5 text-sm text-textcolor/80 transition-colors hover:border-theme/20 hover:text-textcolor"
										onClick={() => {
											knowledgeRagQaStore.resetConversation();
											chatFooterRef.current?.clearInputs();
										}}
									>
										<CirclePlus />
										{t('knowledge.assistant.newConversation')}
									</Button>
								</div>
							) : null}
							{showPostStreamActions ? (
								<div className="mb-3 flex justify-between min-w-0 gap-1.5 mr-10">
									{KNOWLEDGE_ASSISTANT_PROMPTS.map((item) => (
										<Button
											key={item.kind}
											size="sm"
											variant="link"
											className="flex-1 px-1! rounded-md border border-theme/5 bg-theme/5 text-xs text-textcolor/80 transition-colors hover:text-textcolor hover:bg-theme/10"
											onClick={() => void sendKnowledgePromptCard(item.kind)}
										>
											<item.icon />
											{t(item.titleKey)}
										</Button>
									))}
								</div>
							) : null}
						</>
					}
					footer={
						<KnowledgeAssistantFooterControls isRagMode={isRagMode}>
							{({ isSending, isStreaming }) => (
								<KnowledgeAssistantChatFooter
									ref={chatFooterRef}
									documentKey={documentKey}
									isLoggedIn={isLoggedIn}
									isRagMode={isRagMode}
									assistantMode={assistantMode}
									setAssistantMode={setAssistantMode}
									onAssistantModeChange={onAssistantModeChange}
									input={inputProp}
									setInput={setInputProp}
									ragInput={ragInputProp}
									setRagInput={setRagInputProp}
									focusInputAtEndKey={focusInputAtEndKeyProp}
									conversationColumnActive={conversationColumnActive}
									scrollFabMode={scrollFabMode}
									onScrollFabClick={onScrollFabClick}
									enableStreamStickToBottom={enableStreamStickToBottom}
									flushScrollToBottom={flushScrollToBottom}
									isSending={isSending}
									isStreaming={isStreaming}
									onStopGenerating={stopGenerating}
									allowAiShare={allowAiShare}
									shareSelection={shareSelection}
									shareFlow={shareFlow}
									setShareModelVisible={setShareModelVisible}
									shareChatNode={shareChatNode}
									aiMessages={
										allowAiShare && shareSelection.isSharing
											? aiMessages
											: EMPTY_AI_MESSAGES
									}
									showEntryToolbar={showEntryToolbar}
									showAiSessionActions={showAiSessionActions}
									isAiSessionSwitcherLocked={isAiSessionSwitcherLocked}
								/>
							)}
						</KnowledgeAssistantFooterControls>
					}
				/>
			);
		},
	),
);

const KnowledgeAssistant = memo(KnowledgeAssistantInner);

export default KnowledgeAssistant;
