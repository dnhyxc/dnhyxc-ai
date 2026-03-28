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

/** 滚动容器合法 scrollTop 上限（勿用 scrollHeight+N 依赖浏览器钳位） */
function getMaxScrollTop(el: HTMLElement) {
	return Math.max(0, el.scrollHeight - el.clientHeight);
}

/**
 * 行高 ≥ 视口一半时视为「长消息」：分支操作在气泡底部，若仍用钉锚点 top 会滚到对齐气泡上沿，操作区被顶到视口上方。
 * 此时改为把整条 #message-row 的底边与 ScrollArea viewport 底边对齐（只滚外层 scrollContainerRef）。
 */
const LONG_ROW_VIEWPORT_HEIGHT_RATIO = 0.5;

function alignMessageRowBottomToViewportBottom(sc: HTMLElement, rowId: string) {
	const row = sc.querySelector(`#message-${rowId}`);
	if (!(row instanceof HTMLElement)) return;
	const delta =
		row.getBoundingClientRect().bottom - sc.getBoundingClientRect().bottom;
	if (Math.abs(delta) > 0.5) sc.scrollTop += delta;
}

function isLongMessageRowForBranchScroll(sc: HTMLElement, rowId: string) {
	const row = sc.querySelector(`#message-${rowId}`);
	if (!(row instanceof HTMLElement)) return false;
	return (
		row.getBoundingClientRect().height >=
		sc.clientHeight * LONG_ROW_VIEWPORT_HEIGHT_RATIO
	);
}

/** 底下仍有后续消息时：钉视口目标略偏上（仅短消息路径） */
const BRANCH_ANCHOR_NUDGE_UP_PX = 20;

type BranchScrollPending = {
	kind: 'anchorTop' | 'rowBottom';
	before: number;
	nextRowId: string;
	seq: number;
};

/**
 * 分支切换后按锚点修正 scrollTop 一次。
 * 返回 true：可结束本次钉视口（成功对齐或 seq 已过期）；false：DOM 尚未就绪，可交给 useLayoutEffect 再试。
 */
function tryApplyBranchScrollAnchor(
	sc: HTMLElement,
	pending: BranchScrollPending,
	currentSeq: number,
): boolean {
	if (pending.seq !== currentSeq) return true;
	const r = sc.querySelector(`#message-${pending.nextRowId}`);
	if (!(r instanceof HTMLElement)) return false;
	let d = 0;
	if (pending.kind === 'anchorTop') {
		const a = r.querySelector('[data-message-branch-anchor]');
		if (!(a instanceof HTMLElement)) return false;
		d = a.getBoundingClientRect().top - pending.before;
	} else {
		d = r.getBoundingClientRect().bottom - pending.before;
	}
	if (Math.abs(d) > 0.5) sc.scrollTop += d;
	return true;
}

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
				if (
					// 为何：身份不变才允许复用引用；影响：换分支后 chatId 会变，强制换新对象触发子树更新
					p.chatId === n.chatId &&
					// 为何：正文驱动 MdPreview value；影响：内容不变则 memo 的 Markdown 可跳过重渲染
					p.content === n.content &&
					// 为何：思考区单独渲染；影响：展开区与 memo 比较需同步
					(p.thinkContent ?? '') === (n.thinkContent ?? '') &&
					// 为何：流式结束要从「始终富文本」切到可懒加载；影响：状态翻转须换新引用
					p.isStreaming === n.isStreaming &&
					// 为何：分支箭头依赖 siblingIndex；影响：切兄弟仅这两字段变，仍须换新对象
					p.siblingIndex === n.siblingIndex &&
					p.siblingCount === n.siblingCount &&
					// 为何：用户/助手渲染路径不同；影响：角色切换必须重挂载
					p.role === n.role &&
					// 为何：附件列表引用常稳定；影响：同一引用表示附件未变，可省重渲染
					p.attachments === n.attachments &&
					// 为何：maxTokens 等影响「接着回答」按钮；影响：finishReason 变须更新 UI
					p.finishReason === n.finishReason &&
					// 为何：停止态控制「继续生成」；影响：与 chatStore 同步停止标记
					(p.isStopped ?? false) === (n.isStopped ?? false)
				) {
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
		/** 用户手动「滚到底」时注册的 ResizeObserver，需在下次滚顶/卸载时 disconnect */
		const manualScrollToBottomCleanupRef = useRef<(() => void) | null>(null);
		/** 分支切换后：把「当前操作的那条消息行」在视口内的纵向位置钉住，避免下方新链路变长把操作区顶出视野 */
		const pendingBranchScrollAnchorRef = useRef<BranchScrollPending | null>(
			null,
		);
		const branchScrollSeqRef = useRef(0);
		/** 从会话列表进入会话时，同一会话仅滚到底一次（非流式首屏不走下方 observer 跟底） */
		const sessionEnterScrolledRef = useRef<string | null>(null);

		const SCROLL_THRESHOLD = 5;

		const onScrollTo = useCallback(
			(position: string, behavior?: 'smooth' | 'auto') => {
				const el = scrollContainerRef.current;
				if (!el) return;
				const bh = behavior ?? 'smooth';

				if (position === 'up') {
					manualScrollToBottomCleanupRef.current?.();
					manualScrollToBottomCleanupRef.current = null;
					el.scrollTo({ top: 0, behavior: bh });
					return;
				}

				// 刷新后首次滚到底：首帧 scrollHeight 常偏小（字体/MdPreview 懒挂载晚一步），需跟随后续增高
				manualScrollToBottomCleanupRef.current?.();
				manualScrollToBottomCleanupRef.current = null;

				const alignToMax = (scrollBehavior: ScrollBehavior) => {
					el.scrollTo({ top: getMaxScrollTop(el), behavior: scrollBehavior });
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
					requestAnimationFrame(() => {
						alignToMax('auto');
						requestAnimationFrame(() => alignToMax('auto'));
					});
					if (contentRoot) {
						const ro = new ResizeObserver(() => alignToMax('auto'));
						ro.observe(contentRoot);
						let disposed = false;
						// DOM 的 setTimeout 返回 number，与 @types/node 的 Timeout 在合并时易冲突，此处仅作定时清理用
						let tid = 0;
						const dispose = () => {
							if (disposed) return;
							disposed = true;
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

		// 从消息记录进入会话：历史消息非流式，原 effect 仅在 isStreaming 时跟底，需补一次滚到底
		useEffect(() => {
			if (!activeSessionId) {
				sessionEnterScrolledRef.current = null;
				return;
			}
			if (isCurrentSessionLoading) return;
			if (messages.length === 0) return;

			const lastMessage = messages[messages.length - 1];
			const lastStreaming =
				lastMessage?.role === 'assistant' && lastMessage?.isStreaming;
			if (lastStreaming) return;

			if (sessionEnterScrolledRef.current === activeSessionId) return;

			sessionEnterScrolledRef.current = activeSessionId;

			queueMicrotask(() => {
				onScrollTo('down', 'auto');
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
				manualScrollToBottomCleanupRef.current?.();
				manualScrollToBottomCleanupRef.current = null;
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

					// 拷贝当前 Map，在对应父键上写入选中的子 chatId（根层用 'root'）
					const newSelectedChildMap = new Map(selectedChildMap);
					if (parentId) {
						newSelectedChildMap.set(parentId, nextMsg.chatId);
					} else {
						newSelectedChildMap.set('root', nextMsg.chatId);
					}

					// 切换后若当前链路上该条已是最后一条（底下没有后续消息），应贴齐滚动容器底部，锚点钉视口会差一截
					let shouldScrollToBottom = false;
					if (props.displayMessages === undefined) {
						const rawPath = buildMessageList(flatMessages, newSelectedChildMap);
						const lastInChain = rawPath[rawPath.length - 1];
						shouldScrollToBottom = lastInChain?.chatId === nextMsg.chatId;
					}

					const sc = scrollContainerRef.current;
					const oldRow = sc?.querySelector(`#message-${msgId}`);
					const oldBranchEl = oldRow?.querySelector(
						'[data-message-branch-anchor]',
					);
					if (shouldScrollToBottom) {
						pendingBranchScrollAnchorRef.current = null;
					} else if (oldRow instanceof HTMLElement) {
						branchScrollSeqRef.current += 1;
						// 分支按钮在气泡内 absolute bottom，钉行顶无法稳定按钮；优先钉分支条，否则钉整条消息行底边
						if (oldBranchEl instanceof HTMLElement) {
							pendingBranchScrollAnchorRef.current = {
								kind: 'anchorTop',
								before:
									oldBranchEl.getBoundingClientRect().top -
									BRANCH_ANCHOR_NUDGE_UP_PX,
								nextRowId: nextMsg.chatId,
								seq: branchScrollSeqRef.current,
							};
						} else {
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
						pendingBranchScrollAnchorRef.current = null;
					}

					// 同步提交：回复内容与分支 Map 同一帧到位，无 transition 延迟
					flushSync(() => {
						onSelectedChildMapChange(newSelectedChildMap);
					});
					const scAfter = scrollContainerRef.current;
					if (shouldScrollToBottom && scAfter) {
						scAfter.scrollTop = getMaxScrollTop(scAfter);
						requestAnimationFrame(() => {
							const el = scrollContainerRef.current;
							if (!el) return;
							el.scrollTop = getMaxScrollTop(el);
						});
					} else if (scAfter) {
						const nextId = nextMsg.chatId;
						if (isLongMessageRowForBranchScroll(scAfter, nextId)) {
							pendingBranchScrollAnchorRef.current = null;
							alignMessageRowBottomToViewportBottom(scAfter, nextId);
							requestAnimationFrame(() => {
								const sc = scrollContainerRef.current;
								if (!sc) return;
								alignMessageRowBottomToViewportBottom(sc, nextId);
							});
						} else {
							const anchorPending = pendingBranchScrollAnchorRef.current;
							if (anchorPending) {
								const done = tryApplyBranchScrollAnchor(
									scAfter,
									anchorPending,
									branchScrollSeqRef.current,
								);
								if (done) pendingBranchScrollAnchorRef.current = null;
								if (done) {
									const snap = anchorPending;
									requestAnimationFrame(() => {
										if (snap.seq !== branchScrollSeqRef.current) return;
										const sc = scrollContainerRef.current;
										if (!sc) return;
										// 首帧可能尚未撑高（MdPreview 等），第二帧若已变长消息则改用语义对齐，避免仍按锚点把操作顶上去
										if (isLongMessageRowForBranchScroll(sc, snap.nextRowId)) {
											alignMessageRowBottomToViewportBottom(sc, snap.nextRowId);
										} else {
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
						const sid = activeSessionId; // 微任务执行时会话可能已切，先捕获 id 避免写错会话
						const mapSnapshot = new Map(newSelectedChildMap); // Map 引用可能被父 mutate，快照=点击瞬间分支
						queueMicrotask(() => {
							onPersistSessionBranchSelection(sid, mapSnapshot); // commit 后异步持久化，减轻与 paint/layout 同帧争抢
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
				selectedChildMap,
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
				{/* ref 指向 Radix Viewport（可滚动节点），供 ChatAssistantMessage 作 IntersectionObserver.root */}
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
