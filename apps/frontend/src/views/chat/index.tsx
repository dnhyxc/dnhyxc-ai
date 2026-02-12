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

const Chat = () => {
	const [open, setOpen] = useState(false);
	const [sessionListInfo, setSessionListInfo] = useState<SessionListInfo>({
		list: [],
		total: 0,
	});

	const parser = useMemo(() => {
		return new MarkdownParser();
	}, []);

	useEffect(() => {
		getSessions();
	}, []);

	const getSessions = async () => {
		const res = await getSessionList();
		if (res.success) {
			setSessionListInfo(res.data);
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
			<ChatBot />
			<Drawer title="历史对话" open={open} onOpenChange={() => setOpen(false)}>
				<ScrollArea className="h-full overflow-y-auto pr-4 box-border">
					{sessionListInfo.list.map((item) => {
						return (
							<div
								key={item.id}
								className="h-10 p-2 hover:bg-theme/10 rounded-sm cursor-pointer"
							>
								<div
									className="line-clamp-1"
									dangerouslySetInnerHTML={{
										__html: parser.render(item.messages?.[0].content),
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
