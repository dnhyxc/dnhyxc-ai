import ChatBot from '@design/ChatBot';
import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { ScrollArea } from '@ui/index';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { observer } from 'mobx-react';
import { useEffect, useMemo, useState } from 'react';
import { getSessionList } from '@/service';
import useStore from '@/store';
import { Session } from '@/types/chat';

const Chat = observer(() => {
	const [open, setOpen] = useState(false);
	const [activeSessionId, setActiveSessionId] = useState<string>('');

	const { chatStore } = useStore();

	// 跟踪当前正在流式的会话ID
	const [streamingSessionId, setStreamingSessionId] = useState<string>('');

	const parser = useMemo(() => {
		return new MarkdownParser();
	}, []);

	useEffect(() => {
		if (open) {
			getSessions();
		}
	}, [open]);

	// 组件卸载时清理聊天状态
	useEffect(() => {
		return () => {
			// 清理聊天消息，确保下次进入是新的聊天页面
			chatStore.setAllMessages([], '', true);
			setActiveSessionId('');
			setStreamingSessionId('');
		};
	}, []);

	const onSelectSession = (session: Session) => {
		// 如果切换到不同的会话，更新 activeSessionId
		if (session.id !== activeSessionId) {
			setActiveSessionId(session.id);

			// 检查会话是否有流式消息
			const hasStreamingMessage = session.messages?.some((m) => m.isStreaming);

			// 如果切换到正在流式的会话，需要确保流式状态正确
			if (hasStreamingMessage || session.id === streamingSessionId) {
				setStreamingSessionId(session.id);
			} else {
				setStreamingSessionId('');
			}

			// 修改：直接传递完整消息树，不要调用 buildMessageList 裁剪
			// ChatBot 内部会负责根据 selectedChildMap 计算显示路径
			chatStore.setAllMessages(session.messages || [], session.id, false);
			setOpen(false);
		}
	};

	// 分支切换逻辑现在主要由 ChatBot 内部处理，
	// 如果需要在父组件同步状态（例如更新 URL 或持久化），保留 onBranchChange 回调即可
	const onBranchChange = (msgId: string, direction: 'prev' | 'next') => {
		// 父组件目前不需要做复杂的消息重计算，ChatBot 内部会处理 UI 更新
		// 如果需要记录用户的选择状态到父组件，可以在这里做，但不要修改传给 ChatBot 的 messages 结构
		console.log('Branch changed in Chat:', msgId, direction);
	};

	const getSessions = async () => {
		const res = await getSessionList();
		if (res.success) {
			chatStore.sessionData = res.data;
		}
	};

	const onOpenChange = () => {
		setOpen(true);
	};

	return (
		<div className="w-full h-full overflow-hidden">
			<div className="absolute top-4 left-28 z-9">
				{open ? (
					<PanelRightClose
						size={20}
						className="cursor-pointer hover:text-blue-500"
					/>
				) : (
					<PanelRightOpen
						size={20}
						className="cursor-pointer hover:text-blue-500"
						onClick={onOpenChange}
					/>
				)}
			</div>
			<ChatBot
				// 修改：传递完整树
				onBranchChange={onBranchChange}
				activeSessionId={activeSessionId}
				setActiveSessionId={setActiveSessionId}
			/>
			<Drawer title="历史对话" open={open} onOpenChange={() => setOpen(false)}>
				<ScrollArea className="h-full overflow-y-auto pr-4 box-border">
					{chatStore.sessionData.list.map((item) => {
						const hasStreamingMessage = item.messages?.some(
							(m) => m.isStreaming,
						);
						const isStreamingSession = item.id === streamingSessionId;

						return (
							<div
								key={item.id}
								className={`h-10 p-2 hover:bg-theme/10 rounded-sm cursor-pointer flex items-center justify-between ${activeSessionId === item.id ? 'bg-theme/10' : ''}`}
								onClick={() => onSelectSession(item)}
							>
								<div
									className="line-clamp-1 flex-1"
									dangerouslySetInnerHTML={{
										__html: parser.render(
											item.messages?.[0]?.content || '新对话',
										),
									}}
								/>
								{(hasStreamingMessage || isStreamingSession) && (
									<div className="ml-2 flex items-center">
										<div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse mr-1" />
										<span className="text-xs text-cyan-400">生成中</span>
									</div>
								)}
							</div>
						);
					})}
				</ScrollArea>
			</Drawer>
		</div>
	);
});

export default Chat;
