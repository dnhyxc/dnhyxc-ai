import ChatBot, { Message } from '@design/ChatBot';
import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { ScrollArea } from '@ui/index';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getSessionList } from '@/service';
import { buildMessageList, getFormatMessages } from './tools';

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
	const [chatBotMessages, setChatBotMessages] = useState<Message[]>([]);
	const [sessionListInfo, setSessionListInfo] = useState<SessionListInfo>({
		list: [],
		total: 0,
	});
	// 记录每个节点选中的子节点 ID: Map<parentId, selectedChildId>
	const [selectedChildMap, setSelectedChildMap] = useState<Map<string, string>>(
		new Map(),
	);

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
		setSelectedChildMap(new Map());
		const sortedMessages = buildMessageList(session.messages, new Map());
		const formattedMessages = getFormatMessages(sortedMessages);
		setChatBotMessages(formattedMessages);
		setOpen(false);
	};

	const onBranchChange = (msgId: string, direction: 'prev' | 'next') => {
		const currentSession = sessionListInfo.list.find(
			(s) => s.id === activeSessionId,
		);
		if (!currentSession) return;

		const currentMsg = currentSession.messages.find((m) => m.chatId === msgId);
		if (!currentMsg) return;

		const parentId = currentMsg.parentId;

		// 找到所有兄弟节点
		let siblings: Message[] = [];

		if (parentId) {
			siblings = currentSession.messages.filter((m) => m.parentId === parentId);
		} else {
			// Root siblings
			// 同样的逻辑找出 root messages
			siblings = currentSession.messages.filter((m) => !m.parentId);
			if (siblings.length === 0) {
				const allChildren = new Set<string>();
				currentSession.messages.forEach((m) => {
					m.childrenIds?.forEach((c) => {
						allChildren.add(c);
					});
				});
				siblings = currentSession.messages.filter(
					(m) => !allChildren.has(m.chatId),
				);
			}
		}

		const currentIndex = siblings.findIndex((m) => m.chatId === msgId);
		const nextIndex =
			direction === 'next' ? currentIndex + 1 : currentIndex - 1;

		if (nextIndex >= 0 && nextIndex < siblings.length) {
			const nextMsg = siblings[nextIndex];
			// 更新选中状态
			const newSelectedChildMap = new Map(selectedChildMap);
			if (parentId) {
				newSelectedChildMap.set(parentId, nextMsg.chatId);
			} else {
				newSelectedChildMap.set('root', nextMsg.chatId);
			}

			setSelectedChildMap(newSelectedChildMap);

			// 重新构建消息列表
			const sortedMessages = buildMessageList(
				currentSession.messages,
				newSelectedChildMap,
			);

			const formattedMessages = getFormatMessages(sortedMessages);

			setChatBotMessages(formattedMessages);
		}
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
				key={activeSessionId}
				initialMessages={chatBotMessages as any[]}
				onBranchChange={onBranchChange}
				activeSessionId={activeSessionId}
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
