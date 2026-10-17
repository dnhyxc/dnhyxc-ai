import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingUserSettings1792500000000 implements MigrationInterface {
	name = 'EnglishDailyReadingUserSettings1792500000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE \`english_daily_reading_user_settings\` (\`userId\` int NOT NULL, \`themes\` json NOT NULL, \`profile\` json NULL, PRIMARY KEY (\`userId\`)) ENGINE=InnoDB`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP TABLE \`english_daily_reading_user_settings\``,
		);
	}
}
