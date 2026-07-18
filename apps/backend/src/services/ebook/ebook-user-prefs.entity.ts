import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 用户级电子书听书偏好（全局倍速等） */
@Entity('ebook_user_prefs')
export class EbookUserPrefs {
	@PrimaryColumn({ type: 'int', name: 'user_id' })
	userId: number;

	/** 全局听书倍速；未设置本书覆盖时使用 */
	@Column({ type: 'float', name: 'listen_rate', default: 1 })
	listenRate: number;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
