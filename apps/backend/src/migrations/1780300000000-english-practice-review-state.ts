import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishPracticeReviewState1780300000000
	implements MigrationInterface
{
	name = 'EnglishPracticeReviewState1780300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const exists = await queryRunner.query(
			`
			SELECT COUNT(*) AS c FROM information_schema.TABLES
			WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'english_practice_review_state'
			`,
		);
		const count = Number(
			Array.isArray(exists) && exists[0] && typeof exists[0] === 'object'
				? (exists[0] as { c?: string | number }).c
				: 0,
		);
		if (count > 0) return;

		await queryRunner.query(`
			CREATE TABLE \`english_practice_review_state\` (
				\`id\` char(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`content_kind\` varchar(16) NOT NULL,
				\`item_key\` varchar(200) NOT NULL,
				\`next_review_at\` timestamp NOT NULL,
				\`interval_days\` int NOT NULL DEFAULT 0,
				\`repetitions\` int NOT NULL DEFAULT 0,
				\`ease_factor\` decimal(4,2) NOT NULL DEFAULT 2.50,
				\`last_result\` varchar(16) NOT NULL DEFAULT 'wrong',
				\`last_practiced_at\` timestamp NULL,
				PRIMARY KEY (\`id\`),
				UNIQUE KEY \`UQ_eprs_user_kind_key\` (\`user_id\`, \`content_kind\`, \`item_key\`),
				KEY \`IDX_eprs_user_kind_due\` (\`user_id\`, \`content_kind\`, \`next_review_at\`)
			) ENGINE=InnoDB
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP TABLE IF EXISTS \`english_practice_review_state\``,
		);
	}
}
