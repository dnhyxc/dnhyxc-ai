// components/ChatTextArea.tsx

import { Button, ScrollArea, Textarea } from '@ui/index';
import React, { forwardRef, useLayoutEffect, useRef } from 'react';
import { useEntry } from '@/hooks/useEntry'; // 根据实际路径调整
import { cn } from '@/lib/utils';
import { ChatI18nT, Message } from '@/types/chat'; // 根据实际路径调整

interface ChatTextAreaProps {
	// 状态
	input?: string;
	setInput?: (val: string) => void;
	editMessage?: Message | null;
	setEditMessage?: (msg: Message | null) => void;
	loading?: boolean;

	// 回调
	handleEditChange?: (
		e: React.ChangeEvent<HTMLTextAreaElement> | string,
	) => void;
	sendMessage?: (
		content?: string,
		index?: number,
		isEdit?: boolean,
		attachments?: any,
	) => void;
	// 模式：'chat' (底部输入框) | 'edit' (消息编辑模式)
	mode?: 'chat' | 'edit';
	// 样式
	className?: string;
	placeholder?: string;
	/** 文本域样式 */
	textareaClassName?: string;
	/** 为 true 时禁用输入（仅 chat 模式；如知识库要求左侧编辑器先有正文） */
	disableTextInput?: boolean;
	/** i18n 翻译函数（可选）；不传则沿用组件内默认中文文案 */
	t?: ChatI18nT;
	maxLength?: number;
	/** 透传到原生 textarea，供 label/htmlFor 或 getElementById 聚焦 */
	textareaId?: string;
	onScrollAreaWheel?: React.WheelEventHandler<HTMLDivElement>;
	onScrollAreaWheelCapture?: React.WheelEventHandler<HTMLDivElement>;
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
			placeholder: placeholderProp,
			textareaClassName,
			disableTextInput = false,
			t,
			maxLength,
			textareaId,
			onScrollAreaWheel,
			onScrollAreaWheelCapture,
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

		const scrollRef = useRef<HTMLDivElement>(null);

		const isEditMode = mode === 'edit';
		const value = isEditMode ? editMessage?.content || '' : input;
		const chatInputDisabled =
			!isEditMode && (Boolean(loading) || Boolean(disableTextInput));

		const placeholder =
			placeholderProp ?? t?.('chat.textArea.placeholder') ?? '请输入您的问题';

		const scrollInputToBottom = () => {
			const scroll = () => {
				const viewport = scrollRef.current;
				if (viewport) {
					viewport.scrollTop = viewport.scrollHeight;
				}
				const el = typeof ref !== 'function' ? ref?.current : null;
				if (el) {
					el.scrollTop = el.scrollHeight;
				}
			};
			requestAnimationFrame(() => {
				scroll();
				requestAnimationFrame(scroll);
			});
		};

		// 受控 value 更新后（如 Shift+Enter 换行）再滚到底，避免光标被挡在视口外
		useLayoutEffect(() => {
			const el = typeof ref !== 'function' ? ref?.current : null;
			if (!el || document.activeElement !== el) return;
			const atEnd =
				el.selectionStart === el.value.length &&
				el.selectionEnd === el.value.length;
			if (!atEnd) return;

			const viewport = scrollRef.current;
			if (viewport) {
				viewport.scrollTop = viewport.scrollHeight;
			}
			el.scrollTop = el.scrollHeight;
			requestAnimationFrame(() => {
				if (viewport) {
					viewport.scrollTop = viewport.scrollHeight;
				}
				el.scrollTop = el.scrollHeight;
			});
		}, [value, ref]);

		return (
			<>
				<ScrollArea
					ref={scrollRef}
					viewportTabIndex={-1}
					className={cn(
						'flex max-h-35 w-full flex-col overflow-y-auto border-0',
						className,
					)}
					onWheel={onScrollAreaWheel}
					onWheelCapture={onScrollAreaWheelCapture}
				>
					<Textarea
						ref={ref}
						id={textareaId}
						value={value}
						maxLength={maxLength}
						onChange={
							isEditMode ? handleEditChange : (e) => setInput?.(e.target.value)
						}
						onKeyDown={(e) =>
							handleKeyDown(
								e,
								isEditMode ? editMessage : null,
								scrollInputToBottom,
							)
						}
						onCompositionStart={handleCompositionStart}
						onCompositionEnd={handleCompositionEnd}
						placeholder={placeholder}
						spellCheck={false}
						className={cn(
							'flex-1 resize-none border-none shadow-none focus-visible:ring-transparent',
							textareaClassName ? null : 'min-h-16',
							textareaClassName,
						)}
						disabled={isEditMode ? Boolean(loading) : chatInputDisabled}
					/>
				</ScrollArea>
				{isEditMode && (
					<div className="flex justify-end gap-2 mt-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => setEditMessage?.(null)}
						>
							{t?.('common.cancel') ?? '取消'}
						</Button>
						<Button
							size="sm"
							variant="default"
							onClick={() =>
								sendMessage?.(
									editMessage?.content || undefined,
									undefined,
									true,
									editMessage?.attachments,
								)
							}
							disabled={loading}
						>
							{t?.('chat.textArea.send') ?? '发送'}
						</Button>
					</div>
				)}
			</>
		);
	},
);

ChatTextArea.displayName = 'ChatTextArea';

export default ChatTextArea;
