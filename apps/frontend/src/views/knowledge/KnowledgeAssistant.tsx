/**
 * 知识库右侧通用助手：维护 `knowledgeAssistantPersistenceAllowed` 与 `documentKey` 驱动的 `activateForDocument`。
 * 完整设计文档：`docs/knowledge/knowledge-assistant-complete.md`。
 */

import Loading from '@design/Loading';
import { Button, Toast } from '@ui/index';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	type RefObject,
	type UIEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatEntry from '@/components/design/ChatEntry';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import { ScrollArea } from '@/components/ui';
import { useStickToBottomScroll } from '@/hooks';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { cn } from '@/lib/utils';
import useStore from '@/store';
import assistantStore from '@/store/assistant';
import type { Message } from '@/types/chat';
import {
	KNOWLEDGE_ASSISTANT_PROMPTS,
	type KnowledgeAssistantPromptKind,
} from './constants';
import {
	buildKnowledgeAssistantDocumentMessage,
	isKnowledgeLocalMarkdownId,
} from './utils';

interface KnowledgeAssistantProps {
	/** 与 MarkdownEditor `documentIdentity` 一致，用于绑定助手多轮会话 */
	documentKey: string;
	/**
	 * 外部受控输入框（可选）：用于从编辑器右键菜单等外部入口写入草稿。
	 * 若不传则组件内部维护 input state。
	 */
	input?: string;
	setInput?: (value: string) => void;
}

interface KnowledgeAssistantMessageBubbleProps {
	chatId: string;
	index: number;
	messagesLength: number;
	isCopyedId: string;
	onCopy: (content: string, chatId: string) => void;
	onSaveToKnowledge: (message: Message) => void;
	/** 与 ScrollArea Viewport ref 一致，供助手消息内代码块吸顶条与 MdPreview 懒挂载 */
	scrollViewportRef: RefObject<HTMLElement | null>;
}

type KnowledgeAssistantScrollCornerFabMode = 'hidden' | 'toBottom' | 'toTop';

/**
 * 单条气泡独立 observer：从 store 解析出当前 Message。
 * `data-msg-rev` 绑定「正文长度 + 思考区长度 + 是否在流式」的合成串，
 * 使 MobX 在流式阶段能稳定订阅这些字段（语义：消息内容版本戳，非 hack 预读）。
 */
const KnowledgeAssistantMessageBubble = observer(
	function KnowledgeAssistantMessageBubble({
		chatId,
		index,
		messagesLength,
		isCopyedId,
		onCopy,
		onSaveToKnowledge,
		scrollViewportRef,
	}: KnowledgeAssistantMessageBubbleProps) {
		const message = assistantStore.messages.find((m) => m.chatId === chatId);
		if (!message) return null;

		const streamRev =
			message.role === 'assistant'
				? `${message.content.length}:${message.thinkContent?.length ?? 0}:${message.isStreaming ? 1 : 0}`
				: `${message.content.length}`;

		return (
			<div
				className={cn(
					// min-w-0：flex 子项默认可缩到小于内容宽，避免代码块/长行把整列撑出 ScrollArea
					'relative flex min-w-0 max-w-full flex-1 flex-col gap-1 pb-10 w-full group last:pb-8.5',
					message.role === 'user' ? 'items-end' : '',
				)}
				data-msg-rev={streamRev}
			>
				<div
					id="message-md-wrap"
					className={cn(
						'relative flex min-w-0 max-w-full rounded-md p-3 select-auto text-textcolor mb-5',
						message.role === 'user'
							? 'w-fit max-w-full self-end bg-teal-600/5 border border-teal-500/15 text-end pt-2 pb-2.5 px-3'
							: 'flex-1 bg-theme/5 border border-theme/10',
					)}
				>
					{message.role === 'user' ? (
						<ChatAssistantMessage
							message={message}
							className="text-left min-w-0 max-w-full [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full [&_.markdown-body]:overflow-x-auto"
						/>
					) : (
						<ChatAssistantMessage
							message={message}
							scrollViewportRef={scrollViewportRef}
						/>
					)}

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
							onCopy={onCopy}
							needShare={false}
							onSaveToKnowledge={onSaveToKnowledge}
						/>
					</div>
				</div>
			</div>
		);
	},
);

const KnowledgeAssistant = observer(
	({
		documentKey,
		input: inputProp,
		setInput: setInputProp,
	}: KnowledgeAssistantProps) => {
		const { knowledgeStore, userStore } = useStore();
		const [internalInput, setInternalInput] = useState('');
		const input = inputProp ?? internalInput;
		const setInput = setInputProp ?? setInternalInput;
		const [isCopyedId, setIsCopyedId] = useState('');
		const [scrollCornerFabMode, setScrollCornerFabMode] =
			useState<KnowledgeAssistantScrollCornerFabMode>('hidden');
		const scrollCornerFabModeRef =
			useRef<KnowledgeAssistantScrollCornerFabMode>('hidden');

		const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

		const isLoggedIn = Boolean(userStore.userInfo?.id);
		const editorHasBody = Boolean((knowledgeStore.markdown ?? '').trim());

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

		// 左侧编辑器被清空时，同步清空助手输入框，避免禁用输入后仍残留未发送草稿
		useEffect(() => {
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
		}, [knowledgeStore.markdown, setInput, knowledgeStore]);

		const onSaveToKnowledge = useCallback(
			(message: Message) => {
				const body = (message.content ?? '').trim();
				if (!body) {
					Toast({ type: 'warning', title: '没有可写入的正文' });
					return;
				}
				const cur = knowledgeStore.markdown.trimEnd();
				const next = cur ? `${cur}\n\n${body}\n` : `${body}\n`;
				knowledgeStore.setMarkdown(next);
				Toast({ type: 'success', title: '已追加到当前知识文档' });
			},
			[knowledgeStore],
		);

		const onCopy = useCallback((content: string, chatId: string) => {
			navigator.clipboard.writeText(content);
			setIsCopyedId(chatId);
			copyTimerRef.current = setTimeout(() => {
				setIsCopyedId('');
			}, 500);
		}, []);

		const messages = assistantStore.messages;

		const lastMsg = messages[messages.length - 1];
		const streamScrollTick =
			lastMsg != null
				? `${messages.length}:${lastMsg.chatId}:${lastMsg.content.length}:${lastMsg.thinkContent?.length ?? 0}:${lastMsg.isStreaming ? 1 : 0}`
				: String(messages.length);

		const {
			viewportRef: scrollViewportRef,
			scrollViewportHandlers,
			enableStickToBottom: enableStreamStickToBottom,
			disableStickToBottom: disableStreamStickToBottom,
			flushScrollToBottom,
		} = useStickToBottomScroll({
			isStreaming: assistantStore.isStreaming,
			contentRevision: streamScrollTick,
			resetKey: documentKey || undefined,
		});

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
			isLoggedIn &&
			messages.length > 0 &&
			editorHasBody &&
			!assistantStore.isHistoryLoading &&
			!assistantStore.isSending &&
			!assistantStore.isStreaming;

		// 条带插入后 scrollHeight 变化，须在布局后贴底，否则用户仍停在旧滚动位置
		useLayoutEffect(() => {
			if (!showPostStreamActions) return;
			flushScrollToBottom();
			requestAnimationFrame(() => flushScrollToBottom());
		}, [showPostStreamActions, flushScrollToBottom]);

		const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
			scrollViewportRef as RefObject<HTMLElement | null>,
			{
				// 助手正文 / 流式增量会变高，须触发 `layoutChatCodeToolbars`（勿仅用 knowledgeStore.markdown）
				layoutDeps: [streamScrollTick, documentKey, messages.length],
				passiveScrollLayout: true,
				passiveScrollDeps: [
					documentKey,
					messages.length,
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
				const text = (content ?? input).trim();
				if (!text) return;
				if (!isLoggedIn) {
					Toast({ type: 'warning', title: '请先登录后再使用助手' });
					return;
				}
				setInput('');
				enableStreamStickToBottom();
				await assistantStore.sendMessage(text);
			},
			[input, isLoggedIn, enableStreamStickToBottom],
		);

		/** 首页快捷卡片：用户气泡仅显示标题，请求体携带当前文档全文 */
		const sendKnowledgePromptCard = useCallback(
			async (kind: KnowledgeAssistantPromptKind) => {
				if (!isLoggedIn) {
					Toast({ type: 'warning', title: '请先登录后再使用助手' });
					return;
				}
				const md = (knowledgeStore.markdown ?? '').trim();
				if (!md) {
					Toast({ type: 'warning', title: '请先在左侧编辑器输入正文' });
					return;
				}
				if (
					assistantStore.isSending ||
					assistantStore.isHistoryLoading ||
					assistantStore.isStreaming
				) {
					Toast({ type: 'warning', title: '请等待当前回复结束后再试' });
					return;
				}
				const { userMessageShort, extraUserContentForModel } =
					buildKnowledgeAssistantDocumentMessage(
						kind,
						knowledgeStore.markdown ?? '',
					);
				enableStreamStickToBottom();
				await assistantStore.sendMessage(userMessageShort, {
					extraUserContentForModel,
				});
			},
			[isLoggedIn, knowledgeStore.markdown, enableStreamStickToBottom],
		);

		const stopGenerating = useCallback(() => {
			void assistantStore.stopGenerating();
		}, []);

		return (
			<div className="relative flex h-full w-full flex-col overflow-hidden">
				<ChatCodeFloatingToolbar />
				{assistantStore.isHistoryLoading ? (
					<div className="text-textcolor/70 flex flex-1 items-center justify-center text-sm">
						<Loading text="正在加载对话…" />
					</div>
				) : !messages.length ? (
					<div className="text-textcolor/70 flex flex-1 justify-center items-start text-sm pt-4 pl-4 pr-4.5">
						{knowledgeStore.markdown ? (
							<div className="w-full flex flex-col gap-2 justify-center items-center">
								<div className="w-full flex gap-3">
									{KNOWLEDGE_ASSISTANT_PROMPTS.map((item) => (
										<button
											key={item.kind}
											type="button"
											className={cn(
												'flex-1 flex items-start gap-2 border border-theme/10 bg-theme/5 text-textcolor hover:bg-theme/15 py-2 pl-2 pr-2.5 rounded-md cursor-pointer text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-theme/40',
												(assistantStore.isSending ||
													assistantStore.isHistoryLoading ||
													assistantStore.isStreaming) &&
													'pointer-events-none opacity-50',
											)}
											onClick={() => void sendKnowledgePromptCard(item.kind)}
										>
											<item.icon className="text-teal-500 mt-0.5 shrink-0" />
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<span className="text-base font-medium">
													{item.title}
												</span>
												<span className="text-sm text-textcolor/80">
													{item.description}
												</span>
											</div>
										</button>
									))}
								</div>
							</div>
						) : (
							<div className="w-full flex justify-between bg-theme/5 p-2 rounded-md border border-theme/10">
								<Sparkles size={18} className="mr-2 text-teal-500 mt-0.5" />
								<div className="flex-1">
									Hi，我是您的专属知识库助手！从日常的资料查阅、流程指引，到棘手难题的排查与解答，我都会为您提供即时、精准的信息支持。您可以把我当作随时在线的业务智囊，帮您大幅节省检索时间，提升工作效能。
								</div>
							</div>
						)}
					</div>
				) : (
					<ScrollArea
						ref={scrollViewportRef}
						className="min-h-0 flex-1"
						viewportClassName="pb-1 [overflow-anchor:none]"
						{...scrollAreaHandlers}
					>
						<div
							className={cn(
								// 仅加 min-w-0：勿再写 max-w-full，否则会覆盖 max-w-3xl 的栏宽上限
								'pt-4 max-w-3xl mx-auto relative flex w-full min-w-0 flex-col select-none  pr-4 pl-3.5',
							)}
						>
							{messages.map((message, index) => (
								<KnowledgeAssistantMessageBubble
									key={message.chatId}
									chatId={message.chatId}
									index={index}
									messagesLength={messages.length}
									isCopyedId={isCopyedId}
									onCopy={onCopy}
									onSaveToKnowledge={onSaveToKnowledge}
									scrollViewportRef={
										scrollViewportRef as RefObject<HTMLElement | null>
									}
								/>
							))}
							{showPostStreamActions ? (
								<div className="flex w-full min-w-0 flex-wrap gap-3.5 mb-3">
									{KNOWLEDGE_ASSISTANT_PROMPTS.map((item) => (
										<Button
											key={item.kind}
											variant="dynamic"
											className="w-fit rounded-md border border-theme/10 bg-theme/5 p-2 text-left text-sm text-textcolor/80 transition-colors hover:border-theme/20 hover:text-textcolor"
											onClick={() => void sendKnowledgePromptCard(item.kind)}
										>
											{item.title}
										</Button>
									))}
								</div>
							) : null}
						</div>
					</ScrollArea>
				)}
				{isLoggedIn ? (
					<div className="relative w-full flex items-center justify-center pr-4 pl-3.5">
						{messages.length > 0 && scrollCornerFabMode !== 'hidden' ? (
							<button
								type="button"
								className={cn(
									'absolute bottom-full mb-5 right-4.5 z-10 flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/70 backdrop-blur-[2px] hover:bg-theme/15',
									'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
								)}
								aria-label={
									scrollCornerFabMode === 'toBottom'
										? '滚动到底部'
										: '滚动到顶部'
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
							input={input}
							setInput={setInput}
							className="w-full pl-0.5 pr-0.5 pb-4.5 border-theme/10"
							textareaClassName="min-h-9"
							sendMessage={sendMessage}
							placeholder={
								editorHasBody
									? '请输入您的问题'
									: '请先在左侧编辑器输入正文后再向我提问'
							}
							disableTextInput={!editorHasBody}
							loading={
								assistantStore.isSending || assistantStore.isHistoryLoading
							}
							stopGenerating={
								assistantStore.isStreaming ? stopGenerating : undefined
							}
						/>
					</div>
				) : null}
			</div>
		);
	},
);

export default KnowledgeAssistant;
