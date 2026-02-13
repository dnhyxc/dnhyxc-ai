```js
import ChatBot from '@design/ChatBot';
import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { ScrollArea } from '@ui/index';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getSessionList } from '@/service';

interface Message {
	attachments: string[];
	childrenIds: string[];
	parentId: string;
	content: string;
	createdAt: Date;
	id: string;
	role: string;
	siblingIndex?: number;
	siblingCount?: number;
}

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

const buildMessageList = (
	messages: Message[],
	selectedChildMap: Map<string, string>,
): Message[] => {
	const messageMap = new Map<string, Message>();
	const childrenMap = new Map<string, Message[]>();

	messages.forEach((msg) => {
		messageMap.set(msg.id, msg);
		if (msg.parentId) {
			if (!childrenMap.has(msg.parentId)) {
				childrenMap.set(msg.parentId, []);
			}
			childrenMap.get(msg.parentId)?.push(msg);
		}
	});

	// 找出所有的 root messages
	let rootMessages = messages.filter((msg) => !msg.parentId);
	// 如果通过 parentId 找不到，尝试通过排除法
	if (rootMessages.length === 0 && messages.length > 0) {
		const allChildren = new Set<string>();
		messages.forEach((m) => {
			m.childrenIds?.forEach((c) => {
				allChildren.add(c);
			});
		});
		rootMessages = messages.filter((m) => !allChildren.has(m.id));
	}

	// 对 rootMessages 进行排序
	rootMessages.sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);

	const result: Message[] = [];

	// 确定当前的 root message
	const currentRootId = selectedChildMap.get('root');
	let currentMessage = rootMessages.find((m) => m.id === currentRootId);

	// 如果没找到，默认选最新的一个
	if (!currentMessage && rootMessages.length > 0) {
		currentMessage = rootMessages[rootMessages.length - 1];
	}

	while (currentMessage) {
		// 查找当前消息的兄弟节点
		let siblingIndex = 0;
		let siblingCount = 1;

		if (currentMessage.parentId) {
			const siblings = childrenMap.get(currentMessage.parentId) || [];
			siblings.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			);
			siblingCount = siblings.length;
			siblingIndex = siblings.findIndex((m) => m.id === currentMessage?.id);
		} else {
			// Root 节点的兄弟就是 rootMessages
			siblingCount = rootMessages.length;
			siblingIndex = rootMessages.findIndex((m) => m.id === currentMessage?.id);
		}

		result.push({
			...currentMessage,
			siblingIndex,
			siblingCount,
		});

		if (currentMessage.childrenIds && currentMessage.childrenIds.length > 0) {
			// 优先使用用户选择的子节点
			let nextId = selectedChildMap.get(currentMessage.id);
			if (!nextId || !messageMap.has(nextId)) {
				// 默认使用最后一个子节点
				nextId =
					currentMessage.childrenIds[currentMessage.childrenIds.length - 1];
			}
			currentMessage = messageMap.get(nextId);
		} else {
			currentMessage = undefined;
		}
	}
	return result;
};

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
		getSessions();
	}, []);

	const onSelectSession = (session: Session) => {
		setActiveSessionId(session.id);
		setSelectedChildMap(new Map());
		const sortedMessages = buildMessageList(session.messages, new Map());

		const formattedMessages: any[] = sortedMessages.map((msg) => ({
			id: msg.id,
			content: msg.content,
			role: msg.role as 'user' | 'assistant',
			timestamp: new Date(msg.createdAt),
			parentId: msg.parentId,
			childrenIds: msg.childrenIds,
			siblingIndex: msg.siblingIndex,
			siblingCount: msg.siblingCount,
		}));
		setChatBotMessages(formattedMessages);
	};

	const onBranchChange = (msgId: string, direction: 'prev' | 'next') => {
		const currentSession = sessionListInfo.list.find(
			(s) => s.id === activeSessionId,
		);
		if (!currentSession) return;

		const currentMsg = currentSession.messages.find((m) => m.id === msgId);
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
					(m) => !allChildren.has(m.id),
				);
			}
		}

		siblings.sort(
			(a, b) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		);

		const currentIndex = siblings.findIndex((m) => m.id === msgId);
		const nextIndex =
			direction === 'next' ? currentIndex + 1 : currentIndex - 1;

		if (nextIndex >= 0 && nextIndex < siblings.length) {
			const nextMsg = siblings[nextIndex];
			// 更新选中状态
			const newSelectedChildMap = new Map(selectedChildMap);
			if (parentId) {
				newSelectedChildMap.set(parentId, nextMsg.id);
			} else {
				newSelectedChildMap.set('root', nextMsg.id);
			}
			setSelectedChildMap(newSelectedChildMap);

			// 重新构建消息列表
			const sortedMessages = buildMessageList(
				currentSession.messages,
				newSelectedChildMap,
			);
			const formattedMessages: any[] = sortedMessages.map((msg) => ({
				id: msg.id,
				content: msg.content,
				role: msg.role as 'user' | 'assistant',
				timestamp: new Date(msg.createdAt),
				parentId: msg.parentId,
				childrenIds: msg.childrenIds,
				siblingIndex: msg.siblingIndex,
				siblingCount: msg.siblingCount,
			}));
			setChatBotMessages(formattedMessages);
		}
	};

	const getSessions = async () => {
		const res = await getSessionList();
		if (res.success) {
			setSessionListInfo(res.data);
			if (res.data.list.length > 0) {
				onSelectSession(res.data.list[0]);
			}
		}
		console.log(res, 'res');
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
```
