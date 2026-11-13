import { MigrationInterface, QueryRunner } from 'typeorm';

function storedLemma(word: string): string {
	const lemma = String(word ?? '')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase();
	return lemma.length > 120 ? '' : lemma;
}

export class EnglishVocabLibraryItemLemmaBackfill1794414300000
	implements MigrationInterface
{
	public async up(queryRunner: QueryRunner): Promise<void> {
		let last = '';
		for (;;) {
			const rows: { id: string; word: string }[] = await queryRunner.query(
				'SELECT id, word FROM english_vocabulary_library_item WHERE id > ? AND lemma = ? ORDER BY id ASC LIMIT 200',
				[last, ''],
			);
			if (!rows.length) return;
			const values: string[] = [];
			const params: string[] = [];
			for (const row of rows) {
				values.push('WHEN ? THEN ?');
				params.push(row.id, storedLemma(row.word));
			}
			const ids = rows.map((row) => row.id);
			await queryRunner.query(
				`UPDATE english_vocabulary_library_item SET lemma = CASE id ${values.join(' ')} ELSE lemma END WHERE id IN (${ids.map(() => '?').join(',')})`,
				[...params, ...ids],
			);
			last = ids[ids.length - 1];
		}
	}

	public async down(): Promise<void> {}
}
