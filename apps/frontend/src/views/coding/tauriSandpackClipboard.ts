import {
	EditorSelection,
	EditorState,
	type Extension,
	Prec,
} from '@codemirror/state';
import { type EditorView, type KeyBinding, keymap } from '@codemirror/view';
import { copyToClipboard, pasteFromClipboard } from '@/utils/clipboard';

/** 浏览器环境回退（纯 Web 调试时 Tauri 插件不可用） */
async function writeClip(text: string): Promise<void> {
	try {
		await copyToClipboard(text);
	} catch {
		await navigator.clipboard?.writeText(text);
	}
}

async function readClip(): Promise<string> {
	try {
		return await pasteFromClipboard();
	} catch {
		return (await navigator.clipboard?.readText?.()) ?? '';
	}
}

function runCopy(view: EditorView): boolean {
	const { from, to } = view.state.selection.main;
	const text = view.state.sliceDoc(from, to);
	if (!text) return false;
	void writeClip(text);
	return true;
}

function runPaste(view: EditorView): boolean {
	if (view.state.facet(EditorState.readOnly)) return false;
	void (async () => {
		const text = await readClip();
		if (!text) return;
		view.dispatch(view.state.replaceSelection(text));
		view.focus();
	})();
	return true;
}

function runCut(view: EditorView): boolean {
	if (view.state.facet(EditorState.readOnly)) return false;
	const { from, to } = view.state.selection.main;
	if (from === to) return false;
	const text = view.state.sliceDoc(from, to);
	void writeClip(text);
	view.dispatch(
		view.state.update({
			changes: { from, to, insert: '' },
			selection: EditorSelection.cursor(from),
			scrollIntoView: true,
		}),
	);
	return true;
}

/** 必须高于 Sandpack 内置 defaultKeymap，否则 Mod-c / Mod-v 不会走到这里 */
const bindings: KeyBinding[] = [
	{ key: 'Mod-c', run: runCopy },
	{ key: 'Mod-v', run: runPaste },
	{ key: 'Mod-x', run: runCut },
];

/**
 * Tauri WebView 下 CodeMirror contenteditable 往往无法与系统剪贴板互通，
 * 通过 Tauri clipboard 插件显式读写。
 */
export const tauriSandpackClipboardExtension: Extension = Prec.highest(
	keymap.of(bindings),
);
