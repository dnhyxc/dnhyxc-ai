import { History } from 'lucide-react';
import { observer } from 'mobx-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import ChatEntry from '@/components/design/ChatEntry';
import { useChatCore } from '@/hooks/useChatCore';
import { uploadFiles } from '@/service';
import useStore from '@/store';
import { FileWithPreview, UploadedFile } from '@/types';
import SessionList from './session-list';

// Chat 主组件
const ChatContent = observer(() => {
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
	} = useChatCore();

	const navigate = useNavigate();

	const [open, setOpen] = useState(false);

	const chatInputRef = useRef<HTMLTextAreaElement>(null);
	const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			chatStore.setActiveSessionId('');
		};
	}, []);

	useEffect(() => {
		return () => {
			if (focusTimerRef.current) {
				clearTimeout(focusTimerRef.current);
			}
		};
	}, []);

	const onUploadFile = useCallback(
		async (data: FileWithPreview | FileWithPreview[]) => {
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
		},
		[setUploadedFiles],
	);

	const toNewChat = () => {
		clearChat();
		navigate('/chat');
	};

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

			<ChatEntry
				chatInputRef={chatInputRef}
				input={input}
				setInput={setInput}
				uploadedFiles={uploadedFiles}
				setUploadedFiles={setUploadedFiles}
				loading={chatStore.isCurrentSessionLoading}
				editMessage={editMessage}
				setEditMessage={setEditMessage}
				handleEditChange={handleEditChange}
				sendMessage={sendMessage}
				onUploadFile={onUploadFile as any}
				clearChat={toNewChat}
				stopGenerating={stopGenerating}
			/>

			<SessionList open={open} onOpenChange={setOpen} />
		</div>
	);
});

export default ChatContent;
