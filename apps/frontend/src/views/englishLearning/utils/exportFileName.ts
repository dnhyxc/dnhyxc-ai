/** 导出落盘名：去掉路径非法字符，空则用 fallback */
export function safeExportBaseName(title: string, fallback = 'export'): string {
	const s = title
		.trim()
		.replace(/[\\/:*?"<>|]/g, '_')
		.slice(0, 80);
	return s || fallback;
}

/** 保证以 .docx 结尾 */
export function exportDocxFileName(title: string, fallback = 'export'): string {
	const base = safeExportBaseName(title, fallback);
	return /\.docx$/i.test(base) ? base : `${base}.docx`;
}
