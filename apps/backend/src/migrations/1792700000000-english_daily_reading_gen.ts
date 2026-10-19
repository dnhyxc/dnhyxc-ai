import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingGen1792700000000 implements MigrationInterface {
	name = 'EnglishDailyReadingGen1792700000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE \`english_daily_reading_gens\` (
				\`id\` varchar(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`text\` mediumtext NOT NULL,
				\`tokens\` int NOT NULL DEFAULT 0,
				\`elapsed_ms\` int NOT NULL DEFAULT 0,
				\`started_at\` datetime(3) NOT NULL,
				\`status\` varchar(16) NOT NULL,
				PRIMARY KEY (\`id\`)
			) ENGINE=InnoDB`,
		);
		await queryRunner.query(
			`CREATE INDEX \`idx_english_daily_reading_gens_user\` ON \`english_daily_reading_gens\` (\`user_id\`, \`started_at\`)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX \`idx_english_daily_reading_gens_user\` ON \`english_daily_reading_gens\``,
		);
		await queryRunner.query(`DROP TABLE \`english_daily_reading_gens\``);
	}
}
