/**
 * 听写题 — 步骤条、播放；展开提示时在固定高度内分区展示（无滚动）
 */
import { Square, Volume2 } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import type {
	DictationPromptBodyProps,
	DictationStepProgressProps,
	PracticeHintFields,
} from '../../types';

const DICTATION_EQUALIZER_DELAYS = [
	0, 0.09, 0.18, 0.05, 0.14, 0.22, 0.07, 0.16, 0.11,
] as const;

function DictationEqualizer({
	playing,
	className,
}: {
	playing: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn('flex h-5 items-end justify-center gap-0.5', className)}
			aria-hidden
		>
			{DICTATION_EQUALIZER_DELAYS.map((delay, index) => (
				<span
					key={index}
					className={cn(
						'w-0.5 rounded-full bg-linear-to-t from-teal-600/50 to-teal-300/90 sm:w-1',
						playing ? 'practice-dictation-bar h-3.5' : 'h-1.5 opacity-35',
					)}
					style={playing ? { animationDelay: `${delay}s` } : undefined}
				/>
			))}
		</div>
	);
}

function DictationPlayButton({
	playing,
	playLabel,
	onPlay,
	size = 'hero',
}: {
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
	size?: 'hero' | 'strip';
}) {
	const isStrip = size === 'strip';
	const outer = isStrip ? 'size-10' : 'size-14';
	const inner = isStrip ? 'size-8' : 'size-12';
	const icon = isStrip ? 'size-3.5' : 'size-5';

	return (
		<button
			type="button"
			onClick={onPlay}
			aria-label={playLabel}
			className={cn(
				'group relative flex shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
				outer,
			)}
		>
			<span
				className={cn(
					'absolute inset-0 rounded-full',
					playing
						? 'bg-teal-500/15 ring-2 ring-teal-500/25 motion-reduce:ring-0'
						: 'bg-teal-500/8 opacity-0 group-hover:opacity-100',
				)}
				aria-hidden
			/>
			<span
				className={cn(
					'relative z-10 flex items-center justify-center rounded-full border-2 shadow-md group-active:scale-[0.97]',
					inner,
					playing
						? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
						: 'border-white/15 bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-teal-500/25',
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
function DictationHintPanel({
	hintContent,
}: {
	hintContent: PracticeHintFields;
}) {
	const { t } = useI18n();
	const translation = hintContent.translationZh?.trim();
	const ipaText = hintContent.ipa?.trim();

	if (!translation && !ipaText) return null;

	return (
		<div
			className="flex w-full min-h-0 flex-col items-center justify-between gap-2 px-3 text-center"
			aria-live="polite"
		>
			{translation ? (
				<div className="flex w-full min-w-0 flex-col gap-2">
					<span className="text-textcolor/45 text-xs font-medium tracking-wide">
						{t('englishLearning.practice.hintLabelTranslation')}
					</span>
					<p className="text-textcolor line-clamp-3 text-sm font-semibold leading-snug">
						{translation}
					</p>
				</div>
			) : null}
			{ipaText ? (
				<p className="font-mono text-xs leading-snug text-teal-600/90 line-clamp-2 dark:text-teal-400/90">
					{displayIpaWrapped(ipaText)}
				</p>
			) : null}
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
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-5">
				<DictationPlayButton
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
					size="hero"
				/>
				<div className="mt-2 w-full max-w-44">
					<DictationEqualizer playing={playing} className="h-8" />
				</div>
				<p
					className={cn(
						'mt-1.5 text-center text-xs font-medium',
						playing ? 'text-teal-400' : 'text-textcolor/55',
					)}
				>
					{playLabel}
				</p>
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
