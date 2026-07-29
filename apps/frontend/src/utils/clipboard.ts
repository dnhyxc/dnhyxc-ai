import { isTauriRuntime } from './runtime';

/**
 * Tauri WebView 内系统级复制/粘贴有时无法作用到普通 input/textarea / TipTap contenteditable，
 * 通过剪贴板插件 + selectionStart/End（或 insertText）显式处理。
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

/**
 * Tauri 桌面端：读取系统剪贴板 HTML flavor（macOS public.html）。
 * 图文混合复制时 HTML 里含 <img src>，弥补 readText 只拿纯文本、readImage 拿不到远程 URL 图片的缺陷。
 * 走自定义 Rust 命令 read_clipboard_html（arboard），非 Tauri 环境返回 null。
 */
async function readClipHtml(): Promise<string | null> {
	if (!isTauriRuntime()) return null;
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		const html = await invoke<string | null>('read_clipboard_html');
		return html?.trim() ? html : null;
	} catch {
		return null;
	}
}

type ClipSegment =
	| { type: 'text'; value: string }
	| { type: 'image'; src: string };

/**
 * 按原始 DOM 顺序解析剪贴板 HTML，产出文本与图片片段序列。
 * 保证粘贴后图文相对顺序与复制时一致（图片在前则插入时图片也在前）。
 */
function parseHtmlSegments(html: string): ClipSegment[] {
	const tmp = document.createElement('div');
	tmp.innerHTML = html;
	// br 转换行，保留基本排版
	tmp.querySelectorAll('br').forEach((br) => {
		br.replaceWith('\n');
	});
	const segments: ClipSegment[] = [];
	const isImgSrc = (src: string) => /^https?:\/\/|^data:image\//i.test(src);

	// 深度优先遍历：按文档顺序收集文本与图片节点
	const walk = (node: Node) => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const tag = el.tagName.toLowerCase();
			if (tag === 'img') {
				const src = el.getAttribute('src') ?? '';
				if (src && isImgSrc(src)) {
					segments.push({ type: 'image', src });
				}
				return; // img 内部不再遍历
			}
			// 块级元素前后补换行，保留排版
			const blockTags = new Set([
				'p',
				'div',
				'li',
				'h1',
				'h2',
				'h3',
				'h4',
				'h5',
				'h6',
				'tr',
				'blockquote',
			]);
			if (blockTags.has(tag)) {
				segments.push({ type: 'text', value: '\n' });
			}
		}
		if (node.nodeType === Node.TEXT_NODE) {
			const value = node.textContent ?? '';
			if (value) segments.push({ type: 'text', value });
			return; // 文本节点无子节点
		}
		node.childNodes.forEach(walk);
		if (node.nodeType === Node.ELEMENT_NODE) {
			const tag = (node as Element).tagName.toLowerCase();
			const blockTags = new Set([
				'p',
				'div',
				'li',
				'h1',
				'h2',
				'h3',
				'h4',
				'h5',
				'h6',
				'tr',
				'blockquote',
			]);
			if (blockTags.has(tag)) {
				segments.push({ type: 'text', value: '\n' });
			}
		}
	};
	walk(tmp);
	// 合并相邻文本片段，压缩多余空行
	const merged: ClipSegment[] = [];
	let buf = '';
	for (const seg of segments) {
		if (seg.type === 'text') {
			buf += seg.value;
		} else {
			if (buf) {
				merged.push({ type: 'text', value: buf });
				buf = '';
			}
			merged.push(seg);
		}
	}
	if (buf) merged.push({ type: 'text', value: buf });
	// 压缩 3+ 换行为 2 个，trim 首尾
	return merged
		.map((seg) =>
			seg.type === 'text'
				? { ...seg, value: seg.value.replace(/\n{3,}/g, '\n\n') }
				: seg,
		)
		.filter((seg, i, arr) => {
			if (seg.type === 'text') {
				if (seg.value.trim() === '') {
					// 保留片段间的单个换行，仅丢弃纯空的首尾
					return i !== 0 && i !== arr.length - 1;
				}
			}
			return true;
		});
}

/**
 * Tauri 桌面端：读取系统剪贴板图片位图，经 canvas 转 PNG data URL。
 * 走 Tauri IPC（plugin-clipboard-manager），不触发 navigator.clipboard 的 Web 权限弹窗。
 * 剪贴板无图片位图时 readImage 抛错，返回 null 静默忽略。
 * 覆盖截图、从图片应用复制等"独立位图"场景；网页复制的 <img src> 远程图片拿不到。
 */
async function readClipImageAsDataUrl(): Promise<string | null> {
	if (!isTauriRuntime()) return null;
	try {
		const { readImage } = await import('@tauri-apps/plugin-clipboard-manager');
		const img = await readImage();
		const rgba = await img.rgba();
		const size = await img.size();
		const width = size?.width ?? 0;
		const height = size?.height ?? 0;
		// 放宽校验：只要宽高非零且 rgba 存在就尝试转换（位图长度由 Tauri 保证）
		if (!width || !height || !rgba || rgba.length === 0) return null;
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.putImageData(
			new ImageData(new Uint8ClampedArray(rgba), width, height),
			0,
			0,
		);
		return canvas.toDataURL('image/png');
	} catch {
		return null;
	}
}

/**
 * 从 DOM 元素向上查找 ProseMirror EditorView（内部 API pmViewDesc.view）。
 * 用于 Tauri 桌面端手动插入图文到 TipTap 编辑器。
 */
function getProseMirrorView(el: HTMLElement): any | null {
	let node: Element | null = el;
	while (node) {
		const desc = (node as any).pmViewDesc;
		if (desc?.view) return desc.view;
		node = node.parentElement;
	}
	return null;
}

export const copyToClipboard = async (text: string): Promise<void> => {
	await writeClipText(text);
};

/** 将 Canvas 生成的 PNG 写入剪贴板（Safari 须在点击回调内同步调用 write，Blob 用 ClipboardItem Promise 延迟） */
export function copyCanvasToClipboard(
	canvas: HTMLCanvasElement,
): Promise<void> {
	if (isTauriRuntime()) {
		return copyCanvasToClipboardTauri(canvas);
	}
	if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
		return Promise.reject(new Error('剪贴板不可用'));
	}
	// 同步调用 write，不在此前 await；toBlob 放进 ClipboardItem Promise
	return navigator.clipboard.write([
		new ClipboardItem({
			'image/png': canvasToPngBlob(canvas),
		}),
	]);
}

async function copyCanvasToClipboardTauri(
	canvas: HTMLCanvasElement,
): Promise<void> {
	const blob = await canvasToPngBlob(canvas);
	const { Image } = await import('@tauri-apps/api/image');
	const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
	const image = await Image.fromBytes(await blob.arrayBuffer());
	await writeImage(image);
}

/** 将已有图片 Blob 写入剪贴板 */
export async function copyImageToClipboard(blob: Blob): Promise<void> {
	if (isTauriRuntime()) {
		const { Image } = await import('@tauri-apps/api/image');
		const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
		const image = await Image.fromBytes(await blob.arrayBuffer());
		await writeImage(image);
		return;
	}
	if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
		throw new Error('剪贴板不可用');
	}
	await navigator.clipboard.write([
		new ClipboardItem({
			'image/png': Promise.resolve(blob),
		}),
	]);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((result) => {
			if (result) resolve(result);
			else reject(new Error('剪贴板不可用'));
		}, 'image/png');
	});
}

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

/** 事件路径是否落在 Monaco / CodeMirror（自有剪贴板方案，此处不接管） */
function monacoOrCodeMirrorInEventPath(event: KeyboardEvent): boolean {
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

/**
 * TipTap / ProseMirror 正文 contenteditable（非标题原生 input）。
 * Tauri WebView 下系统 Cmd+C/V 往往无法作用到该类节点。
 */
function tipTapBodyInEventPath(event: KeyboardEvent): HTMLElement | null {
	for (const n of event.composedPath()) {
		if (!(n instanceof Element)) continue;
		const el = n.closest?.(
			'.tiptap.ProseMirror, .ProseMirror.tiptap, .rich-editor .tiptap[contenteditable="true"]',
		);
		if (el instanceof HTMLElement && el.isContentEditable) return el;
	}
	return null;
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

/** 事件路径是否落在可编辑区域（input/textarea/contenteditable）内 */
function editableInEventPath(event: KeyboardEvent): boolean {
	for (const n of event.composedPath()) {
		if (!(n instanceof Element)) continue;
		const tag = n.tagName?.toUpperCase?.() ?? '';
		if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
		if ((n as HTMLElement).isContentEditable) return true;
	}
	return false;
}

/**
 * 仅在 Tauri 下挂载：为普通 input/textarea 与 TipTap 正文接管 Cmd/Ctrl+C/V/X（走插件剪贴板），不拦截 Z。
 * Monaco / CodeMirror 有各自实现，此处跳过。
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

		// Monaco / CodeMirror：自有 Tauri 剪贴板扩展
		if (monacoOrCodeMirrorInEventPath(event)) return;

		/**
		 * 兜底：普通页面文本（非输入框/非富编辑器）选区复制
		 * - 目的：修复 Tauri WebView 中“选中文本但无法复制”的问题
		 * - 约束：不影响 input/textarea/contenteditable 的原生行为，也不影响 Monaco/CodeMirror
		 */
		if (key === 'c' && !editableInEventPath(event)) {
			const selection = window.getSelection?.();
			const text = selection?.toString?.() ?? '';
			if (selection && !selection.isCollapsed && text.trim()) {
				event.preventDefault();
				void writeClipText(text);
				return;
			}
		}

		const active = document.activeElement;

		// TipTap 正文：与 Sandpack CM 一样显式读写系统剪贴板
		// 标题区是原生 input，走下方 plain field 分支
		const tipTapBody = tipTapBodyInEventPath(event);
		if (tipTapBody && !isPlainTextField(active)) {
			if (key === 'a') return; // 全选由编辑器自身快捷键处理

			if (key === 'c') {
				const text = window.getSelection()?.toString() ?? '';
				if (!text) return;
				event.preventDefault();
				void writeClipText(text);
				return;
			}

			if (key === 'x') {
				const text = window.getSelection()?.toString() ?? '';
				if (!text) return;
				event.preventDefault();
				void writeClipText(text);
				tipTapBody.focus();
				document.execCommand('delete');
				return;
			}

			if (key === 'v') {
				// Tauri WebView 原生 paste 不触发到 ProseMirror：
				// 优先读剪贴板 HTML（含 <img src>，覆盖网页复制图文混合），
				// 回退 readText + readImage（覆盖纯文本 / 截图独立位图）。
				// 按 HTML 原始 DOM 顺序插入片段，保证图文相对顺序与复制时一致。
				event.preventDefault();
				const root = tipTapBody;
				void (async () => {
					if (!root.isConnected) return;
					// 1) 优先尝试 HTML：按顺序解析为文本/图片片段
					const html = await readClipHtml();
					let segments: ClipSegment[] = [];
					let imageDataUrl: string | null = null;
					if (html) {
						segments = parseHtmlSegments(html);
					} else {
						// 2) 无 HTML 时回退：readText 拿纯文本，readImage 拿截图位图
						const [t, img] = await Promise.all([
							readClipText(),
							readClipImageAsDataUrl(),
						]);
						if (t) segments.push({ type: 'text', value: t });
						imageDataUrl = img;
					}
					if (imageDataUrl) {
						segments.push({ type: 'image', src: imageDataUrl });
					}
					if (segments.length === 0) return;
					root.focus();
					const view = getProseMirrorView(root);
					if (view) {
						const imageType = view.state.schema.nodes.image;
						for (const seg of segments) {
							if (seg.type === 'text') {
								if (seg.value)
									view.dispatch(view.state.tr.insertText(seg.value));
							} else if (imageType) {
								const node = imageType.create({ src: seg.src });
								view.dispatch(view.state.tr.replaceSelectionWith(node));
							}
						}
						view.focus();
					} else {
						for (const seg of segments) {
							if (seg.type === 'text') {
								if (seg.value)
									document.execCommand('insertText', false, seg.value);
							} else {
								document.execCommand(
									'insertHTML',
									false,
									`<img src="${seg.src}" alt="" />`,
								);
							}
						}
					}
				})();
			}
			return;
		}

		const el = active;
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
