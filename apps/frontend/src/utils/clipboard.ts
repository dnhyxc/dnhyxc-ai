import { isTauriRuntime } from './runtime';

/**
 * 程序化读写剪贴板（按钮「复制」、Monaco 显式快捷键绑定等）。
 * 不在 document 上劫持 Cmd+C/V：避免与 Monaco/CodeMirror 冲突；编辑器内快捷键在 Monaco onMount 中绑定。
 */

async function writeClipText(text: string): Promise<void> {
	if (isTauriRuntime()) {
		const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
		await writeText(text);
		return;
	}
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}
	throw new Error('剪贴板不可用');
}

async function readClipText(): Promise<string> {
	if (isTauriRuntime()) {
		const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
		return readText();
	}
	if (navigator.clipboard?.readText) {
		return navigator.clipboard.readText();
	}
	return '';
}

export const copyToClipboard = async (text: string): Promise<void> => {
	await writeClipText(text);
};

export const pasteFromClipboard = async (): Promise<string> => {
	return readClipText();
};
