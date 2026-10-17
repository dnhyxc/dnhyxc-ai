import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { ReadingProfile } from '../daily-reading.rules';

/** 手动生成档。每个用户一行。没有行时接口回系统默认，不插行。 */
@Entity('english_daily_reading_user_settings')
export class EnglishDailyReadingUserSetting {
	@PrimaryColumn({ type: 'int' })
	userId!: number;

	@Column({ type: 'json' })
	themes!: string[];

	@Column({ type: 'json', nullable: true })
	profile!: ReadingProfile | null;
}
