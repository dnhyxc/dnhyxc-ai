/**
 * 分段选择器（模式 / 题量 / 顺序 — 全站练习配置统一控件）
 */
import { cn } from '@/lib/utils';
import type { PracticeSegmentedProps } from '../../types';

export function PracticeSegmented<T extends string>({
	value,
	options,
	onChange,
	className,
}: PracticeSegmentedProps<T>) {
	return (
		<div
			className={cn(
				'border-theme/10 bg-theme/5 flex items-center gap-0.5 rounded-md border p-0.5',
				className,
			)}
			role="tablist"
		>
			{options.map((opt) => {
				const active = value === opt.value;
				return (
					<button
						key={opt.value}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(opt.value)}
						className={cn(
							'inline-flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-sm px-2.5 text-sm font-medium leading-none transition-colors',
							active
								? 'bg-teal-600 text-white shadow-sm'
								: 'text-textcolor/60 hover:bg-theme/10 hover:text-textcolor',
						)}
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
