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
		try {
			const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
			return await readText();
		} catch {
			// 剪贴板无文本 flavor（如纯图片/截图）：返回空串，不阻断 Promise.all
			return '';
		}
	}
	if (navigator.clipboard?.readText) {
		try {
			return await navigator.clipboard.readText();
		} catch {
			return '';
		}
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

const LITERAL_IMG_RE = /<img\b[^>]*>/gi;

/** 1x1 占位图（知乎等懒加载） */
function isPlaceholderSrc(src: string): boolean {
	const s = src.trim();
	if (s.startsWith('data:image/svg+xml;base64,') && s.length < 250) return true;
	if (s.startsWith('data:image/gif;base64,') && s.length < 100) return true;
	if (s.startsWith('data:image/png;base64,') && s.length < 200) return true;
	return false;
}

function isImgSrc(src: string): boolean {
	const s = src.trim();
	if (!s || /^javascript:/i.test(s)) return false;
	return true;
}

/** 懒加载属性优先，拿真实图 URL */
function pickImgSrc(el: Element): string | null {
	const candidates = [
		el.getAttribute('data-rawsrc'),
		el.getAttribute('data-src'),
		el.getAttribute('data-original'),
		el.getAttribute('src'),
	].filter(Boolean) as string[];
	for (const src of candidates) {
		if (isImgSrc(src) && !isPlaceholderSrc(src)) return src;
	}
	const srcset = el.getAttribute('srcset');
	if (srcset) {
		const first = srcset.split(',')[0]?.trim().split(' ')[0];
		if (first && isImgSrc(first)) return first;
	}
	for (const src of candidates) {
		if (src.trim()) return src.trim();
	}
	return null;
}

/**
 * 清洗剪贴板 HTML，交给 TipTap insertContent（对齐 web 原生粘贴：保留 <a>、段落，不人造空行）。
 * - 去掉 noscript/script 等重复源码
 * - img 的 src 改写为 data-original 等真实地址
 * - 剥掉文本里转义的裸 <img> 标签
 */
function preprocessClipboardHtml(html: string): string {
	const tmp = document.createElement('div');
	tmp.innerHTML = html;
	tmp.querySelectorAll('noscript, script, style, template').forEach((el) => {
		el.remove();
	});
	tmp.querySelectorAll('img').forEach((img) => {
		const src = pickImgSrc(img);
		if (src) img.setAttribute('src', src);
		else img.remove();
	});
	const walk = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT);
	const texts: Text[] = [];
	while (walk.nextNode()) texts.push(walk.currentNode as Text);
	for (const t of texts) {
		const v = t.textContent ?? '';
		if (!LITERAL_IMG_RE.test(v)) continue;
		LITERAL_IMG_RE.lastIndex = 0;
		t.textContent = v.replace(LITERAL_IMG_RE, '');
	}
	return tmp.innerHTML;
}

/**
 * 按原始 DOM 顺序解析剪贴板 HTML → 文本/图片片段（无 TipTap 时的回退路径）。
 */
function parseHtmlSegments(html: string): ClipSegment[] {
	const tmp = document.createElement('div');
	tmp.innerHTML = preprocessClipboardHtml(html);
	tmp.querySelectorAll('br').forEach((br) => {
		br.replaceWith('\n');
	});
	const segments: ClipSegment[] = [];
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

	const walk = (node: Node) => {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const tag = el.tagName.toLowerCase();
			if (tag === 'img') {
				const src = pickImgSrc(el);
				if (src) segments.push({ type: 'image', src });
				return;
			}
			if (blockTags.has(tag)) segments.push({ type: 'text', value: '\n' });
		}
		if (node.nodeType === Node.TEXT_NODE) {
			const value = node.textContent ?? '';
			if (value) segments.push({ type: 'text', value });
			return;
		}
		node.childNodes.forEach(walk);
		if (node.nodeType === Node.ELEMENT_NODE) {
			const tag = (node as Element).tagName.toLowerCase();
			if (blockTags.has(tag)) segments.push({ type: 'text', value: '\n' });
		}
	};
	walk(tmp);

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
	return merged
		.map((seg) =>
			seg.type === 'text'
				? { ...seg, value: seg.value.replace(/\n{3,}/g, '\n\n') }
				: seg,
		)
		.filter((seg, i, arr) => {
			if (seg.type === 'text' && seg.value.trim() === '') {
				return i !== 0 && i !== arr.length - 1;
			}
			return true;
		});
}

/**
 * Tauri 桌面端：读取系统剪贴板图片位图，Rust 侧用 arboard 读取并编码为 PNG base64 data URL。
 * 走自定义 Rust 命令 read_clipboard_image_base64，避免 Tauri plugin readImage 的 canvas 转换问题。
 * 剪贴板无图片位图时返回 null。覆盖截图、从图片应用复制等"独立位图"场景。
 */
async function readClipImageAsDataUrl(): Promise<string | null> {
	if (!isTauriRuntime()) return null;
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		const dataUrl = await invoke<string | null>('read_clipboard_image_base64');
		return dataUrl?.startsWith('data:image/') ? dataUrl : null;
	} catch {
		return null;
	}
}

/**
 * Tauri 桌面端：读取剪贴板文件列表中的所有图片文件，逐个返回 data URL。
 * 走自定义 Rust 命令 read_clipboard_image_files_base64（arboard file_list + fs::read）。
 * 覆盖从 Finder 选中多个图片文件复制、从富文本应用复制多图等场景（arboard get_image 只能读单张）。
 * 非图片文件、读取失败的单项在 Rust 侧已跳过。
 */
async function readClipImageFiles(): Promise<string[]> {
	if (!isTauriRuntime()) return [];
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		const list = await invoke<string[]>('read_clipboard_image_files_base64');
		return (list ?? []).filter((s) => s.startsWith('data:image/'));
	} catch {
		return [];
	}
}

/**
 * 从 DOM 向上取 TipTap Editor / ProseMirror EditorView。
 * TipTap：view.dom.editor；原生 PM：pmViewDesc.view。
 */
function getTipTapEditor(el: HTMLElement): any | null {
	let node: Element | null = el;
	while (node) {
		const editor = (node as any).editor;
		if (editor?.commands && !editor.isDestroyed) return editor;
		node = node.parentElement;
	}
	return null;
}

function getProseMirrorView(el: HTMLElement): any | null {
	const editor = getTipTapEditor(el);
	if (editor?.view) return editor.view;
	let node: Element | null = el;
	while (node) {
		const desc = (node as any).pmViewDesc;
		if (desc?.view) return desc.view;
		node = node.parentElement;
	}
	return null;
}

/**
 * 有 HTML 时优先用 schema 缓存的 DOMParser.parseSlice（贴近 web 原生粘贴），
 * 否则 TipTap insertContent；保留 <a> / 段落。成功返回处理后的 HTML，失败 null。
 */
function insertHtmlViaEditor(editor: any, html: string): string | null {
	const processed = preprocessClipboardHtml(html);
	if (!processed.trim()) return null;
	const view = editor.view;
	const parser = view?.state?.schema?.cached?.domParser;
	if (parser?.parseSlice) {
		try {
			const holder = document.createElement('div');
			holder.innerHTML = processed;
			const slice = parser.parseSlice(holder, {
				preserveWhitespace: true,
				context: view.state.selection.$from,
			});
			if (slice?.content?.size) {
				view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
				view.focus();
				return processed;
			}
		} catch {
			// fall through
		}
	}
	try {
		const ok = !!editor.chain().focus().insertContent(processed).run();
		return ok ? processed : null;
	} catch {
		return null;
	}
}

/**
 * 块级图片插入后若仍停在 NodeSelection，下一段会盖掉上一张；near 把光标挪到节点后。
 */
function moveSelectionAfter(tr: any): any {
	const sel = tr.selection;
	const Sel = sel?.constructor;
	if (typeof Sel?.near !== 'function') return tr;
	const next = Sel.near(tr.doc.resolve(sel.to), 1);
	return next ? tr.setSelection(next) : tr;
}

/** 无 HTML / insertContent 失败时的回退：纯文本 + 图片片段 */
function insertClipSegments(view: any, segments: ClipSegment[]): void {
	const imageType = view.state.schema.nodes.image;
	for (const seg of segments) {
		if (seg.type === 'text') {
			if (!seg.value) continue;
			if (view.state.selection.node) {
				view.dispatch(moveSelectionAfter(view.state.tr));
			}
			view.dispatch(view.state.tr.insertText(seg.value));
		} else if (imageType) {
			const node = imageType.create({ src: seg.src });
			view.dispatch(
				moveSelectionAfter(view.state.tr.replaceSelectionWith(node)),
			);
		}
	}
	view.focus();
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
				// Tauri WebView 原生 paste 往往到不了 ProseMirror：
				// 有 HTML → 预处理后 insertContent（对齐 web：保留链接/段落）
				// 无 HTML → 纯文本 + 文件列表/位图图片
				event.preventDefault();
				const root = tipTapBody;
				void (async () => {
					if (!root.isConnected) return;
					const [html, imageDataUrl, imageFiles, text] = await Promise.all([
						readClipHtml(),
						readClipImageAsDataUrl(),
						readClipImageFiles(),
						readClipText(),
					]);

					root.focus();
					const editor = getTipTapEditor(root);
					const view = editor?.view ?? getProseMirrorView(root);

					// 优先：整段 HTML 一次插入（链接、换行与 web 一致）
					if (html && editor) {
						const inserted = insertHtmlViaEditor(editor, html);
						if (inserted != null) {
							const htmlImageCount = (inserted.match(/<img\b/gi) ?? []).length;
							const extraImages: string[] = [
								...imageFiles,
								...(imageDataUrl ? [imageDataUrl] : []),
							];
							const needExtra =
								htmlImageCount === 0 ||
								(htmlImageCount < extraImages.length && extraImages.length > 1);
							if (needExtra && extraImages.length > 0 && view) {
								insertClipSegments(
									view,
									extraImages.map((src) => ({
										type: 'image' as const,
										src,
									})),
								);
							}
							return;
						}
					}

					// 回退：文本/图片片段
					let segments: ClipSegment[] = [];
					if (html) segments = parseHtmlSegments(html);

					const htmlImageCount = segments.filter(
						(s) => s.type === 'image',
					).length;
					const extraImages: string[] = [
						...imageFiles,
						...(imageDataUrl ? [imageDataUrl] : []),
					];
					const needExtraImages =
						htmlImageCount === 0 ||
						(htmlImageCount < extraImages.length && extraImages.length > 1);

					if (needExtraImages && extraImages.length > 0) {
						if (segments.length === 0 && text) {
							segments.push({ type: 'text', value: text });
						}
						for (const src of extraImages) {
							segments.push({ type: 'image', src });
						}
					}
					if (segments.length === 0 && text) {
						segments.push({ type: 'text', value: text });
					}
					if (segments.length === 0) return;

					if (view) {
						insertClipSegments(view, segments);
					} else {
						for (const seg of segments) {
							if (seg.type === 'text') {
								if (seg.value)
									document.execCommand('insertText', false, seg.value);
							} else {
								document.execCommand(
									'insertHTML',
									false,
									`<img src="${seg.src.replace(/"/g, '&quot;')}" alt="" />`,
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
