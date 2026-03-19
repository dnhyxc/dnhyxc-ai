// components/ChatTextArea.tsx

import { Button } from '@ui/button';
import { Textarea } from '@ui/textarea';
import { forwardRef } from 'react';
import { useEntry } from '@/hooks/useEntry'; // 根据实际路径调整
import { Message } from '@/types/chat'; // 根据实际路径调整

interface ChatTextAreaProps {
	// 状态
	input: string;
	setInput: (val: string) => void;
	editMessage: Message | null;
	setEditMessage: (msg: Message | null) => void;
	loading: boolean;

	// 回调
	handleEditChange: (
		e: React.ChangeEvent<HTMLTextAreaElement> | string,
	) => void;
	sendMessage: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: any,
	) => void;

	// 模式：'chat' (底部输入框) | 'edit' (消息编辑模式)
	mode: 'chat' | 'edit';

	// 样式
	className?: string;
	placeholder?: string;
}

const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			input,
			setInput,
			editMessage,
			setEditMessage,
			loading,
			handleEditChange,
			sendMessage,
			mode,
			className,
			placeholder = '请输入您的问题',
		},
		ref,
	) => {
		const {
			// isComposing,
			handleKeyDown,
			handleCompositionStart,
			handleCompositionEnd,
		} = useEntry({
			isEdit: mode === 'edit',
			loading,
			input,
			setInput,
			editMessage,
			setEditMessage,
			handleEditChange,
			sendMessage,
			textareaRef: {
				current: ref,
			} as React.RefObject<HTMLTextAreaElement | null>,
		});

		const isEditMode = mode === 'edit';
		const value = isEditMode ? editMessage?.content || '' : input;

		return (
			<div className={`flex flex-col w-full ${className || ''}`}>
				<Textarea
					ref={ref}
					value={value}
					onChange={
						isEditMode ? handleEditChange : (e) => setInput(e.target.value)
					}
					onKeyDown={(e) => handleKeyDown(e, isEditMode ? editMessage : null)}
					onCompositionStart={handleCompositionStart}
					onCompositionEnd={handleCompositionEnd}
					placeholder={placeholder}
					spellCheck={false}
					className="flex-1 min-h-16 resize-none border-none shadow-none focus-visible:ring-transparent"
					disabled={loading}
				/>

				{isEditMode && (
					<div className="flex justify-end gap-2 mt-2">
						<Button variant="secondary" onClick={() => setEditMessage(null)}>
							取消
						</Button>
						<Button
							variant="secondary"
							onClick={() =>
								sendMessage(
									editMessage?.content || undefined,
									undefined,
									true,
									editMessage?.attachments,
								)
							}
							disabled={loading}
						>
							发送
						</Button>
					</div>
				)}
			</div>
		);
	},
);

ChatTextArea.displayName = 'ChatTextArea';

export default ChatTextArea;
