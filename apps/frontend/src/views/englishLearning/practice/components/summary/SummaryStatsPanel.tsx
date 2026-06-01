/**
 * 结算页 — 正确率与分项统计（无报告标题，可紧凑以腾出错题列表空间）
 */
import { cn } from '@/lib/utils';
import { SUMMARY_ACCENT_TONE } from './metricTone';
import { SummaryMetric } from './SummaryMetric';

type SummaryStatsPanelProps = {
	accuracyPct: number;
	correctCount: number;
	wrongCount: number;
	roundTotal: number;
	practicedTotal: number;
	/** 有错题列表时压缩统计区高度 */
	compact?: boolean;
	labels: {
		accuracy: string;
		correct: string;
		wrong: string;
		roundTotal: string;
		practiced: string;
	};
};

export function SummaryStatsPanel({
	accuracyPct,
	correctCount,
	wrongCount,
	roundTotal,
	practicedTotal,
	compact = false,
	labels,
}: SummaryStatsPanelProps) {
	const accent = SUMMARY_ACCENT_TONE;

	const accuracyValue = (
		<p
			className={cn(
				'font-bold tabular-nums leading-none tracking-tight',
				accent.value,
				compact ? 'text-3xl' : 'text-5xl',
			)}
		>
			{accuracyPct}%
		</p>
	);

	const accuracyCell = (
		<div
			className={cn(
				'flex min-w-0 w-full flex-col items-center justify-between gap-0.5 px-1',
				compact ? 'h-full py-1.5' : 'py-5',
				accent.shell,
			)}
		>
			<p
				className={cn(
					'text-center font-medium leading-tight',
					compact ? 'text-xs' : 'text-sm tracking-wide',
					accent.label,
				)}
			>
				{labels.accuracy}
			</p>
			{accuracyValue}
		</div>
	);

	if (compact) {
		return (
			<div className="grid h-16 w-full shrink-0 grid-cols-5 items-stretch">
				{accuracyCell}
				<SummaryMetric
					compact
					tone="correct"
					label={labels.correct}
					value={correctCount}
				/>
				<SummaryMetric
					compact
					tone="wrong"
					label={labels.wrong}
					value={wrongCount}
				/>
				<SummaryMetric
					compact
					tone="total"
					label={labels.roundTotal}
					value={roundTotal}
				/>
				<SummaryMetric
					compact
					tone="practiced"
					label={labels.practiced}
					value={practicedTotal}
				/>
			</div>
		);
	}

	return (
		<div className="grid w-full grid-cols-5">
			{accuracyCell}
			<SummaryMetric
				tone="correct"
				label={labels.correct}
				value={correctCount}
			/>
			<SummaryMetric tone="wrong" label={labels.wrong} value={wrongCount} />
			<SummaryMetric
				tone="total"
				label={labels.roundTotal}
				value={roundTotal}
			/>
			<SummaryMetric
				tone="practiced"
				label={labels.practiced}
				value={practicedTotal}
			/>
		</div>
	);
}
