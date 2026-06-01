/**
 * 单题练习卡 — 中间提示区壳（答题 / 错题叠层）
 */
import { cn } from '@/lib/utils';
import type { SessionPromptPanelProps } from '../../types';

export function SessionPromptPanel({
	children,
	className,
	fillHeight = false,
}: SessionPromptPanelProps) {
	return (
		<div
			className={cn(
				'border-theme/10 bg-theme-background w-full rounded-lg border shadow-sm px-4 py-4',
				fillHeight && 'flex h-full min-h-0 flex-col justify-center',
				className,
			)}
		>
			{children}
		</div>
	);
}
