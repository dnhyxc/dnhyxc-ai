import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { ScrollArea, Spinner, Toast } from '@ui/index';
import { SquarePen, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import Confirm from '@/components/design/Confirm';
import { useChatCore } from '@/hooks/useChatCore';
import { deleteSession, getSessionList } from '@/service';
import useStore from '@/store';
import { Session } from '@/types/chat';

interface IProps {
	open: boolean;
	onOpenChange: () => void;
}

interface SessionItemProps {
	item: Session;
	isActive: boolean;
	isLoading: boolean;
	onSelect: (e: React.MouseEvent<HTMLDivElement>, session: Session) => void;
	onDelete: (e: React.MouseEvent<HTMLDivElement>, item: Session) => void;
	parser: MarkdownParser;
}

// 会话列表项组件
const SessionItem = memo<SessionItemProps>(
	({ item, isActive, isLoading, onSelect, onDelete, parser }) => {
		return (
			<div
				className={`group relative h-10 px-2 mb-1 hover:bg-theme/10 rounded-sm cursor-pointer flex items-center justify-between ${isActive ? 'bg-theme/10' : ''}`}
				onClick={(e) => onSelect(e, item)}
			>
				{isLoading && <Spinner className="w-4 h-4 mr-2 text-cyan-400" />}
				<div
					className="line-clamp-1 flex-1 text-sm [&_.markdown-body]:text-textcolor!"
					dangerouslySetInnerHTML={{
						__html: parser.render(item.messages?.[0]?.content || '新对话'),
					}}
				/>
				<div className="absolute right-2 items-center hidden group-hover:flex">
					<div className="bg-theme-background p-1 rounded-sm hover:text-blue-500">
						<SquarePen size={18} />
					</div>
					<div
						className="bg-theme-background p-1 ml-2 rounded-sm hover:text-red-500"
						onClick={(e) => onDelete(e, item)}
					>
						<Trash2 size={18} />
					</div>
				</div>
			</div>
		);
	},
);

const SessionList: React.FC<IProps> = () => {
	const { chatStore } = useStore();
	const { clearChat, stopGenerating } = useChatCore();

	const navigate = useNavigate();

	const [open, setOpen] = useState(false);
	const [streamingSessionId, setStreamingSessionId] = useState<string>('');
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleteItem, setDeleteItem] = useState<Session | null>(null);

	const parser = useMemo(() => new MarkdownParser(), []);

	useEffect(() => {
		if (open) getSessions();
	}, [open]);

	const getSessions = useCallback(async () => {
		const res = await getSessionList();
		if (res.success) {
			chatStore.setSessionData(res.data);
		}
	}, [chatStore]);

	const handleConfirmDelete = useCallback(async () => {
		if (deleteItem) {
			const res = await deleteSession(deleteItem.id);
			if (res.success) {
				if (deleteItem.id === chatStore.activeSessionId) {
					await stopGenerating(deleteItem.id, true);
					clearChat(deleteItem.id);
					navigate('/chat');
				} else {
					await stopGenerating(deleteItem.id, true);
				}
				chatStore.updateSessionData(deleteItem.id);
			} else {
				Toast({ type: 'error', title: res.message || '删除失败' });
			}
		}
		setConfirmOpen(false);
		setDeleteItem(null);
	}, [deleteItem, chatStore, stopGenerating, clearChat]);

	const handleCancelDelete = useCallback(() => {
		setConfirmOpen(false);
		setDeleteItem(null);
	}, []);

	const onSelectSession = useCallback(
		(e: React.MouseEvent<HTMLDivElement>, session: Session) => {
			e.stopPropagation();

			chatStore.setActiveSessionId(session.id);

			const hasStreamingMessage = session.messages?.some((m) => m.isStreaming);
			if (hasStreamingMessage || session.id === streamingSessionId) {
				setStreamingSessionId(session.id);
			} else {
				setStreamingSessionId('');
			}

			chatStore.setAllMessages(session.messages || [], session.id, false);
			setOpen(false);
			navigate(`/chat/c/${session.id}`);
		},
		[chatStore, streamingSessionId, navigate],
	);

	const onDelete = useCallback(
		(e: React.MouseEvent<HTMLDivElement>, item: Session) => {
			e.stopPropagation();
			setDeleteItem(item);
			setConfirmOpen(true);
		},
		[],
	);

	const sessionList = useMemo(() => {
		return chatStore.sessionData.list.map((item) => (
			<SessionItem
				key={item.id}
				item={item}
				isActive={chatStore.activeSessionId === item.id}
				isLoading={chatStore.loadingSessions.has(item.id)}
				onSelect={onSelectSession}
				onDelete={onDelete}
				parser={parser}
			/>
		));
	}, [
		chatStore.sessionData.list,
		chatStore.activeSessionId,
		chatStore.loadingSessions,
		onSelectSession,
		onDelete,
		parser,
	]);

	return (
		<Drawer title="历史对话" open={open} onOpenChange={setOpen}>
			<ScrollArea className="h-full overflow-y-auto pr-4 box-border">
				{sessionList}
			</ScrollArea>
			<Confirm
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="确认删除"
				description="确定要删除这个会话吗？此操作无法撤销。"
				className="w-100"
				onConfirm={handleConfirmDelete}
				onCancel={handleCancelDelete}
			/>
		</Drawer>
	);
};

export default SessionList;
