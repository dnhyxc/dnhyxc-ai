/**
 * 知识库助手专用轻量输入条：textarea 非受控，按键不触发 React 重渲染；
 * 仅在「空↔非空」切换时更新，供发送钮 disabled 与 disableTextInput 判定。
 * AI 模式可 `/` 唤起 SkillSlashPicker，芯片展示已选 Skill。
 */
import MessageSendControl from '@design/MessageSendButton';
import SkillSlashPicker from '@design/SkillSlashPicker';
import { ScrollArea, Textarea } from '@ui/index';
import { X } from 'lucide-react';
import { observer } from 'mobx-react';
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
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import skillStore from '@/store/skill';

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
	/** AI 模式开启 `/` 选 Skill；RAG 应关闭 */
	skillSlashEnabled?: boolean;
};

/** `/` 须在行首或空白后；其后仅连续非空白为过滤词（空格则退出，对齐 Cursor） */
function findSlashAtCursor(
	value: string,
	cursor: number,
): { start: number; query: string } | null {
	const before = value.slice(0, cursor);
	const m = before.match(/(?:^|[\s\n])(\/([^\s\n]*))$/);
	if (!m) return null;
	const slashLocal = m[1]!;
	const start = before.length - slashLocal.length;
	return { start, query: m[2] ?? '' };
}

const SkillChips = observer(function SkillChips() {
	const { t } = useI18n();
	const ids = skillStore.selectedSkillIds;
	if (ids.length === 0) return null;
	const byId = new Map(skillStore.list.map((s) => [s.id, s]));
	return (
		<div
			className="flex flex-wrap gap-1.5 px-2.5 pt-2"
			role="group"
			aria-label={t('skill.chips.aria')}
		>
			{ids.map((id) => {
				const title = byId.get(id)?.title ?? id.slice(0, 8);
				return (
					<span
						key={id}
						className="inline-flex max-w-full items-center gap-1 rounded-md border border-theme/10 bg-theme/5 px-2 py-0.5 text-xs text-textcolor"
					>
						<span className="truncate">{title}</span>
						<button
							type="button"
							className="shrink-0 rounded p-0.5 hover:bg-theme/10"
							aria-label="remove"
							onClick={() => skillStore.toggleSelectedSkillId(id)}
						>
							<X className="size-3" />
						</button>
					</span>
				);
			})}
		</div>
	);
});

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
		skillSlashEnabled = false,
	},
	ref,
) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const wrapRef = useRef<HTMLDivElement>(null);
	const composingRef = useRef(false);
	const consumedFocusKeyRef = useRef(0);
	const [hasText, setHasText] = useState(false);
	const [slashOpen, setSlashOpen] = useState(false);
	const [slashQuery, setSlashQuery] = useState('');
	const slashStartRef = useRef<number | null>(null);

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

	const closeSlash = useCallback(() => {
		setSlashOpen(false);
		slashStartRef.current = null;
		setSlashQuery('');
	}, []);

	const syncSlashFromDom = useCallback(() => {
		if (!skillSlashEnabled || composingRef.current) {
			if (slashOpen) closeSlash();
			return;
		}
		const el = textareaRef.current;
		if (!el) return;
		const cursor = el.selectionStart ?? el.value.length;
		const hit = findSlashAtCursor(el.value, cursor);
		if (!hit) {
			if (slashOpen) closeSlash();
			return;
		}
		slashStartRef.current = hit.start;
		setSlashQuery(hit.query);
		if (!slashOpen) setSlashOpen(true);
	}, [skillSlashEnabled, slashOpen, closeSlash]);

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

	useLayoutEffect(() => {
		if (!skillSlashEnabled) return;
		if (skillStore.list.length === 0) void skillStore.loadList();
	}, [skillSlashEnabled]);

	const send = useCallback(async () => {
		if (disableTextInput || loading) return;
		const text = textareaRef.current?.value.trim() ?? '';
		if (!text) return;
		if (textareaRef.current) textareaRef.current.value = '';
		setHasText(false);
		closeSlash();
		await onSend(text);
		textareaRef.current?.focus({ preventScroll: true });
	}, [disableTextInput, loading, onSend, closeSlash]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === 'Escape' && slashOpen) {
				e.preventDefault();
				closeSlash();
				return;
			}
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
			if (slashOpen) return;
			e.preventDefault();
			void send();
		},
		[scrollInputToBottom, send, syncHasTextFromDom, slashOpen, closeSlash],
	);

	const onConfirmSkills = useCallback(
		(ids: string[]) => {
			skillStore.setSelectedSkillIds(ids);
			const el = textareaRef.current;
			const start = slashStartRef.current;
			if (el && start != null) {
				const cursor = el.selectionStart ?? el.value.length;
				el.value = `${el.value.slice(0, start)}${el.value.slice(cursor)}`;
				el.selectionStart = el.selectionEnd = start;
				syncHasTextFromDom();
			}
			closeSlash();
			el?.focus({ preventScroll: true });
		},
		[closeSlash, syncHasTextFromDom],
	);

	const inputDisabled =
		Boolean(loading) || (Boolean(disableTextInput) && !hasText);
	const sendDisabled = loading || (disableTextInput && !hasText) || !hasText;

	return (
		<div className={cn('relative w-full px-0 pb-4', className)}>
			{skillSlashEnabled ? (
				<SkillSlashPicker
					open={slashOpen}
					anchorRef={wrapRef}
					onOpenChange={(v) => {
						if (!v) closeSlash();
						else setSlashOpen(true);
					}}
					query={slashQuery}
					onConfirm={onConfirmSkills}
				/>
			) : null}
			<div
				ref={wrapRef}
				className={cn(
					'relative flex w-full flex-col overflow-y-auto rounded-md border border-theme/10 bg-theme/2',
					inputWrapClassName,
				)}
			>
				{skillSlashEnabled ? <SkillChips /> : null}
				<ScrollArea
					ref={scrollRef}
					className="flex max-h-35 w-full flex-col overflow-y-auto border-0"
				>
					<Textarea
						ref={textareaRef}
						defaultValue=""
						onChange={() => {
							syncHasTextFromDom();
							syncSlashFromDom();
						}}
						onKeyDown={handleKeyDown}
						onKeyUp={() => {
							if (skillSlashEnabled) syncSlashFromDom();
						}}
						onClick={() => {
							if (skillSlashEnabled) syncSlashFromDom();
						}}
						onCompositionStart={() => {
							composingRef.current = true;
						}}
						onCompositionEnd={() => {
							window.setTimeout(() => {
								composingRef.current = false;
								syncSlashFromDom();
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
