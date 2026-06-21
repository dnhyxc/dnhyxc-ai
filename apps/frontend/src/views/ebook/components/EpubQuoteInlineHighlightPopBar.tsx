import { Popover, PopoverAnchor, PopoverContent } from '@ui/index';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
	EpubSelectionPopBarPanel,
	type EpubSelectionPopBarPanelProps,
} from './EpubSelectionPopBarPanel';

type Props = EpubSelectionPopBarPanelProps & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
};

/** 侧栏引用块上方内嵌 PopBar（Radix 锚定引用 DOM，不用 fixed 坐标） */
export function EpubQuoteInlineHighlightPopBar({
	open,
	onOpenChange,
	children,
	...panelProps
}: Props) {
	const anchorRef = useRef<HTMLDivElement>(null);
	const [caretAnchorX, setCaretAnchorX] = useState<number | undefined>();

	useLayoutEffect(() => {
		if (!open) {
			setCaretAnchorX(undefined);
			return;
		}
		const el = anchorRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		setCaretAnchorX(rect.left + rect.width / 2);
	}, [open]);

	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<PopoverAnchor asChild>
				<div ref={anchorRef} className="relative">
					{children}
				</div>
			</PopoverAnchor>
			<PopoverContent
				side="top"
				align="center"
				sideOffset={8}
				collisionPadding={12}
				className={cn(
					'group/pop z-[60] w-auto border-0 bg-transparent p-0 shadow-none outline-none',
				)}
				onOpenAutoFocus={(e) => e.preventDefault()}
				onCloseAutoFocus={(e) => e.preventDefault()}
				onMouseDown={(e) => e.preventDefault()}
			>
				<EpubSelectionPopBarPanel
					{...panelProps}
					caretAnchorX={caretAnchorX}
					variant="inline"
				/>
			</PopoverContent>
		</Popover>
	);
}
