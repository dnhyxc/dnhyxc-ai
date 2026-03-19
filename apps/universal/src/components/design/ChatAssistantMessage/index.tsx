import MarkdownPreview from '@design/Markdown';
import { Spinner } from '@ui/spinner';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Message } from '@/types/chat';

interface AssistantMessageProps {
	message: Message;
	isShowThinkContent: boolean;
	onToggleThinkContent: () => void;
	onContinue: () => void;
}

const ChatAssistantMessage = ({
	message,
	isShowThinkContent,
	onToggleThinkContent,
	onContinue,
}: AssistantMessageProps) => {
	return (
		<div className="w-full h-auto">
			{/* 思考过程区域 */}
			<div className="w-full">
				{message?.thinkContent ? (
					<div
						className="mb-2 flex items-center cursor-pointer select-none"
						onClick={onToggleThinkContent}
					>
						思考过程
						{isShowThinkContent ? (
							<ChevronDown size={20} className="ml-2 mt-0.5" />
						) : (
							<ChevronRight size={20} className="ml-2 mt-0.5" />
						)}
					</div>
				) : null}
				{message.thinkContent && isShowThinkContent && (
					<MarkdownPreview
						value={message.thinkContent || '思考中...'}
						theme="dark"
						className="h-auto p-0"
						background="transparent"
						padding="0"
					/>
				)}
			</div>

			{/* 主要内容区域 */}
			<MarkdownPreview
				value={message.content || (message?.thinkContent ? '' : '思考中...')}
				theme="dark"
				className="h-auto p-0"
				background="transparent"
				padding="0"
			/>

			{/* 流式生成状态 */}
			{message.isStreaming && (
				<div className="mt-1 flex items-center">
					<Spinner className="w-4 h-4 mr-2 text-textcolor/50" />
					<span className="text-sm text-textcolor/50">正在生成中...</span>
				</div>
			)}

			{/* 停止生成后的继续按钮 */}
			{message.isStopped && (
				<div className="flex items-center justify-end">
					<div
						className="cursor-pointer text-sm text-cyan-400 hover:text-cyan-300 select-none"
						onClick={onContinue}
					>
						继续生成
					</div>
				</div>
			)}
		</div>
	);
};

export default ChatAssistantMessage;
