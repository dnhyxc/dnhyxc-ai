/**
 * 结算板 — 统计指标格
 */
import { cn } from '@/lib/utils';
import { METRIC_TONE, type MetricTone } from './tone';

export type MetricProps = {
	label: string;
	value: string | number;
	tone: MetricTone;
	compact?: boolean;
};

export function Metric({ label, value, tone, compact = false }: MetricProps) {
	const styles = METRIC_TONE[tone];
	return (
		<div
			className={cn(
				'flex min-w-0 w-full flex-col items-center justify-between px-1',
				compact ? 'h-full gap-0.5 py-1.5' : 'gap-1 py-3.5',
				styles.shell,
			)}
		>
			<span
				className={cn(
					'text-center font-medium leading-tight',
					compact ? 'text-xs' : 'text-sm',
					styles.label,
				)}
			>
				{label}
			</span>
			<span
				className={cn(
					'text-center font-bold tabular-nums leading-none',
					typeof value === 'string' && value.includes('/')
						? compact
							? 'text-xl'
							: 'text-2xl'
						: 'text-3xl',
					styles.value,
				)}
			>
				{value}
			</span>
		</div>
	);
}
