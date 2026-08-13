import type { QuickContextMenuEntry } from '@design/ContextMenu';
import type { RefObject } from 'react';

export type EpubReaderContextActions = {
	copy: () => void;
	addThought: () => void;
	openAssistant: () => void;
	askAboutSelection: () => void;
	openToc: () => void;
	openSettings: () => void;
	prevPage: () => void;
	nextPage: () => void;
	backToShelf: () => void;
};

type BuildEpubContextMenuItemsInput = {
	hasSelection: boolean;
	/** 分页翻页时才展示上一页/下一页 */
	showPageNav?: boolean;
	actionsRef: RefObject<EpubReaderContextActions | null>;
	t: (key: string, params?: Record<string, unknown>) => string;
};

/** EPUB 阅读区右键菜单（结构对齐知识库 Monaco 编辑器 `buildMonacoEditorContextMenuItems`） */
export function buildEpubContextMenuItems({
	hasSelection,
	showPageNav = false,
	actionsRef,
	t,
}: BuildEpubContextMenuItemsInput): QuickContextMenuEntry[] {
	const items: QuickContextMenuEntry[] = [];

	if (hasSelection) {
		items.push({
			type: 'item',
			id: 'copy',
			label: t('ebook.read.contextMenu.copy'),
			onSelect: () => actionsRef.current?.copy(),
		});
		items.push({
			type: 'item',
			id: 'askSelection',
			label: t('ebook.read.contextMenu.askSelection'),
			onSelect: () => actionsRef.current?.askAboutSelection(),
		});
		items.push({
			type: 'item',
			id: 'addThought',
			label: t('ebook.read.contextMenu.addThought'),
			onSelect: () => actionsRef.current?.addThought(),
		});
		items.push({ type: 'separator', id: 'sep-after-selection' });
	}

	if (!hasSelection) {
		items.push({
			type: 'item',
			id: 'assistant',
			label: t('ebook.read.contextMenu.assistant'),
			onSelect: () => actionsRef.current?.openAssistant(),
		});
		items.push({ type: 'separator', id: 'sep-nav' });
	}

	if (showPageNav) {
		items.push({
			type: 'item',
			id: 'prev',
			label: t('ebook.read.prev'),
			shortcut: '←',
			onSelect: () => actionsRef.current?.prevPage(),
		});
		items.push({
			type: 'item',
			id: 'next',
			label: t('ebook.read.next'),
			shortcut: '→',
			onSelect: () => actionsRef.current?.nextPage(),
		});
		items.push({ type: 'separator', id: 'sep-tools' });
	} else if (hasSelection) {
		items.push({ type: 'separator', id: 'sep-tools' });
	}

	items.push({
		type: 'item',
		id: 'toc',
		label: t('ebook.read.toc'),
		onSelect: () => actionsRef.current?.openToc(),
	});
	items.push({ type: 'separator', id: 'sep-settings' });
	items.push({
		type: 'item',
		id: 'settings',
		label: t('ebook.read.settings'),
		onSelect: () => actionsRef.current?.openSettings(),
	});
	items.push({ type: 'separator', id: 'sep-back' });
	items.push({
		type: 'item',
		id: 'backShelf',
		label: t('ebook.read.backShelf'),
		onSelect: () => actionsRef.current?.backToShelf(),
	});

	return items;
}
