/** 最小版 className 合并工具；建议替换为 clsx + tailwind-merge。 */
export function cn(...xs: Array<string | undefined | null | false>): string {
	return xs.filter(Boolean).join(' ');
}
