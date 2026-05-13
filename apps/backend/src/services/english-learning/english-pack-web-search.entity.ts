import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from 'typeorm';
import type { WebSearchOrganicItem } from '../web-search/web-search.types';

/** 单次拉取会话内一轮 internet_search 的落库结构（可多轮追加到同一 stream） */
export type EnglishPackWebSearchRoundJson = {
	/** 模型传入的检索关键词摘要（可选） */
	query?: string | null;
	organic: WebSearchOrganicItem[];
};

/**
 * 单词包 / 经典句拉取与主检索联网结果的关联表：按 `streamId` + `packKind` 唯一一行，
 * `search_rounds` 为多次联网的 JSON 数组（通常仅一轮）。
 */
@Entity('english_pack_web_search')
@Unique('uq_epws_user_stream_kind', ['userId', 'streamId', 'packKind'])
@Index('idx_epws_user_stream', ['userId', 'streamId'])
export class EnglishPackWebSearchRecord {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'stream_id', type: 'varchar', length: 36 })
	streamId!: string;

	@Column({ name: 'pack_kind', type: 'varchar', length: 32 })
	packKind!: 'vocabulary' | 'classic_quotes';

	@Column({ name: 'search_rounds', type: 'json' })
	searchRounds!: EnglishPackWebSearchRoundJson[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
