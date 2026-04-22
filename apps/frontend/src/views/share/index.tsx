import { Button, ScrollArea } from '@ui/index';
import { ArrowDownToLine, ArrowUpToLine, CircleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatFileList from '@/components/design/ChatFileList';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import { useTheme } from '@/hooks';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { cn } from '@/lib/utils';
import { getShare } from '@/service';

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

	const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
		scrollViewportRef,
		{ layoutDeps: [chatData] },
	);

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
		relayoutCodeToolbar();
	}, [relayoutCodeToolbar]);

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
			<ChatCodeFloatingToolbar />
			<div className="flex items-center justify-between px-4 h-12.5 border border-b-theme/20">
				<div className="text-base font-bold">分享对话内容</div>
				<div className="flex items-center gap-1 text-sm text-textcolor/80">
					<CircleAlert size={17} className="text-textcolor/65" />
					该对话来自分享，由 AI 生成，请仔细甄别
				</div>
			</div>
			<ScrollArea
				ref={scrollViewportRef}
				className="min-h-0 flex-1"
				viewportClassName="pb-1"
				onScroll={syncScrollMetrics}
			>
				<div
					className={cn(
						'max-w-208 mx-auto w-full mt-2.5 relative flex flex-col select-none px-4',
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
									'relative rounded-md p-3 select-auto text-textcolor mb-5 min-w-0',
									message.role === 'user'
										? `bg-teal-600/5 border border-teal-500/15 text-end pt-2 pb-2.5 px-3 ml-auto w-fit max-w-full`
										: 'bg-theme/5 border border-theme/10 w-full',
								)}
							>
								{message.role === 'user' ? (
									<ChatAssistantMessage
										message={message}
										className="text-left min-w-0 max-w-full [&_.markdown-body]:min-w-0 [&_.markdown-body]:max-w-full [&_.markdown-body]:overflow-x-auto"
									/>
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
