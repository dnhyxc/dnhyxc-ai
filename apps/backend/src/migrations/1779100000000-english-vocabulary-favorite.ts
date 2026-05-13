import { MigrationInterface, QueryRunner } from 'typeorm';

/** 用户单词收藏表（user_id + word_key 唯一） */
export class EnglishVocabularyFavorite1779100000000 implements MigrationInterface {
	name = 'EnglishVocabularyFavorite1779100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE TABLE IF NOT EXISTS \`english_vocabulary_favorite\` (
  \`id\` varchar(36) NOT NULL,
  \`user_id\` int NOT NULL,
  \`word_key\` varchar(200) NOT NULL,
  \`word\` varchar(500) NOT NULL,
  \`ipa\` varchar(500) NOT NULL DEFAULT '',
  \`translation_zh\` text NOT NULL,
  \`example\` text NOT NULL,
  \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`UQ_evf_user_word_key\` (\`user_id\`,\`word_key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP TABLE IF EXISTS \`english_vocabulary_favorite\``,
		);
	}
}
