import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

export type SkillTrySessionKind = 'try' | 'generate';

/**
 * Skill 侧栏 Agent 历史索引（与 agent_sessions 同 id；消息在 skill_try_messages）。
 * kind=try / generate 均按 skill_id 隔离；generate 新建草稿时 skill_id 为 null。
 */
@Entity('skill_try_sessions')
@Index('idx_skill_try_session_user_kind_skill_updated', [
	'userId',
	'kind',
	'skillId',
	'updatedAt',
])
export class SkillTrySession {
	/** 与 agent_sessions.id 相同，便于复用 Agent SSE / 消息表 */
	@PrimaryColumn('varchar', { length: 36 })
	id: string;

	@Column({ type: 'int', name: 'user_id' })
	userId: number;

	/** try = 试跑；generate = 生成 */
	@Column({ type: 'varchar', length: 16, default: 'try' })
	kind: SkillTrySessionKind;

	/** 绑定的 Skill；generate 新建未保存时为 null（草稿桶） */
	@Column({ type: 'varchar', length: 36, name: 'skill_id', nullable: true })
	skillId: string | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
