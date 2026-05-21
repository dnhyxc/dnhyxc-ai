/** 知识库编辑器：从本地 .md 文件导入（Web 用 input accept；Tauri 用仅 .md 的系统对话框） */

import { isTauriRuntime } from '@/utils';
import {
	invokeReadKnowledgeMarkdownFile,
	invokeSelectKnowledgeImportMdFile,
} from '@/utils/knowledge-save';

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

function assertImportSize(bytes: number): void {
	if (bytes > MAX_IMPORT_BYTES) {
		throw new Error('file_too_large');
	}
}

function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
		reader.readAsText(file, 'UTF-8');
	});
}

function fileNameFromPath(filePath: string): string {
	const parts = filePath.split(/[/\\]/).filter(Boolean);
	return parts[parts.length - 1] ?? 'import.md';
}

function pickKnowledgeImportFileWeb(): Promise<KnowledgeImportFileResult | null> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = IMPORT_ACCEPT;
		input.style.display = 'none';
		document.body.appendChild(input);

		const cleanup = () => {
			input.remove();
		};

		input.addEventListener('change', () => {
			const file = input.files?.[0];
			cleanup();
			if (!file) {
				resolve(null);
				return;
			}
			if (!isKnowledgeImportMdFile(file.name)) {
				reject(new Error('not_md'));
				return;
			}
			assertImportSize(file.size);
			void readFileAsText(file)
				.then((content) =>
					resolve({ content, fileName: file.name || 'import.md' }),
				)
				.catch(() => reject(new Error('read_failed')));
		});

		input.addEventListener('cancel', () => {
			cleanup();
			resolve(null);
		});

		input.click();
	});
}

async function pickKnowledgeImportFileTauri(): Promise<KnowledgeImportFileResult | null> {
	const filePath = await invokeSelectKnowledgeImportMdFile();
	if (!filePath) return null;
	const fileName = fileNameFromPath(filePath);
	if (!isKnowledgeImportMdFile(fileName)) {
		throw new Error('not_md');
	}
	const content = await invokeReadKnowledgeMarkdownFile(filePath);
	assertImportSize(new TextEncoder().encode(content).length);
	return { content, fileName };
}

/**
 * 打开文件选择器并读取 .md 文本；用户取消时返回 null。
 */
export function pickKnowledgeImportFile(): Promise<KnowledgeImportFileResult | null> {
	if (isTauriRuntime()) {
		return pickKnowledgeImportFileTauri();
	}
	return pickKnowledgeImportFileWeb();
}
