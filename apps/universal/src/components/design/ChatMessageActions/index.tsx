import {
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Copy,
	PencilLine,
	RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from '@/types/chat';

/**
 * 消息操作组件的 Props 接口定义
 */
interface MessageActionsProps {
	/** 当前消息对象 */
	message: Message;
	/** 消息在列表中的索引 */
	index: number;
	/** 消息总数 */
	messagesLength?: number;
	/** 当前已复制成功的消息ID */
	isCopyedId?: string;
	/** 当前会话是否正在加载 */
	isLoading?: boolean;
	/** 分支切换回调 */
	onBranchChange?: (msgId: string, direction: 'prev' | 'next') => void;
	/** 复制回调 */
	onCopy: (content: string, chatId: string) => void;
	/** 编辑回调 */
	onEdit?: (message: Message) => void;
	/** 重新生成回调 */
	onReGenerate?: (index: number) => void;
}

/**
 * MessageActions 组件
 *
 * 用于显示消息底部的操作按钮，包括：
 * - 分支切换按钮（左右箭头和计数显示）
 * - 复制按钮
 * - 编辑按钮（仅用户消息显示）
 * - 重新生成按钮（仅助手消息显示）
 *
 * @param props - 组件属性
 * @returns 消息操作按钮组件
 */
export const MessageActions = ({
	message,
	index,
	messagesLength,
	isCopyedId,
	isLoading,
	onBranchChange,
	onCopy,
	onEdit,
	onReGenerate,
}: MessageActionsProps) => {
	// 是否有多个兄弟节点（分支）
	const hasSiblings = (message.siblingCount || 0) > 1;

	// 是否可以向前切换分支
	const canPrev = (message.siblingIndex || 0) > 0;

	// 是否可以向后切换分支
	const canNext = (message.siblingIndex || 0) < (message.siblingCount || 0) - 1;

	// 是否是最后一条消息
	const isLastMessage = index === (messagesLength || 0) - 1;

	// 是否显示操作按钮（非最后一条消息时 hover 显示，最后一条消息始终显示）
	const getActionsVisibilityClass = () => {
		if (isLastMessage) {
			return isLoading ? 'hidden' : 'flex items-center';
		}
		return `hidden ${isLoading ? 'group-hover:hidden' : 'group-hover:flex'}`;
	};

	return (
		<div
			className={`absolute bottom-2 right-2 h-5 w-fit flex items-center ${
				message.role === 'user' ? 'justify-end' : 'left-2'
			}`}
		>
			{/* 分支切换按钮区域 */}
			{hasSiblings && (
				<div
					className={`${
						message.role === 'user'
							? 'order-last ml-5 -mr-3.5'
							: 'order-first mr-5 -ml-3.5'
					} flex items-center gap-1 text-textcolor/70 select-none`}
				>
					{/* 向前切换按钮 */}
					<ChevronLeft
						size={22}
						className={cn(
							'cursor-pointer hover:text-textcolor',
							!canPrev &&
								'opacity-30 cursor-not-allowed hover:text-textcolor/60',
						)}
						onClick={() => {
							if (canPrev) {
								onBranchChange?.(message.chatId, 'prev');
							}
						}}
					/>

					{/* 分支计数显示 */}
					<span className="min-w-10 text-center">
						{(message.siblingIndex || 0) + 1} / {message.siblingCount}
					</span>

					{/* 向后切换按钮 */}
					<ChevronRight
						size={22}
						className={cn(
							'cursor-pointer hover:text-textcolor',
							!canNext &&
								'opacity-30 cursor-not-allowed hover:text-textcolor/60',
						)}
						onClick={() => {
							if (canNext) {
								onBranchChange?.(message.chatId, 'next');
							}
						}}
					/>
				</div>
			)}

			{/* 操作按钮区域（复制、编辑、重新生成） */}
			{message.content && onCopy && (
				<div
					className={`gap-3 text-textcolor/70 ${
						message.role === 'user' ? '-mr-2' : '-ml-2'
					} ${getActionsVisibilityClass()}`}
				>
					{/* 复制按钮 */}
					<div className="cursor-pointer flex items-center justify-center">
						{isCopyedId !== message.chatId ? (
							<Copy
								size={16}
								className="hover:text-textcolor"
								onClick={() => onCopy(message.content, message.chatId)}
							/>
						) : (
							<div className="flex items-center justify-center text-green-400 rounded-full box-border">
								<CheckCircle size={16} />
							</div>
						)}
					</div>

					{/* 编辑按钮 - 仅用户消息显示 */}
					{message.role === 'user' && onEdit && (
						<div className="cursor-pointer hover:text-textcolor mt-0.5">
							<PencilLine size={16} onClick={() => onEdit?.(message)} />
						</div>
					)}

					{/* 重新生成按钮 - 仅助手消息显示 */}
					{message.role !== 'user' && onReGenerate && (
						<div className="cursor-pointer hover:text-textcolor">
							<RotateCw size={16} onClick={() => onReGenerate?.(index)} />
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default MessageActions;
