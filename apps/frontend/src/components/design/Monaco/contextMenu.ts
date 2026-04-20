import type { OnMount } from '@monaco-editor/react';
import type { QuickContextMenuEntry } from '@/components/design/ContextMenu';

export type MonacoEditorContextActions = {
	copy: () => void;
	cut: () => void;
	paste: () => void;
	selectAll: () => void;
	formatDocument: () => void;
};

/**
 * 生成 Monaco 编辑器右键菜单项。
 *
 * 约束：
 * - `onSelect` 仅通过 `actionsRef` 调动作，避免把大段 onMount 闭包拉进依赖导致频繁重建。
 * - 调用方建议用 `useMemo` 包一层，稳定 `items` 引用以减少菜单子树重渲染。
 */
export function buildMonacoEditorContextMenuItems(input: {
	readOnly: boolean;
	language: string;
	actionsRef: React.MutableRefObject<MonacoEditorContextActions | null>;
}): QuickContextMenuEntry[] {
	const { readOnly, language, actionsRef } = input;
	const items: QuickContextMenuEntry[] = [];

	if (!readOnly) {
		items.push({
			type: 'item',
			id: 'cut',
			label: '剪切',
			shortcut: 'Ctrl/⌘+X',
			onSelect: () => actionsRef.current?.cut(),
		});
	}

	items.push({
		type: 'item',
		id: 'copy',
		label: '复制',
		shortcut: 'Ctrl/⌘+C',
		onSelect: () => actionsRef.current?.copy(),
	});

	if (!readOnly) {
		items.push({
			type: 'item',
			id: 'paste',
			label: '粘贴',
			shortcut: 'Ctrl/⌘+V',
			onSelect: () => actionsRef.current?.paste(),
		});
	}

	items.push({ type: 'separator' });

	items.push({
		type: 'item',
		id: 'selectAll',
		label: '全选',
		shortcut: 'Ctrl/⌘+A',
		onSelect: () => actionsRef.current?.selectAll(),
	});

	if (!readOnly) {
		items.push({ type: 'separator' });
		items.push({
			type: 'item',
			id: 'format',
			label: language === 'markdown' ? '格式化文档' : '格式化',
			shortcut: 'Shift+Alt+F',
			onSelect: () => actionsRef.current?.formatDocument(),
		});
	}

	return items;
}

/**
 * 将「右键菜单动作」注入到 ref 中，使其与快捷键（addCommand）共用同一套逻辑。
 *
 * 设计意图：
 * - Tauri/WebView 下剪贴板行为不稳定：菜单与快捷键都必须走 `copyToClipboard/pasteFromClipboard`。
 * - Markdown 格式化必须走 `safeFormatMarkdownValue` 的“安全格式化”策略，避免围栏反引号数量等问题。
 */
export function injectMonacoEditorContextActions(input: {
	editor: Parameters<OnMount>[0];
	monaco: Parameters<OnMount>[1];
	imeComposingRef: React.MutableRefObject<boolean>;
	actionsRef: React.MutableRefObject<MonacoEditorContextActions | null>;
	getCopyTextFromSelections: () => string;
	rangeForCutWhenCursorOnly: (
		sel: NonNullable<
			ReturnType<Parameters<OnMount>[0]['getSelections']>
		>[number],
	) => any;
	copyToClipboard: (text: string) => Promise<void> | void;
	pasteFromClipboard: () => Promise<string>;
	safeFormatMarkdownValue: (
		text: string,
	) => Promise<string | null | undefined> | string | null | undefined;
}) {
	const {
		editor,
		monaco,
		imeComposingRef,
		actionsRef,
		getCopyTextFromSelections,
		rangeForCutWhenCursorOnly,
		copyToClipboard,
		pasteFromClipboard,
		safeFormatMarkdownValue,
	} = input;

	/** 右键菜单与快捷键共用（Tauri/WebView 剪贴板、Markdown 安全格式化） */
	actionsRef.current = {
		copy: () => {
			const text = getCopyTextFromSelections();
			if (!text) return;
			void copyToClipboard(text);
		},
		cut: () => {
			if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
			void (async () => {
				const text = getCopyTextFromSelections();
				if (!text) return;
				await copyToClipboard(text);
				const sels = editor.getSelections();
				if (!sels?.length) return;
				editor.executeEdits(
					'cut',
					sels.map((sel) => ({
						range: rangeForCutWhenCursorOnly(sel),
						text: '',
					})),
				);
			})();
		},
		paste: () => {
			if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
			if (editor.inComposition || imeComposingRef.current) return;
			void (async () => {
				const text = await pasteFromClipboard();
				if (!text) return;
				const sels = editor.getSelections();
				if (!sels?.length) return;
				editor.executeEdits(
					'paste',
					sels.map((sel) => ({ range: sel, text })),
				);
			})();
		},
		selectAll: () => {
			editor.focus();
			editor.trigger('keyboard', 'editor.action.selectAll', null);
		},
		formatDocument: () => {
			const model = editor.getModel();
			if (!model) return;
			if (model.getLanguageId() === 'markdown') {
				if (editor.getOption(monaco.editor.EditorOption.readOnly)) return;
				void (async () => {
					const next = await safeFormatMarkdownValue(model.getValue());
					if (next == null) return;
					editor.pushUndoStop();
					editor.executeEdits('dnhyxc-markdown-safe-format', [
						{ range: model.getFullModelRange(), text: next },
					]);
					editor.pushUndoStop();
				})();
				return;
			}
			editor.trigger('keyboard', 'editor.action.formatDocument', null);
		},
	};
}
