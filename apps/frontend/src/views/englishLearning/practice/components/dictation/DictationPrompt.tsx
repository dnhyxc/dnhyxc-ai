/**
 * 听写题 — 步骤条、播放钮与均衡器
 */
import { Square, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
	DictationPromptBodyProps,
	DictationStepProgressProps,
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
			className={cn('flex h-8 items-end justify-center gap-1', className)}
			aria-hidden
		>
			{DICTATION_EQUALIZER_DELAYS.map((delay, index) => (
				<span
					key={index}
					className={cn(
						'w-1 rounded-full bg-linear-to-t from-teal-600/50 to-teal-300/90',
						playing ? 'practice-dictation-bar h-4' : 'h-2 opacity-30',
					)}
					style={playing ? { animationDelay: `${delay}s` } : undefined}
				/>
			))}
		</div>
	);
}

/** 听写播放钮（尺寸与渐变勿改） */
function DictationPlayButton({
	playing,
	playLabel,
	onPlay,
}: {
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onPlay}
			aria-label={playLabel}
			className="group relative flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
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
					'relative z-10 flex size-12 items-center justify-center rounded-full border-2 shadow-md group-active:scale-[0.97]',
					playing
						? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
						: 'border-white/15 bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-teal-500/25',
				)}
			>
				{playing ? (
					<Square className="size-5 fill-current" />
				) : (
					<Volume2 className="size-5" />
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
			<div className="mt-2.5 flex items-baseline justify-between gap-3">
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

export function DictationPromptBody({
	hint,
	playing,
	playLabel,
	onPlay,
	stepListen,
	stepSpell,
	spellStepActive,
}: DictationPromptBodyProps) {
	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit] bg-linear-to-b from-teal-500/6 via-theme-background to-theme-background">
			<div className="shrink-0 px-5 pt-3.5 pb-2">
				<DictationStepProgress
					stepListen={stepListen}
					stepSpell={stepSpell}
					playing={playing}
					spellStepActive={spellStepActive}
				/>
			</div>

			<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-4">
				<DictationPlayButton
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
				/>
				<div className="mt-2.5 w-full max-w-44">
					<DictationEqualizer playing={playing} />
				</div>
				<p
					className={cn(
						'mt-2 text-center text-xs font-medium',
						playing ? 'text-teal-400' : 'text-textcolor/55',
					)}
				>
					{playLabel}
				</p>
			</div>

			<div className="shrink-0 px-5 pt-2 pb-3.5">
				<p className="text-textcolor/55 mx-auto max-w-xs text-center text-[11px] leading-relaxed">
					{hint}
				</p>
			</div>
		</div>
	);
}
