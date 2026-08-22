/**
 * 资源库词条续读 offset：对齐到页起点
 */

/** 将任意 offset 对齐到页起点；非法值回退 0 */
export function alignResumeOffset(offset: number, pageSize: number): number {
	if (!Number.isFinite(offset) || offset <= 0 || pageSize <= 0) return 0;
	return Math.floor(offset / pageSize) * pageSize;
}

/** 会话缓存窗口是否仍覆盖续读页（须从 offset 0 起，否则应重新预取） */
export function cacheCoversResumeOffset(
	cached: { startOffset: number; endOffset: number },
	resumeOffset: number,
	pageSize: number,
): boolean {
	if (cached.startOffset !== 0) return false;
	const page = alignResumeOffset(resumeOffset, pageSize);
	return cached.endOffset > page;
}
