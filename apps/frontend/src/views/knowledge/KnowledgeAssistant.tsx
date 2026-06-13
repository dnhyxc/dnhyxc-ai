/**
 * 知识库右侧通用助手：维护 `knowledgeAssistantPersistenceAllowed` 与 `documentKey` 驱动的 `activateForDocument`。
 * 完整设计文档：`docs/knowledge/knowledge-assistant-complete.md`。
 */

import Loading from '@design/Loading';
import { Button, Toast } from '@ui/index';
import {
	BookOpen,
	ChevronDown,
	ChevronUp,
	CirclePlus,
	Sparkles,
} from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type Dispatch,
	type RefObject,
	type SetStateAction,
	type UIEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import ChatEntry from '@/components/design/ChatEntry';
import { ScrollArea } from '@/components/ui';
import { useI18n, useStickToBottomScroll } from '@/hooks';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import assistantStore from '@/store/assistant';
import knowledgeRagQaStore from '@/store/knowledgeRagQa';
import type { Message } from '@/types/chat';
import {
	KNOWLEDGE_ASSISTANT_PROMPTS,
	type KnowledgeAssistantPromptKind,
} from './constants';
import { KnowledgeAssistantEntryToolbar } from './KnowledgeAssistantEntryToolbar';
import {
	KnowledgeAssistantShareBar,
	useKnowledgeAssistantShare,
} from './KnowledgeAssistantShareBar';
import {
	KnowledgeMessageBubble,
	type SelectMessageByChatId,
} from './KnowledgeMessageBubble';
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

export type KnowledgeAssistantMode = 'ai' | 'rag';

interface KnowledgeAssistantProps {
	/** 与 MarkdownEditor `documentIdentity` 一致，用于绑定助手多轮会话 */
	documentKey: string;
	/**
	 * 外部受控输入框（可选）：用于从编辑器右键菜单等外部入口写入草稿。
	 * 若不传则组件内部维护 input state。
	 */
	input?: string;
	setInput?: Dispatch<SetStateAction<string>>;
	/**
	 * 外部受控 RAG 输入框（可选）：与 input 一致，供「复制选中内容到助手」写入 RAG 模式草稿。
	 */
	ragInput?: string;
	setRagInput?: Dispatch<SetStateAction<string>>;
	/** 当前面板为 AI / RAG 时通知父级，便于外部写入对应输入框 */
	onAssistantModeChange?: (mode: KnowledgeAssistantMode) => void;
}

type KnowledgeAssistantScrollCornerFabMode = 'hidden' | 'toBottom' | 'toTop';

/** 仅 UI：助手模式偏好，写入 localStorage（与知识页父组件读取保持一致） */
export const KNOWLEDGE_ASSISTANT_MODE_STORAGE_KEY = 'knowledge-assistant-mode';

/** 与初次挂载时组件内 state 初始化逻辑一致，供父组件初始化「当前模式」ref */
export function readKnowledgeAssistantPanelMode(): KnowledgeAssistantMode {
	if (typeof window === 'undefined') return 'ai';
	return localStorage.getItem(KNOWLEDGE_ASSISTANT_MODE_STORAGE_KEY) === 'rag'
		? 'rag'
		: 'ai';
}

const selectAssistantMessageByChatId: SelectMessageByChatId = (chatId) =>
	assistantStore.messages.find((m) => m.chatId === chatId);

const selectRagMessageByChatId: SelectMessageByChatId = (chatId) =>
	knowledgeRagQaStore.messages.find((m) => m.chatId === chatId);

const KnowledgeAssistant = observer(
	({
		documentKey,
		input: inputProp,
		setInput: setInputProp,
		ragInput: ragInputProp,
		setRagInput: setRagInputProp,
		onAssistantModeChange,
	}: KnowledgeAssistantProps) => {
		const { knowledgeStore, userStore } = useStore();
		const { t } = useI18n();

		const [internalInput, setInternalInput] = useState('');
		const input = inputProp ?? internalInput;
		const setInput = setInputProp ?? setInternalInput;
		const [assistantMode, setAssistantModeState] =
			useState<KnowledgeAssistantMode>(readKnowledgeAssistantPanelMode);
		const setAssistantMode = useCallback((m: KnowledgeAssistantMode) => {
			setAssistantModeState(m);
			if (typeof window !== 'undefined') {
				localStorage.setItem(KNOWLEDGE_ASSISTANT_MODE_STORAGE_KEY, m);
			}
		}, []);
		const [internalRagInput, setInternalRagInput] = useState('');
		const ragInput = ragInputProp ?? internalRagInput;
		const setRagInput = setRagInputProp ?? setInternalRagInput;
		const isRagMode = assistantMode === 'rag';
		const [isCopyedId, setIsCopyedId] = useState('');
		const [scrollCornerFabMode, setScrollCornerFabMode] =
			useState<KnowledgeAssistantScrollCornerFabMode>('hidden');
		const scrollCornerFabModeRef =
			useRef<KnowledgeAssistantScrollCornerFabMode>('hidden');
		/** 用于检测「刚切入 RAG 模式」：仅在 false→true 时贴底，避免影响 AI 模式与其它渲染 */
		const wasRagModeRef = useRef(false);

		const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		/** 「生成目录」快捷卡发送后，流式结束且成功时尝试写入编辑器文首 */
		const pendingOutlineTocApplyRef = useRef(false);
		const wasAssistantStreamingRef = useRef(false);

		const isLoggedIn = Boolean(userStore.userInfo?.id);
		const editorHasBody = Boolean((knowledgeStore.markdown ?? '').trim());

		useLayoutEffect(() => {
			onAssistantModeChange?.(assistantMode);
		}, [assistantMode, onAssistantModeChange]);

		useEffect(() => {
			return () => {
				if (copyTimerRef.current) {
					clearTimeout(copyTimerRef.current);
				}
			};
		}, []);

		// 左侧当前文档身份变化时调用 activate：首段会写入 `activeDocumentKey`（ephemeral 发消息必填），再按是否允许落库拉历史 / 建 session。
		// 未保存草稿的 key 形如 `draft-new__trash-*` 也必须走此处；若跳过则 `activeDocumentKey` 为空，发送时会提示「文档未就绪」。
		// 清空草稿后 `clearAssistantStateOnKnowledgeDraftReset(nextKey)` 已同步 activeDocumentKey；此时无正文不应再 activate，否则会二次清空并可能拉 `draft-new` 会话。
		useEffect(() => {
			if (!documentKey) return;
			if (assistantStore.activeDocumentKey === documentKey && !editorHasBody) {
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

		// 左侧编辑器被清空时，同步清空「AI 助手」输入框（RAG 独立输入，且不因正文清空而清空）
		useEffect(() => {
			if (assistantMode !== 'ai') return;
			/**
			 * 注意：开启助手会导致 Monaco 视图切换与编辑器重挂载，期间父级 markdown 可能出现极短暂的空串。
			 * 若此处立刻清空输入框，会造成“刚复制进输入框就被清掉”的体验。
			 *
			 * 策略：仅当 markdown 持续为空一段时间后再清空输入框，规避重挂载瞬态。
			 */
			const raw = knowledgeStore.markdown ?? '';
			if (raw.trim()) return;
			const id = window.setTimeout(() => {
				if (!(knowledgeStore.markdown ?? '').trim()) {
					setInput('');
				}
			}, 200);
			return () => window.clearTimeout(id);
		}, [knowledgeStore.markdown, setInput, knowledgeStore, assistantMode]);

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

		const onCopy = useCallback((content: string, chatId: string) => {
			navigator.clipboard.writeText(content);
			setIsCopyedId(chatId);
			copyTimerRef.current = setTimeout(() => {
				setIsCopyedId('');
			}, 500);
		}, []);

		const aiMessages = assistantStore.messages;
		const ragMessages = knowledgeRagQaStore.messages;
		const messages = isRagMode ? ragMessages : aiMessages;

		const lastMsg = messages[messages.length - 1];
		const streamScrollTick =
			lastMsg != null
				? `${messages.length}:${lastMsg.chatId}:${lastMsg.content.length}:${lastMsg.thinkContent?.length ?? 0}:${lastMsg.isStreaming ? 1 : 0}`
				: String(messages.length);

		/** AI 模式非流式就绪贴底签名，交给 `useStickToBottomScroll.idleFlushKey`（RAG 传 null 以清除内部记忆） */
		const aiIdleFlushKey = useMemo((): string | null => {
			if (isRagMode) return null;
			if (assistantStore.isHistoryLoading) return null;
			if (aiMessages.length === 0) return null;
			const first = aiMessages[0];
			const last = aiMessages[aiMessages.length - 1];
			return `${documentKey}-${assistantStore.activeSessionId ?? ''}-${aiMessages.length}-${first?.chatId ?? ''}-${last?.chatId ?? ''}`;
		}, [
			isRagMode,
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
			isStreaming: isRagMode
				? knowledgeRagQaStore.isStreaming
				: assistantStore.isStreaming,
			contentRevision: streamScrollTick,
			resetKey: isRagMode
				? 'knowledge-rag-qa-global'
				: documentKey
					? `${documentKey}:session:${assistantStore.activeSessionId ?? 'none'}`
					: undefined,
			idleFlushKey: aiIdleFlushKey,
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

		const refreshScrollCornerFab = useCallback(() => {
			const vp = scrollViewportRef.current;
			if (!vp) return;
			const { scrollTop, scrollHeight, clientHeight } = vp;
			const maxScroll = scrollHeight - clientHeight;
			let nextMode: KnowledgeAssistantScrollCornerFabMode = 'hidden';
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

		const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
			scrollViewportRef as RefObject<HTMLElement | null>,
			{
				// 助手正文 / 流式增量会变高，须触发 `layoutChatCodeToolbars`（勿仅用 knowledgeStore.markdown）
				layoutDeps: [
					streamScrollTick,
					documentKey,
					messages.length,
					isRagMode,
					knowledgeRagQaStore.isStreaming,
				],
				passiveScrollLayout: true,
				passiveScrollDeps: [
					documentKey,
					messages.length,
					streamScrollTick,
					isRagMode
						? knowledgeRagQaStore.isStreaming
						: assistantStore.isStreaming,
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

		// 正文变化 / 视口尺寸变化时更新「是否可滚、是否触底」
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
					behavior: 'smooth',
				});
			} else if (scrollCornerFabMode === 'toTop') {
				// 流式阶段若不先解除贴底，会被 useStickToBottomScroll 立刻拉回底部
				disableStreamStickToBottom();
				vp.scrollTo({ top: 0, behavior: 'smooth' });
			}
		}, [
			scrollViewportRef,
			enableStreamStickToBottom,
			disableStreamStickToBottom,
			scrollCornerFabMode,
		]);

		const sendMessage = useCallback(
			async (content?: string) => {
				if (isRagMode) {
					const text = (content ?? ragInput).trim();
					if (!text) return;
					if (!isLoggedIn) {
						Toast({
							type: 'warning',
							title: t('knowledge.assistant.loginToUse'),
						});
						return;
					}
					setRagInput('');
					enableStreamStickToBottom();
					await knowledgeRagQaStore.sendMessage(text);
					return;
				}
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
				await assistantStore.sendMessage(text);
			},
			[input, ragInput, isLoggedIn, enableStreamStickToBottom, isRagMode],
		);

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

		const [isAiHistoryDrawerOpen, setIsAiHistoryDrawerOpen] = useState(false);

		useEffect(() => {
			if (!isAiHistoryDrawerOpen) return;
			// 打开抽屉时轻量刷新一次会话列表
			void assistantStore.refreshSessionListForCurrentDocument();
		}, [isAiHistoryDrawerOpen]);

		const {
			allowAiShare,
			shareFlow,
			shareSelection,
			onShare,
			setShareModelVisible,
			shareChatNode,
		} = useKnowledgeAssistantShare({
			aiMessages,
			isLoggedIn,
			isRagMode,
		});

		/** 当前为「会话列表 + 底部输入」视图（与加载中 / 空状态引导互斥） */
		const conversationColumnActive = !(
			(!isRagMode && assistantStore.isHistoryLoading) ||
			(isRagMode && !ragMessages.length) ||
			(!isRagMode && !aiMessages.length)
		);

		const renderAssistantFooter = (embeddedInConversationColumn: boolean) => (
			<div
				className={cn(
					'min-w-0 w-full',
					embeddedInConversationColumn && 'shrink-0',
				)}
			>
				{/*
					置顶/置底钮与消息列同宽：定位在 max-w-3xl 内容容器内，right-4 与 pr-4 对齐，避免相对全屏 footer 用 right-0 贴到面板最右侧。
				*/}
				<div className="relative mx-auto min-w-0 w-full max-w-3xl pl-4 pr-4">
					{messages.length > 0 && scrollCornerFabMode !== 'hidden' ? (
						<button
							type="button"
							className={cn(
								'absolute bottom-full right-4 z-10 mb-[17px] flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/70 backdrop-blur-[2px] hover:bg-theme/15',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
							)}
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
					{allowAiShare && shareSelection.isSharing ? (
						<KnowledgeAssistantShareBar
							aiMessages={aiMessages}
							shareSelection={shareSelection}
							shareFlow={shareFlow}
							setShareModelVisible={setShareModelVisible}
						/>
					) : (
						<ChatEntry
							t={t}
							input={isRagMode ? ragInput : input}
							setInput={isRagMode ? setRagInput : setInput}
							className="w-full px-0 pb-4.5"
							textareaClassName="min-h-9"
							inputWrapClassName="border-theme/5"
							sendMessage={sendMessage}
							placeholder={
								isRagMode
									? t('knowledge.assistant.placeholder.rag')
									: editorHasBody
										? t('knowledge.assistant.placeholder.ai')
										: t('knowledge.assistant.placeholder.aiNeedsBody')
							}
							disableTextInput={isRagMode ? false : !editorHasBody}
							loading={
								isRagMode
									? knowledgeRagQaStore.isSending
									: assistantStore.isSending || assistantStore.isHistoryLoading
							}
							stopGenerating={
								isRagMode
									? knowledgeRagQaStore.isStreaming
										? stopGenerating
										: undefined
									: assistantStore.isStreaming
										? stopGenerating
										: undefined
							}
							entryChildren={
								<KnowledgeAssistantEntryToolbar
									showEntryToolbar={showEntryToolbar}
									showAiSessionActions={showAiSessionActions}
									isAiSessionSwitcherLocked={isAiSessionSwitcherLocked}
									isAiHistoryDrawerOpen={isAiHistoryDrawerOpen}
									setIsAiHistoryDrawerOpen={setIsAiHistoryDrawerOpen}
									enableStreamStickToBottom={enableStreamStickToBottom}
									flushScrollToBottom={flushScrollToBottom}
									assistantMode={assistantMode}
									setAssistantMode={setAssistantMode}
								/>
							}
						/>
					)}
					{shareChatNode}
				</div>
			</div>
		);

		return (
			<div className="relative flex h-full w-full flex-col overflow-hidden">
				<ChatCodeFloatingToolbar t={t} />
				{/* 多会话切换入口改到输入框区域（见 ChatEntry.entryChildren） */}
				{!isRagMode && assistantStore.isHistoryLoading ? (
					<div className="text-textcolor/70 flex flex-1 items-center justify-center text-sm">
						<Loading text={t('knowledge.assistant.loadingConversation')} />
					</div>
				) : isRagMode && !ragMessages.length ? (
					<div className="max-w-3xl mx-auto text-textcolor/70 flex flex-1 justify-center items-start text-sm pt-4 pl-4 pr-4">
						<div className="w-full flex gap-2 border border-theme/5 bg-theme/2 p-3 rounded-md">
							<BookOpen size={18} className="mt-[3px] shrink-0 text-teal-500" />
							<div className="flex-1 text-sm leading-relaxed">
								{t('knowledge.assistant.ragIntro')}
							</div>
						</div>
					</div>
				) : !isRagMode && !aiMessages.length ? (
					<div className="text-textcolor/70 flex flex-1 justify-center items-start text-sm pt-4">
						{knowledgeStore.markdown ? (
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
									<div className="flex-1">
										{t('knowledge.assistant.aiIntro')}
									</div>
								</div>
							</div>
						)}
					</div>
				) : (
					<div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
						{/*
							ScrollArea 必须占满助手面板宽度，滚动条才会贴在容器最右侧。
							max-w-3xl 仅作用在滚动内容（及底部输入）上，避免整列变窄后滚动条跟着缩在中间留白旁。
						*/}
						<ScrollArea
							ref={scrollViewportRef}
							className="min-h-0 min-w-0 w-full flex-1 mb-0.5"
							viewportClassName="pb-1 [overflow-anchor:none]"
							{...scrollAreaHandlers}
						>
							<div className="relative mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-col pt-4 px-3.5 select-none">
								{messages.map((message, index) => (
									<KnowledgeMessageBubble
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
								{showRagNewConversation ? (
									<div className="mb-3 flex w-full min-w-0 justify-start">
										<Button
											size="sm"
											variant="dynamic"
											className="w-fit rounded-md border border-theme/5 bg-theme/5 px-3 py-1.5 text-sm text-textcolor/80 transition-colors hover:border-theme/20 hover:text-textcolor"
											onClick={() => {
												knowledgeRagQaStore.resetConversation();
												setRagInput('');
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
	},
);

export default KnowledgeAssistant;
