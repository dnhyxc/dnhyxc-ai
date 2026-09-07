import type { Cache } from '@nestjs/cache-manager';
import type { LoggerService } from '@nestjs/common';

/** vocab = 单词库；classic = 经典语句库 */
export type ElLibraryKind = 'vocab' | 'classic';

/** 库列表缓存行：不含 isOwned / itemsResumeOffset（按请求用户现算） */
export type CachedLibraryRow = {
	id: string;
	userId: number;
	title: string;
	/** vocab→wordCount；classic→quoteCount */
	count: number;
	isPublic: boolean;
	/** ISO 字符串，避免 Redis JSON 后 Date 方法丢失 */
	createdAt: string;
};

/** 词条缓存：禁止带 favoriteId（用户相关） */
export type CachedVocabItemRow = {
	id: string;
	sortOrder: number;
	word: string;
	ipa: string;
	pos: string;
	segmentation: string;
	translationZh: string;
	example: string;
};

export type CachedClassicItemRow = {
	id: string;
	sortOrder: number;
	english: string;
	translationZh: string;
	source: string;
	noteZh: string;
};

export const EL_LIB_LIST_TTL_MS = 10 * 60 * 1000;
export const EL_LIB_ITEMS_TTL_MS = 60 * 60 * 1000;
/** version key 长 TTL；实际靠 bump 失效 */
export const EL_LIB_VER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function elPublicVerKey(kind: ElLibraryKind): string {
	return `el:lib:${kind}:publicVer`;
}

export function elMineVerKey(kind: ElLibraryKind, userId: number): string {
	return `el:lib:${kind}:mineVer:${userId}`;
}

export function elItemsVerKey(kind: ElLibraryKind, libraryId: string): string {
	return `el:lib:${kind}:itemsVer:${libraryId}`;
}

export function elLibsPageKey(
	kind: ElLibraryKind,
	userId: number,
	publicVer: number,
	mineVer: number,
	limit: number,
	offset: number,
): string {
	return `el:lib:${kind}:libs:u:${userId}:pv:${publicVer}:mv:${mineVer}:l:${limit}:o:${offset}`;
}

export function elItemsPageKey(
	kind: ElLibraryKind,
	libraryId: string,
	itemsVer: number,
	limit: number,
	offset: number,
): string {
	return `el:lib:${kind}:items:${libraryId}:v:${itemsVer}:l:${limit}:o:${offset}`;
}

export function parseCacheVer(value: unknown): number {
	const n =
		typeof value === 'number'
			? value
			: typeof value === 'string'
				? Number(value)
				: 0;
	return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/**
 * 英语学习资源库 Redis 旁路缓存。
 * 只缓存与「当前用户」无关的数据；收藏 / 续读 / isOwned 必须在命中后再挂。
 */
export class EnglishLearningLibraryCache {
	constructor(
		private readonly cache: Cache,
		private readonly logger: LoggerService,
	) {}

	async getSafe<T>(key: string): Promise<T | undefined> {
		try {
			const v = await this.cache.get<T>(key);
			return v === null || v === undefined ? undefined : v;
		} catch (e) {
			this.logger.warn?.(
				`[el-lib-cache] get failed key=${key}: ${e instanceof Error ? e.message : e}`,
			);
			return undefined;
		}
	}

	async setSafe(key: string, value: unknown, ttlMs: number): Promise<void> {
		try {
			await this.cache.set(key, value, ttlMs);
		} catch (e) {
			this.logger.warn?.(
				`[el-lib-cache] set failed key=${key}: ${e instanceof Error ? e.message : e}`,
			);
		}
	}

	async getVer(key: string): Promise<number> {
		return parseCacheVer(await this.getSafe(key));
	}

	async bumpVer(key: string): Promise<number> {
		const next = (await this.getVer(key)) + 1;
		await this.setSafe(key, next, EL_LIB_VER_TTL_MS);
		return next;
	}

	async getListVers(
		kind: ElLibraryKind,
		userId: number,
	): Promise<{ publicVer: number; mineVer: number }> {
		const [publicVer, mineVer] = await Promise.all([
			this.getVer(elPublicVerKey(kind)),
			this.getVer(elMineVerKey(kind, userId)),
		]);
		return { publicVer, mineVer };
	}

	/** 新建私有库：只影响所有者「我的库」世代 */
	async onLibraryCreated(
		kind: ElLibraryKind,
		ownerUserId: number,
	): Promise<void> {
		await this.bumpVer(elMineVerKey(kind, ownerUserId));
	}

	/**
	 * 删除库：所有者列表必变；若曾公开则公开列表也变；词条页世代升高丢弃旧分页。
	 */
	async onLibraryDeleted(
		kind: ElLibraryKind,
		ownerUserId: number,
		libraryId: string,
		wasPublic: boolean,
	): Promise<void> {
		await Promise.all([
			this.bumpVer(elMineVerKey(kind, ownerUserId)),
			wasPublic ? this.bumpVer(elPublicVerKey(kind)) : Promise.resolve(0),
			this.bumpVer(elItemsVerKey(kind, libraryId)),
		]);
	}

	/** 改标题：所有者列表变；公开库标题出现在公开列表里 */
	async onLibraryTitleChanged(
		kind: ElLibraryKind,
		ownerUserId: number,
		isPublic: boolean,
	): Promise<void> {
		await this.bumpVer(elMineVerKey(kind, ownerUserId));
		if (isPublic) {
			await this.bumpVer(elPublicVerKey(kind));
		}
	}

	/** 改可见性：公开列表 + 所有者列表都变；词条内容本身不变 */
	async onLibraryVisibilityChanged(
		kind: ElLibraryKind,
		ownerUserId: number,
	): Promise<void> {
		await Promise.all([
			this.bumpVer(elMineVerKey(kind, ownerUserId)),
			this.bumpVer(elPublicVerKey(kind)),
		]);
	}
}
