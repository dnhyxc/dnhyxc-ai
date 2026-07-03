import type { EbookThought, EbookThoughtSync } from '../../../types';

/** 合并增量想法：按 id 覆盖/追加，保持 createdAt 降序 */
export function mergeEbookThoughts(
	base: EbookThought[],
	incoming: EbookThought[],
): EbookThought[] {
	if (incoming.length === 0) return base;

	const byId = new Map(base.map((item) => [item.id, item]));
	for (const item of incoming) {
		byId.set(item.id, item);
	}
	return [...byId.values()].sort(
		(left, right) =>
			new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
	);
}

export function pruneEbookThoughtsByIds(
	thoughts: EbookThought[],
	deletedIds: string[],
): EbookThought[] {
	if (deletedIds.length === 0) return thoughts;
	const drop = new Set(deletedIds);
	return thoughts.filter((item) => !drop.has(item.id));
}

export function maxEbookThoughtUpdatedAt(
	thoughts: EbookThought[],
): string | null {
	let latestMs = -1;
	let latest: string | null = null;
	for (const thought of thoughts) {
		const ms = new Date(thought.updatedAt).getTime();
		if (ms > latestMs) {
			latestMs = ms;
			latest = thought.updatedAt;
		}
	}
	return latest;
}

/** 传给 /sync 的 since：略早于本地 watermark，避免同毫秒新增被 `>` 漏掉 */
export function ebookThoughtSyncSinceParam(
	localMax: string | null,
): string | undefined {
	if (!localMax) return undefined;
	return new Date(new Date(localMax).getTime() - 1).toISOString();
}

/** 读书记录 / 公开源书：需要拉取他人想法；源书已取消公开则不需要 */
export function isSharedEbookThoughtContext(
	book?: {
		isPublic?: boolean;
		sourceBookId?: string | null;
	} | null,
	publicSource?: { isStillPublic: boolean } | null,
): boolean {
	if (!book) return false;
	if (publicSource && !publicSource.isStillPublic) return false;
	return Boolean(book.isPublic || book.sourceBookId);
}

function isThoughtSyncUnchanged(
	local: EbookThought[],
	sync: EbookThoughtSync,
): boolean {
	const deletedIds = sync.deletedIds ?? [];
	const localMax = maxEbookThoughtUpdatedAt(local);
	return (
		sync.changes.length === 0 &&
		deletedIds.length === 0 &&
		sync.revision.count === local.length &&
		(sync.revision.latestUpdatedAt == null ||
			(localMax != null && sync.revision.latestUpdatedAt <= localMax))
	);
}

/** 应用 sync：增量合并 + deletedIds 剔除；不再依赖无 since 全量兜底 */
export function applyEbookThoughtSync(
	local: EbookThought[],
	sync: EbookThoughtSync,
): { next: EbookThought[] } {
	if (isThoughtSyncUnchanged(local, sync)) {
		return { next: local };
	}

	let next = pruneEbookThoughtsByIds(local, sync.deletedIds ?? []);
	if (sync.changes.length > 0) {
		next = mergeEbookThoughts(next, sync.changes);
	}
	return { next };
}
