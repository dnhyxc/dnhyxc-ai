import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** 公开分享权威行：元数据 + 创建时快照 + 打开次数（Redis 仅旁路） */
@Entity({ name: 'shares' })
@Index('IDX_shares_expires_at', ['expiresAt'])
@Index('IDX_shares_created_by', ['createdBy'])
@Index('IDX_shares_chat_session', ['chatSessionId'])
export class Share {
	@PrimaryColumn({ name: 'share_id', type: 'varchar', length: 64 })
	shareId: string;

	@Column({ name: 'chat_session_id', type: 'varchar', length: 64 })
	chatSessionId: string;

	@Column({
		name: 'share_type',
		type: 'varchar',
		length: 32,
		default: 'session',
	})
	shareType: 'session' | 'knowledge';

	@Column({ name: 'session_type', type: 'varchar', length: 32, nullable: true })
	sessionType: 'chat' | 'assistant' | 'agent' | 'ebook' | null;

	@Column({ name: 'message_ids', type: 'json', nullable: true })
	messageIds: string[] | null;

	@Column({ type: 'varchar', length: 500, nullable: true })
	title: string | null;

	@Column({ name: 'content_snapshot', type: 'json', nullable: true })
	contentSnapshot: Record<string, unknown> | null;

	@Column({ name: 'snapshot_truncated', type: 'boolean', default: false })
	snapshotTruncated: boolean;

	@Column({ name: 'created_by', type: 'int', nullable: true })
	createdBy: number | null;

	@Column({ name: 'created_at_ms', type: 'bigint' })
	createdAt: string;

	@Column({ name: 'expires_at_ms', type: 'bigint' })
	expiresAt: string;

	@Column({ name: 'revoked_at_ms', type: 'bigint', nullable: true })
	revokedAt: string | null;

	@Column({ name: 'view_count', type: 'int', default: 0 })
	viewCount: number;
}
