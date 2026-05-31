/**
 * 单题练习卡 — 中间提示区壳（答题 / 错题叠层）
 */
import { ScrollArea } from '@ui/index';
import { cn } from '@/lib/utils';
import type { SessionPromptPanelProps } from '../../types';

/** 单题练习卡 — 中间提示区壳（答题 / 错题叠层） */
export function SessionPromptPanel({
	children,
	className,
	scrollable = false,
	fillHeight = false,
}: SessionPromptPanelProps) {
	const shellClassName = cn(
		'border-theme/10 bg-theme-background w-full rounded-lg border shadow-sm',
		scrollable
			? cn('flex min-h-0 flex-col overflow-hidden p-0', fillHeight && 'h-full')
			: cn(
					'px-4 py-4',
					fillHeight && 'flex h-full min-h-0 flex-col justify-center',
				),
		className,
	);

	if (!scrollable) {
		return <div className={shellClassName}>{children}</div>;
	}

	return (
		<div className={shellClassName}>
			<ScrollArea
				className={cn(
					'min-h-0 w-full',
					fillHeight ? 'flex-1' : 'max-h-[min(18rem,45dvh)]',
				)}
				viewportClassName={cn(
					'max-h-full',
					fillHeight && '[&>div]:justify-center!',
				)}
			>
				<div
					className={cn(
						'px-4 py-3.5',
						fillHeight && 'flex w-full min-h-full flex-col justify-center',
					)}
				>
					{children}
				</div>
			</ScrollArea>
		</div>
	);
}
