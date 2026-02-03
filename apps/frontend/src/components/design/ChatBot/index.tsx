import { MarkdownParser } from '@dnhyxc-ai/tools';
import { Button, ScrollArea, Spinner, Textarea, Toast } from '@ui/index';
import '@dnhyxc-ai/tools/styles.css';
import { motion } from 'framer-motion';
import { Bot, Send, StopCircle, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { streamFetch } from '@/utils/sse';

interface Message {
	id: string;
	content: string;
	role: 'user' | 'assistant';
	timestamp: Date;
	isStreaming?: boolean;
}

interface ChatBotProps {
	className?: string;
	initialMessages?: Message[];
	apiEndpoint?: string;
	maxHistory?: number;
}

const ChatBot: React.FC<ChatBotProps> = ({
	className,
	initialMessages = [],
	apiEndpoint = '/chat/zhipu-stream',
	maxHistory = 10,
}) => {
	const [messages, setMessages] = useState<Message[]>(initialMessages);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);

	const stopRequestRef = useRef<(() => void) | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	// 初始化 markdown 解析器
	const parser = useMemo(() => new MarkdownParser(), []);

	// 自动滚动到底部
	useEffect(() => {
		if (autoScroll && scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop =
				scrollContainerRef.current.scrollHeight;
		}
	}, [messages, autoScroll]);

	// 滚动事件处理
	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const element = e.currentTarget;
		if (!scrollContainerRef.current) {
			scrollContainerRef.current = element;
		}
		const { scrollTop, scrollHeight, clientHeight } = element;
		const SCROLL_THRESHOLD = 50;
		const isAtBottom =
			scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
		if (isAtBottom) {
			setAutoScroll(true);
		} else {
			setAutoScroll(false);
		}
	};

	// 发送消息
	const sendMessage = async () => {
		if (!input.trim() || loading) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			content: input.trim(),
			role: 'user',
			timestamp: new Date(),
		};

		// 添加用户消息
		setMessages((prev) => [...prev, userMessage]);
		setInput('');
		setLoading(true);
		setAutoScroll(true);

		// 创建 assistant 消息占位符
		const assistantMessageId = (Date.now() + 1).toString();
		const assistantMessage: Message = {
			id: assistantMessageId,
			content: '',
			role: 'assistant',
			timestamp: new Date(),
			isStreaming: true,
		};

		setMessages((prev) => [...prev, assistantMessage]);

		// 准备历史消息（限制长度）
		// const recentMessages = messages.slice(-maxHistory);
		// const history = recentMessages.map((msg) => ({
		// 	role: msg.role,
		// 	content: msg.content,
		// }));

		// 调用流式 API
		try {
			const stop = await streamFetch({
				api: apiEndpoint,
				options: {
					body: JSON.stringify({
						messages: [
							// ...history,
							{ role: 'user', content: userMessage.content },
						],
						stream: true,
					}),
				},
				callbacks: {
					onStart: () => {
						// 已经开始
					},
					onData: (chunk) => {
						if (typeof chunk === 'string') {
							setMessages((prev) =>
								prev.map((msg) =>
									msg.id === assistantMessageId
										? {
												...msg,
												content: msg.content + chunk,
												isStreaming: true,
											}
										: msg,
								),
							);
						}
					},
					onError: (err, type) => {
						setLoading(false);
						Toast({
							type: type || 'error',
							title: err?.message || String(err) || '发送失败',
						});
						// 移除失败的流式消息
						setMessages((prev) =>
							prev.filter(
								(msg) => !(msg.id === assistantMessageId && msg.content === ''),
							),
						);
					},
					onComplete: () => {
						setLoading(false);
						// 更新消息状态，结束流式传输
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === assistantMessageId
									? { ...msg, isStreaming: false }
									: msg,
							),
						);
					},
				},
			});

			stopRequestRef.current = stop;
		} catch (_error) {
			setLoading(false);
			Toast({
				type: 'error',
				title: '发送消息失败',
			});
			setMessages((prev) =>
				prev.filter(
					(msg) => !(msg.id === assistantMessageId && msg.content === ''),
				),
			);
		}
	};

	// 停止生成
	const stopGenerating = () => {
		if (stopRequestRef.current) {
			stopRequestRef.current();
			stopRequestRef.current = null;
			setLoading(false);
			// 更新最后一条助手消息状态
			setMessages((prev) =>
				prev.map((msg, index) =>
					index === prev.length - 1 && msg.role === 'assistant'
						? { ...msg, isStreaming: false }
						: msg,
				),
			);
		}
	};

	// 清除对话
	const clearChat = () => {
		setMessages([]);
		stopRequestRef.current?.();
		stopRequestRef.current = null;
		setLoading(false);
	};

	// 处理输入框按键
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			console.log('handleKeyDown');
			// sendMessage();
		}
	};

	// 聚焦输入框
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<div className={cn('flex flex-col h-full w-full', className)}>
			{/* 聊天消息区域 */}
			<ScrollArea
				ref={scrollContainerRef}
				className="flex-1 overflow-hidden w-full backdrop-blur-sm"
				onScroll={handleScroll}
			>
				<div className="max-w-4xl mx-auto p-4 space-y-6 overflow-auto">
					{messages.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-96 text-textcolor/50">
							<Bot className="w-16 h-16 mb-4" />
							<p className="text-lg">开始与 AI 对话吧！</p>
							<p className="text-sm mt-2">输入你的问题，按 Enter 发送</p>
						</div>
					) : (
						messages.map((message) => (
							<motion.div
								key={message.id}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								className={cn(
									'flex gap-4',
									message.role === 'user' ? 'flex-row-reverse' : '',
								)}
							>
								{/* 头像 */}
								<div
									className={cn(
										'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
										message.role === 'user'
											? 'bg-blue-500/20'
											: 'bg-purple-500/20',
									)}
								>
									{message.role === 'user' ? (
										<User className="w-5 h-5 text-blue-400" />
									) : (
										<Bot className="w-5 h-5 text-purple-400" />
									)}
								</div>

								{/* 消息内容 */}
								<div
									className={cn(
										'flex-1 max-w-3xl rounded-2xl p-4',
										message.role === 'user'
											? 'bg-blue-500/10 border border-blue-500/20'
											: 'bg-theme/5 border border-theme-white/10',
									)}
								>
									<div
										className="prose prose-invert max-w-none"
										dangerouslySetInnerHTML={{
											__html: parser.render(message.content || '思考中...'),
										}}
									/>
									{message.isStreaming && (
										<div className="mt-2 flex items-center">
											<Spinner className="w-4 h-4 mr-2" />
											<span className="text-sm text-textcolor/50">
												正在输入...
											</span>
										</div>
									)}
								</div>
							</motion.div>
						))
					)}
				</div>
			</ScrollArea>

			{/* 输入区域 */}
			<div className="border-t border-theme-white/10 p-4 bg-theme-background/50 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto flex gap-3">
					<div className="flex-1 relative">
						<Textarea
							ref={inputRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="输入消息..."
							spellCheck={false}
							className="min-h-12 max-h-48 resize-none pr-12 bg-theme/5 border-theme-white/10 focus-visible:border-theme/20"
							disabled={loading}
						/>
						{loading ? (
							<Button
								onClick={stopGenerating}
								className="absolute right-2 bottom-2 h-8 px-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
							>
								<StopCircle className="w-4 h-4 mr-2" />
								停止
							</Button>
						) : (
							<Button
								onClick={sendMessage}
								disabled={!input.trim()}
								className="absolute right-2 bottom-2 h-8 px-3 bg-linear-to-r from-blue-500 to-cyan-500"
							>
								<Send className="w-4 h-4" />
							</Button>
						)}
					</div>
					<Button
						variant="secondary"
						onClick={clearChat}
						className="h-12 px-4 bg-theme-white/5 hover:bg-theme-white/10 border border-theme-white/10"
						disabled={messages.length === 0 && !loading}
					>
						<Trash2 className="w-4 h-4" />
					</Button>
				</div>
				<div className="max-w-4xl mx-auto mt-2 text-xs text-textcolor/50 text-center">
					支持多轮对话，最多保留 {maxHistory} 条历史消息
				</div>
			</div>
		</div>
	);
};

export default ChatBot;
