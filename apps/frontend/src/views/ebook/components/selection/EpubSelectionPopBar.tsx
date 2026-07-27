import { type CSSProperties, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

const EDGE = 8;
const GAP = 10;

/**
 * 选区上方浮动操作条。
 * 不用 Radix Popover：其 FocusScope 在卸载时 setTimeout(0) 把焦点还回打开前的
 * EPUB iframe，发生在侧栏输入框 useLayoutEffect 聚焦之后，表现为闪焦后丢失。
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
	const open = Boolean(state?.open);
	const [visible, setVisible] = useState(false);

	useLayoutEffect(() => {
		if (!open) {
			setVisible(false);
			return;
		}
		setVisible(false);
		const id = requestAnimationFrame(() => {
			requestAnimationFrame(() => setVisible(true));
		});
		return () => cancelAnimationFrame(id);
	}, [open, state?.x, state?.y]);

	if (!state?.open) return null;

	const placeAbove = state.y > 72;
	const left = Math.min(
		Math.max(state.x, EDGE),
		(typeof window !== 'undefined' ? window.innerWidth : state.x) - EDGE,
	);
	const top = placeAbove ? Math.max(EDGE, state.y - GAP) : state.y + GAP;

	return createPortal(
		<div
			data-side={placeAbove ? 'top' : 'bottom'}
			className={cn(
				'group/pop fixed z-50 w-auto border-0 bg-transparent p-0 shadow-none outline-none',
				!visible && 'pointer-events-none opacity-0',
			)}
			style={{
				...chromeStyle,
				left,
				top,
				transform: placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
			}}
			onMouseDown={(e) => {
				const el = e.target as HTMLElement;
				if (
					el.closest(
						'button, a, input, textarea, select, [role="button"], [data-slot=select-content]',
					)
				) {
					return;
				}
				e.preventDefault();
			}}
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
		</div>,
		document.body,
	);
}
