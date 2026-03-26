import ChatAnchorNav from '@design/ChatAnchorNav';
import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatControls from '@design/ChatControls';
import ChatFileList from '@design/ChatFileList';
import ChatMessageActions from '@design/ChatMessageActions';
import ChatNewSession from '@design/ChatNewSession';
import ChatUserMessage from '@design/ChatUserMessage';
import { Label, ScrollArea } from '@ui/index';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bot, User } from 'lucide-react';
import React, {
	type ChangeEvent,
	type Dispatch,
	forwardRef,
	Fragment,
	JSX,
	type SetStateAction,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useBranchManage } from '@/hooks/useBranchManage';
import { useMessageTools } from '@/hooks/useMessageTools';
import { cn } from '@/lib/utils';
import {
	type ChatAnchorScrollAdapter,
	ChatBotRef,
	ChatBotViewProps,
	Message,
} from '@/types/chat';

/** 省略业务回调时的稳定空实现，避免每次 render 新建函数导致子组件重渲染 */
const asyncNoop = async () => {};
const noopSetInput = (_: string) => {};
const noopSetEditMessage = (_: Message | null) => {};
const noopHandleEdit = (_: ChangeEvent<HTMLTextAreaElement> | string) => {};
const noopSetCheckedMessage = (_: Message) => {};
const noopDispatchBool: Dispatch<SetStateAction<boolean>> = () => {};
const noopClearChat = (_?: string) => {};
const noopIsMessageStopped = (_chatId: string) => false;

/**
 * 聊天主界面纯 UI（单一渲染组件）。
 *
 * 拆分原因：原先与 MobX chatStore、ChatCoreContext 强耦合，无法在其它仓库直接挂载。
 * 现由 props 驱动全部「业务事实」；连接层（默认导出的 ChatBot）负责订阅 Store 并向下灌入，
 * 从而保持原行为的同时，对外暴露可复用的 ChatBotView。
 *
 * 注意：子组件（ChatUserMessage / useChatCore 等）仍可能依赖本项目的 service、路由；
 * 若要在完全异构的项目使用，需一并替换输入区与发送逻辑，或仅复用本文件做消息列表展示。
 *
 * 插槽：renderMessageActions / renderAnchorNav / renderChatControls 可替换对应内置条；
 * 不传则渲染默认组件。自定义实现应使用回调上下文中的 onBranchChange、switchToLatestBranch 等以操作同一份分支与滚动数据。
 * showMessageActions / showAnchorNav / showChatControls 为 false 时强制不展示对应区域（优先生效于 render*）。
 *
 * 渲染数据源：`flatMessages`、`selectedChildMap`、`onSelectedChildMapChange` 类型上必填，禁止组件内「偷偷造一份默认消息/分支」导致与父状态脱节。
 *
 * 性能相关（与 hooks / 类型改动配套）：
 * - 默认 `virtualizeMessages`：用 `@tanstack/react-virtual` 只渲染可视区消息；`ScrollArea` 的 ref 指向 Radix Viewport，与 `getScrollElement` 一致。
 * - `gap: 24` 对齐原 Tailwind `space-y-6`；`scrollPaddingStart: 20` 对齐锚点滚动「距顶约 20px」；`estimateSize` 为初值，真实高度靠 `measureElement` 修正。
 * - 虚拟开启时向 `ChatAnchorNav`（及 `renderAnchorNav` 上下文）传入 `anchorScrollAdapter`，保证离屏消息仍能滚动定位与高亮。
 * - `buildMessageList` 已含展示字段形态，此处不再调用 `getFormatMessages`，减少一次全表遍历。
 * - 底栏布尔值经 `useBranchManage` 内缓存后再 `useMemo`，避免无关 render 上重复求值（见该 hook 文件头注释）。
 */
const ChatBotView = forwardRef<ChatBotRef, ChatBotViewProps>(
	function ChatBotView(props, ref) {
		const {
			className,
			showAvatar = false,
			onBranchChange,
			flatMessages,
			selectedChildMap,
			onSelectedChildMapChange,
			onPersistSessionBranchSelection,
			streamingBranchSource,
			onScrollToRegister,
			emptyState,
			showMessageActions = true,
			showAnchorNav = true,
			showChatControls = true,
			renderMessageActions,
			renderAnchorNav,
			renderChatControls,
		} = props;

		// `undefined` 视为开启虚拟列表，仅显式 `false` 时关闭（与类型注释中的 default 一致）。
		const virtualizeMessages = props.virtualizeMessages !== false;

		const { buildMessageList, findSiblings } = useMessageTools();

		// 未传 `displayMessages` 时由 flat + `selectedChildMap` 推导当前分支展示列；
		// `buildMessageList` 内已对每条调用 `formatMessageForDisplay`，形态同旧 `getFormatMessages`，此处不再二次 map。
		const messages = useMemo(() => {
			if (props.displayMessages !== undefined) {
				return props.displayMessages;
			}
			return buildMessageList(flatMessages, selectedChildMap);
		}, [
			props.displayMessages,
			flatMessages,
			selectedChildMap,
			buildMessageList,
		]);

		const activeSessionId = props.activeSessionId ?? null;
		const input = props.input ?? '';
		const setInput = props.setInput ?? noopSetInput;
		const editMessage = props.editMessage ?? null;
		const setEditMessage = props.setEditMessage ?? noopSetEditMessage;
		const sendMessage = props.sendMessage ?? asyncNoop;
		const clearChat = props.clearChat ?? noopClearChat;
		const stopGenerating = props.stopGenerating ?? asyncNoop;
		const handleEditChange = props.handleEditChange ?? noopHandleEdit;
		const onContinue = props.onContinue ?? asyncNoop;
		const onContinueAnswering = props.onContinueAnswering ?? asyncNoop;
		const isCurrentSessionLoading = props.isCurrentSessionLoading ?? false;
		const isMessageStopped = props.isMessageStopped ?? noopIsMessageStopped;
		const isSharing = props.isSharing ?? false;
		const setIsSharing = props.setIsSharing ?? noopDispatchBool;
		// 无 checkedMessages 时用实例级空 Set，避免模块级单例被误 mutate 导致串会话
		const defaultCheckedRef = useRef<Set<string>>(new Set());
		const checkedMessages = props.checkedMessages ?? defaultCheckedRef.current;
		const setCheckedMessage = props.setCheckedMessage ?? noopSetCheckedMessage;

		const [autoScroll, setAutoScroll] = useState(true);
		const [isShowThinkContent, setIsShowThinkContent] = useState(true);
		const [isCopyedId, setIsCopyedId] = useState('');
		const [scrollTop, setScrollTop] = useState<number>(0);
		const [hasScrollbar, setHasScrollbar] = useState<boolean>(false);

		const scrollContainerRef = useRef<HTMLDivElement>(null);

		// 必须在 `scrollContainerRef` 之后创建：滚动元素为 Radix ScrollArea Viewport（与本组件原有滚动行为一致）。
		// `enabled` 在无消息时关闭，避免空列表下的无效订阅；有消息且未关闭虚拟化时开启。
		const virtualizer = useVirtualizer({
			count: messages.length,
			getScrollElement: () => scrollContainerRef.current,
			// 首屏估算高度，流式/长文本会由 `measureElement` + ResizeObserver 纠正；过小会多一次布局跳动，过大则浪费空白。
			estimateSize: () => 200,
			// 与 `space-y-6`（1.5rem）一致，保证总高度与旧版全量列表 spacing 接近。
			gap: 24,
			overscan: 8,
			// 与 ChatAnchorNav 非虚拟路径下「scrollTop 减 20px」的视觉效果对齐（见 scrollPaddingStart 语义）。
			scrollPaddingStart: 20,
			paddingEnd: 32,
			// 分支切换时同 index 可能换 chatId，用 chatId 做 key 可让虚拟器复用测量缓存更合理。
			getItemKey: (index) => messages[index]?.chatId ?? index,
			enabled: virtualizeMessages && messages.length > 0,
		});

		// 仅虚拟列表需要：闭包内读取 `virtualizer.measurementsCache` 最新值，勿把 cache 本身放进 deps（会导致无意义失效）。
		const anchorScrollAdapter = useMemo(():
			| ChatAnchorScrollAdapter
			| undefined => {
			if (!virtualizeMessages || messages.length === 0) return undefined;
			return {
				scrollToChatId: (chatId: string) => {
					const idx = messages.findIndex((m) => m.chatId === chatId);
					if (idx < 0) return;
					virtualizer.scrollToIndex(idx, {
						align: 'start',
						behavior: 'smooth',
					});
				},
				resolveActiveUserAnchor: (container, userMessages) => {
					// 与 ChatAnchorNav DOM 算法在同一坐标系：内容纵坐标 = scrollTop + 视口内比例。
					const scrollTop = container.scrollTop;
					const clientHeight = container.clientHeight;
					const lineY = scrollTop + clientHeight / 3;
					const scrollBottom = scrollTop + clientHeight;
					let current = userMessages[0]?.chatId ?? '';
					for (const msg of userMessages) {
						const idx = messages.findIndex((m) => m.chatId === msg.chatId);
						if (idx < 0) continue;
						const item = virtualizer.measurementsCache[idx];
						if (!item) continue;
						if (item.start <= lineY) {
							current = msg.chatId;
						}
						if (item.start > scrollBottom) {
							break;
						}
					}
					return current;
				},
			};
		}, [virtualizeMessages, messages, virtualizer]);

		const editInputRef = useRef<HTMLTextAreaElement>(null);
		const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
		const resizeObserverRef = useRef<ResizeObserver | null>(null);
		const lastScrollHeightRef = useRef<number>(0);
		const mutationObserverRef = useRef<MutationObserver | null>(null);

		const SCROLL_THRESHOLD = 5;

		const onScrollTo = useCallback(
			(position: string, behavior?: 'smooth' | 'auto') => {
				scrollContainerRef.current?.scrollTo({
					top:
						position === 'up'
							? 0
							: scrollContainerRef.current?.scrollHeight + 100,
					behavior: behavior || 'smooth',
				});
			},
			[],
		);

		const {
			isStreamingBranchVisible,
			isLatestBranch,
			switchToLatestBranch,
			switchToStreamingBranch,
		} = useBranchManage({
			// 当前可见分支上的消息（已 format），用于判断流式气泡是否在视窗分支内等。
			messages,
			// 完整树：与「当前分支列表」分离传入，避免 hook 内再依赖 Store 取 chatStore.messages。
			allFlatMessages: flatMessages,
			activeSessionId,
			selectedChildMap,
			setSelectedChildMap: onSelectedChildMapChange,
			onScrollTo,
			// 主项目传入 getStreaming*；第三方不传则退化为恒 true/无操作，不访问 MobX。
			streamingBranchSource,
			onPersistSessionBranchSelection,
		});

		// 替代原先在 ChatBot 根组件里写 onScrollToRef.current = onScrollTo：把「注册副作用」收口到 View 内，
		// 连接层只提供 setter（handleScrollToRegister），避免 Context ref 与滚动实现细节绑死。
		useEffect(() => {
			if (!onScrollToRegister) return;
			onScrollToRegister(onScrollTo);
			return () => {
				onScrollToRegister(null);
			};
		}, [onScrollTo, onScrollToRegister]);

		useEffect(() => {
			const lastMessage = messages[messages.length - 1];
			const isCurrentlyStreaming =
				lastMessage?.role === 'assistant' && lastMessage?.isStreaming;

			const updateScrollbarState = () => {
				if (scrollContainerRef.current) {
					const { scrollHeight, clientHeight } = scrollContainerRef.current;
					setHasScrollbar(scrollHeight > clientHeight);
				}
			};

			const scrollToBottom = () => {
				if (scrollContainerRef.current && autoScroll && isCurrentlyStreaming) {
					const currentScrollHeight = scrollContainerRef.current.scrollHeight;
					if (currentScrollHeight !== lastScrollHeightRef.current) {
						lastScrollHeightRef.current = currentScrollHeight;
						scrollContainerRef.current.scrollTo({
							top: currentScrollHeight + 100,
							behavior: 'auto',
						});
					}
				}
			};

			updateScrollbarState();
			scrollToBottom();

			const contentWrapper =
				scrollContainerRef.current?.querySelector('#message-content');
			if (contentWrapper && isCurrentlyStreaming) {
				resizeObserverRef.current = new ResizeObserver(() => {
					updateScrollbarState();
					scrollToBottom();
				});
				resizeObserverRef.current.observe(contentWrapper);
			}

			const contentArea =
				scrollContainerRef.current?.querySelector('#message-container');
			if (contentArea && isCurrentlyStreaming) {
				mutationObserverRef.current = new MutationObserver(() => {
					updateScrollbarState();
					scrollToBottom();
				});
				mutationObserverRef.current.observe(contentArea, {
					childList: true,
					subtree: true,
					characterData: true,
				});
			}

			return () => {
				if (resizeObserverRef.current) {
					resizeObserverRef.current.disconnect();
					resizeObserverRef.current = null;
				}
				if (mutationObserverRef.current) {
					mutationObserverRef.current.disconnect();
					mutationObserverRef.current = null;
				}
			};
		}, [messages, autoScroll]);

		useEffect(() => {
			return () => {
				if (scrollTimer.current) {
					clearTimeout(scrollTimer.current);
				}
				if (copyTimerRef.current) {
					clearTimeout(copyTimerRef.current);
				}
				if (focusTimerRef.current) {
					clearTimeout(focusTimerRef.current);
				}
				if (resizeObserverRef.current) {
					resizeObserverRef.current.disconnect();
				}
				if (mutationObserverRef.current) {
					mutationObserverRef.current.disconnect();
				}
			};
		}, []);

		const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
			const element = e.currentTarget;
			if (!scrollContainerRef.current) {
				scrollContainerRef.current = element;
			}
			const { scrollTop, scrollHeight, clientHeight } = element;
			setScrollTop(scrollTop);
			setHasScrollbar(scrollHeight > clientHeight);
			const isAtBottom =
				scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
			setAutoScroll(isAtBottom);
		}, []);

		const onToggleThinkContent = useCallback(() => {
			setIsShowThinkContent((prev) => !prev);
		}, []);

		const onCopy = useCallback((value: string, id: string) => {
			navigator.clipboard.writeText(value);
			setIsCopyedId(id);
			copyTimerRef.current = setTimeout(() => {
				setIsCopyedId('');
			}, 500);
		}, []);

		const onEdit = useCallback(
			(message: Message) => {
				setEditMessage(message);
				focusTimerRef.current = setTimeout(() => {
					if (editInputRef.current) {
						editInputRef.current.focus();
						const len = editInputRef.current.value.length;
						editInputRef.current.setSelectionRange(len, len);
					}
				}, 0);
			},
			[setEditMessage],
		);

		// 兄弟切换必须基于完整 flatMessages，不能用 displayMessages：后者只含当前分支一条链，会丢其它兄弟节点。
		const handleBranchChange = useCallback(
			(msgId: string, direction: 'prev' | 'next') => {
				onBranchChange?.(msgId, direction);

				const siblings = findSiblings(flatMessages, msgId);
				const currentIndex = siblings.findIndex((m) => m.chatId === msgId);
				const nextIndex =
					direction === 'next' ? currentIndex + 1 : currentIndex - 1;

				if (nextIndex >= 0 && nextIndex < siblings.length) {
					const nextMsg = siblings[nextIndex];
					const currentMsg = flatMessages.find((m) => m.chatId === msgId);
					const parentId = currentMsg?.parentId;

					const newSelectedChildMap = new Map(selectedChildMap);
					if (parentId) {
						newSelectedChildMap.set(parentId, nextMsg.chatId);
					} else {
						newSelectedChildMap.set('root', nextMsg.chatId);
					}
					onSelectedChildMapChange(newSelectedChildMap);
					if (activeSessionId && onPersistSessionBranchSelection) {
						onPersistSessionBranchSelection(
							activeSessionId,
							newSelectedChildMap,
						);
					}
				}
			},
			[
				activeSessionId,
				findSiblings,
				flatMessages,
				onBranchChange,
				onPersistSessionBranchSelection,
				onSelectedChildMapChange,
				selectedChildMap,
			],
		);

		const onReGenerate = useCallback(
			(index: number) => {
				if (index > 0) {
					const userMsg = messages[index - 1];
					if (userMsg && userMsg.role === 'user') {
						sendMessage(userMsg.content, index);
					}
				}
			},
			[messages, sendMessage],
		);

		const getMessageClassName = useCallback(
			(message: Message) => {
				const isEdit = editMessage?.chatId === message.chatId;
				return cn(
					'flex-1 rounded-md p-3 select-auto',
					message.role === 'user'
						? `bg-blue-500/10 border border-blue-500/20 text-end pt-2 pb-2.5 px-3 ${isEdit ? 'p-0 pr-2.5 pb-2.5' : ''}`
						: 'bg-theme/5 border border-theme-white/10',
					showAvatar
						? 'max-w-[calc(768px-105px)]'
						: isEdit
							? 'w-full bg-theme/5 border-theme-white/10'
							: 'w-auto',
					isSharing ? 'cursor-pointer' : '',
					checkedMessages.has(message.chatId) ? 'bg-theme-background/5' : '',
				);
			},
			[showAvatar, editMessage?.chatId, isSharing, checkedMessages],
		);

		const isAtBottom = useMemo(() => {
			if (!scrollContainerRef.current) return false;
			const { scrollHeight, clientHeight } = scrollContainerRef.current;
			return scrollHeight - scrollTop - clientHeight < 5;
		}, [scrollTop]);

		const onShare = useCallback(() => {
			setIsSharing(true);
		}, [setIsSharing]);

		// 分支条用布尔值传入插槽与默认 ChatControls：`useBranchManage` 已返回稳定 getter + 内部缓存，
		// 此处 `useMemo` 使 ChatControls 收到原始 boolean，避免子树仅因「又调了一次函数」而重渲染。
		const streamingBranchVisibleFlag = useMemo(
			() => isStreamingBranchVisible(),
			[isStreamingBranchVisible],
		);
		const isLatestBranchFlag = useMemo(
			() => isLatestBranch(),
			[isLatestBranch],
		);

		const onScrollToUpDown = useCallback(
			(position: 'up' | 'down', behavior?: 'smooth' | 'auto') => {
				onScrollTo(position, behavior);
			},
			[onScrollTo],
		);

		useImperativeHandle(
			ref,
			() => ({
				clearChat,
				stopGenerating,
				sendMessage,
			}),
			[clearChat, stopGenerating, sendMessage],
		);

		// 与 `virtualizer.options.enabled` 条件保持一致：无消息时不走虚拟布局（空会话仍用占位 UI）。
		const virtualListActive = virtualizeMessages && messages.length > 0;

		// 单条消息的 UI 块：虚拟与全量路径共用，保证行为一致；根节点保留 `id` 以便非虚拟模式下锚点 DOM 查询仍可用。
		const renderMessageRow = (message: Message, index: number) => (
			<div
				id={`message-${message.chatId}`}
				className={cn(
					'flex gap-3 w-full',
					message.role === 'user' ? 'flex-row-reverse' : '',
				)}
			>
				{showAvatar ? (
					<div
						className={cn(
							'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
							message.role === 'user' ? 'bg-blue-500/20' : 'bg-purple-500/20',
						)}
					>
						{message.role === 'user' ? (
							<User className="w-5 h-5 text-blue-400" />
						) : (
							<Bot className="w-5 h-5 text-purple-400" />
						)}
					</div>
				) : null}
				<div
					className={cn(
						'relative flex-1 flex flex-col gap-1 pb-10 w-full group',
						message.role === 'user' ? 'items-end' : '',
					)}
				>
					{message?.attachments && message?.attachments.length > 0 && (
						<div className="flex flex-wrap justify-end gap-1.5 mb-2">
							{message.role === 'user'
								? message?.attachments?.map((i) => (
										<ChatFileList key={i.id || i.uuid} data={i} showDownload />
									))
								: null}
						</div>
					)}
					<Label
						className={getMessageClassName(message)}
						htmlFor={message.chatId}
					>
						{message.role === 'user' ? (
							<ChatUserMessage
								message={message}
								editMessage={editMessage}
								editInputRef={editInputRef}
								input={input}
								setInput={setInput}
								setEditMessage={setEditMessage}
								isLoading={isCurrentSessionLoading}
								handleEditChange={handleEditChange}
								sendMessage={sendMessage}
							/>
						) : (
							<ChatAssistantMessage
								message={message}
								isShowThinkContent={isShowThinkContent}
								onToggleThinkContent={onToggleThinkContent}
								onContinue={onContinue}
								onContinueAnswering={onContinueAnswering}
								isStopped={isMessageStopped(message.chatId)}
							/>
						)}
					</Label>
					{showMessageActions ? (
						renderMessageActions ? (
							renderMessageActions({
								message,
								index,
								messagesLength: messages.length,
								isCopyedId,
								isLoading: isCurrentSessionLoading,
								onBranchChange: handleBranchChange,
								onCopy,
								onEdit,
								onReGenerate,
								onShare,
								isSharing,
								checkedMessages,
								setCheckedMessage,
							})
						) : (
							<ChatMessageActions
								message={message}
								index={index}
								messagesLength={messages.length}
								isCopyedId={isCopyedId}
								isLoading={isCurrentSessionLoading}
								onBranchChange={handleBranchChange}
								onCopy={onCopy}
								onEdit={onEdit}
								onReGenerate={onReGenerate}
								onShare={onShare}
								isSharing={isSharing}
								checkedMessages={checkedMessages}
								setCheckedMessage={setCheckedMessage}
							/>
						)
					) : null}
				</div>
			</div>
		);

		return (
			<div
				className={cn(
					'relative flex flex-col h-full w-full select-none',
					className,
				)}
			>
				<ScrollArea
					ref={scrollContainerRef}
					className="flex-1 overflow-hidden w-full backdrop-blur-sm pb-5"
					onScroll={handleScroll}
				>
					<div
						id="message-container"
						className="max-w-3xl m-auto overflow-y-auto"
					>
						{/* 虚拟模式：`relative` + 总高 = 虚拟列表 scrollHeight；非虚拟：保留原 `space-y-6` 流式布局 */}
						<div
							id="message-content"
							className={cn(
								'overflow-hidden',
								virtualListActive ? 'relative' : 'space-y-6',
							)}
							style={
								virtualListActive
									? { height: `${virtualizer.getTotalSize()}px` }
									: undefined
							}
						>
							{!messages.length
								? (emptyState ?? <ChatNewSession />)
								: virtualListActive
									? // TanStack 要求测量节点带 `data-index`（默认），`measureElement` 挂在行容器上以修正变高气泡
										virtualizer
											.getVirtualItems()
											.map((virtualRow) => {
												const message = messages[virtualRow.index];
												if (!message) return null;
												return (
													<div
														key={virtualRow.key}
														data-index={virtualRow.index}
														ref={virtualizer.measureElement}
														className="left-0 top-0 w-full"
														style={{
															position: 'absolute',
															transform: `translateY(${virtualRow.start}px)`,
														}}
													>
														{renderMessageRow(message, virtualRow.index)}
													</div>
												);
											})
									: // 关闭虚拟化时与历史实现一致：每条消息真实 DOM，便于锚点与调试
										messages.map((message, index) => (
											<Fragment key={message.chatId}>
												{renderMessageRow(message, index)}
											</Fragment>
										))}
						</div>
					</div>
					{showAnchorNav ? (
						renderAnchorNav ? (
							renderAnchorNav({
								messages,
								scrollContainerRef,
								// 自定义锚点请务必透传，否则虚拟列表下点击侧栏无法 scrollToIndex
								anchorScrollAdapter,
							})
						) : (
							<ChatAnchorNav
								messages={messages}
								scrollContainerRef={scrollContainerRef}
								anchorScrollAdapter={anchorScrollAdapter}
							/>
						)
					) : null}
					{showChatControls ? (
						renderChatControls ? (
							renderChatControls({
								isLoading: isCurrentSessionLoading,
								isStreamingBranchVisible: streamingBranchVisibleFlag,
								isLatestBranch: isLatestBranchFlag,
								messagesLength: messages.length,
								switchToStreamingBranch,
								switchToLatestBranch,
								hasScrollbar,
								isAtBottom,
								onScrollTo: onScrollToUpDown,
							})
						) : (
							<ChatControls
								isLoading={isCurrentSessionLoading}
								isStreamingBranchVisible={streamingBranchVisibleFlag}
								isLatestBranch={isLatestBranchFlag}
								messagesLength={messages.length}
								switchToStreamingBranch={switchToStreamingBranch}
								switchToLatestBranch={switchToLatestBranch}
								hasScrollbar={hasScrollbar}
								isAtBottom={isAtBottom}
								onScrollTo={onScrollToUpDown}
							/>
						)
					) : null}
				</ScrollArea>
			</div>
		);
	},
);

export default ChatBotView as React.FC<ChatBotViewProps> &
	((props: { ref?: React.Ref<ChatBotRef> } & ChatBotViewProps) => JSX.Element);
