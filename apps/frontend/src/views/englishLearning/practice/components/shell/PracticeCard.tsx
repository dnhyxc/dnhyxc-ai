/**
 * 练习内容卡片容器
 */
import { cn } from '@/lib/utils';
import type { PracticeCardProps } from '../../types';

export function PracticeCard({
	children,
	className,
	...rest
}: PracticeCardProps) {
	return (
		<div
			className={cn('bg-theme/5 border border-theme/5 rounded-md', className)}
			{...rest}
		>
			{children}
		</div>
	);
}
