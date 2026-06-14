import { invoke } from '@tauri-apps/api/core';
import { fetchEbookBytes } from '@/service';
import { isTauriRuntime } from '@/utils/runtime';
import type { BookFmt, BookSrc } from '../types';

export function fmtFromName(name: string): BookFmt | null {
	const lower = name.toLowerCase();
	if (lower.endsWith('.epub')) return 'epub';
	if (lower.endsWith('.pdf')) return 'pdf';
	return null;
}

export function titleFromName(name: string): string {
	const base = name.replace(/\.[^.]+$/, '').trim();
	return base || name;
}

async function readTauriBytes(path: string): Promise<ArrayBuffer> {
	const bytes = await invoke<number[]>('read_ebook_file', { path });
	return Uint8Array.from(bytes).buffer;
}

/** 统一解析为 epub.js / pdf.js 可用的 ArrayBuffer（避免 Tauri asset:// 与 XHR 不兼容） */
export async function resolveOpen(
	src: BookSrc,
	_fmt: BookFmt,
	bookId?: string,
): Promise<ArrayBuffer> {
	if (src.kind === 'store') {
		if (!bookId) throw new Error('缺少书籍 id');
		return await fetchEbookBytes(bookId);
	}

	if (isTauriRuntime()) {
		return await readTauriBytes(src.path);
	}

	throw new Error('桌面路径仅在 Tauri 客户端可用');
}

export async function pickTauri(): Promise<{
	path: string;
	fmt: BookFmt;
} | null> {
	if (!isTauriRuntime()) return null;
	const path = await invoke<string | null>('pick_ebook_file');
	if (!path) return null;
	const fmt = fmtFromName(path);
	if (!fmt) throw new Error('仅支持 epub / pdf');
	return { path, fmt };
}
