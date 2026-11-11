import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import type { VocabDetail } from '../vocab-detail.parse';

/**
 * 单词详解全局缓存（跨用户共享）。
 * cache_key = sha256(schemaVersion + 规范化词面)。
 */
@Entity('english_vocab_detail_cache')
@Index('UQ_evdc_cache_key', ['cacheKey'], { unique: true })
@Index('IDX_evdc_updated_id', ['updatedAt', 'id'])
export class EnglishVocabDetailCache {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'cache_key', type: 'varchar', length: 64 })
	cacheKey!: string;

	@Column({ name: 'schema_version', type: 'varchar', length: 16 })
	schemaVersion!: string;

	/** 规范化词面，只用于排查，不作为面板标题 */
	@Column({ type: 'varchar', length: 120 })
	lemma!: string;

	@Column({ type: 'json' })
	detail!: VocabDetail;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
