import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

/** 焦点在 CodeMirror（Sandpack 编辑器等）内时不拦截快捷键，避免破坏选区与撤销栈 */
function isFocusInsideCodeMirror(): boolean {
	const el = document.activeElement;
	return el instanceof Element && Boolean(el.closest('.cm-editor'));
}

// 复制粘贴逻辑
export const clipboard = async (event: KeyboardEvent) => {
	// 检查是否按下了Command（Mac）或Control（Windows/Linux）
	const isMod = event.metaKey || event.ctrlKey;

	if (
		isMod &&
		isFocusInsideCodeMirror() &&
		['a', 'c', 'v', 'x', 'z'].includes(event.key)
	) {
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
			await writeText(selectedText);
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

				const event = new Event('input', { bubbles: true });
				inputElement.dispatchEvent(event);
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
				await writeText(selectedText);
				// 删除选中的文本
				document.execCommand('delete');
			}
		}
	}

	if (isMod && event.key === 'v') {
		event.preventDefault();
		const text = await readText();
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
	await writeText(text);
};

export const pasteFromClipboard = async (): Promise<string> => {
	return readText();
};
