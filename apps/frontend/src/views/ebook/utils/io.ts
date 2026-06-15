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

async function readTauriBytes(
	path: string,
	forUpload = false,
): Promise<ArrayBuffer> {
	const bytes = await invoke<number[]>('read_ebook_file', {
		path,
		forUpload,
	});
	return Uint8Array.from(bytes).buffer;
}

/** 桌面端：读本地文件并构造 File，供统一 COS 上传 */
export async function tauriPickedFileToUpload(
	filePath: string,
	fmt: BookFmt,
): Promise<File> {
	const bytes = await readTauriBytes(filePath, true);
	const name = filePath.split(/[/\\]/).pop() ?? `book.${fmt}`;
	const mime = fmt === 'pdf' ? 'application/pdf' : 'application/epub+zip';
	return new File([bytes], name, { type: mime });
}

export function resolveLocalPath(src: BookSrc): string | undefined {
	if (src.kind === 'path') return src.path;
	return src.localPath;
}

/** 统一解析为 epub.js / pdf.js 可用的 ArrayBuffer（桌面端优先本地，失败再拉云端） */
export async function resolveOpen(
	src: BookSrc,
	_fmt: BookFmt,
	bookId?: string,
): Promise<ArrayBuffer> {
	const localPath = resolveLocalPath(src);
	if (localPath && isTauriRuntime()) {
		try {
			return await readTauriBytes(localPath, false);
		} catch {
			// 本地文件不可用（移动/删除）时回退云端
		}
	}

	if (!bookId) {
		throw new Error(
			localPath
				? '本地文件无法读取，且缺少书籍 id'
				: '本地路径书籍需在桌面客户端打开，或请重新导入上传',
		);
	}

	return await fetchEbookBytes(bookId);
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
