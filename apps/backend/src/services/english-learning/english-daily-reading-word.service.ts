import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { EnglishDailyReading } from './entity/english-daily-reading.entity';
import {
	EnglishDailyReadingWord,
	type ReadingWordSource,
	type ReadingWordSurface,
} from './entity/english-daily-reading-word.entity';
import { readingWordKey } from './reading-word-key';

const PAGE = 100;
const TEXT_MAX = 500;
const SURFACES = new Set<ReadingWordSurface>([
	'selection',
	'gloss',
	'glossary',
]);

export type CollectReadingWordInput = {
	word?: unknown;
	readingId?: unknown;
	zh?: unknown;
	sentence?: unknown;
	surface?: unknown;
};

@Injectable()
export class EnglishDailyReadingWordService {
	constructor(
		@InjectRepository(EnglishDailyReadingWord)
		private readonly words: Repository<EnglishDailyReadingWord>,
		@InjectRepository(EnglishDailyReading)
		private readonly readings: Repository<EnglishDailyReading>,
	) {}

	async upsert(userId: number, input: CollectReadingWordInput) {
		const key = this.requireKey(input.word);
		// 标题以这篇阅读行为准。不存在，或手动篇属于别人，都按找不到处理
		const reading = await this.visibleReading(userId, input.readingId);
		const source = this.sourceOf(reading, input);
		// 两次机会：第一次插入若撞上唯一键，再读已有行合并，避免并发收成两行
		for (let attempt = 0; attempt < 2; attempt++) {
			let row = await this.words.findOne({ where: { userId, wordKey: key } });
			if (!row) {
				row = this.words.create({
					userId,
					wordKey: key,
					word: String(input.word).trim().slice(0, 200),
					zh: this.clip(input.zh),
					zhEdited: false,
					sources: [source],
				});
			} else {
				const rest = this.sourcesOf(row).filter(
					(item) => item.readingId !== reading.id,
				);
				// 同一篇再收一次只替换来源，不追加第二份
				row.sources = [...rest, source];
				const zh = this.clip(input.zh);
				// 手改过的释义保持不动；只在原来为空时填上新释义
				if (!row.zhEdited && !row.zh && zh) row.zh = zh;
			}
			try {
				const saved = await this.words.save(row);
				return { id: saved.id, wordKey: key, collected: true, zh: saved.zh };
			} catch (error) {
				if (attempt === 0 && this.isDup(error)) continue;
				throw error;
			}
		}
		throw new BadRequestException('收集失败');
	}

	async removeSource(userId: number, input: CollectReadingWordInput) {
		const key = this.requireKey(input.word);
		const readingId = this.requireId(input.readingId);
		const row = await this.words.findOne({ where: { userId, wordKey: key } });
		if (!row) return { collected: false };
		const next = this.sourcesOf(row).filter(
			(item) => item.readingId !== readingId,
		);
		if (!next.length) {
			await this.words.remove(row);
			return { collected: false };
		}
		row.sources = next;
		await this.words.save(row);
		return { collected: false };
	}

	async keys(userId: number, readingId: string) {
		const id = readingId.trim();
		if (!id) throw new BadRequestException('缺少篇目');
		const rows = await this.words
			.createQueryBuilder('w')
			.select(['w.id', 'w.wordKey'])
			.where('w.userId = :userId', { userId })
			.andWhere(this.readingMatch(), { readingId: id })
			.getMany();
		return { keys: rows.map((row) => row.wordKey) };
	}

	/**
	 * ponytail: 一次取出该用户全部行再按篇聚合。个人词条过万后 JSON_SEARCH 和这次全量读取都要拆成来源表。
	 */
	async sources(userId: number) {
		const rows = await this.words.find({
			where: { userId },
			select: { id: true, sources: true },
		});
		const grouped = new Map<
			string,
			{
				readingId: string;
				titleEn: string;
				titleZh: string;
				count: number;
				collectedAt: string;
			}
		>();
		for (const row of rows) {
			for (const source of this.sourcesOf(row)) {
				const current = grouped.get(source.readingId);
				if (!current) {
					grouped.set(source.readingId, {
						readingId: source.readingId,
						titleEn: source.titleEn,
						titleZh: source.titleZh,
						count: 1,
						collectedAt: source.collectedAt,
					});
					continue;
				}
				current.count += 1;
				if (source.collectedAt > current.collectedAt) {
					current.collectedAt = source.collectedAt;
					current.titleEn = source.titleEn;
					current.titleZh = source.titleZh;
				}
			}
		}
		return [...grouped.values()].sort((a, b) =>
			b.collectedAt.localeCompare(a.collectedAt),
		);
	}

	async list(
		userId: number,
		query: { readingId?: string; q?: string; cursor?: string },
	) {
		const readingId = query.readingId?.trim() ?? '';
		const q = query.q?.trim() ?? '';
		const qb = this.words
			.createQueryBuilder('w')
			.where('w.userId = :userId', { userId });
		if (readingId) qb.andWhere(this.readingMatch(), { readingId });
		if (q) {
			qb.andWhere('(w.word LIKE :like OR w.zh LIKE :like)', {
				like: `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`,
			});
		}
		const total = await qb.clone().getCount();
		const cursor = this.cursorOf(query.cursor);
		if (cursor) {
			// 倒序往下翻：时间更早，或同一时间里 id 更小，避免收集新词后 offset 漏行
			qb.andWhere(
				'(w.updatedAt < :cursorAt OR (w.updatedAt = :cursorAt AND w.id < :cursorId))',
				cursor,
			);
		}
		const rows = await qb
			.orderBy('w.updatedAt', 'DESC')
			.addOrderBy('w.id', 'DESC')
			// 多取 1 条只为判断还有没有下一页，返回给页面的仍是 100 条
			.take(PAGE + 1)
			.getMany();
		const hasMore = rows.length > PAGE;
		const items = rows.slice(0, PAGE).map((row) => this.toItem(row));
		const last = items.at(-1);
		return {
			items,
			total,
			nextCursor: hasMore && last ? `${last.updatedAt}|${last.id}` : null,
		};
	}

	async editZh(userId: number, id: string, zh: unknown) {
		if (typeof zh !== 'string') throw new BadRequestException('释义不正确');
		const row = await this.words.findOne({ where: { id, userId } });
		if (!row) throw new NotFoundException('生词不存在');
		row.zh = zh.trim().slice(0, TEXT_MAX);
		row.zhEdited = true;
		const saved = await this.words.save(row);
		return this.toItem(saved);
	}

	async remove(userId: number, id: string) {
		const row = await this.words.findOne({ where: { id, userId } });
		if (!row) throw new NotFoundException('生词不存在');
		await this.words.remove(row);
		return { removed: true };
	}

	private requireKey(word: unknown): string {
		const key = typeof word === 'string' ? readingWordKey(word) : null;
		if (!key) throw new BadRequestException('不是可收集的英文单词');
		return key;
	}

	private requireId(value: unknown): string {
		if (typeof value !== 'string' || !value.trim()) {
			throw new BadRequestException('缺少篇目');
		}
		return value.trim();
	}

	private async visibleReading(userId: number, readingId: unknown) {
		const id = this.requireId(readingId);
		const reading = await this.readings.findOne({ where: { id } });
		if (!reading || (reading.userId != null && reading.userId !== userId)) {
			// 404 不区分「没有这篇」和「这篇是别人的」
			throw new NotFoundException('阅读不存在');
		}
		return reading;
	}

	private sourceOf(
		reading: EnglishDailyReading,
		input: CollectReadingWordInput,
	): ReadingWordSource {
		if (
			typeof input.surface !== 'string' ||
			!SURFACES.has(input.surface as ReadingWordSurface)
		) {
			throw new BadRequestException('收集入口不正确');
		}
		return {
			readingId: reading.id,
			titleEn: reading.titleEn,
			titleZh: reading.titleZh,
			sentence:
				typeof input.sentence === 'string'
					? input.sentence.trim().slice(0, TEXT_MAX)
					: '',
			surface: input.surface as ReadingWordSurface,
			collectedAt: new Date().toISOString(),
		};
	}

	private clip(value: unknown): string {
		return typeof value === 'string' ? value.trim().slice(0, TEXT_MAX) : '';
	}

	private sourcesOf(row: EnglishDailyReadingWord): ReadingWordSource[] {
		return Array.isArray(row.sources) ? row.sources : [];
	}

	private readingMatch(): string {
		return `JSON_SEARCH(w.sources, 'one', :readingId, NULL, '$[*].readingId') IS NOT NULL`;
	}

	private cursorOf(cursor?: string) {
		if (!cursor?.trim()) return null;
		const splitAt = cursor.lastIndexOf('|');
		if (splitAt <= 0) throw new BadRequestException('游标不正确');
		const at = new Date(cursor.slice(0, splitAt));
		const id = cursor.slice(splitAt + 1);
		if (Number.isNaN(at.getTime()) || !id) {
			throw new BadRequestException('游标不正确');
		}
		return { cursorAt: at, cursorId: id };
	}

	private toItem(row: EnglishDailyReadingWord) {
		return {
			id: row.id,
			word: row.word,
			wordKey: row.wordKey,
			zh: row.zh,
			zhEdited: row.zhEdited,
			sources: this.sourcesOf(row),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	private isDup(error: unknown): boolean {
		if (!(error instanceof QueryFailedError)) return false;
		const driver = error.driverError as { errno?: number; code?: string };
		return driver?.errno === 1062 || driver?.code === 'ER_DUP_ENTRY';
	}
}
