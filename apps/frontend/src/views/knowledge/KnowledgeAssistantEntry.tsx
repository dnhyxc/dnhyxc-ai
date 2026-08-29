/**
 * 知识库助手专用轻量输入条：textarea 非受控，按键不触发 React 重渲染；
 * 仅在「空↔非空」切换时更新，供发送钮 disabled 与 disableTextInput 判定。
 */
import MessageSendControl from '@design/MessageSendButton';
import { ScrollArea, Textarea } from '@ui/index';
import {
	forwardRef,
	memo,
	type ReactNode,
	useCallback,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';

export type KnowledgeAssistantEntryHandle = {
	getValue: () => string;
	setValue: (text: string) => void;
	clear: () => void;
	focusAtEnd: () => void;
};

type KnowledgeAssistantEntryProps = {
	placeholder?: string;
	disableTextInput?: boolean;
	loading?: boolean;
	stopGenerating?: () => void;
	onSend: (text: string) => void | Promise<void>;
	toolbar?: ReactNode;
	className?: string;
	textareaClassName?: string;
	inputWrapClassName?: string;
	focusInputAtEndKey?: number;
};

const KnowledgeAssistantEntryInner = forwardRef<
	KnowledgeAssistantEntryHandle,
	KnowledgeAssistantEntryProps
>(function KnowledgeAssistantEntry(
	{
		placeholder,
		disableTextInput = false,
		loading = false,
		stopGenerating,
		onSend,
		toolbar,
		className,
		textareaClassName,
		inputWrapClassName,
		focusInputAtEndKey = 0,
	},
	ref,
) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const composingRef = useRef(false);
	const consumedFocusKeyRef = useRef(0);
	const [hasText, setHasText] = useState(false);

	const syncHasTextFromDom = useCallback(() => {
		const next = Boolean(textareaRef.current?.value.trim());
		setHasText((prev) => (prev === next ? prev : next));
	}, []);

	const scrollInputToBottom = useCallback(() => {
		const scroll = () => {
			const vp = scrollRef.current;
			if (vp) vp.scrollTop = vp.scrollHeight;
			const el = textareaRef.current;
			if (el) el.scrollTop = el.scrollHeight;
		};
		requestAnimationFrame(() => {
			scroll();
			requestAnimationFrame(scroll);
		});
	}, []);

	useImperativeHandle(
		ref,
		() => ({
			getValue: () => textareaRef.current?.value ?? '',
			setValue: (text: string) => {
				const el = textareaRef.current;
				if (!el) return;
				el.value = text;
				syncHasTextFromDom();
			},
			clear: () => {
				const el = textareaRef.current;
				if (!el) return;
				el.value = '';
				setHasText(false);
			},
			focusAtEnd: () => {
				const el = textareaRef.current;
				if (!el?.value.length) return;
				el.focus({ preventScroll: true });
				const len = el.value.length;
				el.setSelectionRange(len, len);
				el.scrollTop = el.scrollHeight;
			},
		}),
		[syncHasTextFromDom],
	);

	useLayoutEffect(() => {
		if (!focusInputAtEndKey) return;
		if (focusInputAtEndKey <= consumedFocusKeyRef.current) return;
		const el = textareaRef.current;
		if (!el?.value.length) return;
		consumedFocusKeyRef.current = focusInputAtEndKey;
		el.focus({ preventScroll: true });
		const len = el.value.length;
		el.setSelectionRange(len, len);
		el.scrollTop = el.scrollHeight;
	}, [focusInputAtEndKey]);

	const send = useCallback(async () => {
		if (disableTextInput || loading) return;
		const text = textareaRef.current?.value.trim() ?? '';
		if (!text) return;
		if (textareaRef.current) textareaRef.current.value = '';
		setHasText(false);
		await onSend(text);
		textareaRef.current?.focus({ preventScroll: true });
	}, [disableTextInput, loading, onSend]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key !== 'Enter') return;
			const nativeComposing =
				(e.nativeEvent as KeyboardEvent).isComposing || composingRef.current;
			if (nativeComposing && !(e.ctrlKey || e.metaKey)) return;

			if (e.ctrlKey || e.metaKey || e.shiftKey) {
				e.preventDefault();
				const ta = e.currentTarget;
				const start = ta.selectionStart ?? 0;
				const end = ta.selectionEnd ?? 0;
				ta.value = `${ta.value.slice(0, start)}\n${ta.value.slice(end)}`;
				ta.selectionStart = ta.selectionEnd = start + 1;
				syncHasTextFromDom();
				scrollInputToBottom();
				return;
			}
			e.preventDefault();
			void send();
		},
		[scrollInputToBottom, send, syncHasTextFromDom],
	);

	const inputDisabled =
		Boolean(loading) || (Boolean(disableTextInput) && !hasText);
	const sendDisabled = loading || (disableTextInput && !hasText) || !hasText;

	return (
		<div className={cn('relative w-full px-0 pb-4', className)}>
			<div
				className={cn(
					'flex w-full flex-col overflow-y-auto rounded-md border border-theme/10 bg-theme/2',
					inputWrapClassName,
				)}
			>
				<ScrollArea
					ref={scrollRef}
					className="flex max-h-35 w-full flex-col overflow-y-auto border-0"
				>
					<Textarea
						ref={textareaRef}
						defaultValue=""
						onChange={syncHasTextFromDom}
						onKeyDown={handleKeyDown}
						onCompositionStart={() => {
							composingRef.current = true;
						}}
						onCompositionEnd={() => {
							window.setTimeout(() => {
								composingRef.current = false;
							}, 0);
						}}
						placeholder={placeholder}
						spellCheck={false}
						disabled={inputDisabled}
						className={cn(
							'min-h-9 flex-1 resize-none border-none shadow-none focus-visible:ring-transparent',
							textareaClassName,
						)}
					/>
				</ScrollArea>
				<div className="mb-1 mt-2.5 flex h-10 items-center justify-between p-2.5">
					<div className="flex min-w-0 items-center gap-2">{toolbar}</div>
					<MessageSendControl
						loading={loading}
						onStop={stopGenerating}
						sendDisabled={sendDisabled}
						onSend={send}
						sendLoading={loading}
					/>
				</div>
			</div>
		</div>
	);
});

const KnowledgeAssistantEntry = memo(KnowledgeAssistantEntryInner);

export default KnowledgeAssistantEntry;
