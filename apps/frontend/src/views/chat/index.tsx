import ChatEntry from '@design/ChatEntry';
import ShareChat from '@design/Share';
import { Button, Checkbox, Label } from '@ui/index';
import { History, Waypoints } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { useChatCoreContext } from '@/contexts';
import { useI18n } from '@/hooks';
import { useChatCore } from '@/hooks/useChatCore';
import { cn } from '@/lib/utils';
import { uploadFiles } from '@/service';
import useStore from '@/store';
import { FileWithPreview, UploadedFile } from '@/types';
import { resolveUploadedFileUrl } from '@/utils';
import SessionList from './session-list';

// Chat 主组件
const Chat = observer(() => {
	const { chatStore } = useStore();
	const { t, locale } = useI18n();
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
							...res.data.map((item: UploadedFile) => {
								const fileUuid = uuidv4();
								return {
									...item,
									path: resolveUploadedFileUrl(item.path),
									uuid: fileUuid,
									id: item.id || fileUuid,
								};
							}),
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
			<div
				className={cn(
					'absolute top-4 left-29 z-50 flex items-center gap-3 text-theme',
					locale === 'zh-CN' ? 'left-29.5' : 'left-34.5',
				)}
			>
				<div className="lucide-stroke-draw-hover">
					{open ? (
						<History size={20} className="cursor-pointer text-teal-500 mt-px" />
					) : (
						<History
							size={20}
							className="cursor-pointer hover:text-teal-500 mt-px"
							onClick={() => setOpen(true)}
						/>
					)}
				</div>
				{params?.id && !chatStore.isCurrentSessionLoading && !isSharing && (
					<div className="lucide-stroke-draw-hover">
						<Waypoints
							size={20}
							className="cursor-pointer hover:text-teal-500"
							onClick={onShare}
						/>
					</div>
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
								{t('chat.share.selectAll')}
							</Label>
						</div>
						<div className="border-l border-textcolor/50 h-3" />
						<div>
							{t('chat.share.selectedPairs', {
								count: checkedMessages.size / 2,
							})}
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Button
							variant="outline"
							size="sm"
							className="border-theme"
							onClick={onCancelShare}
						>
							{t('common.cancel')}
						</Button>
						<Button
							variant="dynamic"
							size="sm"
							className="text-white border-theme bg-transparent hover:bg-transparent bg-linear-to-r from-teal-500 to-cyan-600"
							onClick={onShowShareModel}
						>
							{t('chat.share.createLink')}
						</Button>
					</div>
				</div>
			) : (
				<ChatEntry
					t={t}
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
				orderedMessageIds={getDisplayMessages().map((m) => m.chatId)}
			/>
		</div>
	);
});

export default Chat;
