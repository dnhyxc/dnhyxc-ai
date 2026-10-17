import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReading1792000000000 implements MigrationInterface {
	name = 'EnglishDailyReading1792000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE \`english_daily_readings\` (\`id\` varchar(36) NOT NULL, \`publish_date\` varchar(10) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'pending', \`started_at\` datetime(6) NOT NULL, \`title_en\` varchar(80) NOT NULL DEFAULT '', \`title_zh\` varchar(80) NOT NULL DEFAULT '', \`body_en\` text NOT NULL, \`body_zh\` text NOT NULL, \`source_kind\` varchar(8) NOT NULL DEFAULT 'llm', \`source_url\` varchar(500) NULL, \`source_title\` varchar(200) NULL, \`theme\` varchar(32) NOT NULL DEFAULT '', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`uq_english_daily_readings_publish_date\` (\`publish_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX \`uq_english_daily_readings_publish_date\` ON \`english_daily_readings\``,
		);
		await queryRunner.query(`DROP TABLE \`english_daily_readings\``);
	}
}
