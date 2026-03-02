import ChatBot from '@design/ChatBot';
import { Message } from '@design/ChatBot/types';
import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { ScrollArea } from '@ui/index';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getSessionList } from '@/service';

interface Session {
	id: string;
	content: string;
	role: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	messages: Message[];
}

interface SessionListInfo {
	list: Session[];
	total: number;
}

const Chat = () => {
	const [open, setOpen] = useState(false);
	const [activeSessionId, setActiveSessionId] = useState<string>('');
	// 修改：直接存储完整的消息树，而不是裁剪后的路径
	const [chatBotMessages, setChatBotMessages] = useState<Message[]>([]);
	const [sessionListInfo, setSessionListInfo] = useState<SessionListInfo>({
		list: [],
		total: 0,
	});

	const parser = useMemo(() => {
		return new MarkdownParser();
	}, []);

	useEffect(() => {
		if (open) {
			getSessions();
		}
	}, [open]);

	const onSelectSession = (session: Session) => {
		setActiveSessionId(session.id);
		// 修改：直接传递完整消息树，不要调用 buildMessageList 裁剪
		// ChatBot 内部会负责根据 selectedChildMap 计算显示路径
		setChatBotMessages(session.messages || []);
		setOpen(false);
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
			setSessionListInfo(res.data);
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
				initialMessages={chatBotMessages}
				onBranchChange={onBranchChange}
				activeSessionId={activeSessionId}
				setActiveSessionId={setActiveSessionId}
			/>
			<Drawer title="历史对话" open={open} onOpenChange={() => setOpen(false)}>
				<ScrollArea className="h-full overflow-y-auto pr-4 box-border">
					{sessionListInfo.list.map((item) => {
						return (
							<div
								key={item.id}
								className={`h-10 p-2 hover:bg-theme/10 rounded-sm cursor-pointer ${activeSessionId === item.id ? 'bg-theme/10' : ''}`}
								onClick={() => onSelectSession(item)}
							>
								<div
									className="line-clamp-1"
									dangerouslySetInnerHTML={{
										__html: parser.render(
											item.messages?.[0]?.content || '新对话',
										),
									}}
								/>
							</div>
						);
					})}
				</ScrollArea>
			</Drawer>
		</div>
	);
};

export default Chat;
