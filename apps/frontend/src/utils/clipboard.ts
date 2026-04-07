import { isTauriRuntime } from './runtime';

/**
 * Tauri WebView 内系统级复制/粘贴有时无法作用到普通 input/textarea，
 * 通过剪贴板插件 + selectionStart/End 显式处理。
 * Monaco/CodeMirror 有各自实现或内部模型，此处一律跳过；Cmd/Ctrl+Z 不拦截，保留原生撤销栈。
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

/** 受控组件下直接改 .value 需走原型 setter，React 才能收到更新 */
function setNativeFormValue(
	el: HTMLInputElement | HTMLTextAreaElement,
	next: string,
): void {
	const proto =
		el instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
	setter?.call(el, next);
}

function dispatchInputForReact(
	el: HTMLInputElement | HTMLTextAreaElement,
	inputType: string,
	data: string | null = null,
): void {
	try {
		el.dispatchEvent(
			new InputEvent('input', {
				bubbles: true,
				cancelable: true,
				inputType,
				data: data ?? undefined,
			}),
		);
	} catch {
		el.dispatchEvent(new Event('input', { bubbles: true }));
	}
}

/** 事件路径是否落在 Monaco / CodeMirror 等富编辑器内 */
function richEditorInEventPath(event: KeyboardEvent): boolean {
	for (const n of event.composedPath()) {
		if (!(n instanceof Element)) continue;
		if (n.closest?.('.monaco-editor, .monaco-diff-editor, .cm-editor')) {
			return true;
		}
		if (n.classList.contains('native-edit-context')) return true;
		if (n instanceof HTMLTextAreaElement && n.classList.contains('inputarea')) {
			return true;
		}
	}
	return false;
}

function isPlainTextField(
	el: EventTarget | null,
): el is HTMLInputElement | HTMLTextAreaElement {
	if (
		!(el instanceof HTMLInputElement) &&
		!(el instanceof HTMLTextAreaElement)
	) {
		return false;
	}
	if (el instanceof HTMLInputElement) {
		if (el.type === 'button' || el.type === 'submit' || el.type === 'reset') {
			return false;
		}
		if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') {
			return false;
		}
	}
	return true;
}

/**
 * 仅在 Tauri 下挂载：为普通 input/textarea 接管 Cmd/Ctrl+A/C/V/X（走插件剪贴板），不拦截 Z。
 * @returns 卸载函数
 */
export function attachTauriPlainFieldClipboardShortcuts(): () => void {
	if (!isTauriRuntime()) {
		return () => {};
	}

	const onKeyDown = (event: KeyboardEvent) => {
		if (!event.ctrlKey && !event.metaKey) return;

		const key = event.key.toLowerCase();
		if (!['a', 'c', 'v', 'x', 'z'].includes(key)) return;

		// 撤销交给 WebView 原生，避免破坏输入栈
		if (key === 'z') return;

		if (richEditorInEventPath(event)) return;

		const el = document.activeElement;
		if (!isPlainTextField(el)) return;
		if (el.disabled) return;

		if (key === 'a') {
			event.preventDefault();
			el.focus();
			el.select();
			return;
		}

		// number/date 等部分类型无 selection API，不拦截
		const start = el.selectionStart;
		const end = el.selectionEnd;
		if (start === null || end === null) return;

		if (key === 'c') {
			event.preventDefault();
			const slice = el.value.slice(start, end);
			if (slice) void writeClipText(slice);
			return;
		}

		if (key === 'x') {
			if (el.readOnly) return;
			event.preventDefault();
			if (start === end) return;
			const slice = el.value.slice(start, end);
			void writeClipText(slice);
			const next = el.value.slice(0, start) + el.value.slice(end);
			setNativeFormValue(el, next);
			el.setSelectionRange(start, start);
			dispatchInputForReact(el, 'deleteByCut', null);
			return;
		}

		if (key === 'v') {
			if (el.readOnly) return;
			event.preventDefault();
			const field = el;
			void (async () => {
				const text = await readClipText();
				if (document.activeElement !== field) return;
				const s = field.selectionStart ?? 0;
				const e = field.selectionEnd ?? 0;
				const next = field.value.slice(0, s) + text + field.value.slice(e);
				setNativeFormValue(field, next);
				const pos = s + text.length;
				field.setSelectionRange(pos, pos);
				dispatchInputForReact(field, 'insertFromPaste', text);
			})();
		}
	};

	document.addEventListener('keydown', onKeyDown, true);
	return () => document.removeEventListener('keydown', onKeyDown, true);
}
