/**
 * 英语学习 — 单词展示卡片（间距/字号与资源库列表一致；勾选仅增加左侧列）
 */

import { Checkbox } from '@ui/checkbox';
import { Button } from '@ui/index';
import { Label } from '@ui/label';
import { Square, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import { SegmentationLine } from './SegmentationLine';

export type VocabularyWordCardVariant = 'library' | 'selectable';

/** 卡片展示的单词快照字段 */
export type VocabularyWordCardData = {
	word: string;
	ipa: string;
	pos?: string | null;
	segmentation?: string | null;
	translationZh: string;
	example?: string | null;
};

/** @deprecated 使用 VocabularyWordCardData */
export type VocabularyWordCardFields = VocabularyWordCardData;

export type VocabularyWordCardSelection = {
	controlId: string;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange: (checked: boolean) => void;
	ariaLabel: string;
};

export type VocabularyWordCardProps = {
	data: VocabularyWordCardData;
	className?: string;
	/** library：词库/包；selectable：收藏、错题集（例句行始终展示） */
	variant?: VocabularyWordCardVariant;
	selection?: VocabularyWordCardSelection;
	playing?: boolean;
	playDisabled?: boolean;
	onTogglePlay?: () => void;
	playLabels: { play: string; stop: string };
	trailingActions?: ReactNode;
	footer?: ReactNode;
	/** library 变体下仍展示例句行（如单词包） */
	forceExample?: boolean;
};

function WordHeader({
	word,
	pos,
	controlId,
}: {
	word: string;
	pos?: string | null;
	controlId?: string;
}) {
	const posNode = pos?.trim() ? (
		<span className="text-textcolor/55 shrink-0 text-xs font-medium">
			{pos}
		</span>
	) : null;

	if (controlId) {
		return (
			<Label
				htmlFor={controlId}
				className="select-text flex min-w-0 cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5"
			>
				<span className="truncate text-lg font-semibold text-textcolor">
					{word}
				</span>
				{posNode}
			</Label>
		);
	}

	return (
		<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
			<div className="truncate text-lg font-semibold text-textcolor">
				{word}
			</div>
			{posNode}
		</div>
	);
}

function CardActionButtons({
	playing,
	playDisabled,
	onTogglePlay,
	playLabels,
	trailingActions,
}: {
	playing: boolean;
	playDisabled: boolean;
	onTogglePlay?: () => void;
	playLabels: { play: string; stop: string };
	trailingActions?: ReactNode;
}) {
	if (!onTogglePlay && !trailingActions) {
		return null;
	}

	return (
		<div className="row-span-3 flex shrink-0 items-center gap-1 self-start">
			{onTogglePlay ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={playDisabled}
					onClick={onTogglePlay}
					className={cn(
						'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
						playing
							? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
							: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
					)}
					aria-label={playing ? playLabels.stop : playLabels.play}
				>
					{playing ? (
						<Square className="size-3.5 fill-current" />
					) : (
						<Volume2 className="size-3.5" />
					)}
				</Button>
			) : null}
			{trailingActions}
		</div>
	);
}

export function VocabularyWordCard({
	data,
	className,
	variant = 'library',
	selection,
	playing = false,
	playDisabled = false,
	onTogglePlay,
	playLabels,
	trailingActions,
	footer,
	forceExample = false,
}: VocabularyWordCardProps) {
	const { word, ipa, pos, segmentation, translationZh, example } = data;
	const controlId = selection?.controlId;
	const showExample =
		variant === 'selectable' || forceExample || Boolean(example?.trim());
	const hasActions = Boolean(onTogglePlay || trailingActions);

	const cardBody = (
		<div
			className={cn(
				'flex min-w-0 flex-col justify-between gap-1.5 h-full',
				selection ? 'min-w-0 flex-1' : undefined,
			)}
		>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-0">
				<WordHeader word={word} pos={pos} controlId={controlId} />
				{hasActions ? (
					<CardActionButtons
						playing={playing}
						playDisabled={playDisabled}
						onTogglePlay={onTogglePlay}
						playLabels={playLabels}
						trailingActions={trailingActions}
					/>
				) : null}
			</div>
			<div className="min-w-0 font-mono text-xs leading-snug text-teal-600/90 dark:text-teal-400/90">
				{displayIpaWrapped(ipa)}
			</div>
			<SegmentationLine segmentation={segmentation} className="min-w-0" />
			<div className="text-textcolor/95 text-sm leading-snug">
				{translationZh}
			</div>
			{showExample ? (
				<div className="text-textcolor/80 text-sm leading-relaxed italic">
					{example}
				</div>
			) : null}
			{footer}
		</div>
	);

	return (
		<div
			className={cn(
				'select-text bg-theme/5 border border-theme/5 flex min-w-0 flex-col rounded-md px-3 py-2.5',
				className,
			)}
		>
			{selection ? (
				<div className="flex items-start gap-2 h-full">
					<Checkbox
						id={selection.controlId}
						className="mt-1.5 shrink-0 cursor-pointer"
						checked={selection.checked}
						disabled={selection.disabled}
						onCheckedChange={(v) => selection.onCheckedChange(v === true)}
						aria-label={selection.ariaLabel}
					/>
					{cardBody}
				</div>
			) : (
				cardBody
			)}
		</div>
	);
}
