import { Button } from '@ui/button';
import { Activity, ArrowDown, ArrowUp, Sparkles } from 'lucide-react';

interface ChatScrollControlsProps {
	// 分支切换相关
	isLoading?: boolean;
	isStreamingBranchVisible?: boolean;
	isLatestBranch?: boolean;
	messagesLength?: number;
	switchToStreamingBranch?: () => void;
	switchToLatestBranch?: () => void;
	// 滚动控制相关
	hasScrollbar?: boolean;
	isAtBottom?: boolean;
	onScrollTo?: (position: 'up' | 'down', behavior?: 'smooth' | 'auto') => void;
}

const ChatControls = ({
	isLoading,
	isStreamingBranchVisible,
	isLatestBranch,
	messagesLength,
	switchToStreamingBranch,
	switchToLatestBranch,
	hasScrollbar,
	isAtBottom,
	onScrollTo,
}: ChatScrollControlsProps) => {
	// 是否显示分支切换按钮
	const showBranchButtons =
		(isLoading && !isStreamingBranchVisible) ||
		(!isLatestBranch && messagesLength && messagesLength > 0);

	return (
		<div className="absolute right-[max(calc((100%-48rem)/2),0rem)] bottom-3.5 mx-auto">
			<div className="flex justify-end">
				{/* 分支切换按钮组 */}
				{showBranchButtons && (
					<div className="flex items-center justify-center">
						{/* 切换回流式消息分支的按钮 */}
						{isLoading && !isStreamingBranchVisible && (
							<Button
								onClick={switchToStreamingBranch}
								className="min-w-8 h-8 text-sm bg-cyan-500/25 text-cyan-400 hover:bg-cyan-500/30 rounded-full transition-colors flex items-center"
							>
								<Sparkles />
								<span className="text-md">回到正在生成的分支</span>
							</Button>
						)}
						{/* 切换到最新分支的按钮 */}
						{!isLatestBranch && messagesLength && messagesLength > 0 && (
							<Button
								onClick={switchToLatestBranch}
								className="min-w-8 h-8 text-sm bg-green-500/25 text-green-400 hover:bg-green-500/30 rounded-full transition-colors flex items-center ml-2"
							>
								<Activity />
								<span className="text-md">回到最新分支</span>
							</Button>
						)}
					</div>
				)}

				{/* 滚动控制按钮 */}
				{hasScrollbar && (
					<div
						className="w-8 h-8 bg-black/10 hover:bg-black/25 text-black/90 flex justify-center items-center cursor-pointer border-black/10 rounded-full ml-2"
						onClick={() => onScrollTo?.(isAtBottom ? 'up' : 'down', 'auto')}
					>
						{isAtBottom ? <ArrowUp /> : <ArrowDown />}
					</div>
				)}
			</div>
		</div>
	);
};

export default ChatControls;
