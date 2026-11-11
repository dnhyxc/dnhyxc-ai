import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnglishVocabDetailCacheListIndex1794300000000
	implements MigrationInterface
{
	name = 'EnglishVocabDetailCacheListIndex1794300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE INDEX \`IDX_evdc_updated_id\` ON \`english_vocab_detail_cache\` (\`updated_at\`, \`id\`)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX \`IDX_evdc_updated_id\` ON \`english_vocab_detail_cache\``,
		);
	}
}
