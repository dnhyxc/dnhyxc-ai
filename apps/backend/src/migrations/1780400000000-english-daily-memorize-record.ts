import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishDailyMemorizeRecord1780400000000
	implements MigrationInterface
{
	name = 'EnglishDailyMemorizeRecord1780400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const exists = await queryRunner.query(
			`
			SELECT COUNT(*) AS c FROM information_schema.TABLES
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'english_daily_memorize_record'
			`,
		);
		const count = Number(
			Array.isArray(exists) && exists[0] && typeof exists[0] === 'object'
				? (exists[0] as { c?: string | number }).c
				: 0,
		);
		if (count > 0) return;

		await queryRunner.query(`
			CREATE TABLE \`english_daily_memorize_record\` (
				\`id\` char(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`word_key\` varchar(200) NOT NULL,
				\`word\` varchar(500) NOT NULL,
				\`ipa\` varchar(500) NOT NULL DEFAULT '',
				\`pos\` varchar(32) NOT NULL DEFAULT '',
				\`segmentation\` varchar(500) NOT NULL DEFAULT '',
				\`translation_zh\` text NOT NULL,
				\`example\` text NOT NULL,
				\`last_correct\` tinyint(1) NOT NULL DEFAULT 0,
				\`practiced_at\` timestamp NOT NULL,
				\`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
				\`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
				PRIMARY KEY (\`id\`),
				UNIQUE KEY \`UQ_edmr_user_word_key\` (\`user_id\`, \`word_key\`),
				KEY \`IDX_edmr_user_practiced\` (\`user_id\`, \`practiced_at\`)
			) ENGINE=InnoDB
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP TABLE IF EXISTS \`english_daily_memorize_record\``,
		);
	}
}
