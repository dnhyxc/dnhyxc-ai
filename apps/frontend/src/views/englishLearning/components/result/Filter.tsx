/**
 * 作答明细 — 错误/正确筛选（再点取消）
 */
import { cn } from '@/lib/utils';

export type FilterKind = 'all' | 'wrong' | 'correct';

const PILL =
	'rounded-md px-2 pt-0.5 pb-1 text-xs font-semibold tabular-nums transition-colors cursor-pointer';
const WRONG_IDLE = 'bg-rose-600/15 text-rose-500/80 hover:bg-rose-600/25';
const WRONG_ON = 'bg-rose-500/30 text-rose-600 ring-1 ring-rose-500/50';
const CORRECT_IDLE = 'bg-teal-500/[0.3] text-teal-600 hover:bg-teal-500/35';
const CORRECT_ON = 'bg-teal-500/30 text-teal-700 ring-1 ring-teal-500/50';

type FilterProps = {
	filter: FilterKind;
	wrongCount: number;
	correctCount: number;
	wrongLabel: string;
	correctLabel: string;
	onToggle: (next: 'wrong' | 'correct') => void;
};

export function Filter({
	filter,
	wrongCount,
	correctCount,
	wrongLabel,
	correctLabel,
	onToggle,
}: FilterProps) {
	if (wrongCount <= 0 && correctCount <= 0) return null;
	return (
		<div className="flex shrink-0 items-center gap-1.5">
			{wrongCount > 0 ? (
				<button
					type="button"
					aria-pressed={filter === 'wrong'}
					className={cn(PILL, filter === 'wrong' ? WRONG_ON : WRONG_IDLE)}
					onClick={() => onToggle('wrong')}
				>
					{wrongLabel}
				</button>
			) : null}
			{correctCount > 0 ? (
				<button
					type="button"
					aria-pressed={filter === 'correct'}
					className={cn(PILL, filter === 'correct' ? CORRECT_ON : CORRECT_IDLE)}
					onClick={() => onToggle('correct')}
				>
					{correctLabel}
				</button>
			) : null}
		</div>
	);
}

export function toggleFilter(
	prev: FilterKind,
	next: 'wrong' | 'correct',
): FilterKind {
	return prev === next ? 'all' : next;
}
