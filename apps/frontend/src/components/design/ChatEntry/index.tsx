import ChatFileList from '@design/ChatFileList';
import ChatTextArea from '@design/ChatTextArea';
import Upload from '@design/Upload';
import { Button, ScrollArea, ScrollBar } from '@ui/index';
import {
	ChevronFirst,
	ChevronLast,
	CirclePlus,
	Link,
	Rocket,
	StopCircle,
} from 'lucide-react';
import { useRef } from 'react';
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
}) => {
	const scrollContainer = useRef<HTMLDivElement>(null);
	return (
		<div className={cn('relative p-5.5 pt-0 backdrop-blur-sm', className)}>
			<div className="max-w-3xl mx-auto flex">
				<div className="flex-1 relative">
					{children}
					<div className="max-w-3xl flex flex-col overflow-y-auto rounded-md bg-theme/2 border border-theme-white/5">
						{uploadedFiles?.length > 0 ? (
							<div className="flex flex-1 flex-col rounded-md">
								<div className="mt-2.5 mb-0.5 px-3 text-sm text-textcolor/70">
									只识别附件中的文字
								</div>
								<div className="w-full px-3 group">
									<ScrollArea
										ref={scrollContainer}
										className="relative max-w-3xl rounded-md"
									>
										<div className="flex items-center rounded-md">
											<Button
												type="button"
												onClick={() =>
													scrollContainer.current?.scrollBy?.({
														left: -200,
														behavior: 'smooth',
													})
												}
												className="hidden group-hover:flex items-center absolute left-0 top-3 w-6 h-14 rounded-md z-10 bg-theme-background/5 hover:bg-theme-background/60 p-2 shadow-md"
											>
												<ChevronFirst className="text-textcolor" />
											</Button>
											<div className="flex mb-2">
												{uploadedFiles.map((i, index) => (
													<ChatFileList
														key={i.id || index}
														data={i}
														showDelete
														setUploadedFiles={setUploadedFiles}
														className={cn('mt-3 shrink-0', 'mr-3 last:mr-0')}
													/>
												))}
											</div>
											<Button
												type="button"
												onClick={() =>
													scrollContainer.current?.scrollBy?.({
														left: 200,
														behavior: 'smooth',
													})
												}
												className="hidden group-hover:flex items-center absolute right-0 top-3 z-10 w-6 h-14 rounded-md bg-theme-background/5 hover:bg-theme-background/60 p-2 shadow-md"
											>
												<ChevronLast className="text-textcolor" />
											</Button>
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
							</div>
							{loading ? (
								<Button
									variant="ghost"
									onClick={() => stopGenerating?.()}
									className="h-8 w-8 mb-1 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
								>
									<StopCircle />
								</Button>
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
