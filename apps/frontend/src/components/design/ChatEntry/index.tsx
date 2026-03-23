import ChatFileList from '@design/ChatFileList';
import ChatTextArea from '@design/ChatTextArea';
import Upload from '@design/Upload';
import { Button } from '@ui/index';
import { CirclePlus, Link, Rocket, StopCircle } from 'lucide-react';
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
	return (
		<div className={cn('relative p-5.5 pt-0 backdrop-blur-sm', className)}>
			<div className="max-w-3xl mx-auto flex">
				<div className="flex-1 relative">
					{children}
					<div className="flex flex-col overflow-y-auto rounded-md bg-theme/2 border border-theme-white/5">
						{uploadedFiles?.length > 0 ? (
							<>
								<div className="mt-2.5 mb-0.5 mx-3 text-sm text-textcolor/70">
									只识别附件中的文字
								</div>
								<div className="w-full flex flex-wrap px-3 mb-2">
									{uploadedFiles.map((i, index) => (
										<ChatFileList
											key={i.id || index}
											data={i}
											showDelete
											setUploadedFiles={setUploadedFiles}
											className="mr-3 mt-3"
										/>
									))}
								</div>
							</>
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
