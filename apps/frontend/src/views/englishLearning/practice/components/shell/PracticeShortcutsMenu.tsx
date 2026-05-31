/**
 * 听写/拼写练习 — 顶栏快捷键说明（? 图标下拉）
 */
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { ScrollArea } from '@ui/index';
import {
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	CircleQuestionMark,
	CornerDownLeft,
	type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { PracticeShortcutsMenuProps } from '../../types';

type PracticeShortcutKey =
	| 'enter'
	| 'shiftSpace'
	| 'left'
	| 'right'
	| 'up'
	| 'down';

const PRACTICE_SHORTCUT_ICONS: Record<
	Exclude<PracticeShortcutKey, 'shiftSpace'>,
	{ Icon: LucideIcon; ariaKey: string }
> = {
	enter: {
		Icon: CornerDownLeft,
		ariaKey: 'englishLearning.practice.shortcuts.keyEnter',
	},
	left: {
		Icon: ArrowLeft,
		ariaKey: 'englishLearning.practice.shortcuts.keyLeft',
	},
	right: {
		Icon: ArrowRight,
		ariaKey: 'englishLearning.practice.shortcuts.keyRight',
	},
	up: { Icon: ArrowUp, ariaKey: 'englishLearning.practice.shortcuts.keyUp' },
	down: {
		Icon: ArrowDown,
		ariaKey: 'englishLearning.practice.shortcuts.keyDown',
	},
};

const KEY_BADGE =
	'border-theme/15 bg-theme/5 text-textcolor/80 rounded px-1 py-px text-[10px] font-medium leading-none';

function ShortcutKeyIcon({
	shortcutKey,
}: {
	shortcutKey: PracticeShortcutKey;
}) {
	const { t } = useI18n();
	if (shortcutKey === 'shiftSpace') {
		return (
			<span
				className="inline-flex shrink-0 items-center gap-0.5"
				role="img"
				aria-label={t('englishLearning.practice.shortcuts.keyShiftSpace')}
			>
				<kbd className={KEY_BADGE}>Shift</kbd>
				<kbd className={KEY_BADGE}>
					{t('englishLearning.practice.shortcuts.keySpace')}
				</kbd>
			</span>
		);
	}
	const { Icon, ariaKey } = PRACTICE_SHORTCUT_ICONS[shortcutKey];
	return (
		<span
			className="text-textcolor/90 inline-flex size-4 shrink-0 items-center justify-center"
			role="img"
			aria-label={t(ariaKey)}
		>
			<Icon className="size-3.5" strokeWidth={2} aria-hidden />
		</span>
	);
}

function ShortcutRow({
	label,
	keys,
}: {
	label: string;
	keys: PracticeShortcutKey[];
}) {
	return (
		<div className="flex items-center justify-between gap-3 py-1.5 text-sm">
			<span className="text-textcolor/75 min-w-0 flex-1 leading-snug">
				{label}
			</span>
			<span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
				{keys.map((key) => (
					<ShortcutKeyIcon key={key} shortcutKey={key} />
				))}
			</span>
		</div>
	);
}

function ShortcutSection({
	title,
	rows,
}: {
	title: string;
	rows: { label: string; keys: PracticeShortcutKey[] }[];
}) {
	return (
		<div className="py-0.5">
			<p className="text-textcolor/45 pt-1.5 pb-0.5 text-[11px] font-medium tracking-wide">
				{title}
			</p>
			{rows.map((row) => (
				<ShortcutRow key={row.label} label={row.label} keys={row.keys} />
			))}
		</div>
	);
}

export function PracticeShortcutsMenu({
	practiceMode,
}: PracticeShortcutsMenuProps) {
	const { t } = useI18n();

	type ShortcutRowDef = { label: string; keys: PracticeShortcutKey[] };

	const sections = useMemo((): { title: string; rows: ShortcutRowDef[] }[] => {
		const promptRows: ShortcutRowDef[] = [
			{
				label: t('englishLearning.practice.shortcuts.check'),
				keys: ['enter'],
			},
		];
		if (practiceMode !== 'spelling') {
			promptRows.push({
				label: t('englishLearning.practice.shortcuts.play'),
				keys: ['shiftSpace'],
			});
		}

		return [
			{
				title: t('englishLearning.practice.shortcuts.sectionPrompt'),
				rows: promptRows,
			},
			{
				title: t('englishLearning.practice.shortcuts.sectionSoftWrong'),
				rows: [
					{
						label: t('englishLearning.practice.shortcuts.play'),
						keys: ['shiftSpace'],
					},
					{
						label: t('englishLearning.practice.shortcuts.showAnswer'),
						keys: ['right'],
					},
					{
						label: t('englishLearning.practice.shortcuts.previous'),
						keys: ['up'],
					},
					{
						label: t('englishLearning.practice.shortcuts.retry'),
						keys: ['left'],
					},
					{
						label: t('englishLearning.practice.shortcuts.next'),
						keys: ['down'],
					},
				],
			},
			{
				title: t('englishLearning.practice.shortcuts.sectionRevealed'),
				rows: [
					{
						label: t('englishLearning.practice.shortcuts.play'),
						keys: ['shiftSpace'],
					},
					{
						label: t('englishLearning.practice.shortcuts.previous'),
						keys: ['up'],
					},
					{
						label: t('englishLearning.practice.shortcuts.retry'),
						keys: ['left'],
					},
					{
						label: t('englishLearning.practice.shortcuts.next'),
						keys: ['down'],
					},
				],
			},
		];
	}, [practiceMode, t]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						'text-textcolor/80 hover:text-textcolor flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none',
						'focus-visible:ring-2 focus-visible:ring-teal-500/40',
					)}
					aria-label={t('englishLearning.practice.shortcuts.triggerAria')}
				>
					<CircleQuestionMark className="size-4" aria-hidden />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				sideOffset={8}
				className="w-[min(20rem,calc(100vw-2rem))] p-0"
			>
				<DropdownMenuLabel className="text-textcolor px-3 py-2.5 text-sm font-semibold">
					{t('englishLearning.practice.shortcuts.title')}
				</DropdownMenuLabel>
				<DropdownMenuSeparator className="mx-0" />
				<ScrollArea
					className="max-h-[min(24rem,70dvh)] w-full min-h-0 border-0"
					viewportClassName="max-h-[min(24rem,70dvh)] box-border py-1 pe-3 ps-3"
				>
					{sections.map((section, index) => (
						<div key={section.title}>
							{index > 0 ? <DropdownMenuSeparator className="my-1" /> : null}
							<ShortcutSection title={section.title} rows={section.rows} />
						</div>
					))}
				</ScrollArea>
				<DropdownMenuSeparator className="mx-0" />
				<p className="text-textcolor/45 px-3 pb-1.5 text-xs leading-relaxed">
					{t('englishLearning.practice.shortcuts.footnote')}
				</p>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
