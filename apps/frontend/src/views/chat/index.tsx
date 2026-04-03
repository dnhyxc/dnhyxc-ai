import ChatEntry from '@design/ChatEntry';
import { Button, Checkbox, Label } from '@ui/index';
import { History, Waypoints } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { useChatCoreContext } from '@/contexts';
import { useChatCore } from '@/hooks/useChatCore';
import { uploadFiles } from '@/service';
import useStore from '@/store';
import { FileWithPreview, UploadedFile } from '@/types';
import SessionList from './session-list';
import ShareChat from './share';

// Chat 主组件
const Chat = observer(() => {
	const { chatStore } = useStore();
	const {
		input,
		setInput,
		uploadedFiles,
		setUploadedFiles,
		editMessage,
		setEditMessage,
		sendMessage,
		handleEditChange,
		clearChat,
		stopGenerating,
		getDisplayMessages,
		webSearchEnabled,
		setWebSearchEnabled,
	} = useChatCore();

	const navigate = useNavigate();
	const params = useParams();
	const location = useLocation();

	const {
		isSharing,
		setIsSharing,
		checkedMessages,
		setAllCheckedMessages,
		clearAllCheckedMessages,
		isAllChecked,
	} = useChatCoreContext();

	const [open, setOpen] = useState(false);
	const [shareModelVisible, setShareModelVisible] = useState(false);
	const [uploadLoading, setUploadLoading] = useState(false);

	const chatInputRef = useRef<HTMLTextAreaElement>(null);
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// 性能/正确性：不要把 chatInputRef.current 放进依赖。ref 变化不会触发重渲染，写在依赖里无效且易误导；
	useEffect(() => {
		chatInputRef.current?.focus();
	}, [location.pathname]);

	useEffect(() => {
		return () => {
			chatStore.setActiveSessionId('');
			setIsSharing(false);
			if (focusTimerRef.current) {
				clearTimeout(focusTimerRef.current);
			}
		};
	}, []);

	const onUploadFile = useCallback(
		async (data: FileWithPreview | FileWithPreview[]) => {
			try {
				setUploadLoading(true);
				const files = Array.isArray(data) ? data : [data];
				const fileList = files.map((item) => item.file);
				const res = await uploadFiles(fileList);
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
			} finally {
				setUploadLoading(false);
			}
		},
		[setUploadedFiles],
	);

	const toNewChat = () => {
		clearChat();
		setIsSharing(false);
		navigate('/chat');
	};

	const onCancelShare = () => {
		setIsSharing(false);
		clearAllCheckedMessages();
	};

	const onCheckedChange = () => {
		// 获取当前显示的消息列表（根据分支选择过滤后的）
		const displayMessages = getDisplayMessages();
		// 检查是否已全选
		if (isAllChecked(displayMessages)) {
			// 已全选，则取消全选
			clearAllCheckedMessages();
		} else {
			// 未全选，则全选当前显示的消息
			setAllCheckedMessages(displayMessages);
		}
	};

	const onShowShareModel = () => {
		setShareModelVisible(true);
	};

	// 关闭分享弹窗时清空分享状态及选中的对话
	const onCloseShareModel = () => {
		setShareModelVisible(false);
		setIsSharing(false);
		clearAllCheckedMessages();
	};

	const onShare = () => {
		setIsSharing(true);
		const displayMessages = getDisplayMessages();
		setAllCheckedMessages(displayMessages);
	};

	return (
		<div className="flex flex-col w-full h-full overflow-hidden rounded-b-md">
			<div className="absolute top-4 left-28 z-50 flex items-center gap-3">
				{open ? (
					<History size={20} className="cursor-pointer text-cyan-500" />
				) : (
					<History
						size={20}
						className="cursor-pointer hover:text-blue-500"
						onClick={() => setOpen(true)}
					/>
				)}
				{params?.id && !chatStore.isCurrentSessionLoading && !isSharing && (
					<Waypoints
						size={20}
						className="cursor-pointer hover:text-blue-500"
						onClick={onShare}
					/>
				)}
			</div>

			<Outlet />

			{isSharing ? (
				<div className="w-full flex justify-between items-center max-w-3xl mx-auto mb-5">
					<div className="flex-1 flex items-center gap-3 text-textcolor/80">
						<div className="flex items-center">
							<Checkbox
								id="terms"
								checked={isAllChecked(getDisplayMessages())}
								onCheckedChange={onCheckedChange}
								className="cursor-pointer border-textcolor/60"
							/>
							<Label htmlFor="terms" className="cursor-pointer ml-2 text-md">
								全选
							</Label>
						</div>
						<div className="border-l border-textcolor/50 h-3" />
						<div>已选择 {checkedMessages.size / 2} 组对话</div>
					</div>
					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							size="sm"
							className="border-textcolor/30 pt-0.5"
							onClick={onCancelShare}
						>
							取消
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="border-textcolor/30 pt-0.5 bg-transparent hover:bg-transparent bg-linear-to-r from-teal-500/80 to-cyan-600/80 hover:from-teal-500 hover:to-cyan-600"
							onClick={onShowShareModel}
						>
							创建分享链接
						</Button>
					</div>
				</div>
			) : (
				<ChatEntry
					chatInputRef={chatInputRef}
					input={input}
					setInput={setInput}
					uploadedFiles={uploadedFiles}
					uploadLoading={uploadLoading}
					setUploadedFiles={setUploadedFiles}
					loading={chatStore.isCurrentSessionLoading}
					editMessage={editMessage}
					setEditMessage={setEditMessage}
					handleEditChange={handleEditChange}
					sendMessage={sendMessage}
					onUploadFile={onUploadFile}
					clearChat={toNewChat}
					stopGenerating={stopGenerating}
					webSearchEnabled={webSearchEnabled}
					onWebSearchEnabledChange={setWebSearchEnabled}
				/>
			)}

			<SessionList open={open} onOpenChange={setOpen} />

			<ShareChat
				open={shareModelVisible}
				onOpenChange={onCloseShareModel}
				checkedMessages={checkedMessages}
			/>
		</div>
	);
});

export default Chat;
