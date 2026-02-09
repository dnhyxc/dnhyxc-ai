import { Button, ScrollArea, Spinner, Textarea, Toast } from '@ui/index';
import { motion } from 'framer-motion';
import {
	Bot,
	Check,
	ChevronDown,
	ChevronRight,
	CirclePlus,
	Copy,
	Link,
	PencilLine,
	Rocket,
	RotateCw,
	StopCircle,
	User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { stopSse, uploadFile } from '@/service';
import { FileWithPreview, UploadedFile } from '@/types';
import { streamFetch } from '@/utils/sse';
import MarkdownPreview from '../Markdown';
import Upload from '../Upload';
import FileInfo from './FileInfo';

interface Message {
	id: string;
	content: string;
	role: 'user' | 'assistant';
	timestamp: Date;
	file?: UploadedFile | null;
	thinkContent?: string;
	isStreaming?: boolean;
	isStopped?: boolean;
}

interface ChatRequestParams {
	messages: { role: 'user' | 'assistant'; content: string }[];
	sessionId: string;
	stream?: boolean;
	filePaths?: string[];
}

interface ChatBotProps {
	className?: string;
	initialMessages?: Message[];
	apiEndpoint?: string;
	maxHistory?: number;
	showAvatar?: boolean;
}

const ChatBot: React.FC<ChatBotProps> = ({
	className,
	initialMessages = [],
	apiEndpoint = '/chat/sse',
	// apiEndpoint = '/chat/zhipu-stream',
	showAvatar = false,
}) => {
	const [messages, setMessages] = useState<Message[]>(initialMessages);
	const [sessionId, setSessionId] = useState('');
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const [isComposing, setIsComposing] = useState(false);
	const [isShowThinkContent, setIsShowThinkContent] = useState(true);
	const [isCopyedId, setIsCopyedId] = useState('');
	const [uploadedFile, setUploadedFile] = useState<UploadedFile>({
		filename: '',
		mimetype: '',
		originalname: '',
		path: '',
		size: 0,
	});

	const stopRequestRef = useRef<(() => void) | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	const navigate = useNavigate();

	// 自动滚动到底部
	useEffect(() => {
		if (autoScroll && scrollContainerRef.current) {
			scrollContainerRef.current.scrollTop =
				scrollContainerRef.current.scrollHeight;
		}
	}, [messages, autoScroll]);

	// 聚焦输入框
	useEffect(() => {
		inputRef.current?.focus();

		return () => {
			if (copyTimer) {
				clearTimeout(copyTimer);
				copyTimer = null;
			}
			stopGenerating();
		};
	}, []);

	// 输入内容变化时自动滚动到底部
	useEffect(() => {
		if (inputRef.current) {
			const textarea = inputRef.current;
			textarea.scrollTop = textarea.scrollHeight;
		}
	}, [input]);

	// 滚动事件处理
	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const element = e.currentTarget;
		if (!scrollContainerRef.current) {
			scrollContainerRef.current = element;
		}
		const { scrollTop, scrollHeight, clientHeight } = element;
		const SCROLL_THRESHOLD = 5;
		const isAtBottom =
			scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
		if (isAtBottom) {
			setAutoScroll(true);
		} else {
			setAutoScroll(false);
		}
	};

	const onSseFetch = async (
		api: string = apiEndpoint,
		assistantMessageId: string,
		userMessage?: Message,
	) => {
		// 调用流式 API
		const messages: ChatRequestParams = {
			messages: [{ role: 'user', content: userMessage?.content || '' }],
			sessionId,
			stream: true,
		};
		if (userMessage?.file) {
			messages.filePaths = [userMessage?.file?.path || ''];
		}
		try {
			const stop = await streamFetch({
				api,
				options: {
					body: JSON.stringify(messages),
				},
				callbacks: {
					onStart: () => {
						setLoading(true);
					},
					onThinking: (thinking) => {
						if (typeof thinking === 'string') {
							setMessages((prev) =>
								prev.map((msg) =>
									msg.id === assistantMessageId
										? {
												...msg,
												thinkContent: msg.thinkContent + thinking,
												isStreaming: true,
											}
										: msg,
								),
							);
						}
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
					getSessionId: (sessionId) => {
						setSessionId(sessionId);
						navigate(`/chat/${sessionId}`);
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
								(msg) =>
									!(
										msg.id === assistantMessageId &&
										msg.content === '' &&
										msg.thinkContent === ''
									),
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
					(msg) =>
						!(
							msg.id === assistantMessageId &&
							msg.content === '' &&
							msg.thinkContent === ''
						),
				),
			);
		}
	};

	// 发送消息
	const sendMessage = async (content?: string, index?: number) => {
		if ((!content && !input.trim()) || loading) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			content: content || input.trim(),
			role: 'user',
			timestamp: new Date(),
		};

		if (uploadedFile.path) {
			userMessage.file = uploadedFile;
		}

		setMessages((prev) => {
			if (content) {
				const messages = [
					...prev.slice(0, index).map((msg) => ({ ...msg, isStopped: false })),
				];
				return content ? messages : [...messages, userMessage];
			}
			return [
				...prev.map((msg) => ({ ...msg, isStopped: false })),
				userMessage,
			];
		});

		setInput('');
		setUploadedFile({
			filename: '',
			mimetype: '',
			originalname: '',
			path: '',
			size: 0,
		});

		setAutoScroll(true);

		// 创建 assistant 消息占位符
		const assistantMessageId = (Date.now() + 1).toString();
		const assistantMessage: Message = {
			id: assistantMessageId,
			content: '',
			thinkContent: '',
			role: 'assistant',
			timestamp: new Date(),
			isStreaming: true,
		};

		setMessages((prev) => [...prev, assistantMessage]);

		// 调用流式 API
		await onSseFetch(apiEndpoint, assistantMessageId, userMessage);
	};

	const onContinue = async () => {
		setMessages((prev) => [
			...prev.map((msg) => ({ ...msg, isStopped: false })),
		]);
		const assistantMessageId = messages[messages.length - 1].id;
		await onSseFetch('/chat/continueSse', assistantMessageId);
	};

	// 停止生成
	const stopGenerating = async () => {
		if (stopRequestRef.current) {
			await stopSse(sessionId);
			stopRequestRef.current();
			stopRequestRef.current = null;
			setLoading(false);
			// 更新最后一条助手消息状态
			setMessages((prev) =>
				prev.map((msg, index) =>
					index === prev.length - 1 && msg.role === 'assistant'
						? { ...msg, isStreaming: false, isStopped: true }
						: msg,
				),
			);
		}
	};

	// 清除对话
	const clearChat = () => {
		setInput('');
		setMessages([]);
		stopRequestRef.current?.();
		stopRequestRef.current = null;
		setLoading(false);
		setSessionId('');
		navigate('/chat');
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
		textarea.selectionStart = textarea.selectionEnd = start + 1;
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
				e.preventDefault();
				// 纯 Enter（没有任何修饰键）: 发送消息
				sendMessage();
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

	const onToggleThinkContent = () => {
		setIsShowThinkContent(!isShowThinkContent);
	};

	const onUploadFile = async (data: FileWithPreview | FileWithPreview[]) => {
		const res = await uploadFile((data as FileWithPreview).file);
		if (res.success) {
			setUploadedFile({
				...res.data,
				path: import.meta.env.VITE_DEV_DOMAIN + res.data.path,
			});
			inputRef.current?.focus();
		}
	};

	const onCopy = (value: string, id: string) => {
		navigator.clipboard.writeText(value);
		setIsCopyedId(id);
		copyTimer = setTimeout(() => {
			setIsCopyedId('');
		}, 500);
	};

	const onReGenerate = (index: number) => {
		const lastUserMessage = messages.filter((msg) => msg.role === 'user');
		const lastUserContent = lastUserMessage?.pop()?.content;
		sendMessage(lastUserContent, index);
	};

	return (
		<div className={cn('flex flex-col h-full w-full', className)}>
			{/* 聊天消息区域 */}
			<ScrollArea
				ref={scrollContainerRef}
				className="flex-1 overflow-hidden w-full backdrop-blur-sm"
				onScroll={handleScroll}
			>
				<div className="max-w-3xl m-auto overflow-y-auto">
					<div className="mx-auto space-y-6 overflow-hidden">
						{messages.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-110 text-textcolor">
								<Bot className="w-16 h-16 mb-4" />
								<p className="text-2xl">欢迎来到 dnhyxc-ai 智能聊天</p>
								<p className="text-lg mt-2">有什么我可以帮您的?</p>
							</div>
						) : (
							messages.map((message, index) => (
								<motion.div
									key={message.id}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									className={cn(
										'flex gap-3 w-full',
										message.role === 'user' ? 'flex-row-reverse' : '',
									)}
								>
									{/* 头像 */}
									{showAvatar ? (
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
									) : null}

									{/* 消息内容 */}
									<div
										className={cn(
											'relative flex-1 flex flex-col gap-3 pb-6 w-full group',
											message.role === 'user' ? 'items-end' : '',
										)}
									>
										{message.file && message.role === 'user' && (
											<FileInfo data={message.file} />
										)}
										<div
											className={cn(
												'flex-1 rounded-md p-3',
												message.role === 'user'
													? 'bg-blue-500/10 border border-blue-500/20 text-end pt-2 pb-2.5 px-3'
													: 'bg-theme/5 border border-theme-white/10',
												showAvatar ? 'max-w-[calc(768px-105px)]' : 'w-auto',
											)}
										>
											{message.role === 'user' ? (
												<div
													className="prose prose-invert max-w-none"
													dangerouslySetInnerHTML={{
														__html: message.content,
													}}
												/>
											) : (
												<div className="w-full h-auto">
													<div className="w-full">
														{message?.thinkContent ? (
															<div
																className="mb-2 flex items-center cursor-pointer select-none"
																onClick={onToggleThinkContent}
															>
																思考过程
																{isShowThinkContent ? (
																	<ChevronDown
																		size={20}
																		className="ml-2 mt-0.5"
																	/>
																) : (
																	<ChevronRight
																		size={20}
																		className="ml-2 mt-0.5"
																	/>
																)}
															</div>
														) : null}
														{message.thinkContent && isShowThinkContent && (
															<MarkdownPreview
																value={message.thinkContent || '思考中...'}
																theme="dark"
																className="h-auto p-0"
																background="transparent"
																padding="0"
															/>
														)}
													</div>
													<MarkdownPreview
														value={
															message.content ||
															(message?.thinkContent ? '' : '思考中...')
														}
														theme="dark"
														className="h-auto p-0"
														background="transparent"
														padding="0"
													/>
												</div>
											)}
											{message.isStreaming && (
												<div className="mt-1 flex items-center">
													<Spinner className="w-4 h-4 mr-2 text-textcolor/50" />
													<span className="text-sm text-textcolor/50">
														正在生成中...
													</span>
												</div>
											)}
											{message.isStopped && (
												<div className="flex items-center justify-end">
													<div
														className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300"
														onClick={onContinue}
													>
														继续生成
													</div>
												</div>
											)}
										</div>
										{message.content && (
											<div
												className={`absolute bottom-0 right-2 gap-3 ${index !== messages.length - 1 ? 'hidden group-hover:flex' : `${loading ? 'hidden' : 'flex items-center'}`} ${message.role === 'user' ? 'justify-end' : 'left-2'}`}
											>
												<div className="cursor-pointer flex items-center justify-center">
													{isCopyedId !== message.id ? (
														<Copy
															size={18}
															onClick={() =>
																onCopy(message.content, message.id)
															}
														/>
													) : (
														<div className="flex items-center justify-center bg-blue-500 rounded-full box-border">
															<Check size={18} />
														</div>
													)}
												</div>
												{message.role === 'user' && (
													<div className="cursor-pointer">
														<PencilLine size={18} />
													</div>
												)}
												{message.role !== 'user' && (
													<div className="cursor-pointer">
														<RotateCw
															size={18}
															onClick={() => onReGenerate(index)}
														/>
													</div>
												)}
											</div>
										)}
									</div>
								</motion.div>
							))
						)}
					</div>
				</div>
			</ScrollArea>

			{/* 输入区域 */}
			<div className="p-5.5 pt-5 backdrop-blur-sm">
				<div className="max-w-3xl mx-auto flex gap-5">
					<div className="flex-1 relative overflow-hidden">
						<div className="flex flex-col overflow-y-auto rounded-md bg-theme/5 border border-theme-white/10">
							{uploadedFile.originalname && (
								<FileInfo data={uploadedFile} showInfo />
							)}
							<Textarea
								ref={inputRef}
								value={input}
								onChange={handleChange}
								onKeyDown={handleKeyDown}
								onCompositionStart={handleCompositionStart}
								onCompositionEnd={handleCompositionEnd}
								placeholder="请输入您的问题"
								spellCheck={false}
								className="flex-1 min-h-16 resize-none border-none shadow-none focus-visible:ring-transparent"
								disabled={loading}
							/>
							<div className="flex items-center justify-between h-10 p-2.5 mb-1 mt-2.5">
								<div className="flex items-center gap-2">
									<Button
										variant="ghost"
										className="flex items-center text-sm bg-theme/5 mb-1 h-8 rounded-md"
										onClick={clearChat}
									>
										<CirclePlus className="w-4 h-4" />
										新对话
									</Button>
									<Upload
										uploadType="button"
										className="w-auto h-auto"
										validTypes={[
											'application/pdf',
											'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
											'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
										]}
										onUpload={onUploadFile}
									>
										<div className="flex items-center">
											<Link className="w-4 h-4 mr-2" />
											上传附件
										</div>
									</Upload>
								</div>
								{loading ? (
									<Button
										variant="ghost"
										onClick={stopGenerating}
										className="h-8 w-8 mb-1 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
									>
										<StopCircle />
									</Button>
								) : (
									<Button
										variant="ghost"
										onClick={() => sendMessage()}
										disabled={!input.trim()}
										className="h-8 w-8 mb-1 flex items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-cyan-500"
									>
										<Rocket className="-rotate-45" />
									</Button>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatBot;
