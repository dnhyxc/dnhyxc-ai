import type { OnMount } from '@monaco-editor/react';
import type { QuickContextMenuEntry } from '@/components/design/ContextMenu';
import { isMacLike } from '@/utils';

function shortcutHintCtrlOrCmdShiftV(): string {
	return isMacLike() ? '⌘+Shift+V' : 'Ctrl+Shift+V';
}

function shortcutHintCtrlOrCmd(key: string): string {
	return isMacLike() ? `⌘+${key}` : `Ctrl+${key}`;
}

export type MonacoEditorContextActions = {
	copy: () => void;
	cut: () => void;
	paste: () => void;
	selectAll: () => void;
	formatDocument: () => void;
	/**
	 * 将「当前选区」写入外部输入框（如知识库助手输入框）。
	 * 注意：只处理**非空选区**；空选区（仅光标）应视为无效，不做“复制整行”的降级。
	 */
	sendSelectionToAssistant?: () => void;
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
	/** 外部是否接入「发送选区到助手输入框」能力（由宿主传入回调决定） */
	enableSendSelectionToAssistant?: boolean;
}): QuickContextMenuEntry[] {
	const {
		readOnly,
		language,
		actionsRef,
		enableSendSelectionToAssistant = false,
	} = input;
	const items: QuickContextMenuEntry[] = [];

	if (!readOnly) {
		items.push({
			type: 'item',
			id: 'cut',
			label: '剪切',
			shortcut: shortcutHintCtrlOrCmd('X'),
			onSelect: () => actionsRef.current?.cut(),
		});
	}

	items.push({
		type: 'item',
		id: 'copy',
		label: '复制',
		shortcut: shortcutHintCtrlOrCmd('C'),
		onSelect: () => actionsRef.current?.copy(),
	});

	if (!readOnly) {
		items.push({
			type: 'item',
			id: 'paste',
			label: '粘贴',
			shortcut: shortcutHintCtrlOrCmd('V'),
			onSelect: () => actionsRef.current?.paste(),
		});
	}

	items.push({ type: 'separator' });

	items.push({
		type: 'item',
		id: 'selectAll',
		label: '全选',
		shortcut: shortcutHintCtrlOrCmd('A'),
		onSelect: () => actionsRef.current?.selectAll(),
	});

	if (enableSendSelectionToAssistant) {
		items.push({ type: 'separator' });
		items.push({
			type: 'item',
			id: 'sendSelectionToAssistant',
			label: '复制选中内容到助手',
			shortcut: shortcutHintCtrlOrCmdShiftV(),
			onSelect: () => actionsRef.current?.sendSelectionToAssistant?.(),
		});
	}

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
	/** 仅返回“真实选区文本”（无选区时返回空串），用于写入外部输入框 */
	getSelectedTextOnlyFromSelections: () => string;
	/** 外部接入：将选区写入助手输入框（实现由知识库页面决定） */
	onInsertSelectionToAssistant?: (text: string) => void;
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
		getSelectedTextOnlyFromSelections,
		onInsertSelectionToAssistant,
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
		sendSelectionToAssistant: onInsertSelectionToAssistant
			? () => {
					const text = getSelectedTextOnlyFromSelections();
					if (!text.trim()) return;
					onInsertSelectionToAssistant(text);
				}
			: undefined,
	};
}
