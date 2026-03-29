# ChatBot 相关改动说明

**统计范围**：`git log --since="3 days ago"` 中涉及下列路径的提交（至当前 HEAD）。

**涉及文件**：

- `apps/frontend/src/components/design/ChatBot/ChatBotView.tsx`
- `apps/frontend/src/components/design/ChatBot/utils.ts`（分支钉视口滚动纯函数）
- `apps/frontend/src/components/design/ChatBot/index.tsx`
- `apps/frontend/src/components/design/ChatBot/SimpleChatBotView.tsx`
- `apps/frontend/src/components/design/ChatAnchorNav/index.tsx`
- `apps/frontend/src/components/design/ChatMessageActions/index.tsx`
- `apps/frontend/src/hooks/useBranchManage.ts`
- `apps/frontend/src/hooks/useMessageTools.ts`（模块级纯函数与 `buildMessageList` 排序优化）

**主要提交主题（节选）**：Chat 性能与注释、将 UI 抽成 `ChatBotView`、`ChatBotView` 参数与插槽、锚点滚动与条数展示、分支切换卡顿优化、刷新后首次置底、分支按钮钉视口与长消息/遮挡问题、从历史记录进入会话滚到底、`syncViewportScrollMetrics` 多触点同步视口与底栏箭头等。

---

## 一、`index.tsx`（连接层：MobX / Context → `ChatBotView`）

```ts
// 引入 mobx 包：后面用 reaction 订阅可观察数据，避免组件直接依赖 observable 引用链导致 React 不刷新
import * as mobx from 'mobx';
// observer：让函数组件能响应 MobX 可观察字段变化（此处主要配合子树与 store）
import { observer } from 'mobx-react';
// 仅保留连接层需要的 React API，不再在本文件内写消息列表 UI
import React, {
	forwardRef,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
// 从 Chat 上下文取滚动 ref 注册、分享勾选等，与 useChatCore 解耦一部分横切逻辑
import { useChatCoreContext } from '@/contexts';
// 会话切换时若本地无分支持久化，用与 hook 相同的算法推导「最新分支」Map
import { findLatestBranchSelection } from '@/hooks/useBranchManage';
// 发送、流式、清空等仍集中在 useChatCore（与本仓库后端耦合）
import { useChatCore } from '@/hooks/useChatCore';
import useStore from '@/store';
// ChatBotRef / ChatBotProps 类型收口到 types，避免连接层再声明一份接口
import { ChatBotProps, ChatBotRef, Message } from '@/types/chat';
// 纯 UI 由 ChatBotView 渲染，本文件只做数据订阅与 props 注入
import ChatBotView from './ChatBotView';

// 对外再导出类型与 View，方便第三方只引 types + ChatBotView，不经过本连接层
export type {
	ChatBotRef,
	ChatBotSimpleViewProps,
	ChatBotViewAnchorNavContext,
	ChatBotViewChatControlsContext,
	ChatBotViewMessageActionsContext,
	ChatBotViewProps,
} from '@/types/chat';
export { default as ChatBotView } from './ChatBotView';
// 轻量封装：只传 messages 时可用 SimpleChatBotView，分支 Map 在内部 useState
export { default as SimpleChatBotView } from './SimpleChatBotView';

/**
 * 模块注释：说明默认导出 ChatBot 的职责边界（MobX、Context、useChatCore），
 * 与可复用的 ChatBotView / SimpleChatBotView 区分。
 */
const ChatBot = observer(
	forwardRef<ChatBotRef, ChatBotProps>(function ChatBot(props, ref) {
		const {
			className,
			apiEndpoint = '/chat/sse',
			showAvatar = false,
			onBranchChange,
			// 以下 show* / render* 透传给 ChatBotView，用于隐藏或替换锚点/操作条/底栏
			showMessageActions,
			showAnchorNav,
			showChatControls,
			renderMessageActions,
			renderAnchorNav,
			renderChatControls,
		} = props;

		const { chatStore } = useStore();
		const {
			onScrollToRef,
			isSharing,
			setIsSharing,
			setCheckedMessage,
			checkedMessages,
		} = useChatCoreContext();

		// 初始化快照：从 store 拷贝一份数组，供下游当「平面全量树」传给 ChatBotView
		const [allMessages, setAllMessages] = useState<Message[]>(() => [
			...chatStore.messages,
		]);
		// 当前会话在树结构上的「每个父节点选哪个子节点」
		const [selectedChildMap, setSelectedChildMap] = useState<
			Map<string, string>
		>(new Map());

		// useCallback 稳定：把 View 传来的 onScrollTo 写进 Context 的 ref，避免 effect 无意义重跑
		const handleScrollToRegister = useCallback(
			(
				handler:
					| ((position: string, behavior?: 'smooth' | 'auto') => void)
					| null,
			) => {
				onScrollToRef.current = handler;
			},
			[onScrollToRef],
		);

		// useMemo 固定对象引用：避免 useBranchManage 内依赖 streamingBranchSource 的 callback 每帧失效
		const streamingBranchSource = useMemo(
			() => ({
				getStreamingMessages: () => chatStore.getStreamingMessages(),
				getStreamingMessageSessionId: (id: string) =>
					chatStore.streamingBranchMaps.get(id)?.sessionId,
				getStreamingBranchMap: (id: string) =>
					chatStore.getStreamingBranchMap(id),
			}),
			[chatStore],
		);

		// 分支选择持久化到 store（会话级），由 View 在切换兄弟后 queueMicrotask 调用
		const onPersistSessionBranchSelection = useCallback(
			(sessionId: string, map: Map<string, string>) => {
				chatStore.saveSessionBranchSelection(sessionId, map);
			},
			[chatStore],
		);

		const {
			input,
			setInput,
			setUploadedFiles,
			editMessage,
			setEditMessage,
			sendMessage,
			clearChat,
			stopGenerating,
			handleEditChange,
			onContinue,
			onContinueAnswering,
		} = useChatCore({
			apiEndpoint,
		});

		// reaction：store.messages 变化时同步到 React state，保证 flatMessages 引用更新、子组件 effect 可依赖
		useEffect(() => {
			const dispose = mobx.reaction(
				() => chatStore.messages,
				(newMessages) => {
					setAllMessages([...newMessages]);
				},
				{ fireImmediately: true },
			);
			return () => dispose();
		}, [chatStore]);

		// reaction：当前会话的分支持久化 Map 变化时，同步到本地 selectedChildMap
		useEffect(() => {
			const dispose = mobx.reaction(
				() => {
					if (chatStore.activeSessionId) {
						return chatStore.getSessionBranchSelection(
							chatStore.activeSessionId,
						);
					}
					return null;
				},
				(newSelectedChildMap) => {
					if (newSelectedChildMap) {
						setSelectedChildMap(new Map(newSelectedChildMap));
					}
				},
				{ fireImmediately: true },
			);
			return () => dispose();
		}, [chatStore]);

		// 仅 activeSessionId 变化时重置输入、附件、编辑态，并恢复/推导分支 Map（与旧行为一致）
		useEffect(() => {
			if (!chatStore.activeSessionId) {
				setSelectedChildMap(new Map());
				setInput('');
				setUploadedFiles([]);
				setEditMessage(null);
				return;
			}

			const savedSelection = chatStore.getSessionBranchSelection(
				chatStore.activeSessionId,
			);

			if (chatStore.messages.length > 0) {
				if (savedSelection) {
					setSelectedChildMap(savedSelection);
				} else {
					const latestBranchMap = findLatestBranchSelection(chatStore.messages);
					if (latestBranchMap) {
						setSelectedChildMap(latestBranchMap);
						chatStore.saveSessionBranchSelection(
							chatStore.activeSessionId,
							latestBranchMap,
						);
					} else {
						setSelectedChildMap(new Map());
					}
				}
			} else {
				setSelectedChildMap(new Map());
			}

			setInput('');
			setUploadedFiles([]);
			setEditMessage(null);
		}, [chatStore.activeSessionId]);

		return (
			<ChatBotView
				ref={ref}
				className={className}
				showAvatar={showAvatar}
				onBranchChange={onBranchChange}
				flatMessages={allMessages}
				selectedChildMap={selectedChildMap}
				onSelectedChildMapChange={setSelectedChildMap}
				activeSessionId={chatStore.activeSessionId ?? null}
				onPersistSessionBranchSelection={onPersistSessionBranchSelection}
				streamingBranchSource={streamingBranchSource}
				input={input}
				setInput={setInput}
				editMessage={editMessage}
				setEditMessage={setEditMessage}
				sendMessage={sendMessage}
				clearChat={clearChat}
				stopGenerating={stopGenerating}
				handleEditChange={handleEditChange}
				onContinue={onContinue}
				onContinueAnswering={onContinueAnswering}
				isCurrentSessionLoading={chatStore.isCurrentSessionLoading}
				isMessageStopped={(id) => chatStore.isMessageStopped(id)}
				isSharing={isSharing}
				setIsSharing={setIsSharing}
				checkedMessages={checkedMessages}
				setCheckedMessage={setCheckedMessage}
				onScrollToRegister={handleScrollToRegister}
				showMessageActions={showMessageActions}
				showAnchorNav={showAnchorNav}
				showChatControls={showChatControls}
				renderMessageActions={renderMessageActions}
				renderAnchorNav={renderAnchorNav}
				renderChatControls={renderChatControls}
			/>
		);
	}),
);

export default ChatBot as React.FC<ChatBotProps> &
	((
		props: { ref?: React.Ref<ChatBotRef> } & ChatBotProps,
	) => React.JSX.Element);
```

---

## 二、`SimpleChatBotView.tsx`

```ts
// 仅需 forwardRef 与本地分支 state 时用到的 API
import { forwardRef, useState } from 'react';
import type { ChatBotRef, ChatBotSimpleViewProps } from '@/types/chat';
import ChatBotView from './ChatBotView';

/**
 * 文件头注释：说明本组件是 ChatBotView 薄封装，flatMessages 用 props.messages 传入。
 */
const SimpleChatBotView = forwardRef<ChatBotRef, ChatBotSimpleViewProps>(
	function SimpleChatBotView(props, ref) {
		// 从 props 拆出 messages 与 initialSelectedChildMap，其余透传给 ChatBotView
		const { messages, initialSelectedChildMap, ...rest } = props;

		// 内部分支 Map：可选用初始 Map 克隆，否则空 Map
		const [selectedChildMap, setSelectedChildMap] = useState<
			Map<string, string>
		>(() =>
			initialSelectedChildMap ? new Map(initialSelectedChildMap) : new Map(),
		);

		return (
			<ChatBotView
				ref={ref}
				flatMessages={messages}
				selectedChildMap={selectedChildMap}
				onSelectedChildMapChange={setSelectedChildMap}
				{...rest}
			/>
		);
	},
);

export default SimpleChatBotView;
```

---

## 三、`ChatBotView.tsx`（分块：滚动、历史进入、分支钉视口、布局）

### 3.1 滚动上限与分支钉视口工具函数

```ts
// 计算可滚动区域的最大 scrollTop，避免 scrollHeight + 常数依赖浏览器钳位行为不一致
function getMaxScrollTop(el: HTMLElement) {
	return Math.max(0, el.scrollHeight - el.clientHeight);
}

// 长消息阈值：行高超过视口一半时，用「行底对齐视口底」而不是钉分支锚点 top
const LONG_ROW_VIEWPORT_HEIGHT_RATIO = 0.5;

// 将指定 message 行的底边与滚动容器视口底边对齐（只改 scrollTop）
function alignMessageRowBottomToViewportBottom(sc: HTMLElement, rowId: string) {
	const row = sc.querySelector(`#message-${rowId}`);
	if (!(row instanceof HTMLElement)) return;
	const delta =
		row.getBoundingClientRect().bottom - sc.getBoundingClientRect().bottom;
	if (Math.abs(delta) > 0.5) sc.scrollTop += delta;
}

// 判断当前行是否属于「长消息」路径（与上面 ratio 一致）
function isLongMessageRowForBranchScroll(sc: HTMLElement, rowId: string) {
	const row = sc.querySelector(`#message-${rowId}`);
	if (!(row instanceof HTMLElement)) return false;
	return (
		row.getBoundingClientRect().height >=
		sc.clientHeight * LONG_ROW_VIEWPORT_HEIGHT_RATIO
	);
}

// 短消息路径：底下还有后续消息时，钉锚点目标略上移，避免贴边误差
const BRANCH_ANCHOR_NUDGE_UP_PX = 20;

// 分支切换待处理的钉视口元数据：按锚点 top 或整行 bottom 两种
type BranchScrollPending = {
	kind: 'anchorTop' | 'rowBottom';
	before: number;
	nextRowId: string;
	seq: number;
};

// 在下一帧根据 pending 修正 scrollTop；返回 true 表示可清除 pending（含 seq 过期）
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
```

### 3.2 `onScrollTo`：置底与刷新后高度滞后

```ts
// 用户手动滚到底时注册的 ResizeObserver 清理函数，滚顶或卸载前要 disconnect
const manualScrollToBottomCleanupRef = useRef<(() => void) | null>(null);

const onScrollTo = useCallback(
	(position: string, behavior?: 'smooth' | 'auto') => {
		const el = scrollContainerRef.current;
		if (!el) return;
		const bh = behavior ?? 'smooth';

		// 滚到顶部：先清掉置底用的 ResizeObserver
		if (position === 'up') {
			manualScrollToBottomCleanupRef.current?.();
			manualScrollToBottomCleanupRef.current = null;
			el.scrollTo({ top: 0, behavior: bh });
			return;
		}

		// 置底前同样清理上一次 manual 置底观察，避免多个 RO 叠加
		manualScrollToBottomCleanupRef.current?.();
		manualScrollToBottomCleanupRef.current = null;

		// 多次 align：先算合法最大值再滚
		const alignToMax = (scrollBehavior: ScrollBehavior) => {
			el.scrollTo({ top: getMaxScrollTop(el), behavior: scrollBehavior });
		};

		const contentRoot = el.querySelector('#message-content');
		const lastRow = contentRoot?.lastElementChild;
		// 先把最后一行 scrollIntoView(end)，再滚到 max，缓解末行未完全进入视口的问题
		if (lastRow instanceof HTMLElement) {
			lastRow.scrollIntoView({
				block: 'end',
				inline: 'nearest',
				behavior: bh,
			});
		}
		alignToMax(bh === 'smooth' ? 'smooth' : 'auto');

		// behavior 为 auto 时：双 rAF + 短时间 ResizeObserver + 600ms 超时再对齐，应对 MdPreview 等晚挂载撑高
		if (bh === 'auto') {
			requestAnimationFrame(() => {
				alignToMax('auto');
				requestAnimationFrame(() => alignToMax('auto'));
			});
			if (contentRoot) {
				const ro = new ResizeObserver(() => alignToMax('auto'));
				ro.observe(contentRoot);
				let disposed = false;
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
```

### 3.3 向 Context 注册滚动函数

```ts
useEffect(() => {
	if (!onScrollToRegister) return;
	onScrollToRegister(onScrollTo);
	return () => {
		onScrollToRegister(null);
	};
}, [onScrollTo, onScrollToRegister]);
```

### 3.4 从历史记录进入会话：非流式首屏补一次滚到底

```ts
const sessionEnterScrolledRef = useRef<string | null>(null);

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
```

**释义概要**：无会话时清空「已滚」标记；加载中或尚无消息不滚；最后一条仍在流式则交给流式 effect；同一会话只滚一次，避免每条消息更新都触发；`queueMicrotask` 让布局先提交再置底。

### 3.5 流式输出跟底（仅 assistant + isStreaming）

```ts
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
		// cleanup 断开观察器
		// ...
	};
}, [messages, autoScroll]);
```

### 3.6 分支切换 `handleBranchChange`（`flushSync` + 长消息 + 持久化）

```ts
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
				const sid = activeSessionId;
				const mapSnapshot = new Map(newSelectedChildMap);
				queueMicrotask(() => {
					onPersistSessionBranchSelection(sid, mapSnapshot);
				});
			}
		}
	},
	[/* ... */],
);
```

**释义概要**：用 `findSiblings`/`flatMessages` 算下一兄弟；更新 Map；若切换后该条已是链尾则直接 `getMaxScrollTop`；否则记录切换前分支锚点或行底的视口坐标，提交后用 `tryApplyBranchScrollAnchor` 或长消息路径 `alignMessageRowBottomToViewportBottom`；`flushSync` 保证 DOM 与 Map 同帧；持久化用 `queueMicrotask` 避免与 layout 争抢。

### 3.7 `useLayoutEffect`：DOM 未就绪时补钉一次

```ts
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
```

### 3.8 列表渲染关键布局（避免嵌套滚动、遮挡、overflow-anchor）

```tsx
<ScrollArea
	ref={scrollContainerRef}
	viewportClassName="[overflow-anchor:none]"
	className="flex-1 overflow-hidden w-full backdrop-blur-sm pb-5"
	onScroll={handleScroll}
>
	<div id="message-container" className="max-w-3xl m-auto min-w-0">
		<div id="message-content" className="space-y-6 min-w-0">
			{messages.map((message, index) => (
				<div
					key={message.chatId}
					id={`message-${message.chatId}`}
					style={{ zIndex: messages.length - index }}
					className={cn(
						'flex gap-3 w-full',
						message.role === 'user' ? 'flex-row-reverse' : '',
					)}
				>
					<div
						className={cn(
							'relative flex-1 flex flex-col gap-1 pb-10 w-full group',
							message.role === 'user' ? 'items-end' : '',
						)}
					>
						{/* ... 气泡与 ChatMessageActions ... */}
					</div>
				</div>
			))}
		</div>
	</div>
</ScrollArea>
```

**释义概要**：`overflow-anchor:none` 减轻浏览器滚动锚定导致的置底弹跳；`message-container` 不再使用内层 `overflow-y-auto`，避免与外层 ScrollArea 双滚动；`zIndex: messages.length - index` 让**靠上**的消息行盖住**靠下**行的 absolute 操作区，减少分支按钮被下一条挡住；`pb-10` 为气泡底部绝对定位的操作条留出空间。

---

## 四、`ChatMessageActions/index.tsx`（分支区域锚点）

```tsx
{/* 分支切换按钮区域；data 供 ChatBotView 在切换兄弟后钉住视口位置 */}
{hasSiblings && !isSharing && (
	<div
		data-message-branch-anchor
		className={`${
			message.role === 'user'
				? 'order-last ml-5 -mr-3.5'
				: 'order-first mr-5 -ml-3.5'
		} flex items-center gap-1 text-textcolor/70 select-none`}
	>
```

**释义**：`data-message-branch-anchor` 给 `querySelector` 用，切换分支时用该元素 `getBoundingClientRect().top` 作为钉视口的参考点（见 `tryApplyBranchScrollAnchor` 的 `anchorTop` 分支）。

---

## 五、`ChatAnchorNav/index.tsx`（锚点滚动与条数展示）

```ts
// 主区域处于「点击锚点触发的 smooth 滚动」期间为 true，scroll 回调里跳过 calculateActiveAnchor，避免高亮在动画中途乱跳
const isProgrammaticMainScrollRef = useRef(false);
// scrollend 缺失时的兜底定时器，超时后解锁 isProgrammaticMainScrollRef
const programmaticScrollFallbackTimerRef = useRef<ReturnType<
	typeof setTimeout
> | null>(null);
```

```ts
const handleScroll = () => {
	if (isProgrammaticMainScrollRef.current) return;
	if (rafIdRef.current !== null) return;
	rafIdRef.current = requestAnimationFrame(() => {
		calculateActiveAnchor();
		rafIdRef.current = null;
	});
};
```

```ts
// 侧栏锚点列表滚动用 instant（behavior: 'auto'），避免与主列表 smooth 同时产生双重「弹性」观感
listContainer.scrollTo({
	top: Math.max(0, targetScrollTop),
	behavior: 'auto',
});
```

```tsx
// 上按钮上方显示「当前是第几条用户消息」（currentIndex + 1）
<div className="opacity-0 group-hover:opacity-100 text-sm text-textcolor/60 mb-2 text-center">
	{currentIndex + 1}
</div>
```

```tsx
// 下按钮下方显示用户消息总条数（「anchor 增加条数」需求）
<div className="opacity-0 group-hover:opacity-100 text-sm text-textcolor/60 mt-2 text-center">
	{userMessages.length}
</div>
```

```tsx
// 锚点列表区域 max-h-80 + ScrollArea，用户消息多时可滚动侧栏
<div className="flex-1 flex max-h-80 overflow-hidden">
	<ScrollArea className="flex-1 overflow-hidden w-full">
```

---

## 六、`useBranchManage.ts`（性能：`latestBranchMapMemo` 与布尔导出）

```ts
// 模块级导出 findLatestBranchSelection：供 ChatBot 连接层与 hook 共用同一套「选最新子节点」算法
export function findLatestBranchSelection(
	allMessages: Message[],
): Map<string, string> {
	// ... 建树、按时间选 latest root 与每层 latest child ...
}
```

```ts
// 仅在 allFlatMessages 引用变化时重算整棵树的「最新分支」映射，避免每次 render 全量 findLatestBranchSelection
const latestBranchMapMemo = useMemo(
	() =>
		allFlatMessages.length === 0
			? null
			: findLatestBranchSelection(allFlatMessages),
	[allFlatMessages],
);
```

```ts
// isLatestBranch：逐层对比 selectedChildMap 与 latestBranchMapMemo，判断是否「每一层都选了时间最新的子节点」
const isLatestBranch = useMemo(() => {
	// ...
}, [
	allFlatMessages.length,
	messages,
	selectedChildMap,
	latestBranchMapMemo,
]);
```

```ts
// switchToLatestBranch / switchToStreamingBranch：setTimeout 50ms 后再 onScrollTo('down','auto')，等待分支切换后布局稳定再滚到底
latestBranchTimerRef.current = setTimeout(() => {
	onScrollTo('down', 'auto');
}, 50);
```

---

## 七、分支切换钉视口 + 从消息列表进入会话置底（`utils.ts` 与 `ChatBotView.tsx`）

本节说明两类体验问题的**成因**与**实现要点**：（1）切换助手分支时列表跳动、长气泡底部操作区被顶出视口；（2）从消息列表进入历史会话时首屏未贴底、或首帧 `scrollHeight` 偏小导致「像卡顿/没滚到底」。实现上滚动辅助函数集中在 `utils.ts`，状态与副作用在 `ChatBotView.tsx`。

### 7.1 问题与目标（为何改）

| 场景 | 现象 | 方向 |
|------|------|------|
| 助手分支 prev/next | 切换后下方链路长度变化，`scrollTop` 不变时分支条（在气泡底部）会跑出视口 | 切换前采样视口坐标，切换后把同一「视觉锚点」钉回视口；长消息改钉整行底边 |
| 用户消息分支 | 无气泡底部分支条，不需要向下补偿 | 不做 `pending` / 锚点 / 长消息对齐 |
| 历史会话进入 | 最后一条非流式时，原逻辑只靠流式 observer 跟底，首屏常停在列表中部 | `sessionEnterScrolledRef` + `queueMicrotask` 触发一次 `onScrollTo('down','auto')` |
| 刷新/懒渲染后滚底 | 首帧 `scrollHeight` 小于最终高度，单次 `scrollTop = max` 仍留空 | `scrollIntoView` + 双帧 `requestAnimationFrame` + `ResizeObserver` + 延时 `dispose` |
| 卸载/快速打断 | 未取消的 `requestAnimationFrame` 可能在卸载后仍读 DOM | `scrollToBottomRafCancelRef`、`branchChangeRafIdsRef` + 卸载 `cancelAnimationFrame` |

### 7.2 `utils.ts`（钉视口计算，与 DOM 约定耦合）

消息行容器约定 id 为 `#message-${chatId}`；助手分支锚点元素带 `[data-message-branch-anchor]`（见 `ChatMessageActions` 等）。

```ts
// 切换后待应用的钉视口任务：kind 区分按分支条顶还是按整行底；before 为切换前该点在视口中的纵向坐标（已含 nudge）；seq 与 branchScrollSeqRef 对齐用于防连点串台
export type BranchScrollPending = {
	kind: 'anchorTop' | 'rowBottom';
	before: number;
	nextRowId: string;
	seq: number;
};

// 行高达到滚动容器可视高度一半及以上 →「长消息」：若仍按锚点 top 对齐，会把整段气泡往上推，底部分支条反而离开视口
const LONG_ROW_VIEWPORT_HEIGHT_RATIO = 0.5;

// 短消息路径：目标点略上移几个像素，避免钉死后紧贴视口上沿观感太死
export const BRANCH_ANCHOR_NUDGE_UP_PX = 20;

// 合法 scrollTop 上界：scrollHeight - clientHeight，避免依赖浏览器对超大 scrollTop 的静默钳位
export function getMaxScrollTop(el: HTMLElement) {
	return Math.max(0, el.scrollHeight - el.clientHeight);
}

// 把 #message-row 的底边与滚动容器视口底边对齐：只改外层 sc 的 scrollTop，delta = 行底 - 视口底
export function alignMessageRowBottomToViewportBottom(sc: HTMLElement, rowId: string) {
	const row = sc.querySelector(`#message-${rowId}`);
	if (!(row instanceof HTMLElement)) return;
	const delta =
		row.getBoundingClientRect().bottom - sc.getBoundingClientRect().bottom;
	if (Math.abs(delta) > 0.5) sc.scrollTop += delta;
}

// 根据行高与视口比例判断是否走「长消息」分支
export function isLongMessageRowForBranchScroll(sc: HTMLElement, rowId: string) {
	const row = sc.querySelector(`#message-${rowId}`);
	if (!(row instanceof HTMLElement)) return false;
	return (
		row.getBoundingClientRect().height >=
		sc.clientHeight * LONG_ROW_VIEWPORT_HEIGHT_RATIO
	);
}

// 用 pending.before 与切换后新行上对应点（锚点 top 或行底）求差，把差值加到 scrollTop；返回 true 表示可结束（成功或 seq 已过期）；false 表示新行/锚点 DOM 未就绪，交给 useLayoutEffect 再试
export function tryApplyBranchScrollAnchor(
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
```

### 7.3 `ChatBotView.tsx`：refs 与分支用 rAF 包装

```ts
// flushSync 之后若子树未完全就绪，仍可能需下一帧 layout 再钉一次：pending 存「要补的滚动修正」
const pendingBranchScrollAnchorRef = useRef<BranchScrollPending | null>(null);
// 每次助手分支切换递增；rAF / tryApply 内比对 snap.seq，丢弃过期回调
const branchScrollSeqRef = useRef(0);
// 记录「本会话是否已做过进入时滚到底」，避免 messages 小更新反复触发 onScrollTo 造成卡顿感
const sessionEnterScrolledRef = useRef<string | null>(null);
// onScrollTo('down','auto') 双帧 rAF：当没有 #message-content 时没有 dispose，靠此 ref 在卸载/下次滚底时 cancel
const scrollToBottomRafCancelRef = useRef<(() => void) | null>(null);
// handleBranchChange 内 scheduleBranchRaf 登记的 id，卸载时统一 cancelAnimationFrame
const branchChangeRafIdsRef = useRef<Set<number>>(new Set());

// 执行前把 id 加入 Set，回调执行后 delete；组件卸载遍历 Set cancel，避免卸载后仍改 scrollTop
const scheduleBranchRaf = useCallback((fn: FrameRequestCallback) => {
	const id = requestAnimationFrame((time) => {
		branchChangeRafIdsRef.current.delete(id);
		fn(time);
	});
	branchChangeRafIdsRef.current.add(id);
}, []);
```

### 7.4 `onScrollTo('down', 'auto')`：首屏/刷新后贴底与 rAF 清理

```ts
// 滚顶或新一轮滚底前：断开上一轮 ResizeObserver + 清定时器，并取消未执行的双帧 rAF（含无 contentRoot 时挂在 ref 上的 cancel）
manualScrollToBottomCleanupRef.current?.();
manualScrollToBottomCleanupRef.current = null;
scrollToBottomRafCancelRef.current?.();
scrollToBottomRafCancelRef.current = null;

// 先让最后一行 scrollIntoView(block:'end')，再 scrollTo(max)，缓解首帧高度不足
const alignToMax = (scrollBehavior: ScrollBehavior) => {
	el.scrollTo({ top: getMaxScrollTop(el), behavior: scrollBehavior });
};

// behavior === 'auto'：双帧 rAF 再 alignToMax；若有 #message-content，ResizeObserver 在高度变化时继续贴底，600ms 后 dispose 并 cancel 两层 rAF
const rafHandles = { outer: 0, inner: 0 };
const cancelScrollToBottomRafs = () => {
	cancelAnimationFrame(rafHandles.outer);
	cancelAnimationFrame(rafHandles.inner);
	rafHandles.outer = rafHandles.inner = 0;
};
// dispose 内首行调用 cancelScrollToBottomRafs，保证与 RO/timeout 一并释放

// 若无 contentRoot：scrollToBottomRafCancelRef.current = cancelScrollToBottomRafs，供卸载与下次滚底取消
```

### 7.5 从消息列表进入会话：补一次滚到底

```ts
// 无会话 id 时重置「进入标记」，避免切换账号/清空后错误跳过
if (!activeSessionId) {
	sessionEnterScrolledRef.current = null;
	return;
}
// 会话消息仍在加载则不滚，避免空列表或半截数据
if (isCurrentSessionLoading) return;
if (messages.length === 0) return;

// 若最后一条仍在流式，交给下方 observer 跟底，此处不抢
const lastStreaming =
	lastMessage?.role === 'assistant' && lastMessage?.isStreaming;
if (lastStreaming) return;

// 同一会话只触发一次进入滚底，避免 messages 依赖导致 effect 反复执行 → 主观卡顿
if (sessionEnterScrolledRef.current === activeSessionId) return;
sessionEnterScrolledRef.current = activeSessionId;

// 微任务排到当前 commit 之后，再调 onScrollTo，让 DOM 先挂上消息列表
queueMicrotask(() => {
	onScrollTo('down', 'auto');
});
```

### 7.6 `handleBranchChange`：流程摘要（与源码注释一致）

1. `findSiblings(flatMessages, msgId)` 算兄弟，**不得**用 `displayMessages`（会丢旁支）。
2. 拷贝 `selectedChildMap`，在 `parentId` 或 `'root'` 上写入 `nextMsg.chatId`。
3. `shouldScrollToBottom`：仅当未外部传入 `displayMessages` 时，用 `buildMessageList` + 新 map 判断选中兄弟是否为链尾。
4. `isAssistantBranchSwitch`：仅 `role === 'assistant'` 时设置 `pendingBranchScrollAnchorRef` 与后续补偿；**用户消息**分支直接 `pending = null`，且 `flushSync` 后不走进长消息/锚点分支。
5. `flushSync(() => onSelectedChildMapChange(...))`：内容与 map 同帧，避免闪分支。
6. 若 `shouldScrollToBottom`：`scrollTop = getMaxScrollTop` + `scheduleBranchRaf` 再贴底一次（lazy 增高）。
7. 若助手且非贴底：长消息用 `alignMessageRowBottomToViewportBottom` + `scheduleBranchRaf`；短消息用 `tryApplyBranchScrollAnchor`，成功后再 `scheduleBranchRaf` 做第二帧（MdPreview 撑高后可能改长消息策略）。
8. `onPersistSessionBranchSelection` 放 `queueMicrotask`，减轻与 layout 同帧竞争。

### 7.7 `useLayoutEffect`：DOM 晚就绪时的补钉

```ts
// 依赖 messages、selectedChildMap：flushSync 后若 tryApply 返回 false（节点未挂载），在此阶段再量一次
const pending = pendingBranchScrollAnchorRef.current;
if (!pending) return;
// 若已变长消息：改行底对齐并清空 pending
if (isLongMessageRowForBranchScroll(sc, nextId)) {
	pendingBranchScrollAnchorRef.current = null;
	alignMessageRowBottomToViewportBottom(sc, nextId);
	return;
}
// 否则再 tryApplyBranchScrollAnchor，成功则清 pending
```

### 7.8 卸载清理（与 rAF 相关）

```ts
manualScrollToBottomCleanupRef.current?.();
scrollToBottomRafCancelRef.current?.();
branchChangeRafIdsRef.current.forEach((id) => {
	cancelAnimationFrame(id);
});
branchChangeRafIdsRef.current.clear();
```

### 7.9 `syncViewportScrollMetrics`：为何多处调用、影响点与作用

#### 作用（这一函数到底干什么）

从 `ScrollArea` 的**视口节点**（与 `scrollContainerRef` 绑定的 Radix `Viewport`）**同一次读取**：

- `scrollTop`
- `scrollHeight`
- `clientHeight`

并据此**一并更新**与滚动相关的 React state：

- `scrollTop`（供其它逻辑需要时与 DOM 对齐，避免「只信过期的 state」）
- `hasScrollbar`（`scrollHeight > clientHeight`，控制底栏是否出现滚动按钮）
- `isAtBottom`（`scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD`，控制 `ChatControls` 箭头朝上/朝下）
- `autoScroll`（与「是否在底部」一致，供流式输出时是否自动跟底使用）

**设计动机**：历史上用 `useMemo` 计算「是否在底部」时，曾把 **state 里的 `scrollTop`** 和 **ref 里当前帧的 `scrollHeight` / `clientHeight`** 混在一起算。换会话、换分支或从无滚动条列表切到有滚动条列表时，DOM 已是新内容高度，但 **`scrollTop` 的 state 仍可能停留在上一会话/上一分支**（程序化改 `scrollTop` 或未冒泡的 `scroll`），就会误判「已在底部」→ **`ChatControls` 箭头方向反了**（例如应显示「置底」向下箭头却显示「置顶」向上箭头）。`syncViewportScrollMetrics` 把「读 DOM → 写 state」收口成一处，保证**四项指标来自同一快照**。

#### 影响点（谁会因它变对/变错）

| 消费方 | 依赖字段 | 不同步时的典型问题 |
|--------|----------|-------------------|
| `ChatControls` | `hasScrollbar`、`isAtBottom` | 从无滚动条会话切到有滚动条会话后，按钮突然出现但箭头方向错误；或该显示「滚到底」却显示「滚到顶」 |
| 流式跟底逻辑 | `autoScroll` + 真实 `scrollTop` | 误判跟底开关，或 `lastScrollHeightRef` 与视口脱节（与其它修复配合） |
| 调试与后续扩展 | `scrollTop` state | 避免日志/后续功能读到与视口不一致的滚动位置 |

#### 为何要在「这么多地方」调用（而不是只放在 `handleScroll` 里）

浏览器与当前实现里，**并不是每一次视口滚动或 `scrollTop` 变化都会触发挂在 Viewport 上的 React `onScroll`**。只要在下面任一情况下**只依赖 `handleScroll`**，就会出现「DOM 已经滚过去了，state 没更新」的窗口期：

1. **`onScrollTo` / `alignToMax`**：`element.scrollTo(...)`、`scrollIntoView` 以及双帧 `rAF`、内部 `ResizeObserver` 触发的贴底，在部分时序下**不保证**走 `handleScroll`，或走在了 React 批更新尚未反映到依赖的帧。因此在 **`alignToMax` 末尾**通过 `syncViewportScrollMetricsRef.current()` 补一刀（`onScrollTo` 用 ref 是为了 `useCallback([])` 稳定且仍能调到最新实现）。
2. **滚顶分支** `position === 'up'`：`scrollTo({ top: 0 })` 后同样显式同步。
3. **从会话列表进入会话**：`queueMicrotask` 里 `onScrollTo('down','auto')` 后，再在**双 `requestAnimationFrame`** 末尾同步，覆盖「滚底在 rAF 链末尾才落定、中间没有可靠 `scroll` 事件」的情况。
4. **流式 `useEffect`**：在 **`scrollToBottom()` 之后**调用，避免「先读了 metrics 再滚」的顺序颠倒；在 **ResizeObserver / MutationObserver** 回调里 **`scrollToBottom()` 之后**再同步，避免仅内容高度变而 state 未跟。
5. **`useLayoutEffect([messages, activeSessionId, selectedChildMap])`**：在 **DOM 已按新会话/新分支/新列表提交后**立刻用视口真值覆盖 state，专门解决「列表结构已换，scroll 相关 state 仍是上一上下文」的错位。
6. **`handleScroll`**：用户滚轮/拖拽滚动条等**正常会触发** `onScroll` 的路径，统一走 `syncViewportScrollMetrics()`，与程序化路径行为一致。
7. **`handleBranchChange`**：存在 **`sc.scrollTop = getMaxScrollTop(...)`** 或 `alignMessageRowBottomToViewportBottom` 等**直接改 DOM** 的逻辑，**不保证**产生 `onScroll`。因此在 **`queueMicrotask` / `scheduleBranchRaf` 回调末尾**补同步，保证切分支后底栏箭头与 `hasScrollbar` 立即正确。

#### 性能与重复调用

单次 `sync` 仅为**常数次 DOM 属性读取**与**至多若干次 `setState`**；React 18+ 会对同一事件/同一 commit 内的更新做批处理。流式场景下主要在「确实发生了滚底或布局变化」的回调里调用，属于**用可接受的同步成本换 UI 状态与视口一致**，避免出现难以排查的「箭头反了、跟底停了」类问题。

**小结**：分支切换的「不卡顿、不跳错」依赖 **同帧 `flushSync` + 视口锚点数学（utils）+ 长/短分支 + seq**；列表进入的「不卡在中间」依赖 **`sessionEnterScrolledRef` 单次触发 + `queueMicrotask` + `onScrollTo` 双帧与 RO**；**rAF cancel** 负责卸载与快速打断时的安全收尾；**`syncViewportScrollMetrics` 多触点调用**则保证 **程序化滚动 / 直接改 `scrollTop` / 换会话换分支** 后，`ChatControls` 与流式跟底所依赖的 state 与**真实视口**一致。

---

## 八、多轮对话 + 多分支：切换分支卡死 / 从历史进入卡顿 — 成因与代码层修复

> 说明：桌面端（如 Tauri/Electron）上渲染线程长时间阻塞时「主进程卡死」；本质多为 **JS 主线程（与 UI 同线程）** 在单帧或连续多帧内做了过多工作。以下修复均针对 **减少无效重渲染、避免每帧全量 O(n) 重算、避免副作用风暴**。

### 8.1 问题如何从「轮数多、分支多」被放大

| 瓶颈类型 | 典型表现 | 轮数/分支变多时的后果 |
|----------|----------|------------------------|
| **列表项引用抖动** | 每次 `selectedChildMap` 变化都 `getFormatMessages` 出全新数组，且每项都是新对象 | React 认为每一行 props 全变 → **N 条消息 ×（User/Assistant 子树 + Markdown）** 同步重渲染，单帧耗时可超百毫秒 |
| **「最新分支」全量重算** | 每次 render 都对整棵 `flatMessages` 跑 `findLatestBranchSelection` | O(n) 建树 +  walk，与 render 次数相乘，切分支/进会话时易卡顿 |
| **Hook 返回函数引用不稳定** | `useMessageTools()` 内联定义 `buildMessageList` / `findSiblings`，每次 render 新函数 | 依赖它们的 `useMemo`/`useCallback` **依赖恒变** → effect 重复跑、子树认为 props 变 |
| **`buildMessageList` 内重复排序** | 沿链 walk 时对兄弟反复 `sort` | 兄弟多、层数多时 CPU 徒增 |
| **进入会话时重复滚底** | `messages` 在 hydrate/多次 patch 时连续变，`useEffect` 每次触发 `onScrollTo` | 连续 layout/scroll，主观卡顿 |
| **同步持久化与 paint 争抢** | 分支切换后立刻同步写 Store/磁盘 | 与 `flushSync`、布局测量叠在同一敏感时段，拉长关键路径（辅助手段见 `queueMicrotask`） |

### 8.2 `useMessageTools.ts`：稳定引用 + 兄弟排序只做一次

```ts
// 模块注释摘要：纯函数提到模块级，避免「每次 render 新建函数引用」导致下游 useMemo/useCallback 依赖误判为变化，引发多余 effect 与重渲染（多轮对话下会被放大）
/**
 * 性能：以下函数不依赖 Hook 闭包，全部放在模块级。
 * 原先在 useMessageTools() 内每次 render 都会新建函数引用，导致依赖 buildMessageList / findSiblings 等的
 * useCallback、useEffect 依赖比较永远认为「变了」，从而重复执行或让子组件认为 props 变了。
 * 抽成常量引用后，调用方可以稳定依赖这些函数，逻辑与之前完全一致（仍是同一套纯函数实现）。
 */

// 每组兄弟只 sort 一次；walk 里只 findIndex，避免「沿链每步都对同一组兄弟排序」的重复 CPU
const sortMessagesByTimeAsc = (arr: Message[]) => {
	arr.sort((a, b) => getMessageSortTime(a) - getMessageSortTime(b));
};

// buildMessageList：先建 childrenMap，再对 childrenMap 的每个 value、以及多根 rootMessages 各调用一次 sortMessagesByTimeAsc
for (const siblings of childrenMap.values()) {
	sortMessagesByTimeAsc(siblings);
}
if (rootMessages.length > 1) {
	sortMessagesByTimeAsc(rootMessages);
}

// Hook 始终返回同一对象引用，ChatBotView 的 messages useMemo 可把 buildMessageList/getFormatMessages 放进依赖且不引起无意义失效
const MESSAGE_TOOLS = { /* ... */ buildMessageList, findSiblings, getFormatMessages };
export const useMessageTools = () => MESSAGE_TOOLS;
```

**释义**：轮数多时 `buildMessageList` 调用频率高（每次 `selectedChildMap` / `flatMessages` 变）。**排序从「walk 内热循环」挪到「预处理每组兄弟一次」**，复杂度从「层数 × 每层多次 sort」降为「兄弟组数 × 单次 sort」。**稳定函数引用**切断「render → 新函数 → useMemo 失效 → 更重 render」的连锁反应。

### 8.3 `ChatBotView.tsx`：展示列表「结构共享」稳定 message 引用

```ts
// ref 保存上一轮 merge 结果，供下一轮按索引比较「语义是否未变」
const stableDisplayMessagesRef = useRef<Message[]>([]);

const messages = useMemo(() => {
	if (props.displayMessages !== undefined) {
		stableDisplayMessagesRef.current = props.displayMessages;
		return props.displayMessages;
	}
	const raw = buildMessageList(flatMessages, selectedChildMap);
	const fresh = getFormatMessages(raw);
	const prev = stableDisplayMessagesRef.current;
	if (prev.length === 0) {
		stableDisplayMessagesRef.current = fresh;
		return fresh;
	}
	// 按索引对齐：同一槽位若 chatId、content、think、sibling*、role、附件、流式/停止等均未变，则沿用 prev[i] 的同一对象引用
	const merged = fresh.map((n, i) => {
		const p = prev[i];
		if (!p) return n;
		if (
			p.chatId === n.chatId &&
			p.content === n.content &&
			(p.thinkContent ?? '') === (n.thinkContent ?? '') &&
			p.isStreaming === n.isStreaming &&
			p.siblingIndex === n.siblingIndex &&
			p.siblingCount === n.siblingCount &&
			p.role === n.role &&
			p.attachments === n.attachments &&
			p.finishReason === n.finishReason &&
			(p.isStopped ?? false) === (n.isStopped ?? false)
		) {
			return p; // 引用不变 → ChatAssistantMessage.memo、Markdown 等可跳过深渲染
		}
		return n;
	});
	stableDisplayMessagesRef.current = merged;
	return merged;
}, [props.displayMessages, flatMessages, selectedChildMap, buildMessageList, getFormatMessages]);
```

**释义**：切换分支时，**仅分叉点之后**的链与索引会变化；**前缀轮次**若 `chatId` 与内容不变，应复用旧引用。否则 N 条全部新引用 → **N 份 Markdown/气泡** 同时 diff，极易造成长时间主线程占用（表现为卡死或严重掉帧）。

### 8.4 `useBranchManage.ts`：「最新分支」Map 只随 flat 树引用变而重算

```ts
// 仅当 allFlatMessages 引用变化时执行 findLatestBranchSelection；不在每一次 render 上对整棵树 O(n) 重算
const latestBranchMapMemo = useMemo(
	() =>
		allFlatMessages.length === 0
			? null
			: findLatestBranchSelection(allFlatMessages),
	[allFlatMessages],
);

// isLatestBranch：遍历当前展示链 messages，与 latestBranchMapMemo、selectedChildMap 比对；不再每次调用 findLatestBranchSelection
const isLatestBranch = useMemo(() => {
	// ...
}, [allFlatMessages.length, messages, selectedChildMap, latestBranchMapMemo]);
```

**释义**：`findLatestBranchSelection` 需遍历 `allMessages` 建树。对话轮数、分支节点多时 **单次成本已不低**；若与 **每次 render** 相乘，切分支或 Store 高频更新时会明显卡顿。**memo 化**把重算限制在「整平面列表引用更新」（通常一批消息写入一次）时。

### 8.5 `index.tsx`（连接层）：减少向下游传导的「引用抖动」

```ts
// streamingBranchSource 用 useMemo 包一层，依赖 [chatStore]；闭包内仍每次调用 getStreamingMessages 等读 MobX，行为不变
// 若每次 render 新建对象，useBranchManage 内依赖 streamingBranchSource 的 useMemo/useCallback 会频繁失效
const streamingBranchSource = useMemo(
	() => ({
		getStreamingMessages: () => chatStore.getStreamingMessages(),
		getStreamingMessageSessionId: (id: string) =>
			chatStore.streamingBranchMaps.get(id)?.sessionId,
		getStreamingBranchMap: (id: string) =>
			chatStore.getStreamingBranchMap(id),
	}),
	[chatStore],
);

// 不传 displayMessages：由 ChatBotView 内部对 flatMessages + selectedChildMap 单一 useMemo 推导展示列，避免连接层再维护一份重复 state + effect
// 见 ChatBotView props：仅 flatMessages / selectedChildMap / onSelectedChildMapChange
```

**释义**：连接层少一份「格式化后的 messages」状态，就少一轮 **setState → render → 大列表**；与 8.3 的 merge 策略配合，使 **单次分支切换** 的渲染量接近「仅变化后缀行」而非「整表 N 行」。

### 8.6 分支切换与进入会话：避免「副作用风暴」（与第七节衔接）

```ts
// 持久化分支选择放到微任务，避免与 flushSync 触发的同步布局、scroll 修正同帧抢主线程（多轮会话写盘/Store 若较重时更明显）
queueMicrotask(() => {
	onPersistSessionBranchSelection(sid, mapSnapshot);
});

// 进入会话：同一会话 id 只触发一次滚底，避免 messages 从空→半载→满载连续触发多次 onScrollTo（历史会话消息多时 scroll/layout 叠加卡顿）
if (sessionEnterScrolledRef.current === activeSessionId) return;
sessionEnterScrolledRef.current = activeSessionId;
queueMicrotask(() => {
	onScrollTo('down', 'auto');
});
```

**释义**：**`sessionEnterScrolledRef`** 解决「依赖 `[messages, …]` 时进入长会话 effect 连跑多趟」；**`queueMicrotask`** 把非关键路径稍延后，缩短用户可感知的同步阻塞段。

### 8.7 关于 `flushSync` 与性能

```ts
flushSync(() => {
	onSelectedChildMapChange(newSelectedChildMap);
});
```

**释义**：`flushSync` 会 **同步** 提交 React 更新并跑子树渲染，单帧成本高于批量更新；此处用于 **分支 UI 与 DOM 行 id 同帧一致**，否则钉视口测量会读到错误分支。**取舍**：用可控的一次同步提交换滚动正确性；整体卡顿的主因仍由 **8.2–8.5 控制重渲染与全量重算** 承担，而不是单靠去掉 `flushSync`。

### 8.8 涉及文件速查

| 文件 | 作用 |
|------|------|
| `useMessageTools.ts` | 稳定工具引用、`buildMessageList` 预处理排序 |
| `ChatBotView.tsx` | `messages` 结构共享、`handleBranchChange` 微任务持久化、进入会话单次滚底、钉视口 |
| `useBranchManage.ts` | `latestBranchMapMemo`、`isLatestBranch` 避免每帧全树推导 |
| `index.tsx` | `streamingBranchSource` useMemo、单一数据源进 View |
| `utils.ts` | 钉滚动纯函数（与 CPU 无关，但减少错误重滚导致的二次布局） |

---

## 附：如何自行生成与本文档同范围的 diff

```bash
git log --since="3 days ago" --oneline -- \
  apps/frontend/src/components/design/ChatBot/ \
  apps/frontend/src/components/design/ChatAnchorNav/ \
  apps/frontend/src/components/design/ChatMessageActions/ \
  apps/frontend/src/hooks/useBranchManage.ts \
  apps/frontend/src/hooks/useMessageTools.ts \
  apps/frontend/src/hooks/useMessageTools.ts

git diff ba10fff^...HEAD -- \
  apps/frontend/src/components/design/ChatBot/ \
  apps/frontend/src/components/design/ChatAnchorNav/ \
  apps/frontend/src/components/design/ChatMessageActions/ \
  apps/frontend/src/hooks/useBranchManage.ts \
  apps/frontend/src/hooks/useMessageTools.ts
```

（注：`ba10fff` 为近三天窗口内涉及 `ChatBot` 的最早一条提交，若你本地历史不同，请用 `git log --reverse` 取首条替换。）

---

**说明**：`ChatBotView.tsx` 全文约九百行，若逐行抄写将严重重复仓库内容。本文已按**功能块**把近三天相关逻辑全部拆开并附**逐行级**释义；**第七节**为钉视口与置底的交互逻辑；**第八节**为「多轮 + 多分支」场景下**卡死/卡顿**的成因与 `useMessageTools` / 结构共享 / `latestBranchMapMemo` / 连接层与微任务等**性能向**修改对照。与源码一一对应时，请以仓库当前文件为准，用行号或块标题对照即可。

---

## 九、本次需求：Markdown 围栏代码块吸顶工具栏（Portal + 全局 layout）

> **说明**：本节与上文「近三天 Chat 性能/分支」等主题**独立**，专门记录**代码块工具栏吸顶**相关改动的**完整代码位置**、**功能点**、**影响面**与**设计原因**。行号以写入本文档时仓库为准；后续若增删行，请以 Git 或 IDE 为准对照**小节标题与符号名**。

### 9.1 需求与方案摘要

| 维度 | 内容 |
|------|------|
| **目标** | 助手消息内 Markdown 围栏代码块：顶栏展示语言 + 复制/下载；用户向上滚动使代码块跨过聊天区视口顶边时，工具栏**贴在滚动视口上沿**，并与代码块/气泡水平范围协调。 |
| **痛点** | `position: sticky` 在 Radix `ScrollArea`（内部 `overflow`）链路上易失效；在滚动容器子树内用 `transform` 模拟或 `fixed` 易受祖先 `transform`/`filter` 建立Containing Block 的影响；**每条消息各自更新**易出现多实例竞争、水平偏移。 |
| **方案** | ① `MarkdownParser` 输出统一 DOM（`data-chat-code-block`、`toolbar-slot`）；② `layoutChatCodeToolbars(viewport)` 在视口内只 **pin** 一个块并写全局 store；③ `ChatCodeToolbarFloating` 用 **`createPortal(..., document.body)`** + **`fixed`** + 视口矩形；④ 被 pin 块的内联工具栏 **`visibility:hidden`**，**slot 设 `minHeight`** 防布局跳动；⑤ `ChatBotView` 统一在滚动/resize/消息变化时调 `layout`。 |

### 9.2 改动文件清单（本次需求）

| 文件 | 改动性质 |
|------|----------|
| `packages/tools/src/markdown-parser.ts` | fence HTML 增加外层 `chat-md-code-toolbar-slot`（改后需 `pnpm --filter @dnhyxc-ai/tools build`）。 |
| `apps/frontend/src/utils/chatCodeToolbar.ts` | 新增/替换为 store + `layoutChatCodeToolbars` + `getPinnedChatCodeBlock` 等；移除旧的 `subscribe`/`notify`/`updateChatCodeToolbarsInShell`（若仍有引用需删）。 |
| `apps/frontend/src/components/design/ChatCodeToolBar/index.tsx` | 浮动工具栏组件（默认导出；`ChatBotView` 从 `@design/ChatCodeToolBar` 引入）。 |
| `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx` | 根节点 `data-chat-assistant-shell`；移除对 `subscribeChatCodeToolbarScrollSync` / `notify` / `updateChatCodeToolbarsInShell` 的 effect；保留内联按钮事件委托。 |
| `apps/frontend/src/components/design/ChatBot/ChatBotView.tsx` | 引入并渲染浮动组件；`syncViewportScrollMetrics`、resize、scroll、`messages` effect 中调用 `layoutChatCodeToolbars`。 |
| `apps/frontend/src/index.css` | slot、隐藏态、浮动态样式；工具栏去掉 `will-change: transform`。 |

---

### 9.3 `packages/tools/src/markdown-parser.ts`（fence 模板）

**功能点**：仅在 `options.enableChatCodeFenceToolbar === true` 时 `patchChatCodeFenceRenderer()` 覆盖 `md.renderer.rules.fence`。

**关键输出结构**（逻辑行约 96–114，以仓库为准）：

```ts
// fence 规则 return 拼接字符串（节选）
'<div class="chat-md-code-block" data-chat-code-block>' +
'<div class="chat-md-code-toolbar-slot">' +
'<div class="chat-md-code-toolbar">' +
// ... lang + buttons ...
'</div></div>' +  // 先闭合 toolbar，再闭合 slot
'<pre><code class="...">' + highlighted + '</code></pre></div>\n'
```

**逐段说明**

| 片段 | 功能点 | 影响点 | 为什么这么写 |
|------|--------|--------|----------------|
| `chat-md-code-block` + `data-chat-code-block` | 标识一个可参与吸顶算法的代码块根节点 | `layoutChatCodeToolbars` 内 `querySelectorAll('[data-chat-code-block]')` | 与正文其它 div 区分，避免误选 |
| `chat-md-code-toolbar-slot` | 占位容器 | JS 对 pin 块设置 `slot.style.minHeight`；`reset` 时清空 | 内联工具栏隐藏后仍占高度，**防止 pre 上顶导致页面跳动** |
| 内层 `chat-md-code-toolbar` | 非吸顶/未 pin 时可见的条 | 加类 `--replaced-by-float` 后仅隐藏条本身，不占「可见」但 slot 撑高度 | 与浮动条复用同一套 class，样式一致 |
| `data-chat-code-action` / `data-chat-code-lang` | 内联按钮语义 | `ChatAssistantMessage` 点击委托复制/下载 | 未 pin 时用户仍点原文；pin 时点浮动条（Portal 内 React 按钮） |

---

### 9.4 `apps/frontend/src/utils/chatCodeToolbar.ts`（全文件逐行/逐符号说明）

下面按**行号区间**说明；区间内若多行同属一句法单元，合并为一行描述。

| 行号 | 代码要点 | 功能点 | 影响点 | 为什么这么写 |
|------|----------|--------|--------|----------------|
| 1–5 | 文件头注释 | 文档化架构决策 | 维护者理解为何不用 sticky | 避免后续改回子树 fixed/transform |
| 7–14 | `ChatCodeFloatingToolbarState` | 描述 Portal 条需要的几何与语言、`pinId` | `useSyncExternalStore` 的快照类型 | 单次更新原子替换 `state` |
| 16–23 | `HIDDEN` 常量 | 不可见时的统一初始快照 | `layout` 无候选或 `viewport==null` | 避免魔法数字散落 |
| 25–27 | `state` / `listeners` / `pinSession` | 模块级 store；`pinSession` 单调递增 | 全局单例；多 Tab 各页面独立加载各一份模块 | 无需 Redux；与单一浮动条 UI 匹配 |
| 29 | `PIN_ATTR` | `data-chat-toolbar-pin` 常量 | DOM 与 `querySelector` 一致 | 避免字符串拼写漂移 |
| 31–35 | `emit` | 通知所有 React 订阅者 | 每次 `layout` 结束调用 | 最小 pub/sub |
| 37–41 | `subscribeChatCodeFloatingToolbar` | `useSyncExternalStore` 的 subscribe | 仅 `ChatCodeToolbarFloating` 订阅 | React 18 推荐外部 store 形态 |
| 43–45 | `getChatCodeFloatingToolbarSnapshot` | 返回当前 `state` 引用 | 重渲染时读位置/语言 | 与 subscribe 成对 |
| 47–57 | `resetFloatingMarkersInViewport` | 清除上一轮 pin、隐藏类、slot 的 `minHeight` | **仅遍历 viewport 子树**，不扫全 `document` | 多聊天实例若共存需各自 viewport；性能可控 |
| 59–76 | `computePinnedBarBox` | 算 `left`/`width`（视口坐标） | 浮动条水平范围 | 优先用**代码块与视口交集**；宽度过小则退化为**视口与 shell 交集**，避免条宽为 0 |
| 81–86 | `layout` 入口 `viewport===null` | 隐藏浮动条 | 卸载、ref 未就绪 | 防止 Portal 残留错位 |
| 88–89 | `getBoundingClientRect` + `reset` | 取视口矩形；清标记 | 每一帧 layout 都先清再算 | 保证不会两个块同时带 pin |
| 91–115 | 遍历 blocks，收集 `toolbar`/`slot`/`shell` | 缺任一则跳过 | 旧 HTML 无 slot 时**不参与吸顶**（兼容未重建 tools 包） | 强制 slot 存在才吸顶，保证占位逻辑成立 |
| 117–121 | `PIN_EPS` + `candidates` | 「跨过视口顶」判定 | 决定谁有资格吸顶 | `±1px` 减少浮点边界抖动 |
| 123–127 | 无候选 → `HIDDEN` | 不显示浮动条 | 用户滚到无代码块区域 | |
| 129 | `reduce` 选 `br.top` 最大 | **多个块跨顶时取最靠下的一条** | 视觉上「当前正在读」的块 | 与 DeepSeek 等产品行为一致 |
| 130–134 | `pinId`++、设 attr、加隐藏类、写 `minHeight` | 锁定 DOM；占位 | 内联条不可见但高度保留 | `offsetHeight \|\| 36` 防止首帧高度为 0 |
| 136–139 | `shellRect` + `computePinnedBarBox` + `lang` | 水平盒 + 展示语言 | 浮动条文案 | `lang` 来自 `.chat-md-code-lang` 文本 |
| 141–149 | 写 `state` + `emit` | 触发 React 更新 Portal | 一帧内完成测量与提交 | |
| 152–180 | `LANG_TO_EXT` + `fileExtension` | 下载文件名后缀 | `downloadChatCodeBlock` | 与原先工具栏逻辑一致 |
| 182–185 | `getChatCodeBlockPlainText` | 读 `pre code` 文本 | 复制/下载 | 与 Markdown 结构耦合 |
| 187–190 | `getPinnedChatCodeBlock` | `document.querySelector` 按 `pinId` | 浮动按钮找块 | pin 全局唯一，故全局查询安全 |
| 192–204 | `downloadChatCodeBlock` | Blob + 临时 `<a>` | 浏览器下载 | 标准前端下载模式 |

**风险小结**：`layout` 含多次 DOM 查询与 `getBoundingClientRect`，滚动时若与 `syncViewportScrollMetrics`、原生 `scroll` **重复调用**，主线程成本约 **2 倍**（见 9.7）。

---

### 9.5 `apps/frontend/src/components/design/ChatCodeToolBar/index.tsx`（浮动组件，逐行）

| 行号 | 代码要点 | 功能点 | 影响点 | 为什么这么写 |
|------|----------|--------|--------|----------------|
| 1–2 | `useSyncExternalStore` + `createPortal` | 订阅 store + 挂 body | 脱离 ScrollArea 层叠 | 解决 fixed 参照系问题 |
| 3–9 | 从 `chatCodeToolbar` 引入工具函数 | 复制/下载/订阅 | 单一数据源 | 避免重复实现 |
| 14–26 | `useSyncExternalStore(..., serverSnapshot)` | SSR 时快照全 false | Next/SSR 不报错 | 第三参数给 `getServerSnapshot` |
| 28 | `copied` 本地 state | 「已复制」文案 | 仅浮动条按钮 | 与内联按钮的 1.5s 提示一致体验 |
| 30–36 | `onCopy` | `getPinnedChatCodeBlock` → 剪贴板 | 依赖 `state.pinId` | pin 变时 callback 更新 |
| 38–42 | `onDownload` | 同上 + `downloadChatCodeBlock` | 依赖 `lang` | 语言与 store 同步 |
| 44–46 | `document` 判空 + `visible` + `width<8` | 不渲染 | SSR、无候选、几何异常 | 避免 Portal 空条或 NaN |
| 48–71 | `node` 的 `className` / `style` | `fixed` + `top/left/width` + `zIndex:60` | 可能盖住页面其它 fixed 层 | 需与全局模态 z-index 策略统一 |
| 59–60 | `role="toolbar"`、`aria-label` | a11y | 读屏 | 基础可访问性 |
| 74 | `createPortal(node, document.body)` | 实际挂载点 | DOM 不在 ChatBot 子树 | **核心架构点** |

---

### 9.6 `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`（与本次需求相关部分）

**未改动的相关逻辑**：`MarkdownParser({ enableChatCodeFenceToolbar: true })`、`parser.render` 输出仍带工具栏 HTML；`useEffect` 点击委托处理 `[data-chat-code-action]`（**未吸顶**时点击内联按钮）。

**本次改动**

| 行号（约） | 改动 | 功能点 | 影响点 | 为什么这么写 |
|------------|------|--------|--------|----------------|
| 13–16 | 仅从 `chatCodeToolbar` 引入 `download`/`getPlainText` | 去掉 notify/subscribe/update | 不再按消息订阅全局滚动 | 避免与 `ChatBotView` 双重 layout |
| 11 | 去掉 `useLayoutEffect` import | 无 rAF notify | 减少无效帧 | 吸顶改由父级统一驱动 |
| 183–209 | 保留点击委托 | 内联复制/下载 | 与浮动条并存 | 未 pin 的块仍只靠内联条交互 |
| 212–216 | 根 `div` 增加 `data-chat-assistant-shell` | 标记助手气泡边界 | `layout` 内 `closest` 算水平盒 | **无此属性则 `shell` 为 null，该块不参与 scored**（被跳过） |
| （删除） | 原 `subscribeChatCodeToolbarScrollSync` + `updateChatCodeToolbarsInShell` 的 `useEffect` | — | — | 防止每条消息各跑一遍 transform/layout |
| （删除） | 原 `useLayoutEffect` + `requestAnimationFrame(notify)` | — | — | 同上，统一收口到 View |

**回归注意**：若其它页面渲染助手消息但**未**包在带 `data-chat-assistant-shell` 的容器内，代码块**不会出现吸顶**（仍可用内联条）。

---

### 9.7 `apps/frontend/src/components/design/ChatBot/ChatBotView.tsx`（本次需求相关片段）

**下列行号为写入本文档时近似值，请以仓库为准。**

#### 9.7.1 import 与 JSX

| 行号（约） | 代码 | 功能点 | 影响点 | 为什么这么写 |
|------------|------|--------|--------|----------------|
| 3 | `import ChatCodeToolbarFloating from '@design/ChatCodeToolBar'` | 挂载浮动 UI | 多 1 个子组件 | 与路径别名一致 |
| 30 | `import { layoutChatCodeToolbars } from '@/utils/chatCodeToolbar'` | 布局入口 | 替代旧 `notify` | 必须传 viewport |
| 807 | `<ChatCodeToolbarFloating />` | 在 View 树注册订阅者 | Portal 实际在 body | 放在 `ScrollArea` 外同级，避免嵌套干扰 |
| 808–809 | 注释 | 说明 ref 与 Portal 关系 | 维护 | — |

#### 9.7.2 `syncViewportScrollMetrics`（约 213–223 行）

| 行号（约） | 代码 | 功能点 | 影响点 | 为什么这么写 |
|------------|------|--------|--------|----------------|
| 214–221 | 原有 `scrollTop` / 滚动条 / 是否到底 | **未改行为** | `ChatControls`、自动跟底等 | 保持原逻辑 |
| 222 | `layoutChatCodeToolbars(el)` | 与视口指标同步刷新吸顶条 | 任何调用 `syncViewportScrollMetrics` 的路径都会更新工具栏 | `onScrollTo`、滚底双帧、`handleScroll` 等**间接**受益 |

#### 9.7.3 `handleScroll`（约 511–518 行）

| 代码 | 功能点 | 影响点 | 为什么这么写 |
|------|--------|--------|----------------|
| `syncViewportScrollMetrics()` | 用户滚动时更新状态 + **layout** | 与 9.7.4 原生 `scroll` 可能**连续两次** layout | Radix 的 `onScroll` 可靠性 + 原有 ref 回填逻辑保留 |

#### 9.7.4 resize 与 `useLayoutEffect`（约 350–369 行）

| 行号（约） | 代码 | 功能点 | 影响点 | 为什么这么写 |
|------------|------|--------|--------|----------------|
| 350–355 | `resize` → `layoutChatCodeToolbars(scrollContainerRef.current)` | 窗宽变化重算 `left/width` | 全局 `window` 监听 | 浮动条用视口像素，必须随窗宽变 |
| 357–364 | `useLayoutEffect`：`vp.addEventListener('scroll', ...)` | 滚动必 layout | `activeSessionId` / `messages.length` 变时重绑 | 防止会话切换后 listener 挂在旧 DOM |
| 366–369 | `useLayoutEffect([messages])` | 列表引用变化 layout 一次 | 流式/懒加载高度变而无 scroll 事件时补一帧 | **不解决**「同引用仅内容变」的极端情况（见 9.4 风险） |

**与原有功能冲突评估**：**不修改** `messages` 合并算法、分支滚动、`flushSync` 等；仅增加 **layout 副作用**。理论上**不应**改变跟底判定；若发现滚动卡顿，优先 profiling `layoutChatCodeToolbars` 调用次数。

---

### 9.8 `apps/frontend/src/index.css`（`.chat-md-*` 相关）

| 选择器/行（约） | 声明 | 功能点 | 影响点 | 为什么这么写 |
|-----------------|------|--------|--------|----------------|
| 37–38 | 注释 | 说明工具栏来源 | 维护 | — |
| 38–45 | `.chat-md-code-block` | 块容器样式 | 全局助手 Markdown | 原样保留 |
| 47–50 | `.chat-md-code-toolbar-slot` | `flex-shrink: 0` | 与 flex 布局共存时 slot 不被压扁 | 保证占位稳定 |
| 52–71 | `.chat-md-code-toolbar` | 条样式 | 内联与结构一致 | **删除**原 `will-change: transform`：已不再用 transform 吸顶，避免无谓合成层 |
| 73–76 | `--replaced-by-float` | `visibility:hidden` + `pointer-events:none` | pin 时内联条不可点不可见 | 保留布局参与（配合 slot 高度）；不用 `display:none` 以免高度逻辑更难统一 |
| 78–86 | `--floating` | 整块圆角、边框、阴影 | 仅 Portal 条额外 class | 视觉与块内条区分（浮在内容之上） |
| 88–121 | lang / actions / btn | 子元素样式 | 内联与浮动共用 | 复用同一套 DOM 结构 |

---

### 9.9 数据流与时序（便于排查 bug）

```mermaid
flowchart LR
  subgraph dom [DOM]
    VP[ScrollArea viewport]
    BLOCK[data-chat-code-block]
    SLOT[slot + toolbar]
    BODY[document.body]
  end
  CBV[ChatBotView] -->|scroll resize messages sync| LAYOUT[layoutChatCodeToolbars]
  LAYOUT -->|read| VP
  LAYOUT -->|query| BLOCK
  LAYOUT -->|pin attr minHeight class| SLOT
  LAYOUT -->|set state emit| STORE[chatCodeToolbar store]
  STORE -->|subscribe| FLOAT[ChatCodeToolbarFloating]
  FLOAT -->|Portal fixed| BODY
```

**常见 bug 对照**

| 现象 | 可能原因 |
|------|----------|
| 无吸顶条 | `@dnhyxc-ai/tools` 未 build；HTML 无 `toolbar-slot`；无 `data-chat-assistant-shell` |
| 条位置闪 | `messages` 引用未变但内容大变，需滚动或补 ResizeObserver |
| 双次卡顿 | `handleScroll` 与原生 `scroll` 双重 `layout`（可优化为单次） |
| z-index 被挡 | 浮动条 `z-index:60` 低于模态 |

---

### 9.10 构建与联调命令

```bash
# 修改 markdown-parser 后必做
pnpm --filter @dnhyxc-ai/tools run build

# 前端类型检查
cd apps/frontend && pnpm exec tsc --noEmit
```

---

**本节完**：九、本次需求「代码块吸顶工具栏」从 **parser 输出 → store/layout → Portal UI → View 驱动 → CSS** 全链路说明完毕；与**第一节至第八节**（历史性能与分支等）可并列查阅，互不替代。
