import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 用户错题集：练习拼写错误的单词快照；同一用户同一规范化词形仅一行。
 */
@Entity('english_vocabulary_mistake')
@Index('UQ_evm_user_word_key', ['userId', 'wordKey'], { unique: true })
export class EnglishVocabularyMistake {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'word_key', type: 'varchar', length: 200 })
	wordKey!: string;

	@Column({ type: 'varchar', length: 500 })
	word!: string;

	@Column({ type: 'varchar', length: 500, default: '' })
	ipa!: string;

	@Column({ type: 'varchar', length: 32, default: '' })
	pos!: string;

	@Column({ type: 'varchar', length: 500, default: '' })
	segmentation!: string;

	@Column({ name: 'translation_zh', type: 'text' })
	translationZh!: string;

	@Column({ type: 'text' })
	example!: string;

	/** 入库时的错误拼写 */
	@Column({
		name: 'last_user_input',
		type: 'varchar',
		length: 500,
		default: '',
	})
	lastUserInput!: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
