import { MigrationInterface, QueryRunner } from 'typeorm';

/** 单词库/包/收藏表增加音节划分字段 segmentation */
export class VocabularySegmentation1780100000000 implements MigrationInterface {
	name = 'VocabularySegmentation1780100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		for (const table of [
			'english_vocabulary_library_item',
			'english_vocabulary_pack_item',
			'english_vocabulary_favorite',
		]) {
			const exists = await queryRunner.query(
				`
				SELECT COUNT(*) AS c FROM information_schema.COLUMNS
				WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'segmentation'
				`,
				[table],
			);
			const count = Number(
				Array.isArray(exists) && exists[0] && typeof exists[0] === 'object'
					? (exists[0] as { c?: string | number }).c
					: 0,
			);
			if (count > 0) continue;
			await queryRunner.query(
				`ALTER TABLE \`${table}\` ADD \`segmentation\` varchar(500) NOT NULL DEFAULT ''`,
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		for (const table of [
			'english_vocabulary_library_item',
			'english_vocabulary_pack_item',
			'english_vocabulary_favorite',
		]) {
			const exists = await queryRunner.query(
				`
				SELECT COUNT(*) AS c FROM information_schema.COLUMNS
				WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'segmentation'
				`,
				[table],
			);
			const count = Number(
				Array.isArray(exists) && exists[0] && typeof exists[0] === 'object'
					? (exists[0] as { c?: string | number }).c
					: 0,
			);
			if (count === 0) continue;
			await queryRunner.query(
				`ALTER TABLE \`${table}\` DROP COLUMN \`segmentation\``,
			);
		}
	}
}
