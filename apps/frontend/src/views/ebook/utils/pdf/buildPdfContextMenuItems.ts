import type { QuickContextMenuEntry } from '@design/ContextMenu';
import type { RefObject } from 'react';

export type PdfReaderContextActions = {
	openAssistant: () => void;
	zoomIn: () => void;
	zoomOut: () => void;
	prevPage: () => void;
	nextPage: () => void;
	openToc: () => void;
};

type BuildPdfContextMenuItemsInput = {
	actionsRef: RefObject<PdfReaderContextActions | null>;
	canZoomIn: boolean;
	canZoomOut: boolean;
	canPrev: boolean;
	canNext: boolean;
	t: (key: string, params?: Record<string, unknown>) => string;
};

/** PDF 阅读区右键菜单：智能助手、目录、缩放、翻页（无选区问书） */
export function buildPdfContextMenuItems({
	actionsRef,
	canZoomIn,
	canZoomOut,
	canPrev,
	canNext,
	t,
}: BuildPdfContextMenuItemsInput): QuickContextMenuEntry[] {
	return [
		{
			type: 'item',
			id: 'assistant',
			label: t('ebook.read.contextMenu.assistant'),
			onSelect: () => actionsRef.current?.openAssistant(),
		},
		{ type: 'separator', id: 'sep-zoom' },
		{
			type: 'item',
			id: 'zoomIn',
			label: t('ebook.read.pdfZoomIn'),
			shortcut: '+',
			disabled: !canZoomIn,
			onSelect: (event) => {
				event.preventDefault();
				actionsRef.current?.zoomIn();
			},
		},
		{
			type: 'item',
			id: 'zoomOut',
			label: t('ebook.read.pdfZoomOut'),
			shortcut: '−',
			disabled: !canZoomOut,
			onSelect: (event) => {
				event.preventDefault();
				actionsRef.current?.zoomOut();
			},
		},
		{ type: 'separator', id: 'sep-nav' },
		{
			type: 'item',
			id: 'prev',
			label: t('ebook.read.prev'),
			shortcut: '←',
			disabled: !canPrev,
			onSelect: () => actionsRef.current?.prevPage(),
		},
		{
			type: 'item',
			id: 'next',
			label: t('ebook.read.next'),
			shortcut: '→',
			disabled: !canNext,
			onSelect: () => actionsRef.current?.nextPage(),
		},
		{ type: 'separator', id: 'sep-assistant' },
		{
			type: 'item',
			id: 'toc',
			label: t('ebook.read.toc'),
			onSelect: () => actionsRef.current?.openToc(),
		},
	];
}
