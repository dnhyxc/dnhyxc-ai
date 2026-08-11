/** 英语学习 JSON 导入：Web 用 input accept；Tauri 用通用 selectFile + 读文件 */

import { isTauriRuntime, selectFile } from '@/utils';

export const JSON_IMPORT_ACCEPT = '.json';

export function isJsonImportFileName(name: string): boolean {
	return name.trim().toLowerCase().endsWith('.json');
}

function fileNameFromPath(filePath: string): string {
	const parts = filePath.split(/[/\\]/).filter(Boolean);
	return parts[parts.length - 1] ?? 'import.json';
}

function pickJsonFileWeb(): Promise<File | null> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = JSON_IMPORT_ACCEPT;
		input.style.display = 'none';
		document.body.appendChild(input);

		const cleanup = () => input.remove();

		input.addEventListener('change', () => {
			const file = input.files?.[0] ?? null;
			cleanup();
			if (!file) {
				resolve(null);
				return;
			}
			if (!isJsonImportFileName(file.name)) {
				reject(new Error('not_json'));
				return;
			}
			resolve(file);
		});

		input.addEventListener('cancel', () => {
			cleanup();
			resolve(null);
		});

		input.click();
	});
}

async function pickJsonFileTauri(): Promise<File | null> {
	const filePath = await selectFile({
		accept: JSON_IMPORT_ACCEPT,
		title: '导入 JSON',
	});
	if (!filePath) return null;
	const fileName = fileNameFromPath(filePath);
	if (!isJsonImportFileName(fileName)) return null;
	const { invoke } = await import('@tauri-apps/api/core');
	const content = await invoke<string>(
		'read_english_learning_import_json_file',
		{ filePath },
	);
	return new File([content], fileName, {
		type: 'application/json',
		lastModified: Date.now(),
	});
}

/** 打开文件选择并返回单个 .json File；取消或非 .json 返回 null */
export function pickEnglishLearningJsonFile(): Promise<File | null> {
	if (isTauriRuntime()) {
		return pickJsonFileTauri();
	}
	return pickJsonFileWeb();
}
