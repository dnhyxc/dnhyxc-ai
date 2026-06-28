import { Popover, PopoverAnchor, PopoverContent } from '@ui/index';
import { type CSSProperties, useLayoutEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { EpubHighlightColorId, EpubHighlightStyle } from '../../types';
import type { EpubReaderBgTheme } from '../../utils/epub/reader/epubReaderSettings';
import type { EpubSelectionPopBarPayload } from '../../utils/epub/reader/epubSelectionToolbarAttach';
import {
	type EpubSelectionPopBarLabels,
	EpubSelectionPopBarPanel,
} from './EpubSelectionPopBarPanel';

export type EpubSelectionPopBarState = EpubSelectionPopBarPayload & {
	open: boolean;
};

export type { EpubSelectionPopBarLabels };

type Props = {
	state: EpubSelectionPopBarState | null;
	labels: EpubSelectionPopBarLabels;
	selectionFullyHighlighted?: boolean;
	selectionHasHighlight?: boolean;
	highlightStyle: EpubHighlightStyle;
	highlightColor: EpubHighlightColorId;
	onHighlightStyleChange: (style: EpubHighlightStyle) => void;
	onHighlightColorChange: (color: EpubHighlightColorId) => void;
	onCopy: () => void;
	onApplyHighlight: () => void;
	onRemoveHighlight: () => void;
	onWriteThought: () => void;
	onAskBook: () => void;
	onShare?: () => void;
	onListen?: () => void;
	onClearSelection?: () => void;
	/** Portal 挂载阅读 chrome CSS 变量（字色/表面） */
	chromeStyle?: CSSProperties;
	readerBgTheme?: EpubReaderBgTheme;
};

/**
 * 选区上方浮动操作条（Pop Sidebar）。
 * 锚点 + Radix Popover 碰撞检测，与 EpubReaderContextMenu 相同，避免贴边溢出。
 */
export function EpubSelectionPopBar({
	state,
	labels,
	selectionFullyHighlighted,
	selectionHasHighlight,
	highlightStyle,
	highlightColor,
	onHighlightStyleChange,
	onHighlightColorChange,
	onCopy,
	onApplyHighlight,
	onRemoveHighlight,
	onWriteThought,
	onAskBook,
	onShare,
	onListen,
	onClearSelection,
	chromeStyle,
	readerBgTheme = 'default',
}: Props) {
	const [visible, setVisible] = useState(false);

	const anchorStyle = useMemo(
		() =>
			state
				? ({
						position: 'fixed',
						left: state.x,
						top: state.y,
						width: 1,
						height: 1,
						pointerEvents: 'none',
					} as const)
				: undefined,
		[state],
	);

	useLayoutEffect(() => {
		if (!state?.open) {
			setVisible(false);
			return;
		}
		setVisible(false);
		const id = requestAnimationFrame(() => {
			requestAnimationFrame(() => setVisible(true));
		});
		return () => cancelAnimationFrame(id);
	}, [state?.open, state?.x, state?.y]);

	if (!state?.open) return null;

	return (
		<Popover open={state.open}>
			<PopoverAnchor asChild>
				<span aria-hidden style={anchorStyle} />
			</PopoverAnchor>
			<PopoverContent
				side="top"
				align="center"
				sideOffset={10}
				collisionPadding={12}
				className={cn(
					'group/pop z-50 w-auto border-0 bg-transparent p-0 shadow-none outline-none',
					!visible && 'pointer-events-none opacity-0',
				)}
				style={chromeStyle}
				onOpenAutoFocus={(e) => e.preventDefault()}
				onCloseAutoFocus={(e) => e.preventDefault()}
				onMouseDown={(e) => e.preventDefault()}
			>
				<EpubSelectionPopBarPanel
					labels={labels}
					selectionFullyHighlighted={selectionFullyHighlighted}
					selectionHasHighlight={selectionHasHighlight}
					highlightStyle={highlightStyle}
					highlightColor={highlightColor}
					onHighlightStyleChange={onHighlightStyleChange}
					onHighlightColorChange={onHighlightColorChange}
					onCopy={onCopy}
					onApplyHighlight={onApplyHighlight}
					onRemoveHighlight={onRemoveHighlight}
					onWriteThought={onWriteThought}
					onAskBook={onAskBook}
					onShare={onShare}
					onListen={onListen}
					onClearSelection={onClearSelection}
					caretAnchorX={state.x}
					readerBgTheme={readerBgTheme}
				/>
			</PopoverContent>
		</Popover>
	);
}
