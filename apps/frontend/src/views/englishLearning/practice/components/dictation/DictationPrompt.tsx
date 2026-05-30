/**
 * 听写题 — 步骤条、播放；展开提示时在固定高度内分区展示（无滚动）
 */
import { Square, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import type {
	DictationPromptBodyProps,
	DictationStepProgressProps,
	PracticeHintFields,
} from '../../types';

const DICTATION_EQUALIZER_BAR_COUNT = 9;

export function DictationEqualizer({
	playing,
	className,
}: {
	playing: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'practice-dictation-equalizer flex h-5 items-end justify-center gap-0.5',
				playing && 'practice-dictation-equalizer--playing',
				className,
			)}
			aria-hidden
		>
			{Array.from({ length: DICTATION_EQUALIZER_BAR_COUNT }, (_, index) => (
				<span key={index} className="practice-dictation-bar" />
			))}
		</div>
	);
}

export function DictationPlayButton({
	playing,
	playLabel,
	onPlay,
	size = 'hero',
}: {
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
	size?: 'hero' | 'medium' | 'strip';
}) {
	const outer =
		size === 'hero' ? 'size-14' : size === 'medium' ? 'size-12' : 'size-10';
	const inner =
		size === 'hero' ? 'size-12' : size === 'medium' ? 'size-10' : 'size-8';
	const icon =
		size === 'hero' ? 'size-5' : size === 'medium' ? 'size-4' : 'size-3.5';
	const playingHalo =
		size === 'hero'
			? 'bg-teal-500/15 ring-2 ring-teal-500/25'
			: 'bg-teal-500/15 ring-1 ring-inset ring-teal-500/35';

	return (
		<button
			type="button"
			onClick={onPlay}
			aria-label={playLabel}
			className={cn(
				'group relative isolate flex shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
				outer,
			)}
		>
			<span
				className={cn(
					'absolute inset-0 rounded-full',
					playing
						? cn(playingHalo, 'motion-reduce:ring-0')
						: 'bg-teal-500/8 opacity-0 group-hover:opacity-100',
				)}
				aria-hidden
			/>
			<span
				className={cn(
					'relative z-10 flex items-center justify-center rounded-full border-2 group-active:scale-[0.97]',
					inner,
					playing
						? 'border-teal-500/40 bg-teal-500/15 text-teal-600 shadow-sm dark:text-teal-400'
						: 'border-white/15 bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-md shadow-teal-500/25',
				)}
			>
				{playing ? (
					<Square className={cn(icon, 'fill-current')} />
				) : (
					<Volume2 className={icon} />
				)}
			</span>
		</button>
	);
}

function DictationStepProgress({
	stepListen,
	stepSpell,
	playing,
	spellStepActive,
}: DictationStepProgressProps) {
	const listenStepActive = playing || !spellStepActive;
	const spellStepHighlighted = spellStepActive;

	const stepBarActive =
		'h-1 flex-1 rounded-full bg-teal-500 shadow-[0_0_10px_rgba(45,212,191,0.35)]';
	const stepBarIdle = 'bg-white/10 h-1 flex-1 rounded-full';
	const stepLabelActive =
		'text-teal-400 text-[11px] font-semibold tracking-wide';
	const stepLabelIdle =
		'text-textcolor/40 text-[11px] font-medium tracking-wide';

	return (
		<div className="w-full">
			<div className="flex gap-1.5" role="presentation">
				<div className={listenStepActive ? stepBarActive : stepBarIdle} />
				<div className={spellStepHighlighted ? stepBarActive : stepBarIdle} />
			</div>
			<div className="mt-2 flex items-baseline justify-between gap-3">
				<span className={listenStepActive ? stepLabelActive : stepLabelIdle}>
					{stepListen}
				</span>
				<span
					className={spellStepHighlighted ? stepLabelActive : stepLabelIdle}
				>
					{stepSpell}
				</span>
			</div>
		</div>
	);
}

/** 听写提示：中文释义 + 音标（无英文词面） */
export function DictationHintPanel({
	hintContent,
	variant = 'default',
	align = 'center',
}: {
	hintContent: PracticeHintFields;
	/** compact：固定高度内截断；softWrong：首次答错面板，字号与间距更大 */
	variant?: 'default' | 'compact' | 'softWrong';
	/** start：与播放钮横排时左对齐，减少无效留白 */
	align?: 'center' | 'start';
}) {
	const { t } = useI18n();
	const translation = hintContent.translationZh?.trim();
	const ipaText = hintContent.ipa?.trim();
	const source = hintContent.source?.trim();
	const noteZh = hintContent.noteZh?.trim();
	const compact = variant === 'compact';
	const softWrong = variant === 'softWrong';
	const start = align === 'start';

	if (!translation && !ipaText && !source && !noteZh) return null;

	/** 软揭示：出处与说明合并为一行，减少纵向占用 */
	const softWrongMeta =
		softWrong && (source || noteZh)
			? [source, noteZh].filter(Boolean).join(' · ')
			: null;

	return (
		<div
			className={cn(
				'flex w-full min-w-0 flex-col text-center',
				start ? 'items-start text-left' : 'items-center',
				softWrong
					? 'shrink-0 gap-1.5'
					: compact
						? 'min-h-0 gap-1 overflow-hidden'
						: 'justify-between gap-2 px-3',
			)}
			aria-live="polite"
		>
			{translation ? (
				softWrong ? (
					<div className="flex w-full shrink-0 flex-col items-center gap-0.5">
						<span className="text-textcolor/45 text-[11px] font-medium tracking-wide">
							{t('englishLearning.practice.hintLabelTranslation')}
						</span>
						<p className="text-textcolor w-full text-center text-sm font-semibold leading-snug line-clamp-2">
							{translation}
						</p>
					</div>
				) : compact ? (
					start ? (
						<p className="text-textcolor line-clamp-2 w-full text-sm font-semibold leading-snug">
							<span className="text-textcolor/45 me-1 text-[10px] font-medium tracking-wide">
								{t('englishLearning.practice.hintLabelTranslation')}
							</span>
							{translation}
						</p>
					) : (
						<div className="flex w-full flex-col items-center gap-0.5">
							<span className="text-textcolor/45 text-[10px] font-medium tracking-wide">
								{t('englishLearning.practice.hintLabelTranslation')}
							</span>
							<p className="text-textcolor line-clamp-2 text-sm font-semibold leading-snug">
								{translation}
							</p>
						</div>
					)
				) : (
					<div className="flex w-full min-w-0 flex-col gap-2">
						<span className="text-textcolor/45 text-xs font-medium tracking-wide">
							{t('englishLearning.practice.hintLabelTranslation')}
						</span>
						<p className="text-textcolor line-clamp-3 text-sm font-semibold leading-snug">
							{translation}
						</p>
					</div>
				)
			) : null}
			{ipaText ? (
				<p
					className={cn(
						'w-full shrink-0 text-center font-mono text-teal-600/90 dark:text-teal-400/90',
						softWrong
							? 'line-clamp-1 text-xs leading-snug'
							: compact
								? 'line-clamp-1 text-[11px] leading-snug'
								: 'line-clamp-2 text-xs leading-snug',
					)}
				>
					{displayIpaWrapped(ipaText)}
				</p>
			) : null}
			{softWrong ? (
				softWrongMeta ? (
					<p className="text-textcolor/60 w-full shrink-0 text-center text-[11px] leading-snug italic line-clamp-2">
						{softWrongMeta}
					</p>
				) : null
			) : (
				<>
					{source ? (
						<p
							className={cn(
								'w-full shrink-0 text-center text-textcolor/65',
								compact
									? 'line-clamp-1 text-[11px] leading-snug'
									: 'line-clamp-2 text-xs leading-snug',
							)}
						>
							{source}
						</p>
					) : null}
					{noteZh ? (
						<p
							className={cn(
								'w-full shrink-0 text-center italic text-textcolor/60',
								compact
									? 'line-clamp-2 text-[10px] leading-snug'
									: 'line-clamp-3 text-xs leading-relaxed',
							)}
						>
							{noteZh}
						</p>
					) : null}
				</>
			)}
		</div>
	);
}

/** 播放钮外圈光晕需留白，避免被 overflow-hidden 父级裁切 */
export function DictationPlaySlot({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				'flex shrink-0 flex-col items-center gap-1.5 overflow-visible px-2.5 py-2',
				className,
			)}
		>
			{children}
		</div>
	);
}

/** 听写首次答错：播放 + 提示，适配固定卡片高度、无滚动 */
export function DictationSoftWrongHintBlock({
	hintContent,
	playing,
	playLabel,
	onPlay,
}: {
	hintContent: PracticeHintFields;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
}) {
	return (
		<div className="flex w-full max-h-full min-h-0 flex-col items-center gap-2">
			<DictationPlaySlot>
				<DictationPlayButton
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
					size="medium"
				/>
				<DictationEqualizer playing={playing} className="h-4 w-32" />
			</DictationPlaySlot>
			<div className="w-full min-h-0 overflow-hidden">
				<DictationHintPanel
					hintContent={hintContent}
					variant="softWrong"
					align="center"
				/>
			</div>
		</div>
	);
}

/** 展开提示：横向听音条 + 线索面板 + 底栏说明 */
function DictationPromptWithHint({
	hintContent,
	playing,
	playLabel,
	onPlay,
}: {
	hintContent: PracticeHintFields;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden justify-between">
			<div className="flex flex-1 shrink-0 flex-col items-center justify-center gap-2">
				<DictationPlayButton
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
					size="strip"
				/>
				<div className="min-h-5 min-w-0">
					<DictationEqualizer playing={playing} className="h-full w-full" />
				</div>
			</div>

			<DictationHintPanel hintContent={hintContent} />
		</div>
	);
}

/** 默认：居中大号播放 */
function DictationPromptDefault({
	hint,
	playing,
	playLabel,
	onPlay,
}: {
	hint: string;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
}) {
	return (
		<>
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-5 mb-3">
				<DictationPlayButton
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
					size="hero"
				/>
				<div className="mt-1 w-full max-w-44">
					<DictationEqualizer playing={playing} className="h-8" />
				</div>
			</div>
			<div className="shrink-0 px-5">
				<p className="text-textcolor/55 mx-auto max-w-xs text-center text-[11px] leading-relaxed">
					{hint}
				</p>
			</div>
		</>
	);
}

export function DictationPromptBody({
	hint,
	hintOpen,
	hintContent,
	playing,
	playLabel,
	onPlay,
	stepListen,
	stepSpell,
	spellStepActive,
}: DictationPromptBodyProps) {
	return (
		<div className="p-3 flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-linear-to-b from-teal-500/6 via-theme-background to-theme-background">
			<div className={cn('shrink-0', hintOpen ? 'pb-1' : 'pb-2')}>
				<DictationStepProgress
					stepListen={stepListen}
					stepSpell={stepSpell}
					playing={playing}
					spellStepActive={spellStepActive}
				/>
			</div>

			{hintOpen ? (
				<DictationPromptWithHint
					hintContent={hintContent}
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
				/>
			) : (
				<DictationPromptDefault
					hint={hint}
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
				/>
			)}
		</div>
	);
}
