import { cn } from '@/lib/utils';
import { ScrollFab } from './ScrollFab';
import type { AssistantFooterProps } from './types';

/** 助手输入区：max-w-3xl 居中 + 可选置顶/置底 FAB */
export function AssistantFooter({
	embedded: _embedded = false,
	containerClassName,
	showScrollFab = false,
	scrollFab,
	children,
}: AssistantFooterProps) {
	return (
		<div className="min-w-0 w-full shrink-0">
			<div
				className={cn(
					'relative mx-auto min-w-0 w-full max-w-3xl pl-4 pr-4',
					containerClassName,
				)}
			>
				{showScrollFab && scrollFab ? <ScrollFab {...scrollFab} /> : null}
				{children}
			</div>
		</div>
	);
}
