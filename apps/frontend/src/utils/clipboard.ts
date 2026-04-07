import { isTauriRuntime } from './runtime';

/** 焦点在 CodeMirror（Sandpack 编辑器等）内时不拦截快捷键，避免破坏选区与撤销栈 */
function isFocusInsideCodeMirror(): boolean {
	const el = document.activeElement;
	return el instanceof Element && Boolean(el.closest('.cm-editor'));
}

/** 焦点在 Monaco 编辑区内时不拦截：其选区在隐藏 textarea 上，window.getSelection() 不可靠 */
function isFocusInsideMonacoEditor(): boolean {
	const el = document.activeElement;
	return (
		el instanceof Element &&
		Boolean(el.closest('.monaco-editor, .monaco-diff-editor'))
	);
}

/** 使用自管选区/剪贴板的编辑器：勿用全局 getSelection + preventDefault 顶替系统行为 */
function shouldLetEditorHandleModChord(event: KeyboardEvent): boolean {
	const k = event.key.toLowerCase();
	if (!['a', 'c', 'v', 'x', 'z'].includes(k)) return false;
	return isFocusInsideCodeMirror() || isFocusInsideMonacoEditor();
}

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

// 复制粘贴逻辑
export const clipboard = async (event: KeyboardEvent) => {
	// 检查是否按下了Command（Mac）或Control（Windows/Linux）
	const isMod = event.metaKey || event.ctrlKey;

	if (isMod && shouldLetEditorHandleModChord(event)) {
		return;
	}

	if (isMod && event.key === 'a') {
		// 阻止默认行为，因为我们想要自定义全选
		event.preventDefault();

		// 获取当前焦点元素
		const activeElement = document.activeElement;
		if (
			activeElement &&
			(activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA')
		) {
			// 选中文本
			(activeElement as HTMLInputElement).select();
		}
	}
	if (isMod && event.key === 'c') {
		// 阻止默认行为，因为我们想要自定义复制
		event.preventDefault();

		// 获取选中的文本
		const selectedText = window.getSelection()?.toString();

		if (selectedText) {
			await writeClipText(selectedText);
		}
	}

	if (isMod && event.key === 'z') {
		event.preventDefault();

		// 获取当前焦点元素
		const activeElement = document.activeElement;
		if (
			activeElement &&
			(activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA')
		) {
			const inputElement = activeElement as
				| HTMLInputElement
				| HTMLTextAreaElement;
			const start = inputElement.selectionStart || 0;
			const end = inputElement.selectionEnd || 0;
			const value = inputElement.value;

			if (start > 0 || end > 0) {
				const deletePos = Math.max(start, end) - 1;
				const newValue = value.slice(0, deletePos) + value.slice(deletePos + 1);

				inputElement.value = newValue;
				inputElement.setSelectionRange(deletePos, deletePos);

				const ev = new Event('input', { bubbles: true });
				inputElement.dispatchEvent(ev);
			}
		}
	}

	if (isMod && event.key === 'x') {
		event.preventDefault();

		// 获取当前焦点元素
		const activeElement = document.activeElement;
		if (
			activeElement &&
			(activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA')
		) {
			const inputElement = activeElement as HTMLInputElement;
			const selectedText = inputElement.value.substring(
				inputElement.selectionStart || 0,
				inputElement.selectionEnd || 0,
			);

			if (selectedText) {
				// 将选中的文本写入剪贴板
				await writeClipText(selectedText);
				// 删除选中的文本
				document.execCommand('delete');
			}
		}
	}

	if (isMod && event.key === 'v') {
		event.preventDefault();
		const text = await readClipText();
		// 将剪贴板内容插入到当前焦点元素（如果有）或者做其他处理
		const activeElement = document.activeElement;
		if (
			activeElement &&
			(activeElement.tagName === 'INPUT' ||
				activeElement.tagName === 'TEXTAREA')
		) {
			// 在光标处插入文本
			document.execCommand('insertText', false, text);
		}
	}
};

export const copyToClipboard = async (text: string): Promise<void> => {
	await writeClipText(text);
};

export const pasteFromClipboard = async (): Promise<string> => {
	return readClipText();
};
