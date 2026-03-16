import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { ScrollArea, Spinner, Toast } from '@ui/index';
import { History, SquarePen, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Outlet, useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import ChatEntry from '@/components/design/ChatEntry';
import Confirm from '@/components/design/Confirm';
import { ChatCoreProvider } from '@/contexts';
import { useChatCore } from '@/hooks/useChatCore';
import { deleteSession, getSessionList, uploadFiles } from '@/service';
import useStore from '@/store';
import { FileWithPreview, UploadedFile } from '@/types';
import { Session } from '@/types/chat';

// ChatEntry 包装组件 - 使用 observer 响应 MobX 状态变化
const ChatEntryWrapper = observer(() => {
	const { chatStore } = useStore();
	const {
		input,
		setInput,
		uploadedFiles,
		setUploadedFiles,
		editMessage,
		setEditMessage,
		sendMessage,
		clearChat,
		stopGenerating,
		handleEditChange,
	} = useChatCore();

	const chatInputRef = useRef<HTMLTextAreaElement>(null);
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const navigate = useNavigate();

	// 直接从 store 获取 loading 状态，observer 会自动响应变化
	const loading = chatStore.isCurrentSessionLoading;

	const onUploadFile = useCallback(
		async (data: FileWithPreview | FileWithPreview[]) => {
			const files = Array.isArray(data) ? data : [data];
			const fileList = files.map((item) => item.file);
			const res = await uploadFiles(fileList);
			console.log(res, 'res', res.data);
			if (res.success) {
				setUploadedFiles((prev) => {
					return [
						...prev,
						...res.data.map((item: UploadedFile) => ({
							...item,
							path: import.meta.env.VITE_DEV_DOMAIN + item.path,
							uuid: uuidv4(),
						})),
					];
				});
				chatInputRef.current?.focus();
			}
		},
		[setUploadedFiles],
	);

	useEffect(() => {
		return () => {
			if (focusTimerRef.current) {
				clearTimeout(focusTimerRef.current);
			}
		};
	}, []);

	const toNewChat = () => {
		clearChat();
		navigate('/chat');
	};

	return (
		<ChatEntry
			chatInputRef={chatInputRef}
			input={input}
			setInput={setInput}
			uploadedFiles={uploadedFiles}
			setUploadedFiles={setUploadedFiles}
			loading={loading}
			editMessage={editMessage}
			setEditMessage={setEditMessage}
			handleEditChange={handleEditChange}
			sendMessage={sendMessage}
			onUploadFile={onUploadFile as any}
			clearChat={toNewChat}
			stopGenerating={stopGenerating}
		/>
	);
});

// 会话列表项组件
const SessionItem = React.memo<{
	item: Session;
	isActive: boolean;
	isLoading: boolean;
	onSelect: (e: React.MouseEvent<HTMLDivElement>, session: Session) => void;
	onDelete: (e: React.MouseEvent<HTMLDivElement>, item: Session) => void;
	parser: MarkdownParser;
}>(({ item, isActive, isLoading, onSelect, onDelete, parser }) => {
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
});

// Chat 主组件
const ChatContent = observer(() => {
	const { chatStore } = useStore();
	const { clearChat, stopGenerating } = useChatCore();

	const [open, setOpen] = useState(false);
	const [streamingSessionId, setStreamingSessionId] = useState<string>('');
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleteItem, setDeleteItem] = useState<Session | null>(null);

	const navigate = useNavigate();
	const parser = useMemo(() => new MarkdownParser(), []);

	useEffect(() => {
		if (open) getSessions();
	}, [open]);

	useEffect(() => {
		return () => {
			// chatStore.setAllMessages([], '', true);
			chatStore.setActiveSessionId('');
			// setStreamingSessionId('');
			// stopGenerating(undefined, true);
			// clearChat();
			// chatStore.clearLoadingSessions();
		};
	}, []);

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
		<div className="flex flex-col w-full h-full overflow-hidden">
			<div className="absolute top-4 left-28 z-50">
				{open ? (
					<History size={20} className="cursor-pointer text-cyan-500" />
				) : (
					<History
						size={20}
						className="cursor-pointer hover:text-blue-500"
						onClick={() => setOpen(true)}
					/>
				)}
			</div>

			<Outlet />

			<ChatEntryWrapper />

			<Drawer title="历史对话" open={open} onOpenChange={setOpen}>
				<ScrollArea className="h-full overflow-y-auto pr-4 box-border">
					{sessionList}
				</ScrollArea>
			</Drawer>

			<Confirm
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				title="确认删除"
				description="确定要删除这个会话吗？此操作无法撤销。"
				className="w-100"
				onConfirm={handleConfirmDelete}
				onCancel={handleCancelDelete}
			/>
		</div>
	);
});

// 导出包装后的组件
const Chat = () => (
	<ChatCoreProvider>
		<ChatContent />
	</ChatCoreProvider>
);

export default Chat;
