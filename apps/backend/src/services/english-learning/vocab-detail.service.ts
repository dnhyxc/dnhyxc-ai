import { createHash, randomUUID } from 'node:crypto';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
	BadGatewayException,
	BadRequestException,
	Inject,
	Injectable,
	Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { createLlm } from 'src/utils/create-llm';
import { Not, Repository } from 'typeorm';
import { LlmConfigService } from '../llm-config/llm-config.service';
import { EnglishVocabDetailCache } from './entity/english-vocab-detail-cache.entity';
import { EnglishVocabularyFavorite } from './entity/english-vocabulary-favorite.entity';
import { EnglishVocabularyLibraryItem } from './entity/english-vocabulary-library-item.entity';
import {
	normalizeVocabLemma,
	parseVocabDetail,
	VOCAB_DETAIL_CACHE_VERSION,
	type VocabDetail,
} from './vocab-detail.parse';

const VOCAB_DETAIL_TASK = `你是英语单词详解助手。只输出一个 JSON 对象，不要 Markdown。
字段：
- morphology.parts：1 到 8 段。每段 form、kind（只能是 prefix、root、suffix、base）、meaningZh。拆不开时只给一段 kind 为 base 的整词，不要编造前后缀。
- morphology.storyZh：一两句中文构词说明，可以是空字符串。
- memory.hookZh：一句中文记忆，必须有。
- senses：1 到 6 条。每条 pos、glossZh、nuanceZh（没有差别就用空字符串）。释义要写清词性和场合，不要只给一个词。
- examples：1 到 4 条。每条 en 和 zh 都要有。
- family：派生词，可空数组。每条 word、pos、glossZh。最多 6 条。
- collocations：常见搭配，可空数组。每条 phrase、glossZh。最多 6 条。
- synonyms：近义，可空数组。每条 word、pos、glossZh。最多 6 条。
- tags：考试或难度短标签，可空数组，最多 4 个。不确定就给空数组。`;

/** 同进程后来的请求直接等这一次，不必轮询。 */
const vocabDetailInflight = new Map<string, Promise<VocabDetail>>();
/** 调用中不解锁，结束才在 finally 里删。过期只留给进程崩溃；须长于 OpenAI 客户端默认 10 分钟。 */
const VOCAB_DETAIL_LOCK_MS = 11 * 60 * 1000;
const VOCAB_DETAIL_LOCK_POLL_MS = 400;
const UNLOCK_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
const CURSOR_SEP = '|';
const LIST_PAGE_SIZE = 50;

export type VocabDetailListItem = {
	lemma: string;
	glossZh: string;
	updatedAt: string;
};

export type VocabDetailListPage = {
	items: VocabDetailListItem[];
	nextCursor: string | null;
	total: number;
};

function parseListCursor(cursor: string): { updatedAt: Date; id: string } {
	const sep = cursor.indexOf(CURSOR_SEP);
	if (sep <= 0) throw new BadRequestException('cursor');
	const updatedAt = new Date(cursor.slice(0, sep));
	const id = cursor.slice(sep + 1);
	if (Number.isNaN(updatedAt.getTime()) || !id) {
		throw new BadRequestException('cursor');
	}
	return { updatedAt, id };
}

type LockHold = 'redis' | 'local' | 'busy';

type RedisLockClient = {
	set: (
		key: string,
		value: string,
		options: { NX: true; PX: number },
	) => Promise<string | null>;
	get: (key: string) => Promise<string | null>;
	eval: (
		script: string,
		options: { keys: string[]; arguments: string[] },
	) => Promise<unknown>;
};

@Injectable()
export class VocabDetailService {
	private readonly logger = new Logger(VocabDetailService.name);
	private stalePurged = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly llmConfigService: LlmConfigService,
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
		@InjectRepository(EnglishVocabDetailCache)
		private readonly repo: Repository<EnglishVocabDetailCache>,
		@InjectRepository(EnglishVocabularyLibraryItem)
		private readonly libraryItems: Repository<EnglishVocabularyLibraryItem>,
		@InjectRepository(EnglishVocabularyFavorite)
		private readonly favorites: Repository<EnglishVocabularyFavorite>,
	) {}

	async getOrCreateVocabDetail(
		word: string,
		userId: number,
	): Promise<VocabDetail> {
		const lemma = normalizeVocabLemma(word);
		if (!lemma) throw new BadRequestException('单词为空');
		if (word.trim().length > 120) throw new BadRequestException('单词过长');
		const cacheKey = createHash('sha256')
			.update(`${VOCAB_DETAIL_CACHE_VERSION}\0${lemma}`, 'utf8')
			.digest('hex');
		const pending = vocabDetailInflight.get(cacheKey);
		if (pending) return pending;
		const job = this.leadOrFollow(lemma, userId, cacheKey).finally(() => {
			vocabDetailInflight.delete(cacheKey);
		});
		vocabDetailInflight.set(cacheKey, job);
		return job;
	}

	/** 列表打开时快照没有音标和词性，从当前用户的词库或收藏补上。 */
	async lookupHead(
		userId: number,
		word: string,
	): Promise<{ ipa: string; pos: string }> {
		const lemma = normalizeVocabLemma(word);
		if (!lemma) return { ipa: '', pos: '' };
		const [library, favorite] = await Promise.all([
			this.libraryItems
				.createQueryBuilder('item')
				.select('item.ipa', 'ipa')
				.addSelect('item.pos', 'pos')
				.where('item.userId = :userId', { userId })
				.andWhere('LOWER(TRIM(item.word)) = :lemma', { lemma })
				.limit(1)
				.getRawOne<{ ipa: string | null; pos: string | null }>(),
			this.favorites.findOne({
				where: { userId, wordKey: word.trim().toLowerCase() },
				select: { id: true, ipa: true, pos: true },
			}),
		]);
		return {
			ipa: library?.ipa?.trim() || favorite?.ipa?.trim() || '',
			pos: library?.pos?.trim() || favorite?.pos?.trim() || '',
		};
	}

	/** Redis NX：别的进程正在生成就等它写入缓存，不另开一次模型。关抽屉不解锁。 */
	private async leadOrFollow(
		lemma: string,
		userId: number,
		cacheKey: string,
	): Promise<VocabDetail> {
		const lockKey = `vocab-detail:lock:${cacheKey}`;
		for (let attempt = 0; attempt < 2; attempt++) {
			const token = randomUUID();
			const hold = await this.tryLock(lockKey, token);
			if (hold === 'busy') {
				const detail = await this.waitForRow(cacheKey, lockKey);
				if (detail) return detail;
				continue;
			}
			try {
				return await this.resolveVocabDetail(lemma, userId, cacheKey);
			} finally {
				if (hold === 'redis') await this.unlock(lockKey, token);
			}
		}
		throw new BadGatewayException('详解生成失败，请重试');
	}

	private async tryLock(key: string, token: string): Promise<LockHold> {
		try {
			const client = await this.lockClient();
			if (!client) return 'local';
			const res = await client.set(key, token, {
				NX: true,
				PX: VOCAB_DETAIL_LOCK_MS,
			});
			return res === 'OK' ? 'redis' : 'busy';
		} catch (e) {
			this.logger.warn(
				`vocab detail lock skipped: ${
					e instanceof Error ? e.message.slice(0, 200) : String(e)
				}`,
			);
			return 'local';
		}
	}

	private async unlock(key: string, token: string): Promise<void> {
		try {
			const client = await this.lockClient();
			if (!client) return;
			await client.eval(UNLOCK_SCRIPT, { keys: [key], arguments: [token] });
		} catch (e) {
			this.logger.warn(
				`vocab detail unlock failed: ${
					e instanceof Error ? e.message.slice(0, 200) : String(e)
				}`,
			);
		}
	}

	private async lockHeld(key: string): Promise<boolean> {
		try {
			const client = await this.lockClient();
			if (!client) return false;
			return (await client.get(key)) != null;
		} catch {
			return false;
		}
	}

	private async waitForRow(
		cacheKey: string,
		lockKey: string,
	): Promise<VocabDetail | null> {
		const deadline = Date.now() + VOCAB_DETAIL_LOCK_MS;
		while (Date.now() < deadline) {
			const hit = await this.repo.findOne({ where: { cacheKey } });
			if (hit) return hit.detail;
			if (!(await this.lockHeld(lockKey))) return null;
			await new Promise((resolve) =>
				setTimeout(resolve, VOCAB_DETAIL_LOCK_POLL_MS),
			);
		}
		const hit = await this.repo.findOne({ where: { cacheKey } });
		return hit?.detail ?? null;
	}

	private async lockClient(): Promise<RedisLockClient | null> {
		const first = this.cache.stores?.[0] as
			| {
					getClient?: () => Promise<RedisLockClient>;
					store?: { getClient?: () => Promise<RedisLockClient> };
			  }
			| undefined;
		const store = first?.store?.getClient ? first.store : first;
		if (!store?.getClient) return null;
		return store.getClient();
	}

	private async resolveVocabDetail(
		lemma: string,
		userId: number,
		cacheKey: string,
	): Promise<VocabDetail> {
		await this.purgeStale();
		const hit = await this.repo.findOne({ where: { cacheKey } });
		if (hit) return hit.detail;
		return this.generateAndStore(lemma, userId, cacheKey);
	}

	private async purgeStale(): Promise<void> {
		if (this.stalePurged) return;
		this.stalePurged = true;
		try {
			await this.repo.delete({
				schemaVersion: Not(VOCAB_DETAIL_CACHE_VERSION),
			});
		} catch (e) {
			this.stalePurged = false;
			this.logger.warn(
				`purge stale vocab detail cache failed: ${
					e instanceof Error ? e.message.slice(0, 200) : String(e)
				}`,
			);
		}
	}

	async listCached(cursor?: string): Promise<VocabDetailListPage> {
		const parsed = cursor ? parseListCursor(cursor) : null;
		const qb = this.repo.createQueryBuilder('c');
		qb.where('c.schemaVersion = :v', { v: VOCAB_DETAIL_CACHE_VERSION });
		if (parsed) {
			qb.andWhere('(c.updatedAt < :t OR (c.updatedAt = :t AND c.id < :id))', {
				t: parsed.updatedAt,
				id: parsed.id,
			});
		}
		qb.orderBy('c.updatedAt', 'DESC');
		qb.addOrderBy('c.id', 'DESC');
		qb.take(LIST_PAGE_SIZE + 1);
		const totalPromise = this.repo.count({
			where: { schemaVersion: VOCAB_DETAIL_CACHE_VERSION },
		});
		const rows = await qb.getMany();
		const total = await totalPromise;
		const hasMore = rows.length > LIST_PAGE_SIZE;
		const page = hasMore ? rows.slice(0, LIST_PAGE_SIZE) : rows;
		const last = page.at(-1);
		const nextCursor =
			hasMore && last
				? `${new Date(last.updatedAt).toISOString()}${CURSOR_SEP}${last.id}`
				: null;
		return {
			items: page.map((row) => ({
				lemma: row.lemma,
				glossZh: row.detail.senses[0]?.glossZh ?? '',
				updatedAt: new Date(row.updatedAt).toISOString(),
			})),
			nextCursor,
			total,
		};
	}

	private async generateAndStore(
		lemma: string,
		userId: number,
		cacheKey: string,
	): Promise<VocabDetail> {
		try {
			const llm = await createLlm(
				this.configService,
				{
					preset: 'englishLearning',
					userId,
					streaming: false,
					temperature: 0.3,
					maxTokens: 4096,
					modelKwargs: { response_format: { type: 'json_object' } },
				},
				this.llmConfigService,
			);
			const message = await llm.invoke([
				new SystemMessage(VOCAB_DETAIL_TASK),
				new HumanMessage(lemma),
			]);
			const text = textOf(message.content);
			const parsed = parseVocabDetail(JSON.parse(text), lemma);
			if (!parsed) throw new Error('vocab detail schema rejected');
			await this.repo.upsert(
				{
					cacheKey,
					schemaVersion: VOCAB_DETAIL_CACHE_VERSION,
					lemma,
					detail: parsed,
				},
				['cacheKey'],
			);
			return parsed;
		} catch (e) {
			if (e instanceof BadRequestException) throw e;
			const message = e instanceof Error ? e.message : String(e);
			this.logger.warn(
				`vocab detail generate failed: ${message.slice(0, 200)}`,
			);
			throw new BadGatewayException('详解生成失败，请重试');
		}
	}
}

function textOf(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.map((part) => {
			if (typeof part === 'string') return part;
			if (part && typeof part === 'object' && 'text' in part) {
				const text = (part as { text?: unknown }).text;
				return typeof text === 'string' ? text : '';
			}
			return '';
		})
		.join('');
}
