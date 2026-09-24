/**
 * 结算板 — 正确率与分项统计
 */
import { cn } from '@/lib/utils';
import { Metric } from './Metric';
import { ACCENT_TONE } from './tone';

type StatsProps = {
	accuracyPct: number;
	/** 多轮时展示总正确率；单轮不传 */
	overallAccuracyPct?: number;
	correctCount: number;
	wrongCount: number;
	roundTotal: number;
	practicedTotal: number;
	/** 词库/题源总量；有则「已练习」显示 已练/总量 */
	poolTotal?: number;
	/** 有明细列表时压缩统计区高度 */
	compact?: boolean;
	labels: {
		accuracy: string;
		overallAccuracy?: string;
		correct: string;
		wrong: string;
		roundTotal: string;
		practiced: string;
	};
};

export function Stats({
	accuracyPct,
	overallAccuracyPct,
	correctCount,
	wrongCount,
	roundTotal,
	practicedTotal,
	poolTotal,
	compact = false,
	labels,
}: StatsProps) {
	const accent = ACCENT_TONE;
	const showOverall =
		overallAccuracyPct != null && Boolean(labels.overallAccuracy);
	const practicedValue =
		poolTotal != null && poolTotal > 0
			? `${practicedTotal}/${poolTotal}`
			: practicedTotal;

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

	const overallCell =
		showOverall && labels.overallAccuracy ? (
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
					{labels.overallAccuracy}
				</p>
				<p
					className={cn(
						'font-bold tabular-nums leading-none tracking-tight',
						accent.value,
						compact ? 'text-3xl' : 'text-5xl',
					)}
				>
					{overallAccuracyPct}%
				</p>
			</div>
		) : null;

	const rest = (
		<>
			<Metric
				compact={compact}
				tone="correct"
				label={labels.correct}
				value={correctCount}
			/>
			<Metric
				compact={compact}
				tone="wrong"
				label={labels.wrong}
				value={wrongCount}
			/>
			<Metric
				compact={compact}
				tone="total"
				label={labels.roundTotal}
				value={roundTotal}
			/>
			<Metric
				compact={compact}
				tone="practiced"
				label={labels.practiced}
				value={practicedValue}
			/>
		</>
	);

	return (
		<div
			className={cn(
				'grid w-full items-stretch',
				compact && 'h-16 shrink-0',
				showOverall ? 'grid-cols-6' : 'grid-cols-5',
			)}
		>
			{accuracyCell}
			{overallCell}
			{rest}
		</div>
	);
}
