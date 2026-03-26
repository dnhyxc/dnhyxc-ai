import * as mobx from 'mobx';
import { observer } from 'mobx-react';
import React, {
	forwardRef,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { useChatCoreContext } from '@/contexts';
import { findLatestBranchSelection } from '@/hooks/useBranchManage';
import { useChatCore } from '@/hooks/useChatCore';
import useStore from '@/store';
import { ChatBotProps, ChatBotRef, Message } from '@/types/chat';
import ChatBotView from './ChatBotView';

export type {
	ChatBotRef,
	ChatBotViewAnchorNavContext,
	ChatBotViewChatControlsContext,
	ChatBotViewMessageActionsContext,
	ChatBotViewProps,
} from '@/types/chat';
export { default as ChatBotView } from './ChatBotView';

/**
 * ChatBot（默认导出）= 本应用专用的「连接层」：
 * - 从 MobX chatStore 订阅消息与分支、会话加载态；
 * - 从 ChatCoreProvider 取分享勾选、滚动 ref 注册；
 * - 调用 useChatCore 绑定发送/流式与本仓库后端。
 *
 * 这样业务页仍只需 `<ChatBot />`，行为与拆分前一致；
 * 需要跨项目复用时请使用 ChatBotView，并自行注入 ChatBotViewProps（零 Store）。
 */
const ChatBot = observer(
	forwardRef<ChatBotRef, ChatBotProps>(function ChatBot(props, ref) {
		const {
			className,
			apiEndpoint = '/chat/sse',
			showAvatar = false,
			onBranchChange,
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

		const [allMessages, setAllMessages] = useState<Message[]>(() => [
			...chatStore.messages,
		]);
		const [selectedChildMap, setSelectedChildMap] = useState<
			Map<string, string>
		>(new Map());

		// 稳定引用，避免 ChatBotView 内注册滚动的 effect 随父级无意义重跑（原先 onScrollToRef 来自 useRef，引用不变）。
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

		// useMemo 固定 streamingBranchSource 引用：否则 useBranchManage 内依赖它的 useCallback 每帧失效，
		// 可能放大重渲染；闭包内仍每次调用读 MobX，行为与重构前一致。
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

		// 与拆分前相同：用 reaction 把可观察数组拷贝到 React state，保证下游 effect 依赖的是快照而非直接持有 observable 引用链。
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

		// 展示列表改由 ChatBotView 内部根据 flatMessages + selectedChildMap memo 推导，
		// 与原先此处 effect + getFormatMessages 语义一致，减少连接层重复状态。

		// 依赖项刻意保持仅 activeSessionId，与旧实现一致，避免在其它 store 字段变化时误触会话重置逻辑。
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
