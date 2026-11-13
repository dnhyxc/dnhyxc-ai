import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import type { VocabDetail } from '../vocab-detail.parse';

/** 某个账号最新一次重新生成的详解。不进全站缓存，也不改手动导入。 */
@Entity('english_vocab_detail_regen')
@Index('UQ_evdr_user_lemma', ['userId', 'lemma'], { unique: true })
export class EnglishVocabDetailRegen {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'varchar', length: 120 })
	lemma!: string;

	@Column({ name: 'schema_version', type: 'varchar', length: 16 })
	schemaVersion!: string;

	@Column({ type: 'json' })
	detail!: VocabDetail;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
