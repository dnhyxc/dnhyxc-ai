import { Button, ScrollArea } from '@ui/index';
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useParams } from 'react-router';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatCodeToolbarFloating from '@/components/design/ChatCodeToolBar';
import ChatFileList from '@/components/design/ChatFileList';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import ChatUserMessage from '@/components/design/ChatUserMessage';
import { useTheme } from '@/hooks';
import { cn } from '@/lib/utils';
import { getShare } from '@/service';
import { layoutChatCodeToolbars } from '@/utils/chatCodeToolbar';

/** 判定「已到底」允许的像素误差（避免子像素取整导致箭头来回跳） */
const SCROLL_BOTTOM_THRESHOLD = 48;

export interface Session {
	id: string;
	content: string;
	role: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	messages: Message[];
	title: string;
}

export interface UploadedFile {
	id: string;
	uuid: string;
	filename: string;
	mimetype: string;
	originalname: string;
	path: string;
	size: number;
}

export interface Message {
	chatId: string;
	content: string;
	role: 'user' | 'assistant';
	timestamp: Date;
	id?: string;
	createdAt?: Date;
	attachments?: UploadedFile[] | null;
	thinkContent?: string;
	isStreaming?: boolean;
	isStopped?: boolean;
	parentId?: string;
	childrenIds?: string[];
	siblingIndex?: number;
	siblingCount?: number;
	currentChatId?: string;
}

const SessionShare = () => {
	const [isCopyedId, setIsCopyedId] = useState('');

	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrollViewportRef = useRef<HTMLDivElement>(null);

	const [scrollMetrics, setScrollMetrics] = useState({
		top: 0,
		scrollHeight: 0,
		clientHeight: 0,
	});

	const params = useParams();
	useTheme();

	const [chatData, setChatData] = useState<Session>();

	const syncScrollMetrics = useCallback(() => {
		const el = scrollViewportRef.current;
		if (!el) {
			return;
		}
		setScrollMetrics({
			top: el.scrollTop,
			scrollHeight: el.scrollHeight,
			clientHeight: el.clientHeight,
		});
		// 与 ChatBotView 一致：每帧滚动更新代码块吸顶条几何，否则 ChatCodeToolbarFloating 无状态可渲染
		layoutChatCodeToolbars(el);
	}, []);

	useEffect(() => {
		if (params?.shareId) {
			getShareData(params.shareId);
		}
	}, [params?.shareId]);

	useEffect(() => {
		return () => {
			if (copyTimerRef.current) {
				clearTimeout(copyTimerRef.current);
				copyTimerRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		syncScrollMetrics();
		const id = requestAnimationFrame(() => syncScrollMetrics());
		return () => cancelAnimationFrame(id);
	}, [chatData, syncScrollMetrics]);

	useEffect(() => {
		const el = scrollViewportRef.current;
		if (!el) {
			return;
		}
		const ro = new ResizeObserver(() => syncScrollMetrics());
		ro.observe(el);
		return () => ro.disconnect();
	}, [syncScrollMetrics]);

	// Markdown 渲染后高度变化，补算一次浮动工具栏
	useLayoutEffect(() => {
		const el = scrollViewportRef.current;
		if (!el) {
			return;
		}
		layoutChatCodeToolbars(el);
		const id = requestAnimationFrame(() => layoutChatCodeToolbars(el));
		return () => cancelAnimationFrame(id);
	}, [chatData]);

	useEffect(() => {
		const onResize = () => layoutChatCodeToolbars(scrollViewportRef.current);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const getShareData = async (id: string) => {
		const res = await getShare<Session>(id);
		if (res.success) {
			setChatData(res.data);
		}
	};

	const onCopy = (content: string, chatId: string) => {
		navigator.clipboard.writeText(content);
		setIsCopyedId(chatId);
		copyTimerRef.current = setTimeout(() => {
			setIsCopyedId('');
		}, 500);
	};

	const scrollShareToTop = () => {
		scrollViewportRef.current?.scrollTo({ top: 0, behavior: 'auto' });
	};

	const scrollShareToBottom = () => {
		const el = scrollViewportRef.current;
		if (!el) {
			return;
		}
		el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
	};

	const { top: scrollTop, scrollHeight, clientHeight } = scrollMetrics;
	const maxScroll = Math.max(0, scrollHeight - clientHeight);
	const canScroll = maxScroll > 4;
	const atBottom =
		!canScroll ||
		scrollTop + clientHeight >= scrollHeight - SCROLL_BOTTOM_THRESHOLD;

	const onScrollFabClick = () => {
		if (!canScroll) {
			return;
		}
		if (atBottom) {
			scrollShareToTop();
		} else {
			scrollShareToBottom();
		}
	};

	return (
		<div className="relative flex h-dvh w-full flex-col overflow-hidden bg-theme-background">
			<ChatCodeToolbarFloating />
			<ScrollArea
				ref={scrollViewportRef}
				className="min-h-0 flex-1"
				viewportClassName="pt-10 pb-1"
				onScroll={syncScrollMetrics}
			>
				<div
					className={cn(
						'max-w-208 mx-auto relative flex w-full flex-col select-none px-4',
					)}
				>
					{chatData?.messages.map((message, index) => (
						<div
							key={message.id}
							className={cn(
								'relative flex-1 flex flex-col gap-1 pb-10 w-full group',
								message.role === 'user' ? 'items-end' : '',
							)}
						>
							{!!message.attachments?.length && (
								<div className="flex flex-wrap justify-end gap-1.5 mb-2">
									{message.role === 'user'
										? message.attachments.map((i) => (
												<ChatFileList
													key={i.id || i.uuid}
													data={i}
													showDownload
												/>
											))
										: null}
								</div>
							)}
							<div
								id="message-md-wrap"
								className={cn(
									'relative flex-1 rounded-md p-3 select-auto text-textcolor mb-5',
									message.role === 'user'
										? 'bg-blue-500/10 border border-blue-500/20 text-end pt-2 pb-2.5 px-3'
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
										messagesLength={chatData?.messages.length || 0}
										onCopy={onCopy}
										needShare={false}
									/>
								</div>
							</div>
						</div>
					))}
				</div>
			</ScrollArea>

			{/* 单图标：未到底为下箭头（置底），到底后变为上箭头（回顶） */}
			{canScroll ? (
				<Button
					title={atBottom ? '回到顶部' : '滚动到底部'}
					aria-label={atBottom ? '滚动到顶部' : '滚动到底部'}
					onClick={onScrollFabClick}
					className={cn(
						'fixed bottom-6 right-5 z-50 flex size-10 items-center justify-center rounded-full',
						'border border-theme/20 bg-theme-background/95 text-textcolor/85 shadow-md backdrop-blur-sm',
						'transition-colors hover:border-theme/50 hover:bg-theme/10 hover:text-textcolor',
						'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
					)}
				>
					{atBottom ? (
						<ArrowUpToLine className="size-5" strokeWidth={2} />
					) : (
						<ArrowDownToLine className="size-5" strokeWidth={2} />
					)}
				</Button>
			) : null}
		</div>
	);
};

export default SessionShare;
