import ChatAnchorNav from '@design/ChatAnchorNav';
import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatControls from '@design/ChatControls';
import ChatFileList from '@design/ChatFileList';
import ChatMessageActions from '@design/ChatMessageActions';
import ChatNewSession from '@design/ChatNewSession';
import ChatUserMessage from '@design/ChatUserMessage';
import { Label, ScrollArea } from '@ui/index';
import { Bot, User } from 'lucide-react';
import React, {
	type ChangeEvent,
	type Dispatch,
	forwardRef,
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
import { ChatBotRef, ChatBotViewProps, Message } from '@/types/chat';

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

		const { buildMessageList, getFormatMessages, findSiblings } =
			useMessageTools();

		// 未传 displayMessages 时由 flat + map 推导展示列；二者均为父级传入的渲染依据，避免无源列表。
		const messages = useMemo(() => {
			if (props.displayMessages !== undefined) {
				return props.displayMessages;
			}
			return getFormatMessages(
				buildMessageList(flatMessages, selectedChildMap),
			);
		}, [
			props.displayMessages,
			flatMessages,
			selectedChildMap,
			buildMessageList,
			getFormatMessages,
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

		// 分支条用布尔值传入插槽与默认 ChatControls，避免子组件或自定义渲染里重复调用 getter。
		const streamingBranchVisibleFlag = isStreamingBranchVisible();
		const isLatestBranchFlag = isLatestBranch();

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
						<div id="message-content" className="space-y-6 overflow-hidden">
							{!messages.length
								? // emptyState 可选：嵌入方自定义欢迎页；默认保持原 ChatNewSession，避免行为变化。
									(emptyState ?? <ChatNewSession />)
								: messages.map((message, index) => (
										<div
											key={message.chatId}
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
											<div
												className={cn(
													'relative flex-1 flex flex-col gap-1 pb-10 w-full group',
													message.role === 'user' ? 'items-end' : '',
												)}
											>
												{message?.attachments &&
													message?.attachments.length > 0 && (
														<div className="flex flex-wrap justify-end gap-1.5 mb-2">
															{message.role === 'user'
																? message?.attachments?.map((i) => (
																		<ChatFileList
																			key={i.id || i.uuid}
																			data={i}
																			showDownload
																		/>
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
														/* isStopped 由外部注入：主项目用 chatStore.isMessageStopped；独立项目可自实现映射 */
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
									))}
						</div>
					</div>
					{showAnchorNav ? (
						renderAnchorNav ? (
							renderAnchorNav({
								messages,
								scrollContainerRef,
							})
						) : (
							<ChatAnchorNav
								messages={messages}
								scrollContainerRef={scrollContainerRef}
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
