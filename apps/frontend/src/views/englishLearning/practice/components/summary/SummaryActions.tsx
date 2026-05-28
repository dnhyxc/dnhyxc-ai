/**
 * 结算页 — 底部操作按钮（单行、按功能区分配色与图标）
 */
import { Button, Spinner } from '@ui/index';
import { ListPlus, RotateCcw, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SummaryActionsProps } from '../../types';

const ACTION_BTN_BASE = cn(
	'h-10 min-h-10 min-w-0 border flex-1 gap-1.5 px-2 text-sm font-medium shadow-none',
	'rounded-md transition-colors',
	'disabled:pointer-events-none disabled:opacity-50',
);

const ACTION_BTN_TONE = {
	/** 重练错题 */
	retry: cn(
		ACTION_BTN_BASE,
		'border-rose-500/30 bg-rose-500/[0.18] text-rose-500',
		'hover:border-rose-500/45 hover:bg-rose-500/[0.15] mt-px',
	),
	/** 继续练习（拉取新词） */
	continue: cn(
		ACTION_BTN_BASE,
		'border-teal-500/40 bg-teal-500/[0.18] text-teal-500',
		'hover:border-teal-500/55 hover:bg-teal-500/20 dark:text-teal-300',
	),
	/** 重新设置 */
	setup: cn(
		ACTION_BTN_BASE,
		'border-sky-500/35 bg-sky-500/[0.18] text-sky-500',
		'hover:border-sky-500/50 hover:bg-sky-500/[0.14] dark:text-sky-300',
	),
} as const;

export function SummaryActions({
	hasWrongItems,
	continueLoading,
	labels,
	onRetryWrong,
	onBackToSetup,
	onContinuePractice,
}: SummaryActionsProps) {
	return (
		<div className="shrink-0 w-full">
			<div className="flex flex-nowrap items-stretch gap-2">
				{hasWrongItems ? (
					<Button
						type="button"
						variant="ghost"
						className={ACTION_BTN_TONE.retry}
						onClick={onRetryWrong}
					>
						<RotateCcw className="size-3.5 shrink-0" aria-hidden />
						<span className="truncate">{labels.retryWrong}</span>
					</Button>
				) : null}
				<Button
					type="button"
					variant="ghost"
					disabled={continueLoading}
					className={ACTION_BTN_TONE.continue}
					onClick={onContinuePractice}
				>
					{continueLoading ? (
						<Spinner className="size-4 shrink-0" />
					) : (
						<ListPlus className="size-3.5 shrink-0" aria-hidden />
					)}
					<span className="truncate">{labels.continuePractice}</span>
				</Button>
				<Button
					type="button"
					variant="ghost"
					className={ACTION_BTN_TONE.setup}
					onClick={onBackToSetup}
				>
					<Settings2 className="size-3.5 shrink-0" aria-hidden />
					<span className="truncate">{labels.practiceAgain}</span>
				</Button>
			</div>
		</div>
	);
}
