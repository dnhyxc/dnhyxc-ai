import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import type { SerperOrganicItem } from '../web-search/web-search.types';
import { SkillTrySession } from './skill-try-session.entity';

export enum SkillTryMessageRole {
	USER = 'user',
	ASSISTANT = 'assistant',
}

/** Skill 试跑/生成消息（业务表；session_id = skill_try_sessions.id） */
@Entity('skill_try_messages')
@Index('idx_skill_try_msg_session_created', ['session', 'createdAt'])
@Index('idx_skill_try_msg_session_turn', ['session', 'turnId'])
export class SkillTryMessage {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(() => SkillTrySession, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'session_id' })
	session: SkillTrySession;

	@Column({
		type: 'enum',
		enum: SkillTryMessageRole,
	})
	role: SkillTryMessageRole;

	@Column({ name: 'turn_id', type: 'varchar', length: 36, nullable: true })
	turnId: string | null;

	@Column({ type: 'longtext' })
	content: string;

	@Column({ name: 'search_organic', type: 'json', nullable: true })
	searchOrganic: SerperOrganicItem[] | null;

	/** 本轮强制应用的 Skill 快照（id + title），供刷新后 UI 展示 */
	@Column({ name: 'applied_skills', type: 'json', nullable: true })
	appliedSkills: Array<{ id: string; title: string }> | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;
}
