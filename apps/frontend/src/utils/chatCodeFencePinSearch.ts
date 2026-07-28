/**
 * 文档序下，找第一个「底边不低于视口顶」的下标（二分）。
 * ponytail: 假定代码块按文档流自上而下排列（Markdown 预览成立）。
 */
export function findFirstBlockNotAboveViewportTop(
	getBottom: (index: number) => number,
	length: number,
	topY: number,
): number {
	let lo = 0;
	let hi = length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (getBottom(mid) <= topY) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}
