import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as React from 'react';

import { cn } from '@/lib/utils';

interface ScrollAreaProps
	extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
	viewportClassName?: string;
	dataTauriDragRegion?: boolean;
	onScroll?: React.UIEventHandler<HTMLDivElement>;
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
	(
		{
			className,
			children,
			viewportClassName,
			dataTauriDragRegion,
			onScroll,
			...props
		},
		ref,
	) => {
		return (
			<ScrollAreaPrimitive.Root
				data-slot="scroll-area"
				className={cn(
					'relative border-2 border-transparent bg-transparent',
					className,
				)}
				{...props}
			>
				<ScrollAreaPrimitive.Viewport
					ref={ref}
					data-tauri-drag-region={dataTauriDragRegion}
					data-slot="scroll-area-viewport"
					className={cn(
						'focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1',
						viewportClassName,
					)}
					onScroll={onScroll}
				>
					{children}
				</ScrollAreaPrimitive.Viewport>
				<ScrollBar />
				<ScrollAreaPrimitive.Corner />
			</ScrollAreaPrimitive.Root>
		);
	},
);

ScrollArea.displayName = 'ScrollArea';

function ScrollBar({
	className,
	orientation = 'vertical',
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
	return (
		<ScrollAreaPrimitive.ScrollAreaScrollbar
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			className={cn(
				'flex touch-none transition-colors select-none',
				orientation === 'vertical' &&
					'h-full w-1.5 border-l border-l-transparent',
				orientation === 'horizontal' &&
					'h-1.5 flex-col border-t border-t-transparent',
				className,
			)}
			{...props}
		>
			<ScrollAreaPrimitive.ScrollAreaThumb
				data-slot="scroll-area-thumb"
				className="bg-theme-border relative flex-1 rounded-full"
			/>
		</ScrollAreaPrimitive.ScrollAreaScrollbar>
	);
}

export { ScrollArea, ScrollBar };
