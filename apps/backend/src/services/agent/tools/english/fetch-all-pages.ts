/** 按页拼到数据库没有下一行。结束条件不含条数硬顶。 */
export async function fetchAllPages<T>(
	pageSize: number,
	fetchPage: (
		limit: number,
		offset: number,
	) => Promise<{ items: T[]; totalCount?: number }>,
): Promise<{ items: T[]; totalCount: number; truncated: boolean }> {
	const items: T[] = [];
	let totalCount = Number.POSITIVE_INFINITY;
	let offset = 0;
	while (true) {
		const page = await fetchPage(pageSize, offset);
		if (typeof page.totalCount === 'number') totalCount = page.totalCount;
		if (!page.items.length) break;
		items.push(...page.items);
		offset += page.items.length;
		if (page.items.length < pageSize) break;
		if (Number.isFinite(totalCount) && items.length >= totalCount) break;
	}
	if (!Number.isFinite(totalCount)) totalCount = items.length;
	return {
		items,
		totalCount,
		truncated: Number.isFinite(totalCount) && items.length < totalCount,
	};
}
