import { ScrollArea } from '@ui/index';
import { forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const EPUB_THOUGHT_PANEL_SCROLL_VIEWPORT_CLASS =
	'h-full min-h-0 min-w-0 max-w-full focus-visible:ring-0 focus-visible:outline-none [&>div]:!min-w-0 [&>div]:!max-w-full [&>div]:min-h-0!';

type Props = {
	children: ReactNode;
	footer?: ReactNode;
	contentClassName?: string;
	onWheel?: React.WheelEventHandler<HTMLDivElement>;
	onWheelCapture?: React.WheelEventHandler<HTMLDivElement>;
};

/** 读书想法：阅读页右侧分栏容器（与 MOKE 助手同栏位） */
export const EpubThoughtPanelShell = forwardRef<HTMLDivElement, Props>(
	function EpubThoughtPanelShell(
		{ children, footer, contentClassName, onWheel, onWheelCapture },
		ref,
	) {
		return (
			<div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
				<ScrollArea
					ref={ref}
					className="min-h-0 flex-1 border-0"
					viewportClassName={EPUB_THOUGHT_PANEL_SCROLL_VIEWPORT_CLASS}
					scrollbarClassName="w-2 pr-px"
					onWheel={onWheel}
					onWheelCapture={onWheelCapture}
				>
					<div className={cn('flex flex-col', contentClassName)}>
						{children}
					</div>
				</ScrollArea>

				{footer ? (
					<div className="shrink-0 mt-4 border-t border-theme/10">{footer}</div>
				) : null}
			</div>
		);
	},
);
