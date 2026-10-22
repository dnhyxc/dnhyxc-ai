import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { StoredProfile } from '../daily-reading.rules';

/** 全站定时档，一行。手动档在 english_daily_reading_user_settings。 */
@Entity('english_daily_reading_settings')
export class EnglishDailyReadingSetting {
	@PrimaryColumn({ type: 'int' })
	id!: number;

	/** 旧的全站手动主题。用户保存不再写这里。定时档空着时回退到这列。 */
	@Column({ type: 'json' })
	themes!: string[];

	/** 旧的全站手动档。用户保存不再写这里。定时档空着时回退到这列。 */
	@Column({ type: 'json', nullable: true })
	profile!: StoredProfile | null;

	/** 定时篇主题。仅超级管理员可写。空则生成时回退手动档。 */
	@Column({ type: 'json', nullable: true })
	autoThemes!: string[] | null;

	/** 定时篇档位。仅超级管理员可写。空则生成时回退手动档。 */
	@Column({ type: 'json', nullable: true })
	autoProfile!: StoredProfile | null;

	/** 每天在该小时（上海）入队下一天。仅超级管理员可写。 */
	@Column({ type: 'int', default: 23 })
	autoHour!: number;
}
