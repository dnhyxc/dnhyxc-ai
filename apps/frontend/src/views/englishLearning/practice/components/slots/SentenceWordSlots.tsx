/**
 * 经典句看中写 — 一词一槽下划线输入（绿对 / 红错 + 光晕）
 */
import {
	type KeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import type { SentenceWordToken } from '../../utils/segmentSentence';
import { matchSlotInput } from '../../utils/segmentSentence';
import {
	posTone,
	posToneStyle,
	type SentenceWordMeta,
} from '../../utils/wordMeta';

export type SentenceWordSlotsProps = {
	tokens: readonly SentenceWordToken[];
	values: readonly string[];
	activeIndex: number;
	/** 提交后锁定各槽对错；未提交时按实时 match */
	locked?: boolean;
	showPos?: boolean;
	showIpa?: boolean;
	/** 揭示态：展示标准词形 + 词义，不可编辑 */
	reveal?: boolean;
	disabled?: boolean;
	/** 与 tokens 下标对齐的标注（来自 annotate API） */
	metaByIndex?: readonly (SentenceWordMeta | null | undefined)[];
	/** 语句槽内释义限宽；单词练习不限 */
	compactMeaning?: boolean;
	onChange: (index: number, value: string) => void;
	onActiveChange: (index: number) => void;
	/** 当前词完成且正确时请求跳下一词；可选带上已合并的 values 以免 setState 竞态 */
	onAdvance?: (fromIndex: number, nextValues: string[]) => void;
	onSubmitAll?: () => void;
};

function underlineClass(
	kind: 'empty' | 'prefix' | 'correct' | 'wrong',
	active: boolean,
): string {
	if (kind === 'wrong') {
		return 'border-rose-500 shadow-[0_6px_14px_-2px_rgba(244,63,94,0.55)]';
	}
	// 仅整词正确才绿；输入中 / 焦点未完成用强调色
	if (kind === 'correct') {
		return 'border-emerald-500';
	}
	if (active) {
		return 'border-teal-500 shadow-[0_6px_14px_-2px_rgba(20,184,166,0.55)]';
	}
	return 'border-textcolor/35';
}

function stripSpaces(raw: string): string {
	return raw.replace(/\s/g, '');
}

/** 非 ASCII（含中文）按更宽估算，避免 ch 按「0」宽度偏窄裁切 */
function estimateSlotCh(text: string): number {
	let n = 0;
	for (const c of text) {
		n += c.codePointAt(0)! > 0x7f ? 1.85 : 1;
	}
	return n;
}

/**
 * 单槽输入：本地 draft 负责展示（兼容中文 IME）；
 * 非组字 / compositionend 时再规范化提交给父级，避免叠字或受控清空。
 */
function SlotWordInput({
	index,
	expect,
	value,
	values,
	tokens,
	disabled,
	active,
	kind,
	inputRef,
	onFocus,
	onCommit,
	onAdvance,
	onSubmitAll,
	onActiveChange,
}: {
	index: number;
	expect: string;
	value: string;
	values: readonly string[];
	tokens: readonly SentenceWordToken[];
	disabled: boolean;
	active: boolean;
	kind: 'empty' | 'prefix' | 'correct' | 'wrong';
	inputRef: (el: HTMLInputElement | null) => void;
	onFocus: () => void;
	onCommit: (index: number, typed: string) => void;
	onAdvance?: (fromIndex: number, nextValues: string[]) => void;
	onSubmitAll?: () => void;
	onActiveChange: (index: number) => void;
}) {
	const [draft, setDraft] = useState(value);
	const composingRef = useRef(false);
	const elRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!composingRef.current) {
			setDraft(value);
		}
	}, [value]);

	const commit = (raw: string) => {
		const typed = stripSpaces(raw);
		setDraft(typed);
		onCommit(index, typed);
		if (matchSlotInput(typed, expect) === 'correct' && onAdvance) {
			const merged = tokens.map((_, j) =>
				j === index ? typed : (values[j] ?? ''),
			);
			onAdvance(index, merged);
		}
	};

	// 焦点槽：ch 下限 + scrollWidth 实测；其余槽只用加宽 ch，避免每键全表 layout
	useLayoutEffect(() => {
		const el = elRef.current;
		if (!el) return;
		const floorCh =
			Math.max(estimateSlotCh(expect), estimateSlotCh(draft), 2) + 1.5;
		el.style.width = `${floorCh}ch`;
		if (!active) return;
		el.style.width = `${Math.max(el.scrollWidth + 2, el.clientWidth)}px`;
	}, [active, draft, expect]);

	return (
		<input
			ref={(el) => {
				elRef.current = el;
				inputRef(el);
			}}
			value={draft}
			disabled={disabled}
			spellCheck={false}
			autoComplete="off"
			autoCapitalize="off"
			autoCorrect="off"
			aria-label={`word ${index + 1}`}
			onFocus={onFocus}
			onCompositionStart={() => {
				composingRef.current = true;
			}}
			onCompositionEnd={(e) => {
				composingRef.current = false;
				commit(e.currentTarget.value);
			}}
			onChange={(e) => {
				const next = e.target.value;
				const ne = e.nativeEvent as InputEvent;
				// 组字中：只更新本地 draft 供显示，不向父级规范化提交
				if (composingRef.current || ne.isComposing) {
					setDraft(next);
					return;
				}
				commit(next);
			}}
			onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
				if (composingRef.current || e.nativeEvent.isComposing) {
					return;
				}
				// Tab 在词槽内循环，避免焦点跑到顶栏/提交按钮
				if (e.key === 'Tab') {
					e.preventDefault();
					const last = tokens.length - 1;
					if (last < 0) return;
					onActiveChange(
						e.shiftKey
							? index <= 0
								? last
								: index - 1
							: index >= last
								? 0
								: index + 1,
					);
					return;
				}
				// 空格跳下一槽；Shift+空格留给快捷播放，不换焦点
				if (e.key === 'Enter' || (e.key === ' ' && !e.shiftKey)) {
					e.preventDefault();
					if (e.key === 'Enter' && onSubmitAll) {
						onSubmitAll();
						return;
					}
					const next = Math.min(index + 1, tokens.length - 1);
					onActiveChange(next);
					return;
				}
				if (e.key === 'Backspace' && !draft && index > 0) {
					e.preventDefault();
					onActiveChange(index - 1);
				}
			}}
			className={cn(
				'box-content bg-transparent px-1 text-center text-lg leading-snug font-medium outline-none sm:text-xl',
				'[font-family:var(--font-family)]',
				kind === 'wrong'
					? 'text-rose-600 dark:text-rose-400'
					: kind === 'correct'
						? 'text-emerald-700 dark:text-emerald-400'
						: 'text-textcolor',
				active && (kind === 'correct' ? 'caret-emerald-500' : 'caret-teal-500'),
			)}
		/>
	);
}

export function SentenceWordSlots({
	tokens,
	values,
	activeIndex,
	locked = false,
	showPos = false,
	showIpa = false,
	reveal = false,
	disabled = false,
	metaByIndex,
	compactMeaning = true,
	onChange,
	onActiveChange,
	onAdvance,
	onSubmitAll,
}: SentenceWordSlotsProps) {
	const refs = useRef<(HTMLInputElement | null)[]>([]);

	useEffect(() => {
		if (reveal || disabled) {
			for (const el of refs.current) el?.blur();
			return;
		}
		refs.current[activeIndex]?.focus();
	}, [activeIndex, reveal, disabled]);

	const metas = tokens.map((_, i) => metaByIndex?.[i] ?? null);
	const filledPos = metas.map((m) => m?.posZh?.trim() || '').filter(Boolean);
	const filledIpa = metas.map((m) => m?.ipa?.trim() || '').filter(Boolean);
	const filledMeaning = metas
		.map((m) => m?.meaningZh?.trim() || '')
		.filter(Boolean);
	// 多词短语只有一条词性/音标/释义：居中挂在整组上，避免后词留空槽
	const sharedPos =
		showPos && tokens.length > 1 && filledPos.length === 1 ? filledPos[0]! : '';
	const sharedIpa =
		showIpa && tokens.length > 1 && filledIpa.length === 1 ? filledIpa[0]! : '';
	const sharedMeaning =
		reveal && tokens.length > 1 && filledMeaning.length === 1
			? filledMeaning[0]!
			: '';

	return (
		<div className="flex w-full flex-col items-center gap-2 px-2 py-1">
			{sharedPos ? (
				<span
					className="inline-flex items-center rounded px-1.5 pt-1 pb-[5px] text-[13px] leading-none font-medium whitespace-nowrap"
					style={posToneStyle(posTone(sharedPos))}
				>
					{sharedPos}
				</span>
			) : null}
			<div className="flex w-full flex-wrap items-start justify-center gap-x-4 gap-y-4">
				{tokens.map((token, i) => {
					const value = values[i] ?? '';
					const kind = locked
						? matchSlotInput(value, token.expect) === 'correct'
							? 'correct'
							: value.trim()
								? 'wrong'
								: 'wrong'
						: matchSlotInput(value, token.expect);
					const active = !reveal && !disabled && i === activeIndex;
					const meta = metaByIndex?.[i] ?? null;
					const displayWord = reveal ? token.raw : value;
					const punctTone =
						reveal || kind === 'correct'
							? 'text-emerald-500'
							: 'text-textcolor/70';

					const wordEl = reveal ? (
						<span
							className={cn(
								'inline-block px-1 text-lg font-semibold leading-snug whitespace-nowrap sm:text-xl',
								'[font-family:var(--font-family)]',
								kind === 'wrong' && !locked
									? 'text-textcolor'
									: 'text-emerald-500',
							)}
						>
							{displayWord}
						</span>
					) : (
						<SlotWordInput
							index={i}
							expect={token.expect}
							value={value}
							values={values}
							tokens={tokens}
							disabled={disabled}
							active={active}
							kind={kind}
							inputRef={(el) => {
								refs.current[i] = el;
							}}
							onFocus={() => onActiveChange(i)}
							onCommit={onChange}
							onAdvance={onAdvance}
							onSubmitAll={onSubmitAll}
							onActiveChange={onActiveChange}
						/>
					);

					return (
						<div
							key={`${token.expect}-${i}`}
							className="flex w-max max-w-full shrink-0 flex-col items-center gap-1"
						>
							{!sharedPos && showPos && meta?.posZh ? (
								<span
									className="inline-flex items-center rounded px-1.5 pt-1 pb-[5px] text-[13px] leading-none font-medium whitespace-nowrap"
									style={posToneStyle(posTone(meta.posZh))}
								>
									{meta.posZh}
								</span>
							) : !sharedPos && showPos ? (
								<span className="h-5" aria-hidden />
							) : null}

							<div className="flex items-end gap-1">
								<div className="flex w-max flex-col items-center gap-1">
									{wordEl}
									<div
										className={cn(
											'h-0 w-full border-b-2 transition-[border-color,box-shadow]',
											underlineClass(kind, active),
										)}
									/>
								</div>
								{token.after ? (
									<span
										className={cn(
											'shrink-0 -mb-2 text-xl font-semibold leading-snug select-none',
											'[font-family:var(--font-family)]',
											punctTone,
										)}
										aria-hidden
									>
										{token.after}
									</span>
								) : null}
							</div>

							{!sharedIpa && showIpa && meta?.ipa ? (
								<span className="text-textcolor/65 px-0.5 my-1 font-mono text-xs leading-snug whitespace-nowrap">
									{displayIpaWrapped(meta.ipa)}
								</span>
							) : !sharedIpa && showIpa ? (
								<span className="h-3" aria-hidden />
							) : null}

							{reveal && !sharedMeaning && meta?.meaningZh ? (
								<span
									className={cn(
										'text-textcolor/80 px-0.5 text-center text-sm leading-snug',
										compactMeaning && 'max-w-32',
									)}
								>
									{meta.meaningZh}
								</span>
							) : null}
						</div>
					);
				})}
			</div>
			{sharedIpa ? (
				<span className="text-textcolor/65 px-0.5 my-1 font-mono text-xs leading-snug whitespace-nowrap">
					{displayIpaWrapped(sharedIpa)}
				</span>
			) : null}
			{sharedMeaning ? (
				<span className="text-textcolor/80 px-0.5 text-center text-sm leading-snug">
					{sharedMeaning}
				</span>
			) : null}
		</div>
	);
}
