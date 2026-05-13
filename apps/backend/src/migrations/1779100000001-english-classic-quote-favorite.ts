import { MigrationInterface, QueryRunner } from 'typeorm';

/** 用户经典句收藏表（user_id + content_key 唯一） */
export class EnglishClassicQuoteFavorite1779100000001 implements MigrationInterface {
	name = 'EnglishClassicQuoteFavorite1779100000001';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE TABLE IF NOT EXISTS \`english_classic_quote_favorite\` (
  \`id\` varchar(36) NOT NULL,
  \`user_id\` int NOT NULL,
  \`content_key\` char(64) NOT NULL,
  \`english\` text NOT NULL,
  \`translation_zh\` text NOT NULL,
  \`source\` varchar(2000) NOT NULL DEFAULT '',
  \`note_zh\` text NOT NULL,
  \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`UQ_ecqf_user_content\` (\`user_id\`,\`content_key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP TABLE IF EXISTS \`english_classic_quote_favorite\``,
		);
	}
}
