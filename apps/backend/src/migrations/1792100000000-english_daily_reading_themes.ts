import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingThemes1792100000000 implements MigrationInterface {
	name = 'EnglishDailyReadingThemes1792100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE \`english_daily_reading_settings\` (\`id\` int NOT NULL, \`themes\` json NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE \`english_daily_reading_settings\``);
	}
}
