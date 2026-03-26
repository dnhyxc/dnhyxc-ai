import { forwardRef, useState } from 'react';
import type { ChatBotRef, ChatBotSimpleViewProps } from '@/types/chat';
import ChatBotView from './ChatBotView';

/**
 * 对 ChatBotView 的薄封装：调用方只传 `messages`（等同 flatMessages），
 * 当前分支 Map 在组件内用 useState 管理，减少「空会话 + new Map + setState」样板代码。
 *
 * 消息条、锚点、底栏等仍可通过 ChatBotView 同名可选 props（如 renderMessageActions、show*）自行扩展；
 * 若要与全局 Store / 会话级分支持久化一致，请改用 ChatBotView 并受控传入 selectedChildMap。
 */
const SimpleChatBotView = forwardRef<ChatBotRef, ChatBotSimpleViewProps>(
	function SimpleChatBotView(props, ref) {
		const { messages, initialSelectedChildMap, ...rest } = props;

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
