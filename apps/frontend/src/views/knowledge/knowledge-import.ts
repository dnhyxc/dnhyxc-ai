/** 知识库编辑器：从本地 .md 文件导入（跨端 pickFileObject） */

import { pickFileObject } from '@/utils';

/** 文件选择器仅展示 .md（部分浏览器仍会依赖后续校验） */
const IMPORT_ACCEPT = '.md';
/** 单文件大小上限（字节） */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type KnowledgeImportFileResult = {
	content: string;
	fileName: string;
};

/** 是否为可导入的 Markdown（.md）文件 */
export function isKnowledgeImportMdFile(fileName: string): boolean {
	return fileName.trim().toLowerCase().endsWith('.md');
}

/** 由导入文件名推导编辑器标题（去掉 `.md` 后缀） */
export function importFileNameToTitle(fileName: string): string {
	const trimmed = fileName.trim();
	if (!trimmed) return '';
	const lower = trimmed.toLowerCase();
	if (lower.endsWith('.md')) {
		return trimmed.slice(0, -3).trim();
	}
	return trimmed;
}

/**
 * 打开文件选择器并读取 .md 文本；用户取消时返回 null。
 * 扩展名不符 / 过大 → throw（`accept` / `file_too_large` / `read_failed`）。
 */
export async function pickKnowledgeImportFile(): Promise<KnowledgeImportFileResult | null> {
	const file = await pickFileObject({
		accept: IMPORT_ACCEPT,
		maxBytes: MAX_IMPORT_BYTES,
		title: '导入 Markdown',
	});
	if (!file) return null;
	if (!isKnowledgeImportMdFile(file.name)) {
		throw new Error('accept');
	}
	try {
		const content = await file.text();
		return { content, fileName: file.name || 'import.md' };
	} catch {
		throw new Error('read_failed');
	}
}
