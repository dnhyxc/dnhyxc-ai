import { Toast } from '@ui/index';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatEntry from '@/components/design/ChatEntry';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import ChatUserMessage from '@/components/design/ChatUserMessage';
import { ScrollArea } from '@/components/ui';
import { useStickToBottomScroll } from '@/hooks';
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
					'relative flex-1 flex flex-col gap-1 pb-10 w-full group last:pb-0',
					message.role === 'user' ? 'items-end' : '',
				)}
				data-msg-rev={streamRev}
			>
				<div
					id="message-md-wrap"
					className={cn(
						'relative flex-1 rounded-md p-3 select-auto text-textcolor mb-5',
						message.role === 'user'
							? 'bg-teal-600/10 border border-teal-600/20 text-end pt-2 pb-2.5 px-3'
							: 'bg-theme/5 border border-theme/20',
					)}
				>
					{message.role === 'user' ? (
						<ChatUserMessage message={message} />
					) : (
						<ChatAssistantMessage message={message} />
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
						viewportClassName="pb-1"
						{...scrollViewportHandlers}
					>
						<div
							className={cn(
								'pt-4 max-w-208 mx-auto relative flex w-full flex-col select-none pr-4 pl-3.5',
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
								/>
							))}
						</div>
					</ScrollArea>
				)}
				{isLoggedIn ? (
					<div className="mt-4">
						<ChatEntry
							input={input}
							setInput={setInput}
							className="pl-4 pr-4.5 pb-4.5 border-theme/10"
							textareaClassName="min-h-9"
							sendMessage={sendMessage}
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
