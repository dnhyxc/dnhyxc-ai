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
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useBranchManage } from '@/hooks/useBranchManage';
import {
	ChatCodeFloatingToolbar,
	useChatCodeFloatingToolbar,
} from '@/hooks/useChatCodeFloatingToolbar';
import { useMessageTools } from '@/hooks/useMessageTools';
import { cn } from '@/lib/utils';
import {
	ChatBotRef,
	type ChatBotViewChatControlsContext,
	ChatBotViewProps,
	Message,
} from '@/types/chat';
import {
	alignMessageRowBottomToViewportBottom,
	BRANCH_ANCHOR_NUDGE_UP_PX,
	type BranchScrollPending,
	getMaxScrollTop,
	isLongMessageRowForBranchScroll,
	isSameMessageForStableDisplay,
	tryApplyBranchScrollAnchor,
} from './utils';

/** 与视口底部判定一致：scrollTop 距最大值的像素容差 */
const SCROLL_VIEWPORT_BOTTOM_THRESHOLD_PX = 5;

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
			webSearchEnabled = false,
			renderMessageActions,
			renderAnchorNav,
			renderChatControls,
			onSaveToKnowledge,
		} = props;

		const { buildMessageList, getFormatMessages, findSiblings } =
			useMessageTools();

		/**
		 * 保存上一轮推导出的展示列表，用于「结构共享」：同索引且业务字段相同则复用对象引用，
		 * 使子组件 memo 与 MdPreview 能跳过无意义更新（尤其分支切换后前缀消息不变时）。
		 */
		const stableDisplayMessagesRef = useRef<Message[]>([]);

		// 未传 displayMessages 时由 flat + map 推导展示列；二者均为父级传入的渲染依据，避免无源列表。
		const messages = useMemo(() => {
			// 调用方完全托管展示数组：直接同步 ref 并返回，不做合并
			if (props.displayMessages !== undefined) {
				stableDisplayMessagesRef.current = props.displayMessages;
				return props.displayMessages;
			}
			// 从全量树 + 分支选择得到当前链路上的原始消息行
			const raw = buildMessageList(flatMessages, selectedChildMap);
			// 规范化为展示用 Message（如 timestamp 转 Date），得到本轮「理想」列表 fresh
			const fresh = getFormatMessages(raw);
			const prev = stableDisplayMessagesRef.current;

			// 首次无历史：整表采用 fresh，并记入 ref
			if (prev.length === 0) {
				stableDisplayMessagesRef.current = fresh;
				return fresh;
			}

			// 按索引对齐：同一位置若语义未变则沿用 prev[i] 引用，否则使用新对象 n
			const merged = fresh.map((n, i) => {
				const p = prev[i];
				// 为何：列表变长或首屏新增行时没有旧引用；影响：必须用新对象，否则缺字段
				if (!p) return n;
				if (isSameMessageForStableDisplay(p, n)) {
					// 影响：保持 message 引用稳定 → ChatAssistantMessage.memo 与 MarkdownPreview.memo 命中跳过
					return p;
				}
				// 为何：任一展示语义变化；影响：新引用推动下游 hooks/子组件拿到新 props
				return n;
			});
			// 为何：下一轮 useMemo 与跨渲染比较都以本次结果为「上一帧」；影响：连续多次部分更新仍能逐级复用
			stableDisplayMessagesRef.current = merged;
			return merged;
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
		const [hasScrollbar, setHasScrollbar] = useState<boolean>(false);
		/** 与 ChatControls 箭头一致：须与视口 DOM 同步，勿混用「旧 scrollTop state + 新 scrollHeight」 */
		const [isAtBottom, setIsAtBottom] = useState(true);

		const scrollContainerRef = useRef<HTMLDivElement>(null);
		const editInputRef = useRef<HTMLTextAreaElement>(null);
		const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
		const resizeObserverRef = useRef<ResizeObserver | null>(null);
		const lastScrollHeightRef = useRef<number>(0);
		const mutationObserverRef = useRef<MutationObserver | null>(null);
		/** 用户手动「滚到底」时注册的 ResizeObserver，需在下次滚顶/卸载时 disconnect */
		const manualScrollToBottomCleanupRef = useRef<(() => void) | null>(null);
		/** 分支切换后：把「当前操作的那条消息行」在视口内的纵向位置钉住，避免下方新链路变长把操作区顶出视野 */
		const pendingBranchScrollAnchorRef = useRef<BranchScrollPending | null>(
			null,
		);
		const branchScrollSeqRef = useRef(0);
		/** 从会话列表进入会话时，同一会话仅滚到底一次（非流式首屏不走下方 observer 跟底） */
		const sessionEnterScrolledRef = useRef<string | null>(null);
		/** 用于检测「尾条助手刚结束流式」；与 webSearchEnabled 联用，仅在开联网时补贴底 */
		const wasLastAssistantStreamingRef = useRef(false);
		/** 滚到底双帧 rAF：无 contentRoot 时无 dispose，卸载或新一轮滚底前需 cancel */
		const scrollToBottomRafCancelRef = useRef<(() => void) | null>(null);
		/** 分支切换里登记的 rAF id，卸载时 cancel 避免卸载后仍触达 DOM */
		const branchChangeRafIdsRef = useRef<Set<number>>(new Set());

		/** 供 onScrollTo 等闭包内调用：始终指向最新同步函数 */
		const syncViewportScrollMetricsRef = useRef<() => void>(() => {});

		const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
			scrollContainerRef,
			{
				layoutDeps: [messages],
				passiveScrollLayout: true,
				passiveScrollDeps: [activeSessionId, messages.length],
			},
		);

		const syncViewportScrollMetrics = useCallback(() => {
			const el = scrollContainerRef.current;
			if (!el) return;
			const { scrollTop: st, scrollHeight, clientHeight } = el;
			setHasScrollbar(scrollHeight > clientHeight);
			const atBottom =
				scrollHeight - st - clientHeight < SCROLL_VIEWPORT_BOTTOM_THRESHOLD_PX;
			setAutoScroll(atBottom);
			setIsAtBottom(atBottom);
			relayoutCodeToolbar();
		}, [relayoutCodeToolbar]);

		syncViewportScrollMetricsRef.current = syncViewportScrollMetrics;

		/** 包装 rAF：登记 id，执行后移除；卸载时批量 cancel */
		const scheduleBranchRaf = useCallback((fn: FrameRequestCallback) => {
			const id = requestAnimationFrame((time) => {
				branchChangeRafIdsRef.current.delete(id);
				fn(time);
			});
			branchChangeRafIdsRef.current.add(id);
		}, []);

		const onScrollTo = useCallback(
			(position: string, behavior?: 'smooth' | 'auto') => {
				const el = scrollContainerRef.current;
				if (!el) return;
				const bh = behavior ?? 'smooth';

				if (position === 'up') {
					manualScrollToBottomCleanupRef.current?.();
					manualScrollToBottomCleanupRef.current = null;
					scrollToBottomRafCancelRef.current?.();
					scrollToBottomRafCancelRef.current = null;
					el.scrollTo({ top: 0, behavior: bh });
					syncViewportScrollMetricsRef.current();
					return;
				}

				// 刷新后首次滚到底：首帧 scrollHeight 常偏小（字体/MdPreview 懒挂载晚一步），需跟随后续增高
				manualScrollToBottomCleanupRef.current?.();
				manualScrollToBottomCleanupRef.current = null;
				scrollToBottomRafCancelRef.current?.();
				scrollToBottomRafCancelRef.current = null;

				const alignToMax = (scrollBehavior: ScrollBehavior) => {
					el.scrollTo({ top: getMaxScrollTop(el), behavior: scrollBehavior });
					syncViewportScrollMetricsRef.current();
				};

				const contentRoot = el.querySelector('#message-content');
				const lastRow = contentRoot?.lastElementChild;
				if (lastRow instanceof HTMLElement) {
					lastRow.scrollIntoView({
						block: 'end',
						inline: 'nearest',
						behavior: bh,
					});
				}
				alignToMax(bh === 'smooth' ? 'smooth' : 'auto');

				if (bh === 'auto') {
					const rafHandles = { outer: 0, inner: 0 };
					const cancelScrollToBottomRafs = () => {
						cancelAnimationFrame(rafHandles.outer);
						cancelAnimationFrame(rafHandles.inner);
						rafHandles.outer = rafHandles.inner = 0;
					};
					rafHandles.outer = requestAnimationFrame(() => {
						rafHandles.outer = 0;
						alignToMax('auto');
						rafHandles.inner = requestAnimationFrame(() => {
							rafHandles.inner = 0;
							alignToMax('auto');
						});
					});
					if (contentRoot) {
						const ro = new ResizeObserver(() => {
							alignToMax('auto');
						});
						ro.observe(contentRoot);
						let disposed = false;
						// DOM 的 setTimeout 返回 number，与 @types/node 的 Timeout 在合并时易冲突，此处仅作定时清理用
						let tid = 0;
						const dispose = () => {
							if (disposed) return;
							disposed = true;
							cancelScrollToBottomRafs();
							ro.disconnect();
							window.clearTimeout(tid);
							if (manualScrollToBottomCleanupRef.current === dispose) {
								manualScrollToBottomCleanupRef.current = null;
							}
						};
						tid = window.setTimeout(() => {
							alignToMax('auto');
							dispose();
						}, 600);
						manualScrollToBottomCleanupRef.current = dispose;
					} else {
						scrollToBottomRafCancelRef.current = cancelScrollToBottomRafs;
					}
				}
			},
			[],
		);

		const {
			// hook 内已用 useMemo 算好布尔值，此处解构重命名后直接传给 ChatControls，避免再调用函数
			isStreamingBranchVisible: streamingBranchVisibleFlag,
			isLatestBranch: isLatestBranchFlag,
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

		// 切换会话：恢复跟底与流式高度基准。上一会话若用户上滚，autoScroll 为 false 会导致
		// 进入本会话（尤其列表尾部仍有合并进来的流式气泡时）无法跟底；lastScrollHeightRef 沿用旧值也会挡住首次 scrollToBottom。
		useEffect(() => {
			if (!activeSessionId) {
				sessionEnterScrolledRef.current = null;
				return;
			}
			setAutoScroll(true);
			lastScrollHeightRef.current = 0;
			wasLastAssistantStreamingRef.current = false;
		}, [activeSessionId]);

		// 从消息记录进入会话：补一次滚到底（含尾条仍在流式的会话；仅靠下方 observer 在 autoScroll=false 时不会触发）
		useEffect(() => {
			if (!activeSessionId) {
				return;
			}
			if (isCurrentSessionLoading) return;
			if (messages.length === 0) return;

			if (sessionEnterScrolledRef.current === activeSessionId) return;

			sessionEnterScrolledRef.current = activeSessionId;

			queueMicrotask(() => {
				onScrollTo('down', 'auto');
				// 滚底在微任务/rAF 内完成，scroll 事件可能未驱动 handleScroll；双帧后对齐底栏箭头
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						syncViewportScrollMetricsRef.current();
					});
				});
			});
		}, [activeSessionId, messages, isCurrentSessionLoading, onScrollTo]);

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
				const sc = scrollContainerRef.current;
				if (sc && autoScroll && isCurrentlyStreaming) {
					const currentScrollHeight = sc.scrollHeight;
					if (currentScrollHeight !== lastScrollHeightRef.current) {
						lastScrollHeightRef.current = currentScrollHeight;
						sc.scrollTo({
							top: getMaxScrollTop(sc),
							behavior: 'auto',
						});
					}
				}
			};

			updateScrollbarState();
			scrollToBottom();
			syncViewportScrollMetrics();

			const contentWrapper =
				scrollContainerRef.current?.querySelector('#message-content');
			if (contentWrapper && isCurrentlyStreaming) {
				resizeObserverRef.current = new ResizeObserver(() => {
					updateScrollbarState();
					scrollToBottom();
					syncViewportScrollMetrics();
				});
				resizeObserverRef.current.observe(contentWrapper);
			}

			const contentArea =
				scrollContainerRef.current?.querySelector('#message-container');
			if (contentArea && isCurrentlyStreaming) {
				mutationObserverRef.current = new MutationObserver(() => {
					updateScrollbarState();
					scrollToBottom();
					syncViewportScrollMetrics();
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
		}, [messages, autoScroll, syncViewportScrollMetrics]);

		// 流式刚结束：observer 已卸；仅「已开联网」时尾条会多出联网区等高，补一次贴底（仅跟底模式）
		useEffect(() => {
			const last = messages[messages.length - 1];
			const nowStreaming = Boolean(
				last?.role === 'assistant' && last?.isStreaming,
			);
			const wasStreaming = wasLastAssistantStreamingRef.current;

			if (
				webSearchEnabled &&
				wasStreaming &&
				!nowStreaming &&
				last?.role === 'assistant' &&
				autoScroll
			) {
				queueMicrotask(() => {
					onScrollTo('down', 'auto');
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							syncViewportScrollMetricsRef.current();
						});
					});
				});
			}

			wasLastAssistantStreamingRef.current = nowStreaming;
		}, [messages, autoScroll, onScrollTo, webSearchEnabled]);

		// 会话/分支切换后：列表高度与 scrollTop 须同取自 DOM，避免沿用上一会话的 scrollTop 误判「在底部」→ 箭头反向
		useLayoutEffect(() => {
			syncViewportScrollMetrics();
		}, [
			messages,
			activeSessionId,
			selectedChildMap,
			syncViewportScrollMetrics,
		]);

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
				manualScrollToBottomCleanupRef.current?.();
				manualScrollToBottomCleanupRef.current = null;
				scrollToBottomRafCancelRef.current?.();
				scrollToBottomRafCancelRef.current = null;
				branchChangeRafIdsRef.current.forEach((id) => {
					cancelAnimationFrame(id);
				});
				branchChangeRafIdsRef.current.clear();
			};
		}, []);

		const handleScroll = useCallback(
			(e: React.UIEvent<HTMLDivElement>) => {
				const element = e.currentTarget;
				if (!scrollContainerRef.current) {
					scrollContainerRef.current = element;
				}
				syncViewportScrollMetrics();
			},
			[syncViewportScrollMetrics],
		);

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
				// 通知外部（如埋点、Store）：用户在该消息上点了上一/下一分支
				onBranchChange?.(msgId, direction);

				// 在整棵 flat 树里找出与 msgId 同父、同层的所有兄弟（含自己），用于 prev/next 边界判断
				const siblings = findSiblings(flatMessages, msgId);
				// 当前消息在兄弟数组中的下标，用于计算目标兄弟下标
				const currentIndex = siblings.findIndex((m) => m.chatId === msgId);
				// 下一目标：next 则 +1，prev 则 -1；越界时下方 if 直接不执行
				const nextIndex =
					direction === 'next' ? currentIndex + 1 : currentIndex - 1;

				if (nextIndex >= 0 && nextIndex < siblings.length) {
					// 切换后要展示的那条兄弟消息（assistant 或 user 皆可能）
					const nextMsg = siblings[nextIndex];
					// 从全量列表取当前行元数据（父 id、角色等），siblings 里字段可能不如 flat 全
					const currentMsg = flatMessages.find((m) => m.chatId === msgId);
					// 父消息 id：有则分支选择挂在父节点下；无则表示根层多条用户消息等，用 'root' 键
					const parentId = currentMsg?.parentId;
					// 仅助手气泡底部有分支条，需要钉视口；用户消息切换不做滚动补偿
					const isAssistantBranchSwitch = currentMsg?.role === 'assistant';

					// 浅拷贝分支 map，避免直接 mutate 父传入的 Map 引用
					const newSelectedChildMap = new Map(selectedChildMap);
					if (parentId) {
						// 在父节点下记录「选中的子节点」为 nextMsg，从而整条展示链切换到该兄弟分支
						newSelectedChildMap.set(parentId, nextMsg.chatId);
					} else {
						// 无 parentId 时根 competing 消息共用虚拟键 'root'
						newSelectedChildMap.set('root', nextMsg.chatId);
					}

					// 是否在切换后应滚到列表最底：仅当组件自己推导展示链时才算（外部 displayMessages 则无法在此推断）
					let shouldScrollToBottom = false;
					if (props.displayMessages === undefined) {
						// 用新 map 从 flat 推导出当前分支上的消息顺序
						const rawPath = buildMessageList(flatMessages, newSelectedChildMap);
						// 链尾消息：若就是刚选中的兄弟，说明下面没有更多回复，视口应贴底而非钉中间
						const lastInChain = rawPath[rawPath.length - 1];
						shouldScrollToBottom = lastInChain?.chatId === nextMsg.chatId;
					}

					// 滚动视口 DOM（ScrollArea 的 viewport），用于读切换前元素位置
					const sc = scrollContainerRef.current;
					// 切换前当前消息对应行节点，id 与列表渲染约定一致
					const oldRow = sc?.querySelector(`#message-${msgId}`);
					// 助手气泡内分支控件上的锚点，用于记录「分支条顶部」视口坐标
					const oldBranchEl = oldRow?.querySelector(
						'[data-message-branch-anchor]',
					);
					if (shouldScrollToBottom || !isAssistantBranchSwitch) {
						// 链尾贴底路径或用户消息：不需要后续按锚点修正 scrollTop
						pendingBranchScrollAnchorRef.current = null;
					} else if (oldRow instanceof HTMLElement) {
						// 新一轮助手钉视口操作，递增序号；过期 seq 在 rAF 里会被丢弃，避免快速连点错乱
						branchScrollSeqRef.current += 1;
						if (oldBranchEl instanceof HTMLElement) {
							// 优先用分支条顶部作为钉视口参照（比钉整行顶更能稳住底部按钮）
							pendingBranchScrollAnchorRef.current = {
								kind: 'anchorTop',
								// 记录切换前视口中的纵向位置，并略向上偏移，避免贴顶太死
								before:
									oldBranchEl.getBoundingClientRect().top -
									BRANCH_ANCHOR_NUDGE_UP_PX,
								// 切换后 DOM 行 id 变为 nextMsg，对齐时找新行上的同位置
								nextRowId: nextMsg.chatId,
								seq: branchScrollSeqRef.current,
							};
						} else {
							// 无分支锚点节点时退化为钉整行底边（同样带向上 nudge）
							pendingBranchScrollAnchorRef.current = {
								kind: 'rowBottom',
								before:
									oldRow.getBoundingClientRect().bottom -
									BRANCH_ANCHOR_NUDGE_UP_PX,
								nextRowId: nextMsg.chatId,
								seq: branchScrollSeqRef.current,
							};
						}
					} else {
						// 未找到旧行 DOM，无法采样 before，放弃本次钉视口
						pendingBranchScrollAnchorRef.current = null;
					}

					// 同步更新 React 状态，使新分支内容与 map 同一帧提交，避免中间帧闪错分支
					flushSync(() => {
						onSelectedChildMapChange(newSelectedChildMap);
					});
					// flushSync 后重新取容器：子树已换成 next 兄弟，可测量新行并改 scrollTop
					const scAfter = scrollContainerRef.current;
					if (shouldScrollToBottom && scAfter) {
						// 立即滚到最大 scrollTop，让链尾贴齐容器底
						scAfter.scrollTop = getMaxScrollTop(scAfter);
						queueMicrotask(() => syncViewportScrollMetrics());
						// 下一帧再滚一次：首帧后 lazy 内容（如 MdPreview）可能增高，需二次对齐到底
						scheduleBranchRaf(() => {
							const el = scrollContainerRef.current;
							if (!el) return;
							el.scrollTop = getMaxScrollTop(el);
							syncViewportScrollMetrics();
						});
					} else if (scAfter && isAssistantBranchSwitch) {
						// 非链尾且为助手：用长消息或锚点逻辑保持操作区在视口内
						const nextId = nextMsg.chatId;
						if (isLongMessageRowForBranchScroll(scAfter, nextId)) {
							// 行高超过视口一半时钉「行底贴视口底」，避免只钉锚点顶把长气泡底部操作区顶出屏
							pendingBranchScrollAnchorRef.current = null;
							alignMessageRowBottomToViewportBottom(scAfter, nextId);
							queueMicrotask(() => syncViewportScrollMetrics());
							scheduleBranchRaf(() => {
								const sc = scrollContainerRef.current;
								if (!sc) return;
								alignMessageRowBottomToViewportBottom(sc, nextId);
								syncViewportScrollMetrics();
							});
						} else {
							// 短消息：用切换前记录的 before 与切换后新行上对应点做差，修正 scrollTop
							const anchorPending = pendingBranchScrollAnchorRef.current;
							if (anchorPending) {
								const done = tryApplyBranchScrollAnchor(
									scAfter,
									anchorPending,
									branchScrollSeqRef.current,
								);
								// 对齐成功或 seq 已作废：清 pending，避免 layout effect 重复应用
								if (done) pendingBranchScrollAnchorRef.current = null;
								if (done) {
									// 快照本次 pending，供 rAF 内使用（ref 可能已被清空）
									const snap = anchorPending;
									scheduleBranchRaf(() => {
										// 若用户又点了一次分支，seq 已变，本帧不再改滚动避免打架
										if (snap.seq !== branchScrollSeqRef.current) return;
										const sc = scrollContainerRef.current;
										if (!sc) return;
										if (isLongMessageRowForBranchScroll(sc, snap.nextRowId)) {
											// 第二帧内容撑高后变为长消息：改用语义对齐行底
											alignMessageRowBottomToViewportBottom(sc, snap.nextRowId);
										} else {
											// 仍短消息：再应用一次锚点修正（处理首帧测量不准）
											tryApplyBranchScrollAnchor(
												sc,
												snap,
												branchScrollSeqRef.current,
											);
										}
									});
								}
							}
						}
					}
					if (activeSessionId && onPersistSessionBranchSelection) {
						// 闭包捕获当前会话 id，避免微任务跑时会话已切换写到别会话
						const sid = activeSessionId;
						// 拷贝 map：防止父组件随后 mutate 同一 Map 导致持久化内容漂移
						const mapSnapshot = new Map(newSelectedChildMap);
						queueMicrotask(() => {
							// 延后到当前同步渲染与布局之后，减少与浏览器 layout/paint 同帧竞争
							onPersistSessionBranchSelection(sid, mapSnapshot);
						});
					}
				}
			},
			[
				activeSessionId,
				buildMessageList,
				findSiblings,
				flatMessages,
				onBranchChange,
				onPersistSessionBranchSelection,
				onSelectedChildMapChange,
				props.displayMessages,
				scheduleBranchRaf,
				selectedChildMap,
				syncViewportScrollMetrics,
			],
		);

		// flushSync 后若 DOM 未就绪未钉住，仅在此处补一次；长消息在首帧可能尚未撑高，此处再判一次
		useLayoutEffect(() => {
			const pending = pendingBranchScrollAnchorRef.current;
			if (!pending) return;
			const sc = scrollContainerRef.current;
			if (!sc) return;
			const nextId = pending.nextRowId;
			if (isLongMessageRowForBranchScroll(sc, nextId)) {
				pendingBranchScrollAnchorRef.current = null;
				alignMessageRowBottomToViewportBottom(sc, nextId);
				return;
			}
			const done = tryApplyBranchScrollAnchor(
				sc,
				pending,
				branchScrollSeqRef.current,
			);
			if (done) pendingBranchScrollAnchorRef.current = null;
		}, [messages, selectedChildMap]);

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
						? `bg-teal-600/10 border border-teal-600/20 text-end pt-2 pb-2.5 px-3 ${isEdit ? 'p-0 pr-2.5 pb-2.5' : ''}`
						: 'bg-theme/5 border border-theme/10',
					showAvatar
						? 'max-w-[calc(768px-105px)]'
						: isEdit
							? 'w-full bg-theme/5 border-theme/10'
							: 'w-auto',
					isSharing ? 'cursor-pointer' : '',
					checkedMessages.has(message.chatId) ? 'bg-theme-background/5' : '',
				);
			},
			[showAvatar, editMessage?.chatId, isSharing, checkedMessages],
		);

		const onShare = useCallback(() => {
			setIsSharing(true);
		}, [setIsSharing]);

		const chatControlsContext = useMemo<ChatBotViewChatControlsContext>(
			() => ({
				isLoading: isCurrentSessionLoading,
				isStreamingBranchVisible: streamingBranchVisibleFlag,
				isLatestBranch: isLatestBranchFlag,
				messagesLength: messages.length,
				switchToStreamingBranch,
				switchToLatestBranch,
				hasScrollbar,
				isAtBottom,
				onScrollTo: onScrollTo as ChatBotViewChatControlsContext['onScrollTo'],
			}),
			[
				isCurrentSessionLoading,
				streamingBranchVisibleFlag,
				isLatestBranchFlag,
				messages.length,
				switchToStreamingBranch,
				switchToLatestBranch,
				hasScrollbar,
				isAtBottom,
				onScrollTo,
			],
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
				<ChatCodeFloatingToolbar />
				{/* ref 指向 ScrollArea Viewport；吸顶条由 useChatCodeFloatingToolbar + layoutChatCodeToolbars 同步 */}
				<ScrollArea
					ref={scrollContainerRef}
					viewportClassName="[overflow-anchor:none]"
					className="flex-1 overflow-hidden w-full backdrop-blur-sm pb-5"
					onScroll={handleScroll}
				>
					<div id="message-container" className="max-w-3xl m-auto min-w-0">
						<div id="message-content" className="space-y-6 min-w-0">
							{!messages.length
								? // emptyState 可选：嵌入方自定义欢迎页；默认保持原 ChatNewSession，避免行为变化。
									(emptyState ?? <ChatNewSession />)
								: messages.map((message, index) => (
										<div
											key={message.chatId}
											id={`message-${message.chatId}`}
											// 靠后的消息默认后绘制会盖住上一条的 absolute 操作区；提高靠前行的 z-index，避免分支按钮被下一条盖住
											style={{ zIndex: messages.length - index }}
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
												<Label
													id="message-md-wrap"
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
															// 与上列 ScrollArea ref 相同：助手气泡内据此懒挂载 MdPreview
															scrollViewportRef={scrollContainerRef}
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
															onSaveToKnowledge,
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
															onSaveToKnowledge={onSaveToKnowledge}
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
							renderChatControls(chatControlsContext)
						) : (
							<ChatControls {...chatControlsContext} />
						)
					) : null}
				</ScrollArea>
			</div>
		);
	},
);

export default ChatBotView as React.FC<ChatBotViewProps> &
	((props: { ref?: React.Ref<ChatBotRef> } & ChatBotViewProps) => JSX.Element);
