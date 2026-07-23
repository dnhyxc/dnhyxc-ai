import type { Editor } from '@tiptap/react';

/** 本地文件 → data URL（默认插图方式，兼容 Tauri WebView） */
export function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error ?? new Error('read failed'));
		reader.readAsDataURL(file);
	});
}

/** 系统文件选择器选本地图片（不用 window.prompt） */
export function pickImageFile(accept = 'image/*'): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.multiple = false;
		let settled = false;
		const done = (file: File | null) => {
			if (settled) return;
			settled = true;
			resolve(file);
		};
		input.onchange = () => done(input.files?.[0] ?? null);
		// Chromium / Tauri WebView 支持 cancel
		input.addEventListener('cancel', () => done(null));
		input.click();
	});
}

export function isImageFile(file: File): boolean {
	return file.type.startsWith('image/');
}

export function clipboardImageFiles(event: ClipboardEvent): File[] {
	const items = event.clipboardData?.items;
	if (!items) return [];
	const out: File[] = [];
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (!item?.type.startsWith('image/')) continue;
		const file = item.getAsFile();
		if (file) out.push(file);
	}
	return out;
}

export function dataTransferImageFiles(dt: DataTransfer | null): File[] {
	if (!dt?.files?.length) return [];
	return [...dt.files].filter(isImageFile);
}

export type ResolveImageSrc = (
	file: File,
) => string | Promise<string | null | undefined>;

export async function insertImages(
	editor: Editor,
	files: File[],
	resolveSrc: ResolveImageSrc,
): Promise<void> {
	for (const file of files) {
		if (!isImageFile(file)) continue;
		const src = await resolveSrc(file);
		if (!src?.trim()) continue;
		editor.chain().focus().setImage({ src: src.trim(), alt: file.name }).run();
	}
}
