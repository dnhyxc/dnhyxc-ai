import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

/** 句内词标注一行（与 LLM / API 字段对齐） */
export type SentenceWordAnnotationRow = {
	word: string;
	posZh: string;
	ipa: string;
	meaningZh: string;
};

/**
 * 句内词标注全局缓存（跨用户共享）。
 * cache_key = sha256(version + 规范化英文句 + words 序列)；prompt/schema 变更时升 version。
 */
@Entity('english_sentence_word_annotation_cache')
@Index('UQ_eswac_cache_key', ['cacheKey'], { unique: true })
export class EnglishSentenceWordAnnotationCache {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** sha256 hex；含 schema version，改 prompt 输出约定时换 version 即失效 */
	@Column({ name: 'cache_key', type: 'varchar', length: 64 })
	cacheKey!: string;

	@Column({ name: 'schema_version', type: 'varchar', length: 16 })
	schemaVersion!: string;

	/** 规范化后的英文原句（排查用） */
	@Column({ name: 'english', type: 'text' })
	english!: string;

	/** 输入分词序列（与 annotations 一一对应） */
	@Column({ name: 'words', type: 'json' })
	words!: string[];

	@Column({ name: 'annotations', type: 'json' })
	annotations!: SentenceWordAnnotationRow[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
