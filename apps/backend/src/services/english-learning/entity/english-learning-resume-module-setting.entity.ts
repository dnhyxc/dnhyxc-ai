import {
	Column,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';
import type { EnglishLearningResumeModuleKey } from '../english-learning-resume-module.constants';

/** 用户按模块关闭列表续读记录（默认开启，仅持久化关闭状态） */
@Entity('english_learning_resume_module_setting')
@Index('UQ_elrms_user_module', ['userId', 'moduleKey'], { unique: true })
export class EnglishLearningResumeModuleSetting {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'module_key', type: 'varchar', length: 32 })
	moduleKey!: EnglishLearningResumeModuleKey;

	@Column({ name: 'enabled', type: 'boolean', default: false })
	enabled!: boolean;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
