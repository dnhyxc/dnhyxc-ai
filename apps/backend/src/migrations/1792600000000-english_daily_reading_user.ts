import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingUser1792600000000 implements MigrationInterface {
	name = 'EnglishDailyReadingUser1792600000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` ADD \`user_id\` int NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX \`idx_english_daily_readings_user\` ON \`english_daily_readings\` (\`user_id\`)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX \`idx_english_daily_readings_user\` ON \`english_daily_readings\``,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` DROP COLUMN \`user_id\``,
		);
	}
}
