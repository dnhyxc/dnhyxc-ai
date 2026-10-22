import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingAutoHour1792800000000 implements MigrationInterface {
	name = 'EnglishDailyReadingAutoHour1792800000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_reading_settings\` ADD \`autoHour\` int NOT NULL DEFAULT 23`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_reading_settings\` DROP COLUMN \`autoHour\``,
		);
	}
}
