import ChatBot from '@design/ChatBot';
import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { ScrollArea, Spinner, Toast } from '@ui/index';
import { History, SquarePen, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react';
import React, { useEffect, useMemo, useState } from 'react';
import Confirm from '@/components/design/Confirm';
import { deleteSession, getSessionList } from '@/service';
import useStore from '@/store';
import { Session } from '@/types/chat';

const Chat = observer(() => {
	const { chatStore } = useStore();

	const [open, setOpen] = useState(false);
	// 跟踪当前正在流式的会话ID
	const [streamingSessionId, setStreamingSessionId] = useState<string>('');
	// 确认对话框状态
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleteItem, setDeleteItem] = useState<Session | null>(null);

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
			chatStore.setActiveSessionId('');
			setStreamingSessionId('');
		};
	}, []);

	const onSelectSession = (
		e: React.MouseEvent<HTMLDivElement>,
		session: Session,
	) => {
		e.stopPropagation();
		// 如果切换到不同的会话，更新 activeSessionId
		if (session.id !== chatStore.activeSessionId) {
			chatStore.setActiveSessionId(session.id);

			// 检查会话是否有流式消息
			const hasStreamingMessage = session.messages?.some((m) => m.isStreaming);

			// 如果切换到正在流式的会话，需要确保流式状态正确
			if (hasStreamingMessage || session.id === streamingSessionId) {
				setStreamingSessionId(session.id);
			} else {
				setStreamingSessionId('');
			}

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
			chatStore.setSessionData(res.data);
		}
	};

	const onOpenChange = () => {
		setOpen(true);
	};

	const onDelete = (e: React.MouseEvent<HTMLDivElement>, item: Session) => {
		e.stopPropagation();
		setDeleteItem(item);
		setConfirmOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (deleteItem) {
			const res = await deleteSession(deleteItem.id);
			if (res.success) {
				Toast({
					type: 'success',
					title: '删除成功',
				});
				getSessions();
			} else {
				Toast({
					type: 'error',
					title: res.message || '删除失败',
				});
			}
		}
		setConfirmOpen(false);
		setDeleteItem(null);
	};

	const handleCancelDelete = () => {
		setConfirmOpen(false);
		setDeleteItem(null);
	};

	const onEdit = (e: React.MouseEvent<HTMLDivElement>, item: Session) => {
		e.stopPropagation();
		console.log(item, 'item');
	};

	return (
		<div className="w-full h-full overflow-hidden">
			<div className="absolute top-4 left-28 z-9">
				{open ? (
					<History size={20} className="cursor-pointer text-cyan-500" />
				) : (
					<History
						size={20}
						className="cursor-pointer hover:text-blue-500"
						onClick={onOpenChange}
					/>
				)}
			</div>
			<ChatBot onBranchChange={onBranchChange} />
			<Drawer title="历史对话" open={open} onOpenChange={() => setOpen(false)}>
				<ScrollArea className="h-full overflow-y-auto pr-4 box-border">
					{chatStore.sessionData.list.map((item) => {
						return (
							<div
								key={item.id}
								className={`group relative h-10 px-2 mb-1 hover:bg-theme/10 rounded-sm cursor-pointer flex items-center justify-between ${chatStore.activeSessionId === item.id ? 'bg-theme/10' : ''}`}
								onClick={(e) => onSelectSession(e, item)}
							>
								<div
									className="line-clamp-1 flex-1 text-sm [&_.markdown-body]:text-textcolor!"
									dangerouslySetInnerHTML={{
										__html: parser.render(
											item.messages?.[0]?.content || '新对话',
										),
									}}
								/>
								<div className="absolute right-2 items-center hidden group-hover:flex">
									<div
										className="bg-theme-background p-1 rounded-sm hover:text-blue-500"
										onClick={(e) => onEdit(e, item)}
									>
										<SquarePen size={18} />
									</div>
									<div
										className="bg-theme-background p-1 ml-2 rounded-sm hover:text-red-500"
										onClick={(e) => onDelete(e, item)}
									>
										<Trash2 size={18} />
									</div>
								</div>
								{chatStore.loadingSessions.has(item.id) ? (
									<Spinner className="w-4 h-4 mr-2 text-cyan-400" />
								) : null}
							</div>
						);
					})}
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

export default Chat;
