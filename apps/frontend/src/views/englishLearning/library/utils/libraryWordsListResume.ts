/**
 * 资源库词条续读 offset：对齐到页起点
 */

/** 将任意 offset 对齐到页起点；非法值回退 0 */
export function alignResumeOffset(offset: number, pageSize: number): number {
	if (!Number.isFinite(offset) || offset <= 0 || pageSize <= 0) return 0;
	return Math.floor(offset / pageSize) * pageSize;
}
