import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { EpubHighlightColorId, EpubHighlightStyle } from '../../types';
import {
	EPUB_READER_POPBAR_CARET_FILL,
	type EpubReaderBgTheme,
	epubReaderPopBarShadowClass,
	epubReaderPopBarSurfaceClass,
} from '../../utils/epub/reader/epubReaderSettings';
import {
	EpubHighlightStyleBar,
	type EpubHighlightStyleBarLabels,
} from './EpubHighlightStyleBar';
import {
	EpubQuoteActionBar,
	type EpubQuoteActionBarLabels,
} from './EpubQuoteActionBar';

export type EpubSelectionPopBarLabels = EpubQuoteActionBarLabels &
	EpubHighlightStyleBarLabels;

export type EpubSelectionPopBarPanelProps = {
	labels: EpubSelectionPopBarLabels;
	/** 选区非空白正文是否均已划线；为 true 时展示「删除划线」，否则展示「划线」 */
	selectionFullyHighlighted?: boolean;
	/** 选区是否命中任意用户划线（含 partial）；为 true 时展示顶栏样式/颜色条 */
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
	/** 显式覆盖是否展示样式/颜色条；默认随 selectionHasHighlight */
	showHighlightStyleBar?: boolean;
	/** 箭头对准的视口 X；不传则居中 */
	caretAnchorX?: number;
	variant?: 'floating' | 'inline';
	/** 阅读背景主题，决定 PopBar 投影（default/night → shadow-6，其余 → rgba） */
	readerBgTheme?: EpubReaderBgTheme;
};

const ARROW_EDGE_PADDING = 10;
const ARROW_WIDTH = 14;
const ARROW_HEIGHT = 7;

function clampArrowLeft(
	toolbarLeft: number,
	toolbarWidth: number,
	anchorX: number,
) {
	const min = ARROW_EDGE_PADDING;
	const max = toolbarWidth - ARROW_EDGE_PADDING;
	return Math.max(min, Math.min(max, anchorX - toolbarLeft));
}

function PopBarCaret({ left }: { left: number }) {
	return (
		<>
			<svg
				aria-hidden
				className={cn(
					'pointer-events-none absolute -translate-x-1/2',
					'top-[calc(100%-1px)]',
					'group-data-[side=bottom]/pop:hidden',
				)}
				style={{ left }}
				width={ARROW_WIDTH}
				height={ARROW_HEIGHT}
				viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`}
			>
				<title>Caret</title>
				<path
					d={`M0 0 H${ARROW_WIDTH} L${ARROW_WIDTH / 2} ${ARROW_HEIGHT} Z`}
					fill={EPUB_READER_POPBAR_CARET_FILL}
				/>
			</svg>
			<svg
				aria-hidden
				className={cn(
					'pointer-events-none absolute hidden -translate-x-1/2',
					'bottom-[calc(100%-1px)]',
					'group-data-[side=bottom]/pop:block',
				)}
				style={{ left }}
				width={ARROW_WIDTH}
				height={ARROW_HEIGHT}
				viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`}
			>
				<title>Caret</title>
				<path
					d={`M0 ${ARROW_HEIGHT} H${ARROW_WIDTH} L${ARROW_WIDTH / 2} 0 Z`}
					fill={EPUB_READER_POPBAR_CARET_FILL}
				/>
			</svg>
		</>
	);
}

/** PopBar 工具条主体（选区浮动条 / 侧栏引用内嵌条共用） */
export function EpubSelectionPopBarPanel({
	labels,
	selectionFullyHighlighted = false,
	selectionHasHighlight = false,
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
	caretAnchorX,
	variant = 'floating',
	showHighlightStyleBar,
	readerBgTheme = 'default',
}: EpubSelectionPopBarPanelProps) {
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [arrowLeft, setArrowLeft] = useState<number | null>(null);
	const hasHighlight = selectionFullyHighlighted;
	const shouldShowHighlightStyleBar =
		showHighlightStyleBar ?? selectionHasHighlight;

	const measureArrowLeft = useCallback((): number | null => {
		const toolbar = toolbarRef.current;
		if (!toolbar) return null;
		const rect = toolbar.getBoundingClientRect();
		if (rect.width === 0) return null;
		const anchorX = caretAnchorX ?? rect.left + rect.width / 2;
		return clampArrowLeft(rect.left, rect.width, anchorX);
	}, [caretAnchorX]);

	useLayoutEffect(() => {
		const updateArrowLeft = () => {
			const next = measureArrowLeft();
			if (next != null) setArrowLeft(next);
		};

		updateArrowLeft();

		window.addEventListener('resize', updateArrowLeft);
		const toolbarEl = toolbarRef.current;
		const observer = toolbarEl ? new ResizeObserver(updateArrowLeft) : null;
		if (toolbarEl && observer) observer.observe(toolbarEl);

		return () => {
			window.removeEventListener('resize', updateArrowLeft);
			observer?.disconnect();
		};
	}, [measureArrowLeft, shouldShowHighlightStyleBar]);

	return (
		<div className={cn('relative', epubReaderPopBarShadowClass(readerBgTheme))}>
			<div ref={toolbarRef} className={epubReaderPopBarSurfaceClass}>
				{shouldShowHighlightStyleBar ? (
					<EpubHighlightStyleBar
						style={highlightStyle}
						color={highlightColor}
						onStyleChange={onHighlightStyleChange}
						onColorChange={onHighlightColorChange}
						labels={labels}
					/>
				) : null}
				<EpubQuoteActionBar
					variant={variant === 'inline' ? 'floating' : 'floating'}
					labels={labels}
					hasHighlight={hasHighlight}
					onCopy={onCopy}
					onUnderline={onApplyHighlight}
					onRemoveUnderline={onRemoveHighlight}
					onWriteThought={onWriteThought}
					onAskBook={onAskBook}
					onShare={onShare}
					onListen={onListen}
					onAnyAction={onClearSelection}
				/>
			</div>
			{arrowLeft != null ? <PopBarCaret left={arrowLeft} /> : null}
		</div>
	);
}
