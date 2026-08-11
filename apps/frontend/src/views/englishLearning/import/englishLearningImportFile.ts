/** 英语学习 JSON 导入：跨端 pickFileObject */

import { pickFileObject } from '@/utils';

export const JSON_IMPORT_ACCEPT = '.json';

export function isJsonImportFileName(name: string): boolean {
	return name.trim().toLowerCase().endsWith('.json');
}

/** 打开文件选择并返回单个 .json File；取消返回 null；非 .json throw `accept` */
export async function pickEnglishLearningJsonFile(): Promise<File | null> {
	const file = await pickFileObject({
		accept: JSON_IMPORT_ACCEPT,
		title: '导入 JSON',
	});
	if (!file) return null;
	if (!isJsonImportFileName(file.name)) {
		throw new Error('accept');
	}
	return file;
}
