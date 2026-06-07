import { Button, ScrollArea, TooltipProvider } from '@ui/index';
import { ArrowDownToLine, ArrowUpToLine, CircleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import ChatAnchorNav from '@/components/design/ChatAnchorNav';
import ChatAssistantMessage from '@/components/design/ChatAssistantMessage';
import ChatFileList from '@/components/design/ChatFileList';
import ChatMessageActions from '@/components/design/ChatMessageActions';
import MarkdownPreview from '@/components/design/Markdown';
import { useI18n, useTheme } from '@/hooks';
import { findLatestBranchSelection } from '@/hooks/useBranchManage';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { useMessageTools } from '@/hooks/useMessageTools';
import { cn } from '@/lib/utils';
import { getShare } from '@/service';
import type { Message, Session } from '@/types/chat';
import { formatDate } from '@/utils';

/** 判定「已到底」允许的像素误差（避免子像素取整导致箭头来回跳） */
const SCROLL_BOTTOM_THRESHOLD = 48;

/** getShare 在 Session 上附带 Redis 中的 messageIds 顺序（与创建分享时 ChatBot 展示链一致） */
type ShareSessionPayload = Session & { shareMessageIds?: string[] };

/** 将接口 JSON 转为与 ChatBot 一致的 Date，供 buildMessageList / getFormatMessages */
function normalizeMessagesForChatTools(raw: Message[]): Message[] {
	return raw.map((m) => {
		const ts =
			m.timestamp instanceof Date
				? m.timestamp
				: new Date(
						typeof m.timestamp === 'number'
							? m.timestamp
							: typeof m.timestamp === 'string'
								? m.timestamp
								: 0,
					);
		const created =
			m.createdAt instanceof Date
				? m.createdAt
				: m.createdAt != null
					? new Date(m.createdAt as string | number)
					: ts;
		return { ...m, createdAt: created, timestamp: ts };
	});
}

/**
 * 按 shareMessageIds 顺序取出消息（与 ChatBotView 在分享瞬间的展示顺序一致）。
 * 主聊天 findMessages 已按 messageIds 重排；此处再对齐一遍，并覆盖助手等路径。
 */
function pickMessagesInShareIdsOrder(
	messages: Message[],
	orderedIds: string[],
): Message[] {
	const byChatId = new Map(messages.map((m) => [m.chatId, m]));
	return orderedIds
		.map((id) => byChatId.get(id))
		.filter((m): m is Message => m != null);
}

const SessionShare = () => {
	const [isCopyedId, setIsCopyedId] = useState('');
	const { t } = useI18n();

	const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const scrollViewportRef = useRef<HTMLDivElement>(null);

	const [scrollMetrics, setScrollMetrics] = useState({
		top: 0,
		scrollHeight: 0,
		clientHeight: 0,
	});

	const params = useParams();
	const location = useLocation();
	useTheme();

	const [chatData, setChatData] = useState<ShareSessionPayload>();
	const [knowledgeData, setKnowledgeData] = useState<{
		id: string;
		title: string | null;
		content: string;
		createdAt: string | number;
		updatedAt: string | number;
	} | null>(null);

	const { buildMessageList, getFormatMessages } = useMessageTools();

	const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
		scrollViewportRef,
		{
			layoutDeps: [chatData, knowledgeData?.id, knowledgeData?.content],
		},
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
	}, [chatData, knowledgeData, syncScrollMetrics]);

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
		const type = new URLSearchParams(location.search).get('type');
		const res = await getShare<ShareSessionPayload & Record<string, unknown>>(
			id,
		);
		if (res.success) {
			if (type === 'knowledge') {
				const k = res.data?.knowledge;
				setKnowledgeData(
					k &&
						typeof k === 'object' &&
						'id' in k &&
						'content' in k &&
						typeof (k as { id: unknown }).id === 'string'
						? (k as {
								id: string;
								title: string | null;
								content: string;
								createdAt: string | number;
								updatedAt: string | number;
							})
						: null,
				);
				setChatData(undefined);
			} else {
				const payload = res.data;
				setChatData(
					payload
						? {
								...payload,
								messages: Array.isArray(payload.messages)
									? payload.messages
									: [],
								shareMessageIds: payload.shareMessageIds,
							}
						: undefined,
				);
				setKnowledgeData(null);
			}
		}
	};

	/**
	 * 与 ChatBotView 内 messages useMemo 对齐（无 displayMessages 分支）：
	 * - 有 shareMessageIds：顺序 = 创建分享时写入的 messageIds（即当时 getDisplayMessages 顺序）；
	 * - 否则：buildMessageList(flat, selectedChildMap) + getFormatMessages，
	 *   无持久化分支选择时与 Chat 连接层一致，用 findLatestBranchSelection 推导 Map。
	 */
	const displayMessages = useMemo((): Message[] => {
		const raw = chatData?.messages;
		if (!raw?.length) return [];

		const normalized = normalizeMessagesForChatTools(raw as Message[]);
		const ids = chatData?.shareMessageIds;

		if (ids?.length) {
			const ordered = pickMessagesInShareIdsOrder(normalized, ids);
			return getFormatMessages(ordered);
		}

		const branchMap = findLatestBranchSelection(normalized);
		const chain = buildMessageList(normalized, branchMap);
		return getFormatMessages(chain);
	}, [
		chatData?.messages,
		chatData?.shareMessageIds,
		buildMessageList,
		getFormatMessages,
	]);

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
		<TooltipProvider>
			<div className="relative flex h-dvh w-full flex-col overflow-hidden bg-theme-background">
				<ChatCodeFloatingToolbar />
				<div className="flex items-center justify-between px-2.5 h-12.5 border border-b-theme/15">
					<div className="text-base font-bold">
						{knowledgeData
							? t('share.header.knowledgeTitle')
							: t('share.header.chatTitle')}
					</div>
					<div className="flex items-center gap-1 text-sm text-textcolor/80">
						<CircleAlert size={17} className="text-textcolor/65" />
						{knowledgeData
							? t('share.header.knowledgeDisclaimer')
							: t('share.header.chatDisclaimer')}
					</div>
				</div>

				<ScrollArea
					ref={scrollViewportRef}
					className="min-h-0 flex-1"
					viewportClassName="pb-1 [overflow-anchor:none]"
					onScroll={syncScrollMetrics}
				>
					{knowledgeData ? (
						<div
							id="message-md-wrap"
							className="max-w-208 mx-auto w-full mt-2.5 relative flex flex-col select-none px-2.5"
						>
							<div className="text-lg font-bold text-textcolor mb-2">
								{knowledgeData.title?.trim() || t('knowledge.common.untitled')}
							</div>
							<div className="text-xs text-textcolor/50 mb-3">
								{t('share.knowledge.updatedAt', {
									time: formatDate(String(knowledgeData.updatedAt ?? '')),
								})}
							</div>
							<div className="bg-theme/5 border border-theme/10 rounded-md p-3 mb-4 last:mb-2">
								<MarkdownPreview
									markdown={knowledgeData.content ?? ''}
									documentIdentity={knowledgeData.id}
									withScrollArea={false}
									viewportRef={scrollViewportRef}
								/>
							</div>
						</div>
					) : (
						<div
							id="message-container"
							className="max-w-3xl mx-auto w-full mt-2.5 relative flex flex-col select-none px-2.5 min-w-0"
						>
							<div id="message-content" className="space-y-6 min-w-0">
								{displayMessages.map((message, index) => (
									<div
										key={message.chatId}
										id={`message-${message.chatId}`}
										style={{ zIndex: displayMessages.length - index }}
										className={cn(
											'relative flex-1 flex flex-col gap-1 pb-2.5 w-full group last:pb-7',
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
													messagesLength={displayMessages.length}
													onCopy={onCopy}
													needShare={false}
												/>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
					{!knowledgeData && displayMessages.length > 0 ? (
						<ChatAnchorNav
							messages={displayMessages}
							scrollContainerRef={scrollViewportRef}
							t={t}
						/>
					) : null}
				</ScrollArea>

				{canScroll ? (
					<Button
						title={
							atBottom ? t('share.scroll.toTop') : t('share.scroll.toBottom')
						}
						aria-label={
							atBottom
								? t('share.scroll.ariaToTop')
								: t('share.scroll.ariaToBottom')
						}
						onClick={onScrollFabClick}
						className={cn(
							'fixed bottom-5.5 right-5 z-50 flex size-10 items-center justify-center rounded-full',
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
		</TooltipProvider>
	);
};

export default SessionShare;
