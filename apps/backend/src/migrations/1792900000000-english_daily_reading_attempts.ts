import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingAttempts1792900000000 implements MigrationInterface {
	name = 'EnglishDailyReadingAttempts1792900000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` ADD \`attempt_count\` int NOT NULL DEFAULT 0`,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` ADD \`last_error\` varchar(500) NULL`,
		);
		await queryRunner.query(
			`CREATE TABLE \`english_daily_reading_attempts\` (
				\`id\` bigint NOT NULL AUTO_INCREMENT,
				\`publish_date\` varchar(10) NOT NULL,
				\`attempt_no\` int NOT NULL,
				\`enqueued_at\` datetime(3) NOT NULL,
				\`started_at\` datetime(3) NOT NULL,
				\`finished_at\` datetime(3) NOT NULL,
				\`elapsed_ms\` int NOT NULL DEFAULT 0,
				\`tokens\` int NOT NULL DEFAULT 0,
				\`outcome\` varchar(16) NOT NULL,
				\`reason\` varchar(500) NULL,
				UNIQUE INDEX \`uq_english_daily_reading_attempts\` (\`publish_date\`, \`attempt_no\`),
				PRIMARY KEY (\`id\`)
			) ENGINE=InnoDB`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE \`english_daily_reading_attempts\``);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` DROP COLUMN \`last_error\``,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` DROP COLUMN \`attempt_count\``,
		);
	}
}
