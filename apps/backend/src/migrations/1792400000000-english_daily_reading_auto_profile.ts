import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingAutoProfile1792400000000 implements MigrationInterface {
	name = 'EnglishDailyReadingAutoProfile1792400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_reading_settings\` ADD \`autoThemes\` json NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_reading_settings\` ADD \`autoProfile\` json NULL`,
		);
		await queryRunner.query(
			`UPDATE \`english_daily_reading_settings\` SET \`autoThemes\` = \`themes\`, \`autoProfile\` = IFNULL(\`profile\`, CAST('{"level":"B1","length":"medium","focus":"reading","questions":0,"useWeb":true}' AS JSON))`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_reading_settings\` DROP COLUMN \`autoProfile\``,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_reading_settings\` DROP COLUMN \`autoThemes\``,
		);
	}
}
