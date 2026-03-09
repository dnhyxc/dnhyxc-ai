import ChatFileList from '@design/ChatFileList'; // 根据实际路径调整，原代码是 ./FileInfo
import ChatTextArea from '@design/ChatTextArea';
import Upload from '@design/Upload';
import { Button } from '@ui/index';
import {
	Activity,
	CirclePlus,
	Link,
	Rocket,
	Sparkles,
	StopCircle,
} from 'lucide-react';
import { FileWithPreview, UploadedFile } from '@/types'; // 根据实际路径调整
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
	clearChat: () => void;
	stopGenerating: () => void;
	messages: Message[];
	isStreamingBranchVisible: () => boolean;
	isLatestBranch: () => boolean;
	switchToLatestBranch: () => void;
	switchToStreamingBranch: () => void;
	chatInputRef?: React.RefObject<HTMLTextAreaElement | null>; // 新增
	children?: React.ReactNode;
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
	messages,
	isStreamingBranchVisible,
	isLatestBranch,
	switchToLatestBranch,
	switchToStreamingBranch,
}) => {
	return (
		<div className="relative p-5.5 pt-5 backdrop-blur-sm">
			<div className="max-w-3xl mx-auto flex">
				<div className="flex-1 relative">
					{/* 分支切换按钮区域 */}
					{children ||
						((loading && !isStreamingBranchVisible()) ||
						(!isLatestBranch() && messages.length > 0) ? (
							<div className="absolute -top-[47px] right-0 mb-5 z-10">
								<div className="gap-3 flex items-center justify-center">
									{/* 切换回流式消息分支的按钮 */}
									{loading && !isStreamingBranchVisible() && (
										<Button
											onClick={switchToStreamingBranch}
											className="min-w-8 h-8 text-sm bg-cyan-500/25 text-cyan-400 rounded-full hover:bg-cyan-500/30 transition-colors flex items-center gap-2"
										>
											<Sparkles />
											<span className="text-xs">回到正在生成的分支</span>
										</Button>
									)}
									{/* 切换到最新分支的按钮 */}
									{!isLatestBranch() && messages.length > 0 && (
										<Button
											onClick={switchToLatestBranch}
											className="min-w-8 h-8 text-sm bg-green-500/25 text-green-400 rounded-full hover:bg-green-500/30 transition-colors flex items-center gap-2"
										>
											<Activity />
											<span className="text-xs">回到最新分支</span>
										</Button>
									)}
								</div>
							</div>
						) : null)}
					<div className="flex flex-col overflow-y-auto rounded-md bg-theme/5 border border-theme-white/10">
						{uploadedFiles?.length > 0 ? (
							<>
								<div className="my-2.5 mx-3 text-sm text-textcolor/70">
									只识别附件中的文字
								</div>
								<div className="w-full flex flex-wrap gap-3 px-3 mb-2">
									{uploadedFiles.map((i, index) => (
										<ChatFileList
											key={i.id || index}
											data={i}
											showDelete
											setUploadedFiles={setUploadedFiles}
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
								<Button
									variant="ghost"
									className="flex items-center text-sm bg-theme/5 mb-1 h-8 rounded-md"
									onClick={clearChat}
								>
									<CirclePlus className="w-4 h-4" />
									新对话
								</Button>
								<Upload
									uploadType="button"
									className="w-auto h-auto"
									maxSize={20 * 1024 * 1024}
									multiple
									countValidText="最多只能支持 5 个文件"
									uploadedCount={uploadedFiles?.length}
									disabled={uploadedFiles?.length >= 5}
									validTypes={[
										'application/pdf',
										'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
										'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
									]}
									showTooltip
									tooltipContent="仅支持 PDF、DOCX、XLSX 格式，最多同时支持 5 个文件，每个文件最大 20 MB"
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
									onClick={stopGenerating}
									className="h-8 w-8 mb-1 flex items-center justify-center rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
								>
									<StopCircle />
								</Button>
							) : (
								<Button
									variant="ghost"
									onClick={() => sendMessage()}
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
