/** 下载进度等：字节格式化为 MB（1 MB = 1024² 字节） */
export function formatBytesAsMb(bytes: number): string {
	const n = Math.max(0, Number(bytes) || 0);
	const mb = n / (1024 * 1024);
	return `${mb.toFixed(2)} MB`;
}
