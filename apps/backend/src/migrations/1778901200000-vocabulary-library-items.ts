import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 单词库：词条从 library.items(JSON) 拆到 english_vocabulary_library_item 子表。
 */
export class VocabularyLibraryItems1778901200000 implements MigrationInterface {
	name = 'VocabularyLibraryItems1778901200000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE \`english_vocabulary_library_item\` (
				\`id\` varchar(36) NOT NULL,
				\`library_id\` varchar(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`sort_order\` int NOT NULL,
				\`word\` varchar(500) NOT NULL,
				\`ipa\` varchar(2000) NOT NULL DEFAULT '',
				\`pos\` varchar(64) NOT NULL DEFAULT '',
				\`translation_zh\` text NOT NULL,
				\`example\` text NOT NULL,
				INDEX \`idx_evli_library_sort\` (\`library_id\`, \`sort_order\`),
				INDEX \`idx_evli_user_library\` (\`user_id\`, \`library_id\`),
				PRIMARY KEY (\`id\`),
				CONSTRAINT \`FK_evli_library\` FOREIGN KEY (\`library_id\`) REFERENCES \`english_vocabulary_library\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
			) ENGINE=InnoDB
		`);

		const libTable = await queryRunner.getTable('english_vocabulary_library');
		const itemsCol = libTable?.findColumnByName('items');
		if (itemsCol) {
			await queryRunner.query(`
				ALTER TABLE \`english_vocabulary_library\` DROP COLUMN \`items\`
			`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE \`english_vocabulary_library\`
			ADD COLUMN \`items\` json NOT NULL AFTER \`title\`
		`);
		await queryRunner.query(`
			DROP INDEX \`idx_evli_user_library\` ON \`english_vocabulary_library_item\`
		`);
		await queryRunner.query(`
			DROP INDEX \`idx_evli_library_sort\` ON \`english_vocabulary_library_item\`
		`);
		await queryRunner.query(`DROP TABLE \`english_vocabulary_library_item\``);
	}
}
