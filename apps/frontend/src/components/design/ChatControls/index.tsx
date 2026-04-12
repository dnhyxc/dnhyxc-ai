import { Button } from '@ui/index';
import { Activity, ArrowDown, ArrowUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatScrollControlsProps {
	// 分支切换相关
	isLoading: boolean;
	isStreamingBranchVisible: boolean;
	isLatestBranch: boolean;
	messagesLength: number;
	switchToStreamingBranch: () => void;
	switchToLatestBranch: () => void;
	// 滚动控制相关
	hasScrollbar: boolean;
	isAtBottom: boolean;
	onScrollTo: (position: 'up' | 'down', behavior?: 'smooth' | 'auto') => void;
}

/** 与工具栏一致的毛玻璃：主题底 + 轻模糊 + oklch 混色阴影 */
const glassChipClass =
	'h-5 flex items-center justify-between gap-2 pl-3.5 pr-1 rounded-2xl bg-theme/5 border border-theme/5 backdrop-blur-[2px] transition-colors duration-200 z-99';

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
		(!isLatestBranch && messagesLength > 0);

	return (
		<div className="absolute right-[max(calc((100%-48rem)/2),0rem)] bottom-3 mx-auto">
			<div className="flex justify-end">
				{/* 分支切换按钮组 */}
				{showBranchButtons && (
					<div className="flex items-center justify-center">
						{/* 切换回流式消息分支的按钮 */}
						{isLoading && !isStreamingBranchVisible && (
							<Button
								variant="dynamic"
								onClick={switchToStreamingBranch}
								className={cn(
									glassChipClass,
									'min-h-8 text-sm text-cyan-500 hover:bg-theme/15',
								)}
							>
								<Sparkles />
								<span className="text-md">回到正在生成的分支</span>
							</Button>
						)}
						{/* 切换到最新分支的按钮 */}
						{!isLatestBranch && messagesLength > 0 && (
							<Button
								variant="dynamic"
								onClick={switchToLatestBranch}
								className={cn(
									glassChipClass,
									'min-h-8 text-sm text-teal-400 hover:bg-theme/15 ml-2',
								)}
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
						className="w-8.5 h-8.5 bg-theme/5 hover:bg-theme/15 text-textcolor/90 flex justify-center items-center cursor-pointer border border-theme/5 backdrop-blur-[2px] rounded-full ml-2 z-99"
						onClick={() => onScrollTo(isAtBottom ? 'up' : 'down', 'auto')}
					>
						{isAtBottom ? <ArrowUp /> : <ArrowDown />}
					</div>
				)}
			</div>
		</div>
	);
};

export default ChatControls;
