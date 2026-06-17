import type { QuickContextMenuEntry } from '@design/ContextMenu';
import type { MutableRefObject } from 'react';
import { isMacLike } from '@/components/design/Monaco/utils';

function shortcutHintCtrlOrCmd(key: string): string {
	return isMacLike() ? `⌘+${key}` : `Ctrl+${key}`;
}

export type EpubReaderContextActions = {
	copy: () => void;
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
	actionsRef: MutableRefObject<EpubReaderContextActions | null>;
	t: (key: string, params?: Record<string, unknown>) => string;
};

/** EPUB 阅读区右键菜单（结构对齐知识库 Monaco 编辑器 `buildMonacoEditorContextMenuItems`） */
export function buildEpubContextMenuItems({
	hasSelection,
	actionsRef,
	t,
}: BuildEpubContextMenuItemsInput): QuickContextMenuEntry[] {
	const items: QuickContextMenuEntry[] = [];

	if (hasSelection) {
		items.push({
			type: 'item',
			id: 'copy',
			label: t('ebook.read.contextMenu.copy'),
			shortcut: shortcutHintCtrlOrCmd('C'),
			onSelect: () => actionsRef.current?.copy(),
		});
		items.push({
			type: 'item',
			id: 'askSelection',
			label: t('ebook.read.contextMenu.askSelection'),
			onSelect: () => actionsRef.current?.askAboutSelection(),
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
	items.push({
		type: 'item',
		id: 'toc',
		label: t('ebook.read.toc'),
		onSelect: () => actionsRef.current?.openToc(),
	});
	items.push({
		type: 'item',
		id: 'settings',
		label: t('ebook.read.settings'),
		onSelect: () => actionsRef.current?.openSettings(),
	});
	items.push({ type: 'separator', id: 'sep-exit' });
	items.push({
		type: 'item',
		id: 'backShelf',
		label: t('ebook.read.backShelf'),
		onSelect: () => actionsRef.current?.backToShelf(),
	});

	return items;
}
