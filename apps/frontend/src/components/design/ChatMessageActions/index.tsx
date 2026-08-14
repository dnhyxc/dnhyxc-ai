import { Checkbox, Toast } from '@ui/index';
import {
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Copy,
	LayersPlus,
	PencilLine,
	RotateCw,
	Share2,
	Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatI18nT, Message } from '@/types/chat';
import { isPlaybackAvailable } from '@/utils/speech';

/**
 * 消息操作组件的 Props 接口定义
 */
interface MessageActionsProps {
	/** 当前消息对象 */
	message: Message;
	/** 消息在列表中的索引 */
	index: number;
	/** 消息总数 */
	messagesLength: number;
	/** 当前已复制成功的消息ID */
	isCopyedId: string;
	/** 当前会话是否正在加载 */
	isLoading?: boolean;
	needShare?: boolean;
	needSave?: boolean;
	/** 分支切换回调 */
	onBranchChange?: (msgId: string, direction: 'prev' | 'next') => void;
	/** 复制回调 */
	onCopy?: (content: string, chatId: string) => void;
	/** 编辑回调 */
	onEdit?: (message: Message) => void;
	/** 重新生成回调 */
	onReGenerate?: (index: number) => void;
	onShare?: (message: Message) => void;
	isSharing?: boolean;
	checkedMessages?: Set<string>;
	setCheckedMessage?: (message: Message) => void;
	deleteCheckedMessage?: (message: Message) => void;
	/** 将助手回复写入知识库草稿（由 ChatBot 注入后跳转知识页） */
	onSaveToKnowledge?: (message: Message) => void;
	/**
	 * 朗读整条助手消息正文（与选区朗读同一套 TTS / 悬浮条）。
	 * 不传则不展示；仅 `role !== 'user'` 时渲染，且位于分享按钮之后。
	 */
	onSpeakContent?: (content: string) => void;
	/** i18n 翻译函数（可选）；不传则沿用组件内默认中文文案 */
	t?: ChatI18nT;
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
	onShare,
	isSharing,
	checkedMessages,
	setCheckedMessage,
	onSaveToKnowledge,
	onSpeakContent,
	needShare = true,
	needSave = true,
	t,
}: MessageActionsProps) => {
	// 是否有多个兄弟节点（分支）
	const hasSiblings = (message.siblingCount || 0) > 1;

	// 是否可以向前切换分支
	const canPrev = (message.siblingIndex || 0) > 0;

	// 是否可以向后切换分支
	const canNext = (message.siblingIndex || 0) < (message.siblingCount || 0) - 1;

	// 是否是最后一条消息
	const isLastMessage = index === messagesLength - 1;

	// 判断是否是倒数第二条消息
	const isSecondToLastMessage = index === messagesLength - 2;

	const onCheckShare = (message: Message) => {
		setCheckedMessage?.(message);
		onShare?.(message);
	};

	const onCheckedMessage = (message: Message) => {
		setCheckedMessage?.(message);
	};

	const onSpeak = () => {
		const text = (message.content ?? '').trim();
		if (!text || !onSpeakContent) return;
		if (!isPlaybackAvailable()) {
			Toast({
				type: 'warning',
				title: t?.('assistant.tts.unsupported') ?? '朗读不可用',
			});
			return;
		}
		onSpeakContent(text);
	};

	return (
		<div
			className={cn(
				'absolute bottom-2 flex h-5 w-fit items-center',
				message.role === 'user'
					? 'right-2 justify-end'
					: 'left-2 justify-start',
			)}
		>
			{isSharing && (
				<div
					className={`${
						message.role === 'user'
							? 'order-last ml-5 -mr-2'
							: 'order-first mr-5 -ml-2'
					} mt-0.5`}
				>
					<Checkbox
						id={message.chatId}
						className="cursor-pointer border-textcolor/60"
						checked={checkedMessages?.has(message.chatId)}
						onCheckedChange={() => onCheckedMessage(message)}
					/>
				</div>
			)}

			{/* 分支切换按钮区域；data 供 ChatBotView 在切换兄弟后钉住视口位置 */}
			{hasSiblings && !isSharing && (
				<div
					data-message-branch-anchor
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
			{message.content && !isSharing && (
				<div
					className={`gap-3 text-textcolor/70 ${
						message.role === 'user' ? '-mr-2' : '-ml-2'
					} ${isSecondToLastMessage || isLastMessage ? (isLastMessage && isLoading ? 'hidden' : 'flex items-center') : 'hidden group-hover:flex'}`}
				>
					{/* 复制按钮 */}
					<div className="cursor-pointer flex items-center justify-center">
						{isCopyedId !== message.chatId ? (
							<Copy
								size={16}
								className="hover:text-textcolor"
								onClick={() => onCopy?.(message.content, message.chatId)}
							/>
						) : (
							<div className="flex items-center justify-center text-teal-400 rounded-full box-border">
								<CheckCircle size={16} />
							</div>
						)}
					</div>

					{/* 编辑按钮 - 仅用户消息显示 */}
					{onEdit && message.role === 'user' && !isLoading && !isSharing && (
						<div className="cursor-pointer hover:text-textcolor mt-0.5">
							<PencilLine size={16} onClick={() => onEdit?.(message)} />
						</div>
					)}

					{/* 重新生成按钮 - 仅助手消息显示 */}
					{onReGenerate &&
						message.role !== 'user' &&
						!isLoading &&
						!isSharing && (
							<div className="cursor-pointer hover:text-textcolor">
								<RotateCw size={16} onClick={() => onReGenerate?.(index)} />
							</div>
						)}

					{needSave &&
						onSaveToKnowledge &&
						message.role !== 'user' &&
						!isLoading &&
						!isSharing && (
							<div
								className="cursor-pointer hover:text-textcolor"
								title={
									t?.('chat.messageActions.saveToKnowledge') ?? '保存到知识库'
								}
							>
								<LayersPlus
									size={16}
									onClick={() => onSaveToKnowledge(message)}
								/>
							</div>
						)}

					{needShare &&
						message.role !== 'user' &&
						!isLoading &&
						!isSharing &&
						onShare && (
							<div
								className="cursor-pointer hover:text-textcolor"
								title={t?.('chat.messageActions.shareAnswer') ?? '分享此回答'}
							>
								<Share2 size={16} onClick={() => onCheckShare(message)} />
							</div>
						)}

					{/* 朗读整条 AI 消息 — 传入 onSpeakContent 才显示，放在分享之后 */}
					{onSpeakContent &&
						message.role !== 'user' &&
						!isLoading &&
						!isSharing && (
							<div
								className="cursor-pointer hover:text-textcolor"
								title={t?.('assistant.selection.speak') ?? '朗读内容'}
							>
								<Volume2 size={18} onClick={onSpeak} />
							</div>
						)}
				</div>
			)}
		</div>
	);
};

export default MessageActions;
