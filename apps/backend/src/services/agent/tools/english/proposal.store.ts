import { randomUUID } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

export type ElProposalKind =
	| 'favorite_add'
	| 'favorite_remove'
	| 'mistake_add'
	| 'pack_generate'
	| 'reading_generate';

export type ElProposalPayload = {
	kind: ElProposalKind;
	/** vocab | classic */
	contentKind: 'vocab' | 'classic';
	/** 写入业务表所需字段（已校验）；批量时为 items[0] */
	body: Record<string, unknown>;
	/** 一批词。有则 commit 按数组落库 */
	items?: Record<string, unknown>[];
	/**
	 * 同一条确认里的另一类。只有原话同时点了单词和语句才写。
	 * items 仍是 contentKind 那一侧。
	 */
	paired?: {
		contentKind: 'vocab' | 'classic';
		items: Record<string, unknown>[];
	};
	/** 点名超过上限、清单未取尽，或有批没判完 */
	truncated?: boolean;
	/** cap 点名截断；list 清单未取尽；judge 有批未能判断 */
	gaps?: Array<'cap' | 'list' | 'judge'>;
	/** 移除时的收藏记录 id；批量时为 ids[0] */
	id?: string;
	/** 一批要取消的收藏记录 id */
	ids?: string[];
};

type StoredProposal = {
	userId: number;
	payload: ElProposalPayload;
	createdAt: number;
};

const KEY_PREFIX = 'el_proposal:';
/** 提案 TTL：10 分钟 */
const TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ElProposalStore {
	constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

	private key(id: string): string {
		return `${KEY_PREFIX}${id}`;
	}

	async put(userId: number, payload: ElProposalPayload): Promise<string> {
		const id = randomUUID();
		const row: StoredProposal = {
			userId,
			payload,
			createdAt: Date.now(),
		};
		await this.cache.set(this.key(id), row, TTL_MS);
		return id;
	}

	async peek(
		userId: number,
		proposalId: string,
	): Promise<ElProposalPayload | null> {
		const row = await this.cache.get<StoredProposal>(this.key(proposalId));
		if (!row || row.userId !== userId) return null;
		return row.payload;
	}

	/** 一次性消费；属主不符或过期返回 null */
	async consume(
		userId: number,
		proposalId: string,
	): Promise<ElProposalPayload | null> {
		const k = this.key(proposalId);
		const row = await this.cache.get<StoredProposal>(k);
		if (!row || row.userId !== userId) return null;
		await this.cache.del(k);
		return row.payload;
	}
}
