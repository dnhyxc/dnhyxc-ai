import { useRef, useState } from 'react';
import { InsertNewlineParams, Message } from '@/types/chat';

interface UseChatInputOptions {
	input: string;
	setInput: (val: string) => void;
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
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>; // 新增：接收外部 ref
	isEdit?: boolean;
	loading?: boolean;
}

export const useEntry = ({
	isEdit = false,
	input,
	setInput,
	editMessage,
	handleEditChange,
	sendMessage,
	textareaRef,
}: UseChatInputOptions) => {
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const editInputRef = useRef<HTMLTextAreaElement>(null);
	const [isComposing, setIsComposing] = useState(false);

	const insertNewline = (params: InsertNewlineParams) => {
		const { e, isEdit, editMessage, input, setEditInputValue, setInputValue } =
			params;
		e.preventDefault();
		const textarea = e.currentTarget;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		if (isEdit) {
			const newValue = `${editMessage?.content?.substring(0, start)}\n${editMessage?.content?.substring(end)}`;
			setEditInputValue(newValue);
		} else {
			const newValue = `${input.substring(0, start)}\n${input.substring(end)}`;
			setInputValue(newValue);
		}

		// 移动光标到插入位置后
		textarea.selectionStart = textarea.selectionEnd = start + 1;
	};

	const handleCompositionStart = () => {
		setIsComposing(true);
	};

	const handleCompositionEnd = () => {
		setTimeout(() => {
			setIsComposing(false);
		}, 0);
	};

	const handleKeyDown = (
		e: React.KeyboardEvent<HTMLTextAreaElement>,
		message?: Message | null,
	) => {
		if (e.key === 'Enter') {
			const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey || e.altKey;
			const isCurrentlyComposing =
				(e.nativeEvent as KeyboardEvent).isComposing || isComposing;

			// 辅助函数：插入换行
			const doInsertNewline = () => {
				insertNewline({
					e,
					isEdit,
					editMessage,
					input,
					setInputValue: setInput,
					setEditInputValue: handleEditChange,
					textareaNode: textareaRef?.current || undefined, // 传递 ref 给工具函数
				});
			};

			if (isCurrentlyComposing) {
				if (e.ctrlKey || e.metaKey) {
					doInsertNewline();
				}
				return;
			}

			if (e.ctrlKey || e.metaKey || e.shiftKey) {
				doInsertNewline();
			} else if (!hasModifier) {
				e.preventDefault();
				if (isEdit) {
					// onSendMessage(message as Message);
					sendMessage(message?.content, undefined, true, message?.attachments);
				} else {
					console.log('-------------------');
					sendMessage();
				}
			}
		}
	};

	const getRef = () => (isEdit ? editInputRef : inputRef);

	return {
		inputRef,
		editInputRef,
		getRef,
		isComposing,
		handleKeyDown,
		handleCompositionStart,
		handleCompositionEnd,
	};
};
