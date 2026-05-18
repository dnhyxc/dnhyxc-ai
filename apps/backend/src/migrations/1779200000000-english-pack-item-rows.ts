import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 单词/经典句拉取：会话表 + 明细行表；batch 表去掉 items JSON，改为 item_count。
 * 将既有 batch.items JSON 摊平写入明细表（若列仍存在）。
 */
export class EnglishPackItemRows1779200000000 implements MigrationInterface {
	name = 'EnglishPackItemRows1779200000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS \`english_vocabulary_pack_session\` (
				\`stream_id\` varchar(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`topic\` varchar(500) NOT NULL,
				\`target_count\` int NOT NULL,
				\`item_count\` int NOT NULL DEFAULT 0,
				\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
				\`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
				PRIMARY KEY (\`stream_id\`),
				INDEX \`idx_evps_user_updated\` (\`user_id\`, \`updated_at\`)
			) ENGINE=InnoDB
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS \`english_vocabulary_pack_item\` (
				\`id\` varchar(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`stream_id\` varchar(36) NOT NULL,
				\`round\` int NOT NULL,
				\`sort_order\` int NOT NULL,
				\`batch_id\` varchar(36) NULL,
				\`word\` varchar(500) NOT NULL,
				\`ipa\` varchar(2000) NOT NULL DEFAULT '',
				\`pos\` varchar(64) NOT NULL DEFAULT '',
				\`translation_zh\` text NOT NULL,
				\`example\` text NOT NULL,
				PRIMARY KEY (\`id\`),
				INDEX \`idx_evpi_user_stream_sort\` (\`user_id\`, \`stream_id\`, \`sort_order\`),
				INDEX \`idx_evpi_stream_sort\` (\`stream_id\`, \`sort_order\`)
			) ENGINE=InnoDB
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS \`english_classic_quotes_pack_session\` (
				\`stream_id\` varchar(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`topic\` varchar(500) NOT NULL,
				\`target_count\` int NOT NULL,
				\`item_count\` int NOT NULL DEFAULT 0,
				\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
				\`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
				PRIMARY KEY (\`stream_id\`),
				INDEX \`idx_ecqps_user_updated\` (\`user_id\`, \`updated_at\`)
			) ENGINE=InnoDB
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS \`english_classic_quotes_pack_item\` (
				\`id\` varchar(36) NOT NULL,
				\`user_id\` int NOT NULL,
				\`stream_id\` varchar(36) NOT NULL,
				\`round\` int NOT NULL,
				\`sort_order\` int NOT NULL,
				\`batch_id\` varchar(36) NULL,
				\`english\` text NOT NULL,
				\`translation_zh\` text NOT NULL,
				\`source\` varchar(2000) NOT NULL DEFAULT '',
				\`note_zh\` text NOT NULL,
				PRIMARY KEY (\`id\`),
				INDEX \`idx_ecqpi_user_stream_sort\` (\`user_id\`, \`stream_id\`, \`sort_order\`),
				INDEX \`idx_ecqpi_stream_sort\` (\`stream_id\`, \`sort_order\`)
			) ENGINE=InnoDB
		`);

		const vocabHasItems = await this.columnExists(
			queryRunner,
			'english_vocabulary',
			'items',
		);
		if (vocabHasItems) {
			await this.migrateVocabBatches(queryRunner);
			await queryRunner.query(
				`ALTER TABLE \`english_vocabulary\` DROP COLUMN \`items\``,
			);
		}
		const vocabHasItemCount = await this.columnExists(
			queryRunner,
			'english_vocabulary',
			'item_count',
		);
		if (!vocabHasItemCount) {
			await queryRunner.query(
				`ALTER TABLE \`english_vocabulary\` ADD \`item_count\` int NOT NULL DEFAULT 0`,
			);
		}

		const classicHasItems = await this.columnExists(
			queryRunner,
			'english_classic_quotes',
			'items',
		);
		if (classicHasItems) {
			await this.migrateClassicBatches(queryRunner);
			await queryRunner.query(
				`ALTER TABLE \`english_classic_quotes\` DROP COLUMN \`items\``,
			);
		}
		const classicHasItemCount = await this.columnExists(
			queryRunner,
			'english_classic_quotes',
			'item_count',
		);
		if (!classicHasItemCount) {
			await queryRunner.query(
				`ALTER TABLE \`english_classic_quotes\` ADD \`item_count\` int NOT NULL DEFAULT 0`,
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE \`english_vocabulary\` ADD \`items\` json NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE \`english_classic_quotes\` ADD \`items\` json NULL`,
		);
		await queryRunner.query(`DROP TABLE IF EXISTS \`english_vocabulary_pack_item\``);
		await queryRunner.query(
			`DROP TABLE IF EXISTS \`english_vocabulary_pack_session\``,
		);
		await queryRunner.query(
			`DROP TABLE IF EXISTS \`english_classic_quotes_pack_item\``,
		);
		await queryRunner.query(
			`DROP TABLE IF EXISTS \`english_classic_quotes_pack_session\``,
		);
	}

	private async columnExists(
		queryRunner: QueryRunner,
		table: string,
		column: string,
	): Promise<boolean> {
		const rows = await queryRunner.query(
			`SELECT COUNT(*) AS c FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
			[table, column],
		);
		return Number(rows[0]?.c ?? 0) > 0;
	}

	private async migrateVocabBatches(queryRunner: QueryRunner): Promise<void> {
		const batches: Array<{
			id: string;
			user_id: number;
			stream_id: string;
			round: number;
			topic: string;
			target_count: number;
			items: string | unknown[];
			created_at: Date;
		}> = await queryRunner.query(
			`SELECT id, user_id, stream_id, round, topic, target_count, items, created_at
			 FROM english_vocabulary WHERE items IS NOT NULL`,
		);

		const sortByStream = new Map<string, number>();

		for (const b of batches) {
			const items = this.parseJsonArray(b.items);
			if (!items.length) {
				await queryRunner.query(
					`UPDATE english_vocabulary SET item_count = 0 WHERE id = ?`,
					[b.id],
				);
				continue;
			}

			let sortBase = sortByStream.get(b.stream_id) ?? -1;
			let inserted = 0;

			for (const raw of items) {
				if (!raw || typeof raw !== 'object') continue;
				const o = raw as Record<string, unknown>;
				const word = typeof o.word === 'string' ? o.word.trim() : '';
				const ipa = typeof o.ipa === 'string' ? o.ipa.trim() : '';
				if (!word || !ipa) continue;
				sortBase += 1;
				inserted += 1;
				const id = randomUUID();
				const pos =
					typeof o.pos === 'string' ? o.pos.trim().slice(0, 64) : '';
				const translationZh =
					typeof o.translationZh === 'string'
						? o.translationZh
						: typeof o.translation_zh === 'string'
							? o.translation_zh
							: '—';
				const example = typeof o.example === 'string' ? o.example : '—';
				await queryRunner.query(
					`INSERT INTO english_vocabulary_pack_item
					 (id, user_id, stream_id, round, sort_order, batch_id, word, ipa, pos, translation_zh, example)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						id,
						b.user_id,
						b.stream_id,
						b.round,
						sortBase,
						b.id,
						word.slice(0, 500),
						ipa.slice(0, 2000),
						pos,
						String(translationZh).trim().slice(0, 8000),
						String(example).trim().slice(0, 8000),
					],
				);
			}

			sortByStream.set(b.stream_id, sortBase);

			await queryRunner.query(
				`INSERT INTO english_vocabulary_pack_session
				 (stream_id, user_id, topic, target_count, item_count, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)
				 ON DUPLICATE KEY UPDATE
				 item_count = item_count + VALUES(item_count),
				 updated_at = GREATEST(updated_at, VALUES(updated_at))`,
				[
					b.stream_id,
					b.user_id,
					String(b.topic).slice(0, 500),
					b.target_count,
					inserted,
					b.created_at,
					b.created_at,
				],
			);

			await queryRunner.query(
				`UPDATE english_vocabulary SET item_count = ? WHERE id = ?`,
				[inserted, b.id],
			);
		}

		// 按明细表校正 session.item_count
		await queryRunner.query(`
			UPDATE english_vocabulary_pack_session s
			SET item_count = (
				SELECT COUNT(*) FROM english_vocabulary_pack_item i WHERE i.stream_id = s.stream_id
			)
		`);
	}

	private async migrateClassicBatches(queryRunner: QueryRunner): Promise<void> {
		const batches: Array<{
			id: string;
			user_id: number;
			stream_id: string;
			round: number;
			topic: string;
			target_count: number;
			items: string | unknown[];
			created_at: Date;
		}> = await queryRunner.query(
			`SELECT id, user_id, stream_id, round, topic, target_count, items, created_at
			 FROM english_classic_quotes WHERE items IS NOT NULL`,
		);

		const sortByStream = new Map<string, number>();

		for (const b of batches) {
			const items = this.parseJsonArray(b.items);
			if (!items.length) {
				await queryRunner.query(
					`UPDATE english_classic_quotes SET item_count = 0 WHERE id = ?`,
					[b.id],
				);
				continue;
			}

			let sortBase = sortByStream.get(b.stream_id) ?? -1;
			let inserted = 0;

			for (const raw of items) {
				if (!raw || typeof raw !== 'object') continue;
				const o = raw as Record<string, unknown>;
				const english = typeof o.english === 'string' ? o.english.trim() : '';
				const translationZh =
					typeof o.translationZh === 'string'
						? o.translationZh.trim()
						: typeof o.translation_zh === 'string'
							? o.translation_zh.trim()
							: '';
				if (!english || !translationZh) continue;
				sortBase += 1;
				inserted += 1;
				const id = randomUUID();
				const source = typeof o.source === 'string' ? o.source : '—';
				const noteZh = typeof o.noteZh === 'string' ? o.noteZh : '—';
				await queryRunner.query(
					`INSERT INTO english_classic_quotes_pack_item
					 (id, user_id, stream_id, round, sort_order, batch_id, english, translation_zh, source, note_zh)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						id,
						b.user_id,
						b.stream_id,
						b.round,
						sortBase,
						b.id,
						english,
						translationZh.slice(0, 8000),
						String(source).slice(0, 2000),
						String(noteZh).slice(0, 8000),
					],
				);
			}

			sortByStream.set(b.stream_id, sortBase);

			await queryRunner.query(
				`INSERT INTO english_classic_quotes_pack_session
				 (stream_id, user_id, topic, target_count, item_count, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)
				 ON DUPLICATE KEY UPDATE
				 item_count = item_count + VALUES(item_count),
				 updated_at = GREATEST(updated_at, VALUES(updated_at))`,
				[
					b.stream_id,
					b.user_id,
					String(b.topic).slice(0, 500),
					b.target_count,
					inserted,
					b.created_at,
					b.created_at,
				],
			);

			await queryRunner.query(
				`UPDATE english_classic_quotes SET item_count = ? WHERE id = ?`,
				[inserted, b.id],
			);
		}

		await queryRunner.query(`
			UPDATE english_classic_quotes_pack_session s
			SET item_count = (
				SELECT COUNT(*) FROM english_classic_quotes_pack_item i WHERE i.stream_id = s.stream_id
			)
		`);
	}

	private parseJsonArray(raw: string | unknown[]): unknown[] {
		if (Array.isArray(raw)) return raw;
		if (typeof raw === 'string') {
			try {
				const parsed = JSON.parse(raw) as unknown;
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		return [];
	}
}
