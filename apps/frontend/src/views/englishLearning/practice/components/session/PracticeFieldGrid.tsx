/**
 * 练习卡字段网格与听音底栏（软揭示 / 完整揭示共用）
 *
 * - FieldCells：标签 | 内容 两行网格
 * - PRACTICE_PANEL_SHELL：渐变面板壳
 * - PracticeSoftWrongListenFooter / PracticeRevealedListenFooter：底栏播放区
 */
import { Eye } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
	DictationCircleButton,
	DictationEqualizer,
	DictationPlayButton,
	DictationPlaySlot,
} from '../prompt/DictationPrompt';

export const PRACTICE_PANEL_SHELL =
	'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[inherit] bg-linear-to-b from-teal-500/6 via-theme-background to-theme-background p-3';

const FIELD_GRID =
	'grid w-full grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-5';

const LABEL_CELL =
	'text-textcolor/45 block w-full text-justify text-sm font-medium leading-snug tracking-normal [text-align-last:justify] [font-family:var(--font-family)]';

const VALUE_CELL =
	'text-textcolor min-w-0 text-base leading-snug wrap-break-word [font-family:var(--font-family)]';

/** 网格字段：标签 + 值（行间 mb-3，末行不留底距） */
export function FieldCells({
	label,
	children,
	valueClassName,
}: {
	label: string;
	children: ReactNode;
	valueClassName?: string;
}) {
	return (
		<div className={cn(FIELD_GRID, 'mb-3 last:mb-0')}>
			<span className={LABEL_CELL}>{label}</span>
			<div className={cn(VALUE_CELL, valueClassName)}>{children}</div>
		</div>
	);
}

/** 第二阶段软揭示：左播放 · 中音浪+引导 · 右看答案 */
export function PracticeSoftWrongListenFooter({
	playing,
	playLabel,
	onPlay,
	guidance,
	trailing,
}: {
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
	guidance: string;
	trailing: ReactNode;
}) {
	return (
		<div className="mt-auto shrink-0 pt-4">
			<div className="flex items-center gap-2">
				<DictationPlaySlot className="shrink-0 px-0 py-0">
					<DictationPlayButton
						playing={playing}
						playLabel={playLabel}
						onPlay={onPlay}
						size="medium"
					/>
				</DictationPlaySlot>

				<div className="flex min-h-9 min-w-0 flex-1 flex-col items-center justify-center gap-1.5">
					<DictationEqualizer
						playing={playing}
						className="h-5 w-36 justify-center sm:w-44"
					/>
					<p className="text-textcolor/50 max-w-xs text-center text-[11px] leading-relaxed">
						{guidance}
					</p>
				</div>

				<div className="flex shrink-0 items-center">{trailing}</div>
			</div>
		</div>
	);
}

/** 完整揭示：左右布局 — 左播放、右音浪（整行拉满） */
export function PracticeRevealedListenFooter({
	playing,
	playLabel,
	onPlay,
}: {
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
}) {
	return (
		<div className="mt-auto w-full shrink-0 pt-4">
			<div className="flex w-full items-center justify-between gap-3 pr-1">
				<DictationPlaySlot className="shrink-0 px-0 py-0">
					<DictationPlayButton
						playing={playing}
						playLabel={playLabel}
						onPlay={onPlay}
						size="medium"
					/>
				</DictationPlaySlot>
				<div className="flex min-h-5 min-w-0 flex-1 justify-end ps-2">
					<DictationEqualizer
						playing={playing}
						className="h-5 w-full max-w-44 justify-end"
					/>
				</div>
			</div>
		</div>
	);
}

/** 软揭示底栏 — 看答案（圆形，样式与播放钮一致） */
export function PracticeShowAnswerButton({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	const useIcon = label.length > 4;

	return (
		<DictationPlaySlot className="shrink-0 px-0 py-0">
			<DictationCircleButton ariaLabel={label} onClick={onClick} size="medium">
				{useIcon ? (
					<Eye className="size-4" aria-hidden />
				) : (
					<span className="px-0.5 text-center text-[10px] leading-none font-semibold tracking-tight">
						{label}
					</span>
				)}
			</DictationCircleButton>
		</DictationPlaySlot>
	);
}
