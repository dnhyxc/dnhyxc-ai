import { MarkdownParser } from '@dnhyxc-ai/tools';
import { Button, ScrollArea, Spinner, Textarea, Toast } from '@ui/index';
import '@dnhyxc-ai/tools/styles.css';
import { motion } from 'framer-motion';
import {
	Bot,
	CirclePlus,
	Rocket,
	StopCircle,
	Trash2,
	User,
} from 'lucide-react';
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
}) => {
	const [messages, setMessages] = useState<Message[]>(initialMessages);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const [isComposing, setIsComposing] = useState(false);

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

	// 处理输入框变化
	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value);
	};

	// 插入换行符的辅助函数
	const insertNewline = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		e.preventDefault();
		const textarea = e.currentTarget;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const newValue = `${input.substring(0, start)}\n${input.substring(end)}`;
		setInput(newValue);
		// 移动光标到插入位置后
		setTimeout(() => {
			textarea.selectionStart = textarea.selectionEnd = start + 1;
		}, 0);
	};

	// 处理输入框按键
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter') {
			// 检查是否按下了修饰键
			const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;

			// 组合输入状态下（中文输入法）
			// 使用原生事件的 isComposing 属性，这是最可靠的方法
			const isCurrentlyComposing =
				(e.nativeEvent as KeyboardEvent).isComposing || isComposing;

			if (isCurrentlyComposing) {
				// 如果按下了 Ctrl/Cmd + Enter，即使在组合输入状态下也插入换行
				if (e.ctrlKey || e.metaKey) {
					insertNewline(e);
				}
				// 其他情况允许默认行为（中文输入法选择候选词）
				return;
			}

			// 非组合输入状态下
			if (e.ctrlKey || e.metaKey) {
				// Ctrl/Cmd + Enter: 插入换行符
				insertNewline(e);
			} else if (e.shiftKey) {
				// Shift + Enter: 也插入换行符（常见约定）
				insertNewline(e);
			} else if (!hasModifier) {
				// 纯 Enter（没有任何修饰键）: 发送消息
				e.preventDefault();
				// sendMessage();
				console.log('发送消息');
			}
		}
	};

	// 处理组合输入开始
	const handleCompositionStart = () => {
		setIsComposing(true);
	};

	// 处理组合输入结束
	const handleCompositionEnd = () => {
		// 延迟设置 isComposing 为 false，确保 keydown 事件能检测到组合状态
		setTimeout(() => {
			setIsComposing(false);
		}, 0);
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
			<div className="p-4 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto flex gap-5">
					<div className="flex-1 relative overflow-hidden">
						<div className="flex flex-col overflow-y-auto rounded-md bg-theme/5">
							<Textarea
								ref={inputRef}
								value={input}
								onChange={handleChange}
								onKeyDown={handleKeyDown}
								onCompositionStart={handleCompositionStart}
								onCompositionEnd={handleCompositionEnd}
								placeholder="输入消息..."
								spellCheck={false}
								rows={4}
								className="flex-1 resize-none border-none shadow-none pr-12 focus-visible:ring-transparent"
								disabled={loading}
							/>
							<div className="flex items-center justify-between h-10 p-2.5 mb-1">
								<Button
									variant="ghost"
									className="flex items-center text-sm bg-theme/5 mb-1 h-8 rounded-md"
									onClick={() => {
										setInput('');
									}}
								>
									<CirclePlus className="w-4 h-4 mr-2" />
									新对话
								</Button>
								{loading ? (
									<Button
										variant="ghost"
										onClick={stopGenerating}
										className="h-8 w-8 mb-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
									>
										<StopCircle />
									</Button>
								) : (
									<Button
										variant="ghost"
										onClick={sendMessage}
										disabled={!input.trim()}
										className="h-8 w-8 mb-1 flex items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-cyan-500"
									>
										<Rocket className="-rotate-45" />
									</Button>
								)}
							</div>
						</div>
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
			</div>
		</div>
	);
};

export default ChatBot;
