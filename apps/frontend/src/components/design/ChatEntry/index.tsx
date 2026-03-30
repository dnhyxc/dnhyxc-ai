import ChatFileList from '@design/ChatFileList';
import ChatTextArea from '@design/ChatTextArea';
import Upload from '@design/Upload';
import { Button, ScrollArea, ScrollBar } from '@ui/index';
import {
	ChevronFirst,
	ChevronLast,
	CirclePlus,
	Globe,
	Link,
	Rocket,
	Target,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { CHAT_VALIDTYPES } from '@/constant';
import { cn } from '@/lib/utils';
import { FileWithPreview, UploadedFile } from '@/types';
import { Message } from '@/types/chat';

interface ChatEntryProps {
	input: string;
	setInput: (val: string) => void;
	uploadedFiles: UploadedFile[];
	setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
	loading: boolean;
	editMessage: Message | null;
	setEditMessage: (msg: Message | null) => void;
	handleEditChange: (
		e: React.ChangeEvent<HTMLTextAreaElement> | string,
	) => void;
	sendMessage: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: any,
	) => void;
	onUploadFile: (data: FileWithPreview | FileWithPreview[]) => Promise<void>;
	clearChat?: () => void;
	stopGenerating?: () => void;
	chatInputRef?: React.RefObject<HTMLTextAreaElement | null>; // 新增
	children?: React.ReactNode;
	className?: string;
	uploadLoading?: boolean;
	/** 是否启用 Serper 联网搜索（由后端注入检索上下文） */
	webSearchEnabled?: boolean;
	onWebSearchEnabledChange?: (enabled: boolean) => void;
}

const ChatEntry: React.FC<ChatEntryProps> = ({
	input,
	setInput,
	uploadedFiles,
	setUploadedFiles,
	loading,
	editMessage,
	setEditMessage,
	handleEditChange,
	sendMessage,
	onUploadFile,
	clearChat,
	stopGenerating,
	chatInputRef,
	children,
	className,
	uploadLoading,
	webSearchEnabled = false,
	onWebSearchEnabledChange,
}) => {
	const scrollContainer = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
	// 记录当前聚焦/锚点的索引，初始为 0
	const [currentIndex, setCurrentIndex] = useState(0);
	// 新增：记录滚动位置状态 (用于禁用判断)
	const [scrollState, setScrollState] = useState({
		left: 0,
		width: 0,
		clientWidth: 0,
	});

	/**
	 * 动态计算当前索引 & 更新滚动位置状态
	 */
	const handleScrollUpdate = () => {
		const container = scrollContainer.current;
		if (!container) return;

		// 更新所有滚动相关状态
		setScrollState({
			left: container.scrollLeft,
			width: container.scrollWidth,
			clientWidth: container.clientWidth,
		});

		// ... 锚点索引计算逻辑保持不变 ...
		const containerLeft = container.getBoundingClientRect().left;
		for (let i = 0; i < itemRefs.current.length; i++) {
			const node = itemRefs.current[i];
			if (node) {
				const rect = node.getBoundingClientRect();
				if (rect.left >= containerLeft - 1) {
					setCurrentIndex(i);
					return;
				}
			}
		}
		if (itemRefs.current.length > 0) {
			setCurrentIndex(itemRefs.current.length - 1);
		}
	};

	const onJumpTo = useCallback(
		(position: 'left' | 'right') => {
			if (position === 'left') {
				const nextIndex = currentIndex - 1;
				setCurrentIndex(nextIndex);
				const targetNode = itemRefs.current[nextIndex];
				if (targetNode) {
					// scrollIntoView 是最简单的锚点实现方式
					// block: 'nearest' 防止垂直滚动，inline: 'start' 强制左对齐
					targetNode.scrollIntoView({
						behavior: 'smooth',
						inline: 'start',
						block: 'nearest',
					});
				}
			} else {
				const nextIndex = currentIndex + 1;
				setCurrentIndex(nextIndex);
				const targetNode = itemRefs.current[nextIndex];
				if (targetNode) {
					// 将目标元素移动到最左侧
					targetNode.scrollIntoView({
						behavior: 'smooth',
						inline: 'start',
						block: 'nearest',
					});
				}
			}
		},
		[currentIndex],
	);

	// 计算是否可以继续滚动
	// scrollLeft 为 0 表示在最左侧，scrollLeft + clientWidth >= scrollWidth 表示在最右侧 (允许 1px 误差)
	const isAtStart = scrollState.left <= 0;
	const isAtEnd =
		scrollState.width > scrollState.clientWidth &&
		scrollState.left + scrollState.clientWidth >= scrollState.width - 1;

	return (
		<div className={cn('relative p-5.5 pt-0 backdrop-blur-sm', className)}>
			<div className="max-w-3xl mx-auto flex">
				<div className="flex-1 relative">
					{children}
					<div className="max-w-3xl flex flex-col overflow-y-auto rounded-md bg-theme/2 border border-theme-white/5">
						{uploadedFiles?.length > 0 ? (
							<div className="flex flex-1 flex-col rounded-md">
								<div className="flex justify-between items-center mt-2.5 mb-0.5 px-3 text-sm text-textcolor/70">
									只识别附件中的文字
									<div className="flex gap-3">
										<Button
											disabled={isAtStart}
											onClick={() => onJumpTo('left')}
											className={cn(
												'items-center w-6 h-6 rounded-md bg-theme/5 hover:bg-theme/20 p-2 shadow-md',
											)}
										>
											<ChevronFirst className="text-textcolor" />
										</Button>
										{/* 右侧箭头：点击后，将下一个元素滚动到最左侧 */}
										<Button
											disabled={isAtEnd}
											onClick={() => onJumpTo('right')}
											className={cn(
												'items-center w-6 h-6 rounded-md bg-theme/5 hover:bg-theme/20 p-2 shadow-md',
											)}
										>
											<ChevronLast className="text-textcolor" />
										</Button>
									</div>
								</div>
								<div className="w-full px-3 group">
									<ScrollArea
										ref={scrollContainer}
										className="relative max-w-3xl rounded-md"
										onScroll={handleScrollUpdate}
									>
										<div className="flex items-center rounded-md">
											{/* 左侧箭头：点击后，将上一个元素滚动到最左侧 */}

											<div className="flex mb-2 gap-3">
												{uploadedFiles.map((i, index) => (
													<div
														key={i.id || index}
														ref={(el) => {
															itemRefs.current[index] = el;
														}}
													>
														<ChatFileList
															data={i}
															showDelete
															setUploadedFiles={setUploadedFiles}
															className="mt-3 shrink-0"
														/>
													</div>
												))}
											</div>
										</div>
										<ScrollBar orientation="horizontal" />
									</ScrollArea>
								</div>
							</div>
						) : null}

						{/* 复用 ChatTextArea 组件 */}
						<ChatTextArea
							ref={chatInputRef}
							mode="chat"
							input={input}
							setInput={setInput}
							editMessage={editMessage}
							setEditMessage={setEditMessage}
							loading={loading}
							handleEditChange={handleEditChange}
							sendMessage={sendMessage}
						/>

						<div className="flex items-center justify-between h-10 p-2.5 mb-1 mt-2.5">
							<div className="flex items-center gap-2">
								{clearChat && (
									<Button
										variant="ghost"
										className="flex items-center text-sm bg-theme/5 mb-1 h-8 rounded-md"
										onClick={clearChat}
									>
										<CirclePlus className="w-4 h-4" />
										新对话
									</Button>
								)}
								<Upload
									uploadType="button"
									className="w-auto h-auto"
									maxSize={20 * 1024 * 1024}
									multiple
									countValidText="最多只能支持 5 个文件"
									uploadedCount={uploadedFiles?.length}
									disabled={uploadedFiles?.length >= 5 || uploadLoading}
									loading={uploadLoading}
									validTypes={CHAT_VALIDTYPES}
									showTooltip
									tooltipContent={
										<div className="flex flex-col gap-1.5">
											<div>
												仅支持 PDF、DOCX、XLSX、PNG、JPG、JPEG、WEBP 格式！
											</div>
											<div>最多同时支持 5 个文件，每个文件最大 20 MB！</div>
										</div>
									}
									onUpload={onUploadFile}
								>
									<div className="flex items-center">
										<Link className="w-4 h-4 mr-2" />
										上传附件
									</div>
								</Upload>
								{onWebSearchEnabledChange ? (
									<Button
										type="button"
										variant="ghost"
										aria-pressed={webSearchEnabled}
										aria-label="联网搜索"
										disabled={loading}
										onClick={() => onWebSearchEnabledChange(!webSearchEnabled)}
										className={cn(
											'mb-1 h-8 shrink-0 gap-1.5 rounded-md px-2.5 text-sm',
											webSearchEnabled
												? 'border border-theme/40 bg-linear-to-r from-blue-500/20 to-cyan-500/20 text-textcolor hover:from-blue-500/30 hover:to-cyan-500/30'
												: 'border border-transparent bg-theme/5 bg-linear-to-r text-textcolor/80 hover:from-blue-500/30 hover:to-cyan-500/30 hover:text-textcolor',
										)}
									>
										<Globe className="h-3.5 w-3.5 shrink-0" />
										联网搜索
									</Button>
								) : null}
							</div>
							{loading ? (
								<span
									className={cn(
										'inline-flex mb-1 h-8 w-8 items-center justify-center rounded-full',
										'animate-chat-stop-breathe motion-reduce:animate-none',
									)}
								>
									<Button
										variant="ghost"
										onClick={() => stopGenerating?.()}
										className="p-0 h-8 w-8 flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/20 text-red-500 hover:bg-red-500/30 hover:text-red-500 shadow-none"
									>
										<Target
											className={cn(
												'h-4 w-4 shrink-0 text-red-500/60',
												'animate-chat-stop-icon-breathe motion-reduce:animate-none',
											)}
										/>
									</Button>
								</span>
							) : (
								<Button
									variant="ghost"
									onClick={() => {
										sendMessage();
										chatInputRef?.current?.focus();
									}}
									disabled={!input.trim()}
									className="h-8 w-8 mb-1 flex items-center justify-center rounded-full bg-linear-to-r from-blue-500 to-cyan-500"
								>
									<Rocket className="-rotate-45" />
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ChatEntry;
