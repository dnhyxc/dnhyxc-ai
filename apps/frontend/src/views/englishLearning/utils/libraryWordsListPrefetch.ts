/** 与后端 vocabulary/classic items API limit 上限一致 */
export const LIBRARY_ITEMS_FETCH_CHUNK = 1000;

export type LibraryPrefetchChunk = { offset: number; limit: number };

/** 从 0 到续读页末尾需要的分页请求（尽量少次 HTTP） */
export function buildLibraryPrefetchChunks(
	resumeOffset: number,
	pageSize: number,
	chunkSize = LIBRARY_ITEMS_FETCH_CHUNK,
): LibraryPrefetchChunk[] {
	const end = Math.max(pageSize, resumeOffset + pageSize);
	if (end <= chunkSize) {
		return [{ offset: 0, limit: end }];
	}
	const chunks: LibraryPrefetchChunk[] = [];
	for (let offset = 0; offset < end; offset += chunkSize) {
		chunks.push({
			offset,
			limit: Math.min(chunkSize, end - offset),
		});
	}
	return chunks;
}

/** [fromOffset, toExclusive) 按 chunk 切片，用于 items / favorites-status 对齐预取 */
export function buildLibraryRangeChunks(
	fromOffset: number,
	toExclusive: number,
	chunkSize = LIBRARY_ITEMS_FETCH_CHUNK,
): LibraryPrefetchChunk[] {
	if (toExclusive <= fromOffset) return [];
	const chunks: LibraryPrefetchChunk[] = [];
	for (let offset = fromOffset; offset < toExclusive; offset += chunkSize) {
		chunks.push({
			offset,
			limit: Math.min(chunkSize, toExclusive - offset),
		});
	}
	return chunks;
}

/** ponytail: 限制并发，避免续读很深时瞬间打满连接 */
export async function mapWithConcurrency<T, R>(
	items: readonly T[],
	concurrency: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	if (items.length === 0) return [];
	const results: R[] = new Array(items.length);
	let next = 0;
	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			while (next < items.length) {
				const i = next++;
				results[i] = await fn(items[i], i);
			}
		},
	);
	await Promise.all(workers);
	return results;
}
