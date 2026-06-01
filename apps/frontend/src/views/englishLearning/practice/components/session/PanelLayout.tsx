import { ScrollArea } from '@ui/index';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const PRACTICE_PANEL_COMPACT_MIN_ROWS = 3;

export function isPracticePanelCompact(visibleRowCount: number): boolean {
	return visibleRowCount >= PRACTICE_PANEL_COMPACT_MIN_ROWS;
}

/** 网格字段正文：紧凑时略小字号 */
export function practicePanelBodyClass(compact: boolean): string {
	return cn(
		'leading-snug [font-family:var(--font-family)]',
		compact ? 'text-sm' : 'text-base',
	);
}

/** 软揭示 / 完整揭示 — 中部可滚动字段区 */
export function PracticeScrollableFieldStack({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<div className="px-1 flex h-full min-h-0 flex-1 flex-col overflow-hidden">
			<ScrollArea
				className="min-h-0 w-full flex-1"
				viewportClassName="max-h-full"
			>
				<div role="status" aria-live="polite">
					{children}
				</div>
			</ScrollArea>
		</div>
	);
}
