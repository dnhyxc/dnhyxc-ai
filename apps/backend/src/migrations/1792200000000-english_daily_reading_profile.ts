import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingProfile1792200000000 implements MigrationInterface {
	name = 'EnglishDailyReadingProfile1792200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_reading_settings\` ADD \`profile\` json NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` ADD \`extras\` json NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` DROP COLUMN \`extras\``,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_reading_settings\` DROP COLUMN \`profile\``,
		);
	}
}
