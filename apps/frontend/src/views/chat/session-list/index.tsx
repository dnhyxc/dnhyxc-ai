import Confirm from '@design/Confirm';
import { Drawer } from '@design/Drawer';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { Input, ScrollArea, Spinner, Toast } from '@ui/index';
import { Check, SquarePen, Trash2, X } from 'lucide-react';
import { observer } from 'mobx-react';
import {
	ChangeEvent,
	Dispatch,
	FocusEvent,
	MouseEvent,
	memo,
	SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { useNavigate } from 'react-router';
import { getChatMarkdownHighlightTheme } from '@/constant';
import { useChatCoreContext } from '@/contexts';
import { useTheme } from '@/hooks/theme';
import { useChatCore } from '@/hooks/useChatCore';
import { deleteSession, updateSession } from '@/service';
import useStore from '@/store';
import { Session } from '@/types/chat';
import { formatDate } from '@/utils';

interface IProps {
	open: boolean;
	onOpenChange: Dispatch<SetStateAction<boolean>>;
}

interface SessionItemProps {
	item: Session;
	editItem: Session | null;
	isActive: boolean;
	isLoading: boolean;
	parser: MarkdownParser;
	onSelect: (e: React.MouseEvent<HTMLDivElement>, session: Session) => void;
	onEdit: (e: React.MouseEvent<HTMLDivElement>, item: Session) => void;
	onDelete: (e: React.MouseEvent<HTMLDivElement>, item: Session) => void;
	setEditItem: Dispatch<SetStateAction<Session | null>>;
}

// 会话列表项组件
const SessionItem = memo<SessionItemProps>(
	({
		item,
		editItem,
		setEditItem,
		isActive,
		isLoading,
		onSelect,
		onDelete,
		onEdit,
		parser,
	}) => {
		const [isComposing, setIsComposing] = useState(false);
		const { chatStore } = useStore();

		const onChangeEditValue = (e: ChangeEvent<HTMLInputElement>) => {
			e.stopPropagation();
			setEditItem((item) => {
				if (item) {
					return {
						...item,
						title: e.target.value,
					};
				}
				return item;
			});
		};

		const onSubmit = async () => {
			if (
				editItem?.title.trim() &&
				editItem?.id &&
				(item.title || item?.messages?.[0].content) !== editItem?.title
			) {
				const res = await updateSession(editItem.id, editItem.title);
				if (res.success) {
					Toast({
						type: 'success',
						title: '会话标题更新成功',
					});
				}
				chatStore.updateSessionData(editItem.id, editItem.title);
			}
		};

		const onSubmitEdit = async (
			e: MouseEvent<HTMLDivElement, globalThis.MouseEvent>,
		) => {
			e.stopPropagation();
			await onSubmit();
			setEditItem(null);
		};

		const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
			const isCurrentlyComposing =
				(e.nativeEvent as KeyboardEvent).isComposing || isComposing;

			if (isCurrentlyComposing) return;
			if (e.key === 'Enter') {
				e.preventDefault();
				await onSubmit();
				setEditItem(null);
			}
		};

		const onCancelEdit = (
			e: MouseEvent<HTMLDivElement, globalThis.MouseEvent>,
		) => {
			e.stopPropagation();
			setEditItem(null);
		};

		const handleCompositionStart = () => {
			setIsComposing(true);
		};

		const handleCompositionEnd = () => {
			setTimeout(() => {
				setIsComposing(false);
			}, 0);
		};

		const onBlur = async (e: FocusEvent<HTMLInputElement, Element>) => {
			e.stopPropagation();
			await onSubmit();
			setEditItem(null);
		};

		return (
			<div
				id="__session-item-title__"
				className={`line-clamp-1 group relative ${editItem?.id === item.id ? 'px-0 bg-theme/10 border border-theme/10' : 'px-2'} mb-1.5 hover:bg-theme/10 rounded-sm cursor-pointer flex items-center justify-between ${isActive ? 'bg-theme/10' : ''}`}
				onClick={(e) => onSelect(e, item)}
			>
				{isLoading ? <Spinner className="w-4 h-4 mr-2 text-teal-500" /> : null}
				{editItem?.id === item.id ? (
					<div className="flex items-center w-full h-10">
						<Input
							className="rounded-sm border-0 bg-transparent focus-visible:border-0 focus-visible:ring-0"
							value={editItem?.title || ''}
							onChange={(e) => onChangeEditValue(e)}
							onClick={(e) => e.stopPropagation()}
							onCompositionStart={handleCompositionStart}
							onCompositionEnd={handleCompositionEnd}
							autoFocus
							onKeyDown={(e) => onKeyDown(e)}
							onBlur={(e) => onBlur(e)}
						/>
					</div>
				) : (
					<div className="flex flex-col mt-1">
						<div
							className="line-clamp-1 max-w-85 flex-1 text-sm [&_.markdown-body]:text-textcolor!"
							dangerouslySetInnerHTML={{
								__html: parser.render(
									item?.title || item.messages?.[0]?.content || '新对话',
								),
							}}
						/>
						<div className="text-xs text-textcolor/50 mt-1 mb-1.5">
							{formatDate(item.createdAt)}
						</div>
					</div>
				)}
				{editItem?.id === item.id ? (
					<div className="absolute right-2 items-center hidden group-hover:flex">
						<div
							className="bg-theme-background p-1 rounded-sm hover:bg-teal-500"
							onClick={(e) => onSubmitEdit(e)}
							onMouseDown={(e) => e.preventDefault()}
						>
							<Check size={18} />
						</div>
						<div
							className="bg-theme-background p-1 ml-2 rounded-sm hover:bg-orange-500"
							onClick={(e) => onCancelEdit(e)}
							onMouseDown={(e) => e.preventDefault()}
						>
							<X size={18} />
						</div>
					</div>
				) : (
					<div className="absolute right-2 items-center hidden group-hover:flex">
						<div
							className="bg-theme-background p-1 rounded-sm hover:bg-teal-500"
							onClick={(e) => onEdit(e, item)}
						>
							<SquarePen size={18} />
						</div>
						<div
							className="bg-theme-background p-1 ml-2 rounded-sm hover:bg-red-500"
							onClick={(e) => onDelete(e, item)}
						>
							<Trash2 size={18} />
						</div>
					</div>
				)}
			</div>
		);
	},
);

const SessionList = observer(({ open, onOpenChange }: IProps) => {
	const { chatStore } = useStore();
	const { clearChat, stopGenerating } = useChatCore();
	const { setIsSharing, clearAllCheckedMessages } = useChatCoreContext();
	const { theme: appTheme } = useTheme();

	const navigate = useNavigate();

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleteItem, setDeleteItem] = useState<Session | null>(null);
	const [editItem, setEditItem] = useState<Session | null>(null);

	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
			}),
		[appTheme],
	);

	useEffect(() => {
		if (open) {
			void chatStore.refreshHistorySessionList();
		} else {
			setEditItem(null);
		}
	}, [open, chatStore]);

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
			// 选择历史会话时，关闭分享
			setIsSharing(false);
			// 选择历史会话时要清空消息选中状态
			clearAllCheckedMessages();
			// 切换会话 loading：setActiveSessionId 会置 sessionChromeLoading，由 ChatBot 遮罩至首帧渲染完成
			chatStore.setActiveSessionId(session.id);
			chatStore.setAllMessages(session.messages || [], session.id, false);
			onOpenChange(false);
			navigate(`/chat/c/${session.id}`);
		},
		[chatStore, navigate],
	);

	const onEdit = useCallback(
		(e: React.MouseEvent<HTMLDivElement>, item: Session) => {
			e.stopPropagation();
			setEditItem({
				...item,
				title: item.title || item?.messages?.[0]?.content,
			});
		},
		[],
	);

	const onDelete = useCallback(
		(e: React.MouseEvent<HTMLDivElement>, item: Session) => {
			e.stopPropagation();
			setDeleteItem(item);
			setConfirmOpen(true);
		},
		[],
	);

	/**
	 * 性能：useMemo 依赖项若写 [...chatStore.loadingSessions]，每次 render 都是新数组引用，
	 * React 用 Object.is 比较会认为依赖变了，sessionList 的 useMemo 几乎永远重算，memo 形同虚设。
	 * 改成「当前加载中会话 id 排序后拼接」的字符串：只有集合内容变化时 key 才变，列表才重算；渲染结果一致。
	 */
	const loadingSessionsKey = [...chatStore.loadingSessions].sort().join('|');

	const sessionList = useMemo(() => {
		return chatStore.sessionData.list.map((item) => (
			<SessionItem
				key={item.id}
				item={item}
				editItem={editItem}
				setEditItem={setEditItem}
				isActive={chatStore.activeSessionId === item.id}
				isLoading={chatStore.loadingSessions.has(item.id)}
				onSelect={onSelectSession}
				onDelete={onDelete}
				onEdit={onEdit}
				parser={parser}
			/>
		));
		// loadingSessionsKey 替代原 [...loadingSessions] 数组依赖，见上方说明
	}, [
		chatStore.sessionData.list,
		chatStore.activeSessionId,
		loadingSessionsKey,
		onSelectSession,
		onDelete,
		parser,
		editItem,
		setEditItem,
	]);

	const { sessionData, historySessionLoading, historySessionLoadingMore } =
		chatStore;
	const list = sessionData.list;
	const showInitialPlaceholder = historySessionLoading && list.length === 0;
	const showLoadMoreHint = historySessionLoadingMore;
	const showEmptyHint =
		!historySessionLoading && list.length === 0 && !historySessionLoadingMore;

	return (
		<Drawer title="历史对话" open={open} onOpenChange={onOpenChange}>
			<ScrollArea
				className="h-full overflow-y-auto pr-2 box-border"
				onScroll={chatStore.onHistorySessionViewportScroll}
			>
				<div className="flex flex-col gap-0">
					{showInitialPlaceholder ? (
						<div className="text-sm text-textcolor/60 py-6 text-center">
							加载中…
						</div>
					) : null}
					{sessionList}
					{showLoadMoreHint ? (
						<div className="text-xs text-textcolor/50 py-2 text-center">
							加载更多…
						</div>
					) : null}
					{showEmptyHint ? (
						<div className="text-sm text-textcolor/60 py-8 text-center">
							暂无历史对话
						</div>
					) : null}
				</div>
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
});

export default SessionList;
