import { Toast } from '@ui/index';
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
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatEntry from '@/components/design/ChatEntry';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import ChatUserMessage from '@/components/design/ChatUserMessage';
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

interface KnowledgeAssistantProps {
	/** 与 MarkdownEditor `documentIdentity` 一致，用于绑定助手多轮会话 */
	documentKey: string;
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
					'relative flex min-w-0 max-w-full flex-1 flex-col gap-1 pb-10 w-full group last:pb-0',
					message.role === 'user' ? 'items-end' : '',
				)}
				data-msg-rev={streamRev}
			>
				<div
					id="message-md-wrap"
					className={cn(
						'relative flex min-w-0 max-w-full flex-1 rounded-md p-3 select-auto text-textcolor mb-5',
						message.role === 'user'
							? 'bg-teal-600/10 border border-teal-600/10 text-end pt-2 pb-2.5 px-3'
							: 'bg-theme/5 border border-theme/10',
					)}
				>
					{message.role === 'user' ? (
						<ChatUserMessage message={message} />
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
	({ documentKey }: KnowledgeAssistantProps) => {
		const { knowledgeStore, userStore } = useStore();
		const [input, setInput] = useState('');
		const [isCopyedId, setIsCopyedId] = useState('');

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

		useEffect(() => {
			if (!documentKey) return;
			void assistantStore.activateForDocument(documentKey);
		}, [documentKey]);

		// 左侧编辑器被清空时，同步清空助手输入框，避免禁用输入后仍残留未发送草稿
		useEffect(() => {
			if (!(knowledgeStore.markdown ?? '').trim()) {
				setInput('');
			}
		}, [knowledgeStore.markdown]);

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
		} = useStickToBottomScroll({
			isStreaming: assistantStore.isStreaming,
			contentRevision: streamScrollTick,
			resetKey: documentKey || undefined,
		});

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
				},
			};
		}, [scrollViewportHandlers, relayoutCodeToolbar]);

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

		const stopGenerating = useCallback(() => {
			void assistantStore.stopGenerating();
		}, []);

		return (
			<div className="relative flex h-full w-full flex-col overflow-hidden">
				<ChatCodeFloatingToolbar />
				{!isLoggedIn ? (
					<div className="text-textcolor/70 flex flex-1 items-center justify-center px-4 text-center text-sm">
						登录后可在此与 AI 助手对话，会话按当前知识文档分别保存。
					</div>
				) : assistantStore.isHistoryLoading && messages.length === 0 ? (
					<div className="text-textcolor/70 flex flex-1 items-center justify-center text-sm">
						正在加载对话…
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
								'pt-4 max-w-3xl mx-auto relative flex w-full min-w-0 flex-col select-none pr-4 pl-3.5',
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
						</div>
					</ScrollArea>
				)}
				{isLoggedIn ? (
					<div className="mt-4 flex items-center justify-center">
						<ChatEntry
							input={input}
							setInput={setInput}
							className="max-w-3xl pl-4 pr-4.5 pb-4.5 border-theme/10"
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
