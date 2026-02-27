import ChatBot, { Message } from '@design/ChatBot';
import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { ScrollArea } from '@ui/index';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getSessionList } from '@/service';
import { buildMessageList } from './tools';

const messageList = [
	{
		id: '80e7cb14-f089-4629-8afa-178fa49fec5f',
		role: 'user',
		content: '一句话总结春天',
		parentId: null,
		childrenIds: ['c19e8e6c-3691-45b6-9750-c639d0f3bb6f'],
		createdAt: '2026-02-12T04:27:33.483Z',
		attachments: [],
	},
	{
		id: 'c19e8e6c-3691-45b6-9750-c639d0f3bb6f',
		role: 'assistant',
		content: '**万物复苏，生机勃发。**',
		parentId: '80e7cb14-f089-4629-8afa-178fa49fec5f',
		childrenIds: ['a010e042-dc57-44f8-8f9e-0cca50468fd7'],
		createdAt: '2026-02-12T04:27:36.405Z',
		attachments: [],
	},
	{
		id: 'a010e042-dc57-44f8-8f9e-0cca50468fd7',
		role: 'user',
		content: '一句话总结夏天',
		parentId: 'c19e8e6c-3691-45b6-9750-c639d0f3bb6f',
		childrenIds: ['d1e8ab07-3c5b-4f6b-801f-fec247ffe9de'],
		createdAt: '2026-02-12T04:27:46.606Z',
		attachments: [],
	},
	{
		id: 'd1e8ab07-3c5b-4f6b-801f-fec247ffe9de',
		role: 'assistant',
		content:
			'**春天：** 万物复苏，生机勃发。  \n**夏天：** 热烈繁盛，能量满溢。',
		parentId: 'a010e042-dc57-44f8-8f9e-0cca50468fd7',
		childrenIds: ['beef1216-09cd-4017-8ae4-1610670a0dbd'],
		createdAt: '2026-02-12T04:27:48.687Z',
		attachments: [],
	},
	{
		id: 'beef1216-09cd-4017-8ae4-1610670a0dbd',
		role: 'user',
		content: '一句话总结秋天',
		parentId: 'd1e8ab07-3c5b-4f6b-801f-fec247ffe9de',
		childrenIds: ['1374edca-0a2d-4cd3-922d-e4fc5f8f7bd6'],
		createdAt: '2026-02-12T04:27:58.312Z',
		attachments: [],
	},
	{
		id: '1374edca-0a2d-4cd3-922d-e4fc5f8f7bd6',
		role: 'assistant',
		content:
			'**春天：** 万物在暖阳与细雨中苏醒，生命初绽，充满希望与可能。\n\n**夏天：** 阳光倾泻，万物在极致的繁茂与热烈中，释放着蓬勃的能量。\n\n**秋天：** 世界在绚烂的色彩中沉淀，丰收与凋零交织，归于宁静与深邃。',
		parentId: 'beef1216-09cd-4017-8ae4-1610670a0dbd',
		childrenIds: [
			'abde52b2-5b77-4efc-adfd-643272fdf032',
			'cee9d5bf-c2e4-40c9-b81c-a49146619c90',
		],
		createdAt: '2026-02-12T04:28:02.921Z',
		attachments: [],
	},
	{
		id: 'abde52b2-5b77-4efc-adfd-643272fdf032',
		role: 'user',
		content: '一句话总结冬天',
		parentId: '1374edca-0a2d-4cd3-922d-e4fc5f8f7bd6',
		childrenIds: ['f08b4675-a8fe-4b1e-81ce-a4b7e063ba73'],
		createdAt: '2026-02-12T04:28:12.888Z',
		attachments: [],
	},
	{
		id: 'f08b4675-a8fe-4b1e-81ce-a4b7e063ba73',
		role: 'assistant',
		content:
			'**春天：** 万物在暖阳细雨中苏醒，生命初绽，充满希望。\n\n**夏天：** 阳光倾泻，万物在极致的繁茂与热烈中释放能量。\n\n**秋天：** 世界在绚烂的色彩中沉淀，丰收与凋零交织，归于深邃。\n\n**冬天：** 万物在凛冽与静谧中蛰伏，积蓄力量，等待新生。',
		parentId: 'abde52b2-5b77-4efc-adfd-643272fdf032',
		childrenIds: ['cd79d5ba-c2e4-40c9-b81c-a491466198nf'],
		createdAt: '2026-02-12T04:28:16.922Z',
		attachments: [],
	},
	{
		id: 'cee9d5bf-c2e4-40c9-b81c-a49146619c90',
		role: 'user',
		content: '我不需要带其他季节，只要一句话总结冬天',
		parentId: '1374edca-0a2d-4cd3-922d-e4fc5f8f7bd6',
		childrenIds: ['a4be5ab9-e352-4061-a30a-f2f2a18b827e'],
		createdAt: '2026-02-12T04:28:34.250Z',
		attachments: [],
	},
	{
		id: 'a4be5ab9-e352-4061-a30a-f2f2a18b827e',
		role: 'assistant',
		content: '**冬天：** 万物在凛冽与静谧中蛰伏，积蓄力量，等待新生。',
		parentId: 'cee9d5bf-c2e4-40c9-b81c-a49146619c90',
		childrenIds: [],
		createdAt: '2026-02-12T04:28:37.972Z',
		attachments: [],
	},
	{
		id: 'cd79d5ba-c2e4-40c9-b81c-a491466198nf',
		role: 'user',
		content: '我需要一句话总结冬天',
		parentId: 'f08b4675-a8fe-4b1e-81ce-a4b7e063ba73',
		childrenIds: ['dd79d5ba-c2e4-40c9-b81c-a496966198of'],
		createdAt: '2026-02-12T04:28:34.250Z',
		attachments: [],
	},
	{
		id: 'dd79d5ba-c2e4-40c9-b81c-a496966198of',
		role: 'assistant',
		content: '万物在凛冽与静谧中蛰伏，积蓄力量，等待新生',
		parentId: 'cd79d5ba-c2e4-40c9-b81c-a491466198nf',
		childrenIds: [],
		createdAt: '2026-02-12T04:28:34.250Z',
		attachments: [],
	},
];

// interface Message {
// 	attachments: string[];
// 	childrenIds: string[];
// 	parentId: string;
// 	content: string;
// 	createdAt: Date;
// 	id: string;
// 	role: string;
// 	siblingIndex?: number;
// 	siblingCount?: number;
// }

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
			timestamp: new Date(msg.createdAt as Date),
			parentId: msg.parentId,
			childrenIds: msg.childrenIds,
			siblingIndex: msg.siblingIndex,
			siblingCount: msg.siblingCount,
		}));

		setChatBotMessages(formattedMessages);

		setOpen(false);
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

		// siblings.sort(
		// 	(a, b) =>
		// 		new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		// );

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
				timestamp: new Date(msg.createdAt as Date),
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
			const data = {
				list: [
					{
						id: 'cc41f51f-2fe8-47f9-bcbc-4f5bb4cfb9f2',
						isActive: true,
						createdAt: '2026-02-12T18:34:08.545Z',
						updatedAt: '2026-02-12T18:34:08.545Z',
						messages: messageList as any,
					},
				],
				total: 1,
			};
			setSessionListInfo(res.data);
			// if (res.data.list.length > 0) {
			// 	onSelectSession(res.data.list[0]);
			// }
			// setSessionListInfo(data as any);
			// if (res.data.list.length > 0) {
			// 	onSelectSession(data.list[0] as any);
			// }
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
