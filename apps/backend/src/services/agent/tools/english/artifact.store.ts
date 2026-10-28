import { randomUUID } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

export type ElResourceSource =
	| 'library'
	| 'favorites'
	| 'mistakes'
	| 'memo'
	| 'reading'
	| 'pack'
	| 'notes'
	| 'other';

/** 旁路清单：SSE、消息快照、GET 补拉共用 */
export type ElResourceListPayload = {
	artifactId: string;
	title: string;
	source: ElResourceSource;
	contentKind?: 'vocab' | 'classic';
	libraryId?: string;
	totalCount: number;
	truncated: boolean;
	/** 全量行；SSE 超阈时省略，由 GET 补拉 */
	items?: unknown[];
};

type StoredArtifact = ElResourceListPayload & { userId: number };

const KEY_PREFIX = 'el_artifact:';
/** 30 分钟。ponytail: 内存 TTL，过期靠消息快照或重新提问；要跨进程改 Redis 同一 key。 */
const TTL_MS = 30 * 60 * 1000;

@Injectable()
export class ElArtifactStore {
	constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

	private key(id: string): string {
		return `${KEY_PREFIX}${id}`;
	}

	async put(
		userId: number,
		row: Omit<ElResourceListPayload, 'artifactId'>,
	): Promise<string> {
		const artifactId = randomUUID();
		const stored: StoredArtifact = { ...row, artifactId, userId };
		await this.cache.set(this.key(artifactId), stored, TTL_MS);
		return artifactId;
	}

	/** 属主不符或过期返回 null，避免凭 id 串号 */
	async get(
		userId: number,
		artifactId: string,
	): Promise<ElResourceListPayload | null> {
		const row = await this.cache.get<StoredArtifact>(this.key(artifactId));
		if (!row || row.userId !== userId) return null;
		const { userId: _userId, ...payload } = row;
		return payload;
	}
}
