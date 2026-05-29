/**
 * 英语学习 — 经典语句展示卡片（间距/字号与资源库列表一致；勾选仅增加左侧列）
 */

import { Checkbox } from '@ui/checkbox';
import { Button } from '@ui/index';
import { Label } from '@ui/label';
import { Square, Volume2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

export type ClassicQuoteCardVariant = 'library' | 'selectable';

/** 卡片展示的经典句快照字段 */
export type ClassicQuoteCardData = {
	english: string;
	translationZh: string;
	source?: string | null;
	noteZh?: string | null;
};

export type ClassicQuoteCardSelection = {
	controlId: string;
	checked: boolean;
	disabled?: boolean;
	onCheckedChange: (checked: boolean) => void;
	ariaLabel: string;
};

export type ClassicQuoteCardProps = {
	data: ClassicQuoteCardData;
	className?: string;
	/** library：资源库/包；selectable：收藏、错题集 */
	variant?: ClassicQuoteCardVariant;
	selection?: ClassicQuoteCardSelection;
	playing?: boolean;
	playDisabled?: boolean;
	onTogglePlay?: () => void;
	playLabels: { play: string; stop: string };
	trailingActions?: ReactNode;
	footer?: ReactNode;
	/** selectable 或 forceNote 时始终展示赏析行（即使为空） */
	forceNote?: boolean;
};

function QuoteHeader({
	english,
	controlId,
}: {
	english: string;
	controlId?: string;
}) {
	if (controlId) {
		return (
			<Label
				htmlFor={controlId}
				className="select-text text-textcolor min-w-0 flex-1 cursor-pointer text-base font-medium leading-snug"
			>
				{english}
			</Label>
		);
	}

	return (
		<div className="text-textcolor min-w-0 flex-1 text-base font-medium leading-snug">
			{english}
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
		<div className="flex shrink-0 items-center gap-1">
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
							? 'border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-400'
							: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-violet-600 dark:hover:text-violet-400',
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

export function ClassicQuoteCard({
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
	forceNote = false,
}: ClassicQuoteCardProps) {
	const { t } = useI18n();
	const { english, translationZh, source, noteZh } = data;
	const controlId = selection?.controlId;
	const showNote =
		variant === 'selectable' || forceNote || Boolean(noteZh?.trim());
	const hasActions = Boolean(onTogglePlay || trailingActions);

	const cardBody = (
		<div
			className={cn(
				'flex min-w-0 flex-col gap-1.5 h-full justify-between',
				selection ? 'min-w-0 flex-1' : undefined,
			)}
		>
			<div className="flex items-start justify-between gap-2">
				<QuoteHeader english={english} controlId={controlId} />
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
			<div className="text-textcolor/95 text-sm leading-snug">
				{translationZh}
			</div>
			<div className="text-textcolor/70 text-xs">
				{t('englishLearning.classic.sourceLabel')}
				{source?.trim() || '—'}
			</div>
			{showNote ? (
				<div className="text-textcolor/70 text-xs leading-relaxed italic">
					{noteZh}
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
						className="mt-0.5 shrink-0 cursor-pointer"
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
