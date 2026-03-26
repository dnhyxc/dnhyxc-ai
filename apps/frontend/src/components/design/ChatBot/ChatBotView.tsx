import ChatAnchorNav from '@design/ChatAnchorNav';
import ChatAssistantMessage from '@design/ChatAssistantMessage';
import ChatControls from '@design/ChatControls';
import ChatFileList from '@design/ChatFileList';
import ChatMessageActions from '@design/ChatMessageActions';
import ChatNewSession from '@design/ChatNewSession';
import ChatUserMessage from '@design/ChatUserMessage';
import {
	useVirtualizer,
	type VirtualItem,
	type Virtualizer,
} from '@tanstack/react-virtual';
import { Label, ScrollArea } from '@ui/index';
import { Bot, User } from 'lucide-react';
import React, {
	type ChangeEvent,
	type Dispatch,
	Fragment,
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
 * - 流式输出且最后一条为助手时：该条移出虚拟列表、走文档流（上方历史仍为虚拟列表），避免变高行在 absolute+translateY 下反复测量导致抖动；跟底用 `scrollTop = scrollHeight - clientHeight`（layout 阶段）。
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
		/** 流式跟底：供虚拟器尺寸回调与 handleScroll 读取，避免闭包陈旧 */
		const followStreamRef = useRef(false);
		/** 用户主动向上滚/上滑：同步置位，避免晚于 useLayoutEffect 跟底把滚动抢回去 */
		const streamFollowUserPausedRef = useRef(false);
		const touchStreamLastYRef = useRef<number | null>(null);
		/** 上一帧是否在流式，用于检测「刚结束」并贴底（尾条并回虚拟列表时总高突变） */
		const wasStreamingRef = useRef(false);
		const autoScrollRef = useRef(autoScroll);
		autoScrollRef.current = autoScroll;
		const isStreamingRef = useRef(false);
		const streamTailDetachedRef = useRef(false);
		/** 仅在「新一段流式开始」时清空暂停，避免在流式结束当帧误清 pause，导致结束贴底条件错乱 */
		const prevIsStreamingForPauseReset = useRef(false);
		/** 流式结束并入虚拟列表后短时间内关闭虚拟器 scroll 补偿，减轻闪动 */
		const suppressVirtualScrollAdjustUntilRef = useRef(0);
		const messagesRef = useRef<Message[]>(messages);

		messagesRef.current = messages;

		const lastMessageForStream = messages[messages.length - 1];
		const isCurrentlyStreaming =
			lastMessageForStream?.role === 'assistant' &&
			lastMessageForStream?.isStreaming;
		const nowStreamingBool = Boolean(isCurrentlyStreaming);
		if (!prevIsStreamingForPauseReset.current && nowStreamingBool) {
			streamFollowUserPausedRef.current = false;
			touchStreamLastYRef.current = null;
		}
		prevIsStreamingForPauseReset.current = nowStreamingBool;
		followStreamRef.current =
			Boolean(autoScroll && isCurrentlyStreaming) &&
			!streamFollowUserPausedRef.current;

		/** 流式助手尾条不进入虚拟列表，避免变高时虚拟测量与 translateY 抖动 */
		const streamTailDetached =
			virtualizeMessages &&
			messages.length > 0 &&
			lastMessageForStream?.role === 'assistant' &&
			Boolean(lastMessageForStream?.isStreaming);
		const virtualCount = streamTailDetached
			? Math.max(0, messages.length - 1)
			: messages.length;

		streamTailDetachedRef.current = streamTailDetached;
		isStreamingRef.current = Boolean(isCurrentlyStreaming);

		// 流式内容指纹：避免仅引用未变但漏触发；短句快换行时 length 会变
		const streamContentFingerprint = useMemo(
			() =>
				isCurrentlyStreaming && lastMessageForStream
					? `${lastMessageForStream.chatId}:${lastMessageForStream.content?.length ?? 0}:${lastMessageForStream.thinkContent?.length ?? 0}`
					: '',
			[
				isCurrentlyStreaming,
				lastMessageForStream?.chatId,
				lastMessageForStream?.content,
				lastMessageForStream?.thinkContent,
			],
		);

		// 必须在 `scrollContainerRef` 之后创建：滚动元素为 Radix ScrollArea Viewport（与本组件原有滚动行为一致）。
		// 流式尾条拆出后 `count` 不含最后一条；仅一条且正在流式时 `count===0` 关闭虚拟器。
		const virtualizer = useVirtualizer({
			count: virtualCount,
			getScrollElement: () => scrollContainerRef.current,
			// 首屏估算高度，流式/长文本由 `measureElement` 与虚拟器内部测量纠正。
			estimateSize: () => 200,
			// 与 `space-y-6`（1.5rem）一致，保证总高度与旧版全量列表 spacing 接近。
			gap: 24,
			overscan: 8,
			// 与 ChatAnchorNav 非虚拟路径下「scrollTop 减 20px」的视觉效果对齐（见 scrollPaddingStart 语义）。
			scrollPaddingStart: 20,
			paddingEnd: 1,
			// 分支切换时同 index 可能换 chatId，用 chatId 做 key 可让虚拟器复用测量缓存更合理。
			getItemKey: (index) => messages[index]?.chatId ?? index,
			enabled: virtualizeMessages && virtualCount > 0,
			// 尾条在文档流时变高不会触发虚拟测量；此处仅在「全在虚拟内」的流式场景补跟底
			onChange: () => {
				if (!isStreamingRef.current) return;
				if (streamFollowUserPausedRef.current || !autoScrollRef.current) return;
				if (streamTailDetachedRef.current) return;
				const el = scrollContainerRef.current;
				if (!el) return;
				el.scrollTop = el.scrollHeight - el.clientHeight;
			},
		});

		// 类型上未列入 VirtualizerOptions，但实例支持；跟底流式时禁用尺寸补偿以免与 scrollToIndex 抢滚动。
		useLayoutEffect(() => {
			virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (
				item: VirtualItem,
				_delta: number,
				instance: Virtualizer<HTMLDivElement, Element>,
			) => {
				if (followStreamRef.current) return false;
				if (
					typeof performance !== 'undefined' &&
					performance.now() < suppressVirtualScrollAdjustUntilRef.current
				) {
					return false;
				}
				// virtual-core 默认逻辑；getScrollOffset / scrollAdjustments 未在 .d.ts 中公开
				const core = instance as unknown as {
					getScrollOffset(): number;
					scrollAdjustments: number;
				};
				return item.start < core.getScrollOffset() + core.scrollAdjustments;
			};
			return () => {
				virtualizer.shouldAdjustScrollPositionOnItemSizeChange = undefined;
			};
		}, [virtualizer]);

		// 仅虚拟列表需要：闭包内读取 `virtualizer.measurementsCache` 最新值，勿把 cache 本身放进 deps（会导致无意义失效）。
		const anchorScrollAdapter = useMemo(():
			| ChatAnchorScrollAdapter
			| undefined => {
			if (!virtualizeMessages || messages.length === 0) return undefined;
			return {
				scrollToChatId: (chatId: string) => {
					const idx = messages.findIndex((m) => m.chatId === chatId);
					if (idx < 0) return;
					const lastIdx = messages.length - 1;
					if (
						streamTailDetached &&
						idx === lastIdx &&
						scrollContainerRef.current
					) {
						scrollContainerRef.current.scrollTo({
							top: scrollContainerRef.current.scrollHeight,
							behavior: 'smooth',
						});
						return;
					}
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
		}, [virtualizeMessages, messages, virtualizer, streamTailDetached]);

		const editInputRef = useRef<HTMLTextAreaElement>(null);
		const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
		const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
		const lastScrollHeightRef = useRef<number>(0);
		/**
		 * 分支切换（左右箭头换兄弟回答）时的滚动锚点快照，供下一帧把「分支箭头条」贴回同一屏幕位置。
		 *
		 * 背景：MessageActions 在气泡内 `absolute bottom`，长文时箭头在整条消息最底部。若用整行
		 * `scrollIntoView` / `scrollToIndex(align:center)`，是按整条消息行对齐，箭头仍会相对视口下沉。
		 *
		 * 做法：点击切换前记录「箭头条」相对 Radix ScrollArea Viewport 的 top 差；React 提交新分支
		 * DOM 后再量一次，用 scrollTop 补偿差值，使箭头条的视口 top 与切换前一致。
		 *
		 * 依赖：ChatMessageActions 内分支区域根节点上的 `data-branch-switch-anchor`；每条消息行根节点
		 * 上的 `data-message-list-index`（切换兄弟后 chatId 会变，用列表下标定位同一「槽位」）。
		 * 自定义 renderMessageActions 时请在分支 UI 外包一层并加同名 data 属性，否则不会写入本 ref。
		 */
		const branchSwitchAnchorRef = useRef<{
			/** 当前展示链路上该条消息的下标，切换兄弟后不变 */
			listIndex: number;
			/** 切换前：分支箭头条上边缘距滚动视口上边缘的像素距离（与 getBoundingClientRect 一致） */
			targetViewportTop: number;
		} | null>(null);

		const SCROLL_THRESHOLD = 5;
		/** 流式时「仍算在底部」的容差；过大会导致用户上滑后仍被跟底，难以打断 */
		const STREAM_BOTTOM_SLACK_PX = 48;

		const onScrollTo = useCallback(
			(position: string, behavior?: 'smooth' | 'auto') => {
				const el = scrollContainerRef.current;
				if (!el) return;
				const b = behavior ?? 'smooth';
				const useSmooth = b === 'smooth';

				if (position === 'up') {
					el.scrollTo({ top: 0, behavior: b });
					return;
				}

				const pinNativeBottom = () => {
					const v = scrollContainerRef.current;
					if (!v) return;
					v.scrollTop = Math.max(0, v.scrollHeight - v.clientHeight);
				};

				const lastIdx = messages.length - 1;
				// 尾条拆出时最后一条不在 virtualizer 的 count 里，不能 scrollToIndex(last)
				const useVirtualPinToLast =
					virtualizeMessages &&
					messages.length > 0 &&
					!streamTailDetached &&
					lastIdx >= 0;

				if (useVirtualPinToLast) {
					virtualizer.scrollToIndex(lastIdx, {
						align: 'end',
						behavior: useSmooth ? 'smooth' : 'auto',
					});
				}

				if (!useSmooth) {
					// auto：原生 max + 延后两帧再钉一次，避免虚拟总高与视口 scrollHeight 暂不一致导致差一截
					pinNativeBottom();
					queueMicrotask(pinNativeBottom);
					requestAnimationFrame(pinNativeBottom);
				} else if (!useVirtualPinToLast) {
					el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
				}
			},
			[virtualizer, messages.length, virtualizeMessages, streamTailDetached],
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

		// 流式：layout 贴底 + microtask/rAF 再贴（Markdown/换行后高度晚一帧才稳定）。
		// 流式结束：仅 autoScroll 且未主动暂停时贴底；不用距底像素判断（尾条并进虚拟列表当帧 scrollHeight 会突变，距离会失真）。
		useLayoutEffect(() => {
			const el = scrollContainerRef.current;
			if (el) {
				setHasScrollbar(el.scrollHeight > el.clientHeight);
			}
			if (!el) return;

			const pinNativeBottom = () => {
				const v = scrollContainerRef.current;
				if (!v) return;
				v.scrollTop = v.scrollHeight - v.clientHeight;
			};

			const prevStreaming = wasStreamingRef.current;
			const nowStreaming = Boolean(isCurrentlyStreaming);
			const streamJustEnded = prevStreaming && !nowStreaming;
			wasStreamingRef.current = nowStreaming;

			if (streamJustEnded) {
				const stillFollowingBottom =
					autoScrollRef.current && !streamFollowUserPausedRef.current;
				if (stillFollowingBottom) {
					if (typeof performance !== 'undefined') {
						suppressVirtualScrollAdjustUntilRef.current =
							performance.now() + 200;
					}
					// 只信原生 max scroll，避免与 scrollToIndex 连续抢滚造成闪烁
					pinNativeBottom();
					requestAnimationFrame(() => {
						pinNativeBottom();
					});
				}
				return;
			}

			if (!isCurrentlyStreaming) return;
			if (streamFollowUserPausedRef.current) return;
			if (!autoScroll) return;

			pinNativeBottom();

			if (!virtualizeMessages || messages.length === 0) {
				const sh = el.scrollHeight;
				if (sh !== lastScrollHeightRef.current) {
					lastScrollHeightRef.current = sh;
				}
				queueMicrotask(() => {
					if (
						!isStreamingRef.current ||
						streamFollowUserPausedRef.current ||
						!autoScrollRef.current
					)
						return;
					pinNativeBottom();
				});
				requestAnimationFrame(() => {
					if (
						!isStreamingRef.current ||
						streamFollowUserPausedRef.current ||
						!autoScrollRef.current
					)
						return;
					pinNativeBottom();
				});
				return;
			}

			queueMicrotask(() => {
				if (
					!isStreamingRef.current ||
					streamFollowUserPausedRef.current ||
					!autoScrollRef.current
				)
					return;
				pinNativeBottom();
			});
			requestAnimationFrame(() => {
				if (
					!isStreamingRef.current ||
					streamFollowUserPausedRef.current ||
					!autoScrollRef.current
				)
					return;
				pinNativeBottom();
			});
		}, [
			messages,
			autoScroll,
			isCurrentlyStreaming,
			virtualizeMessages,
			messages.length,
			streamContentFingerprint,
			virtualizer,
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
			};
		}, []);

		const pauseStreamFollowFromUser = useCallback(() => {
			streamFollowUserPausedRef.current = true;
			setAutoScroll(false);
		}, []);

		const onWheelPauseStreamFollow = useCallback(
			(e: React.WheelEvent) => {
				if (e.deltaY >= 0) return;
				const viewport = scrollContainerRef.current;
				if (!viewport || viewport.scrollTop <= 0) return;
				pauseStreamFollowFromUser();
			},
			[pauseStreamFollowFromUser],
		);

		const onTouchMovePauseStreamFollow = useCallback(
			(e: React.TouchEvent) => {
				if (e.touches.length !== 1) return;
				const y = e.touches[0].clientY;
				const prev = touchStreamLastYRef.current;
				touchStreamLastYRef.current = y;
				if (prev == null) return;
				// 手指上移：内容向上滚去看历史，打断跟底
				if (y < prev - 8) {
					pauseStreamFollowFromUser();
				}
			},
			[pauseStreamFollowFromUser],
		);

		const onTouchEndStreamTrack = useCallback(() => {
			touchStreamLastYRef.current = null;
		}, []);

		const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
			const element = e.currentTarget;
			if (!scrollContainerRef.current) {
				scrollContainerRef.current = element;
			}
			const { scrollTop, scrollHeight, clientHeight } = element;
			setScrollTop(scrollTop);
			setHasScrollbar(scrollHeight > clientHeight);
			const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
			const isAtBottom = distanceFromBottom < SCROLL_THRESHOLD;
			const msgs = messagesRef.current;
			const last = msgs[msgs.length - 1];
			const streaming = last?.role === 'assistant' && last?.isStreaming;
			if (streaming) {
				if (distanceFromBottom < SCROLL_THRESHOLD) {
					streamFollowUserPausedRef.current = false;
				} else if (distanceFromBottom > STREAM_BOTTOM_SLACK_PX) {
					// 滚动条拖离底部同样打断跟底（不依赖 wheel）
					streamFollowUserPausedRef.current = true;
				}
				const nearBottom = distanceFromBottom < STREAM_BOTTOM_SLACK_PX;
				setAutoScroll(nearBottom && !streamFollowUserPausedRef.current);
			} else {
				setAutoScroll(isAtBottom);
			}
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

					// --- 分支滚动锚点：必须在 setState（更新 selectedChildMap）之前采样，否则已是新兄弟的 DOM ---
					const listIndex = messages.findIndex((m) => m.chatId === msgId);
					const container = scrollContainerRef.current;
					if (listIndex >= 0 && container) {
						// 限定在第 listIndex 行内查找，避免 query 误命中其它消息上的分支条
						const anchor = container.querySelector(
							`[data-message-list-index="${listIndex}"] [data-branch-switch-anchor]`,
						) as HTMLElement | null;
						if (anchor) {
							const cRect = container.getBoundingClientRect();
							const aRect = anchor.getBoundingClientRect();
							branchSwitchAnchorRef.current = {
								listIndex,
								targetViewportTop: aRect.top - cRect.top,
							};
						}
						// 未找到锚点（例如自定义操作条未带 data-branch-switch-anchor）时不写 ref，后续 effect 不滚动
					}

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
				messages,
			],
		);

		/**
		 * 分支切换后：按「分支箭头条」对齐滚动，而不是对齐整条消息行。
		 *
		 * 几何关系（仅考虑纵向）：
		 * - 视口内某固定点相对视口顶部的距离，在 scrollTop 增加 1px 时，该点对应内容整体上移 1px，
		 *   即 getBoundingClientRect().top 减少约 1。故：希望锚点 top 从 current 变回 target 时，
		 *   应满足 currentTop - ΔscrollTop ≈ targetTop → ΔscrollTop ≈ currentTop - targetTop。
		 * - 代码：`adjust = currentTop - targetTop`，`scrollTop += adjust`。此前若误用 target - current
		 *   会与上述关系相反，会把列表滚向错误方向。
		 *
		 * suppressVirtualScrollAdjustUntilRef：TanStack Virtual 在子项高度变化时会回调
		 * shouldAdjustScrollPositionOnItemSizeChange 并可能改写 scrollTop；分支切换会换 chatId、
		 * 高度常变，短时关闭该补偿避免与本次手动对齐抢滚动。
		 *
		 * layout / microtask / 双 rAF：虚拟列表换 key 后测量与布局可能晚半帧到一帧，多拍执行使补偿
		 * 在测量稳定后仍有机会收敛；重复调用时若已对齐则 adjust≈0，不再改动 scrollTop。
		 */
		useLayoutEffect(() => {
			const pending = branchSwitchAnchorRef.current;
			if (!pending) return;
			// 立即消费，避免同一次会话里后续 messages 更新（如流式）重复执行对齐
			branchSwitchAnchorRef.current = null;
			const idx = pending.listIndex;
			const targetTop = pending.targetViewportTop;
			const container = scrollContainerRef.current;
			if (!container || idx < 0) return;

			const tryAlignBranchAnchor = () => {
				const anchor = container.querySelector(
					`[data-message-list-index="${idx}"] [data-branch-switch-anchor]`,
				) as HTMLElement | null;
				if (!anchor) return;
				if (typeof performance !== 'undefined') {
					suppressVirtualScrollAdjustUntilRef.current = performance.now() + 360;
				}
				const cRect = container.getBoundingClientRect();
				const currentTop = anchor.getBoundingClientRect().top - cRect.top;
				const adjust = currentTop - targetTop;
				if (Math.abs(adjust) >= 0.5) {
					container.scrollTop += adjust;
				}
			};

			tryAlignBranchAnchor();
			queueMicrotask(tryAlignBranchAnchor);
			requestAnimationFrame(() => {
				tryAlignBranchAnchor();
				requestAnimationFrame(tryAlignBranchAnchor);
			});
		}, [messages]);

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
				// 当前分支链路上的序号；切换兄弟回答后该槽位 index 不变，仅 chatId/内容变，供分支滚动用选择器限定行
				data-message-list-index={index}
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
						onWheelCapture={onWheelPauseStreamFollow}
						onTouchMove={onTouchMovePauseStreamFollow}
						onTouchEnd={onTouchEndStreamTrack}
						onTouchCancel={onTouchEndStreamTrack}
					>
						{/* 虚拟模式：流式助手尾条拆出文档流，其余仍虚拟；非虚拟：space-y-6 */}
						<div
							id="message-content"
							className={cn(
								'overflow-hidden',
								virtualListActive ? 'relative' : 'space-y-6',
							)}
							style={
								virtualListActive && !streamTailDetached
									? { height: `${virtualizer.getTotalSize()}px` }
									: undefined
							}
						>
							{!messages.length ? (
								(emptyState ?? <ChatNewSession />)
							) : virtualListActive ? (
								streamTailDetached ? (
									<>
										{virtualCount > 0 ? (
											<div
												className="relative w-full"
												style={{
													height: `${virtualizer.getTotalSize()}px`,
												}}
											>
												{virtualizer.getVirtualItems().map((virtualRow) => {
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
												})}
											</div>
										) : null}
										<div className={cn('w-full', virtualCount > 0 && 'mt-6')}>
											{renderMessageRow(
												messages[messages.length - 1],
												messages.length - 1,
											)}
										</div>
									</>
								) : (
									virtualizer.getVirtualItems().map((virtualRow) => {
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
								)
							) : (
								messages.map((message, index) => (
									<Fragment key={message.chatId}>
										{renderMessageRow(message, index)}
									</Fragment>
								))
							)}
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
