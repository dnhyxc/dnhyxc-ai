import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyReadingSlot1792300000000 implements MigrationInterface {
	name = 'EnglishDailyReadingSlot1792300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` ADD \`slot\` varchar(36) NOT NULL DEFAULT 'day'`,
		);
		await queryRunner.query(
			`DROP INDEX \`uq_english_daily_readings_publish_date\` ON \`english_daily_readings\``,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`uq_english_daily_readings_publish_slot\` ON \`english_daily_readings\` (\`publish_date\`, \`slot\`)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX \`uq_english_daily_readings_publish_slot\` ON \`english_daily_readings\``,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`uq_english_daily_readings_publish_date\` ON \`english_daily_readings\` (\`publish_date\`)`,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_daily_readings\` DROP COLUMN \`slot\``,
		);
	}
}
