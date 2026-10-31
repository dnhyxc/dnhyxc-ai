// components/ChatTextArea.tsx

import { Button, Textarea } from '@ui/index';
import React, {
	forwardRef,
	type RefObject,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { useEntry } from '@/hooks/useEntry'; // 根据实际路径调整
import { cn } from '@/lib/utils';
import { ChatI18nT, Message } from '@/types/chat'; // 根据实际路径调整

/** ownedDraft 时供父级读写正文（发送 / 快捷意图），不经过受控 input 每键上浮 */
export type ChatTextAreaDraftApi = {
	getValue: () => string;
	setValue: (value: string) => void;
};

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
	/**
	 * 正文落在本组件本地：按键不 setInput 上浮，避免 ChatEntry 整树跟键重渲。
	 * 发送按钮空/非空用 onArmedChange；读写走 draftApiRef。
	 */
	ownedDraft?: boolean;
	draftApiRef?: RefObject<ChatTextAreaDraftApi | null>;
	/** 仅在 trim 空↔非空 时回调，供发送钮禁用态 */
	onArmedChange?: (armed: boolean) => void;
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
			ownedDraft = false,
			draftApiRef,
			onArmedChange,
		},
		ref,
	) => {
		const [draft, setDraft] = useState(input ?? '');
		const draftRef = useRef(draft);
		draftRef.current = draft;
		const armedRef = useRef((input ?? '').trim().length > 0);

		const notifyArmed = useCallback(
			(value: string) => {
				const armed = value.trim().length > 0;
				if (armed === armedRef.current) return;
				armedRef.current = armed;
				onArmedChange?.(armed);
			},
			[onArmedChange],
		);

		const setOwnedDraft = useCallback(
			(value: string) => {
				setDraft(value);
				draftRef.current = value;
				notifyArmed(value);
			},
			[notifyArmed],
		);

		useImperativeHandle(
			draftApiRef,
			() => ({
				getValue: () => draftRef.current,
				setValue: setOwnedDraft,
			}),
			[setOwnedDraft],
		);

		const applyChatInput = ownedDraft ? setOwnedDraft : setInput;

		const { handleKeyDown, handleCompositionStart, handleCompositionEnd } =
			useEntry({
				isEdit: mode === 'edit',
				loading,
				input: ownedDraft ? draft : input,
				setInput: applyChatInput,
				editMessage,
				setEditMessage,
				handleEditChange,
				sendMessage,
				textareaRef: {
					current: ref,
				} as React.RefObject<HTMLTextAreaElement | null>,
			});

		/** 仅换行等显式请求时递增；勿每键读 scrollHeight（会逼整页同步 layout） */
		const [scrollNonce, setScrollNonce] = useState(0);

		const isEditMode = mode === 'edit';
		const value = isEditMode
			? editMessage?.content || ''
			: ownedDraft
				? draft
				: input;
		const chatInputDisabled =
			!isEditMode && (Boolean(loading) || Boolean(disableTextInput));

		const placeholder =
			placeholderProp ?? t?.('chat.entry.placeholder') ?? '请输入您的问题';

		const scrollInputToBottom = useCallback(() => {
			setScrollNonce((n) => n + 1);
		}, []);

		// Shift+Enter 换行：等受控 value 提交后再滚，避免光标被挡
		useLayoutEffect(() => {
			if (scrollNonce === 0) return;
			const el = typeof ref !== 'function' ? ref?.current : null;
			if (!el || document.activeElement !== el) return;
			el.scrollTop = el.scrollHeight;
			requestAnimationFrame(() => {
				el.scrollTop = el.scrollHeight;
			});
		}, [scrollNonce, ref]);

		return (
			<>
				{/*
				 * 不用 ScrollArea + field-sizing-content：每键长高会改 footer，
				 * flex 挤压消息列，会话 DOM 越大输入越卡。固定高度 + 自身滚动。
				 */}
				<div
					className={cn('w-full border-0', className)}
					onWheel={onScrollAreaWheel}
					onWheelCapture={onScrollAreaWheelCapture}
				>
					<Textarea
						ref={ref}
						id={textareaId}
						value={value}
						maxLength={maxLength}
						onChange={
							isEditMode
								? handleEditChange
								: (e) => applyChatInput?.(e.target.value)
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
							// 压过 ui/Textarea 默认 field-sizing-content，避免每键撑高 footer
							'field-sizing-fixed max-h-35 overflow-y-auto',
							textareaClassName ? null : 'min-h-16',
							textareaClassName,
						)}
						disabled={isEditMode ? Boolean(loading) : chatInputDisabled}
					/>
				</div>
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
							{t?.('common.send') ?? '发送'}
						</Button>
					</div>
				)}
			</>
		);
	},
);

ChatTextArea.displayName = 'ChatTextArea';

export default ChatTextArea;
