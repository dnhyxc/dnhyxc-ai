import { createHash, randomUUID } from 'node:crypto';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
	BadGatewayException,
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { createLlm } from 'src/utils/create-llm';
import { In, Not, Repository } from 'typeorm';
import { LlmConfigService } from '../llm-config/llm-config.service';
import { EL_LIB_LIST_TTL_MS } from './english-learning-library.cache';
import { EnglishVocabDetailCache } from './entity/english-vocab-detail-cache.entity';
import { EnglishVocabDetailManual } from './entity/english-vocab-detail-manual.entity';
import { EnglishVocabDetailRegen } from './entity/english-vocab-detail-regen.entity';
import { EnglishVocabularyFavorite } from './entity/english-vocabulary-favorite.entity';
import { EnglishVocabularyLibrary } from './entity/english-vocabulary-library.entity';
import { EnglishVocabularyLibraryItem } from './entity/english-vocabulary-library-item.entity';
import {
	normalizeVocabLemma,
	parseVocabDetail,
	VOCAB_DETAIL_CACHE_VERSION,
	type VocabDetail,
} from './vocab-detail.parse';
import {
	createVocabRuns,
	isVocabAbort,
	LIST_CURSOR_SEP,
	LIST_PAGE_SIZE,
	type ListCursor,
	type ListHit,
	type MergedRow,
	mergeLibraryDetailHits,
	pageMergedDetails,
	parseListCursor,
	pickVocabOpen,
	VocabDetailCancelledError,
	type VocabOpenSource,
} from './vocab-detail-run';

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
/** 重新生成按用户分开，不加入可能返回缓存的全站在途。 */
const vocabDetailRegenInflight = new Map<string, Promise<VocabDetail>>();
/** 这一轮模型调用的 AbortSignal。停止时 abort，OpenAI 客户端会断开上游 HTTP。 */
const vocabRuns = createVocabRuns();
const CANCEL_MARK_MS = 60_000;
const CANCEL_MARK_POLL_MS = 300;
/** 调用中不解锁，结束才在 finally 里删。过期只留给进程崩溃；须长于 OpenAI 客户端默认 10 分钟。 */
const VOCAB_DETAIL_LOCK_MS = 11 * 60 * 1000;
const VOCAB_DETAIL_LOCK_POLL_MS = 400;
const UNLOCK_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
export type VocabDetailListItem = {
	lemma: string;
	glossZh: string;
	updatedAt: string;
	source: VocabOpenSource;
};

export type VocabDetailListPage = {
	items: VocabDetailListItem[];
	nextCursor: string | null;
	total: number;
};

export type ImportedWord = {
	lemma: string;
	glossZh: string;
	updatedAt: string;
};

export type ImportedWordPage = {
	items: ImportedWord[];
	nextCursor: string | null;
	total: number;
};

export type VocabVersions = {
	manual: VocabDetail | null;
	generated: VocabDetail | null;
	regen: VocabDetail | null;
};

export type VocabDetailOpen = {
	detail: VocabDetail;
	source: VocabOpenSource;
	versions: VocabVersions;
};

const IMPORT_PAGE = 50;

/** 已导入列表自己的游标。字母与解析列表相同，但不走那套 Redis。 */
function parseImportCursor(cursor: string): {
	updatedAt: number;
	lemma: string;
} {
	const sep = cursor.indexOf(LIST_CURSOR_SEP);
	if (sep <= 0) throw new BadRequestException('cursor');
	const updatedAt = new Date(cursor.slice(0, sep)).getTime();
	const lemma = cursor.slice(sep + 1);
	if (Number.isNaN(updatedAt) || !lemma)
		throw new BadRequestException('cursor');
	return { updatedAt, lemma };
}

function readListCursor(cursor?: string): ListCursor | null {
	if (!cursor) return null;
	try {
		return parseListCursor(cursor);
	} catch {
		throw new BadRequestException('cursor');
	}
}

type LockHold = 'redis' | 'local' | 'busy';

type RedisLockClient = {
	set: (
		key: string,
		value: string,
		options?: { NX?: true; PX?: number },
	) => Promise<string | null>;
	get: (key: string) => Promise<string | null>;
	del: (key: string | string[]) => Promise<number>;
	incr: (key: string) => Promise<number>;
	pExpire: (key: string, ms: number) => Promise<number>;
	eval: (
		script: string,
		options: { keys: string[]; arguments: string[] },
	) => Promise<unknown>;
	zAdd: (
		key: string,
		member:
			| { score: number; value: string }
			| { score: number; value: string }[],
	) => Promise<number>;
	zRem: (key: string, member: string) => Promise<number>;
	zCard: (key: string) => Promise<number>;
	zRange: (
		key: string,
		min: string | number,
		max: string | number,
		options?: {
			BY: 'SCORE';
			REV: true;
			LIMIT?: { offset: number; count: number };
		},
	) => Promise<string[]>;
	hSet: (
		key: string,
		field: string | Record<string, string>,
		value?: string,
	) => Promise<number>;
	hDel: (key: string, field: string) => Promise<number>;
	hmGet: (key: string, fields: string[]) => Promise<(string | null)[]>;
	sAdd: (key: string, member: string) => Promise<number>;
	sMembers: (key: string) => Promise<string[]>;
};

const LIST_EPOCH_KEY = 'el:vocabDetail:epoch';

function listZsetKey(userId: number, libraryId: string): string {
	return `el:vocabDetailList:z:u:${userId}:lib:${libraryId}`;
}
function listHashKey(userId: number, libraryId: string): string {
	return `el:vocabDetailList:h:u:${userId}:lib:${libraryId}`;
}
function listReadyKey(userId: number, libraryId: string): string {
	return `el:vocabDetailList:ready:u:${userId}:lib:${libraryId}`;
}
function listViewersKey(libraryId: string): string {
	return `el:vocabDetailList:viewers:${libraryId}`;
}

@Injectable()
export class VocabDetailService {
	private readonly logger = new Logger(VocabDetailService.name);
	private stalePurged = false;
	/** ponytail: 同进程合并冷启动。多实例仍可能各算一遍，结果相同；成为负担再加 Redis 锁。 */
	private listBuilds = new Map<string, Promise<MergedRow[]>>();

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
		@InjectRepository(EnglishVocabDetailManual)
		private readonly manualRepo: Repository<EnglishVocabDetailManual>,
		@InjectRepository(EnglishVocabDetailRegen)
		private readonly regenRepo: Repository<EnglishVocabDetailRegen>,
		@InjectRepository(EnglishVocabularyLibrary)
		private readonly libraries: Repository<EnglishVocabularyLibrary>,
	) {}

	/** 只读已有详解，不触发生成。没有则 null。 */
	async peekVocabDetail(
		word: string,
		userId: number,
	): Promise<VocabDetailOpen | null> {
		const lemma = normalizeVocabLemma(word);
		if (!lemma) throw new BadRequestException('单词为空');
		if (word.trim().length > 120) throw new BadRequestException('单词过长');
		const versions = await this.readVocabVersions(userId, lemma);
		const picked = pickVocabOpen(versions);
		return picked ? { ...picked, versions } : null;
	}

	/** 打开详解。顺序：重新生成、手动导入、全站缓存；三份都没有才生成进缓存。 */
	async openVocabDetail(
		word: string,
		userId: number,
	): Promise<VocabDetailOpen> {
		const peeked = await this.peekVocabDetail(word, userId);
		if (peeked) return peeked;
		const lemma = normalizeVocabLemma(word);
		const detail = await this.fillSharedCache(lemma, userId);
		return {
			detail,
			source: 'generated',
			versions: { manual: null, generated: detail, regen: null },
		};
	}

	/** 再打一次模型，只 upsert 该用户该词的重新生成行。 */
	async regenerateVocabDetail(
		word: string,
		userId: number,
	): Promise<VocabDetail> {
		const lemma = normalizeVocabLemma(word);
		if (!lemma) throw new BadRequestException('单词为空');
		if (word.trim().length > 120) throw new BadRequestException('单词过长');
		const runKey = regenRunKey(userId, lemma);
		const pending = vocabDetailRegenInflight.get(runKey);
		const detail = pending
			? await pending
			: await this.startRegen(lemma, userId, runKey);
		await this.regenRepo.upsert(
			{
				userId,
				lemma,
				schemaVersion: VOCAB_DETAIL_CACHE_VERSION,
				detail,
			},
			['userId', 'lemma'],
		);
		await this.patchLemmaForUser(userId, lemma);
		return detail;
	}

	/**
	 * 停止这一词正在进行的详解。
	 * scope=regen 只断开该用户这次重新生成；否则断开全站缓存那一次。
	 * abort 的是交给模型客户端的 AbortSignal，上游 HTTP 会断开。
	 */
	async cancelVocabDetail(
		word: string,
		userId?: number,
		scope?: string,
	): Promise<{ cancelled: boolean }> {
		const lemma = normalizeVocabLemma(word);
		if (!lemma) throw new BadRequestException('单词为空');
		if (word.trim().length > 120) throw new BadRequestException('单词过长');
		const regen = scope === 'regen';
		if (regen && userId == null) throw new BadRequestException('单词为空');
		const cacheKey = vocabDetailCacheKey(lemma);
		const runKey = regen ? regenRunKey(userId as number, lemma) : cacheKey;
		const pending = regen
			? vocabDetailRegenInflight.has(runKey)
			: vocabDetailInflight.has(cacheKey);
		const cancelled = vocabRuns.stop(runKey, pending);
		if (cancelled) {
			await this.markCancel(runKey);
			this.logger.warn(`vocab detail model call aborted: ${lemma}`);
		}
		return { cancelled };
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

	/** Redis NX：别的进程正在生成就等它写入缓存，不另开一次模型。关抽屉不解锁。点停止会 abort。 */
	private async leadOrFollow(
		lemma: string,
		userId: number,
		cacheKey: string,
	): Promise<VocabDetail> {
		const lockKey = `vocab-detail:lock:${cacheKey}`;
		// 已经点过停止就留着标记，让别的进程也别再开模型。没停过才清掉上一轮的标记。
		if (!vocabRuns.stopped(cacheKey)) {
			await this.clearCancelMark(cacheKey);
		}
		for (let attempt = 0; attempt < 2; attempt++) {
			await this.throwIfCancelled(cacheKey);
			const token = randomUUID();
			const hold = await this.tryLock(lockKey, token);
			if (hold === 'busy') {
				const detail = await this.waitForRow(cacheKey, lockKey);
				if (detail) return detail;
				await this.throwIfCancelled(cacheKey);
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
			await this.throwIfCancelled(cacheKey);
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
			const removed = await this.repo.delete({
				schemaVersion: Not(VOCAB_DETAIL_CACHE_VERSION),
			});
			if ((removed.affected ?? 0) > 0) await this.bumpListEpoch();
		} catch (e) {
			this.stalePurged = false;
			this.logger.warn(
				`purge stale vocab detail cache failed: ${
					e instanceof Error ? e.message.slice(0, 200) : String(e)
				}`,
			);
		}
	}

	async listForLibrary(
		userId: number,
		libraryId: string,
		cursor?: string,
	): Promise<VocabDetailListPage> {
		await this.assertLibraryReadable(userId, libraryId);
		const parsed = readListCursor(cursor);
		const client = await this.lockClient();
		if (!client) {
			return pageMergedDetails(
				await this.buildLibraryDetailRows(userId, libraryId),
				parsed,
			);
		}
		const epoch = String((await client.get(LIST_EPOCH_KEY)) ?? '0');
		const ready = await client.get(listReadyKey(userId, libraryId));
		if (ready === epoch) {
			try {
				await this.touchListKeys(client, userId, libraryId);
				return await this.pageListZset(client, userId, libraryId, parsed);
			} catch (e) {
				this.logger.warn(
					`vocab detail list page failed: ${
						e instanceof Error ? e.message.slice(0, 200) : String(e)
					}`,
				);
				await client.del(listReadyKey(userId, libraryId));
			}
		}
		const rows = await this.buildListOnce(userId, libraryId);
		await this.writeListZset(client, userId, libraryId, rows, epoch);
		return this.pageListZset(client, userId, libraryId, parsed);
	}

	/** 全站缓存未命中时的那一次生成。先挂上在途，停止才能在 arm 之前认到这一轮。 */
	private fillSharedCache(lemma: string, userId: number): Promise<VocabDetail> {
		const cacheKey = vocabDetailCacheKey(lemma);
		const pending = vocabDetailInflight.get(cacheKey);
		if (pending) return pending;
		const job = this.leadOrFollow(lemma, userId, cacheKey).finally(() => {
			if (vocabDetailInflight.get(cacheKey) === job) {
				vocabDetailInflight.delete(cacheKey);
			}
			vocabRuns.finish(cacheKey);
		});
		vocabDetailInflight.set(cacheKey, job);
		return job;
	}

	private startRegen(
		lemma: string,
		userId: number,
		runKey: string,
	): Promise<VocabDetail> {
		const job = this.callModel(lemma, userId, runKey).finally(() => {
			if (vocabDetailRegenInflight.get(runKey) === job) {
				vocabDetailRegenInflight.delete(runKey);
			}
			vocabRuns.finish(runKey);
		});
		vocabDetailRegenInflight.set(runKey, job);
		return job;
	}

	private async generateAndStore(
		lemma: string,
		userId: number,
		cacheKey: string,
	): Promise<VocabDetail> {
		const parsed = await this.callModel(lemma, userId, cacheKey);
		await this.repo.upsert(
			{
				cacheKey,
				schemaVersion: VOCAB_DETAIL_CACHE_VERSION,
				lemma,
				detail: parsed,
			},
			['cacheKey'],
		);
		await this.patchLemmaForViewers(lemma);
		return parsed;
	}

	/** 打模型并解析。runKey 用来 abort；这里不写任何表。 */
	private async callModel(
		lemma: string,
		userId: number,
		runKey: string,
	): Promise<VocabDetail> {
		const ac = vocabRuns.arm(runKey);
		const stopWatch = this.watchCancel(runKey, ac);
		try {
			if (vocabRuns.stopped(runKey, ac.signal)) {
				throw new VocabDetailCancelledError();
			}
			const llm = await createLlm(
				this.configService,
				{
					preset: 'englishLearning',
					userId,
					streaming: false,
					temperature: 0.3,
					maxTokens: 4096,
					abortSignal: ac.signal,
					modelKwargs: { response_format: { type: 'json_object' } },
				},
				this.llmConfigService,
			);
			if (vocabRuns.stopped(runKey, ac.signal)) {
				throw new VocabDetailCancelledError();
			}
			// invoke 的 signal 会进 OpenAI SDK 的 RequestOptions，abort 时断开上游连接。
			const message = await llm.invoke(
				[new SystemMessage(VOCAB_DETAIL_TASK), new HumanMessage(lemma)],
				{ signal: ac.signal },
			);
			const text = textOf(message.content);
			const parsed = parseVocabDetail(JSON.parse(text), lemma);
			if (!parsed) throw new Error('vocab detail schema rejected');
			return parsed;
		} catch (e) {
			if (e instanceof BadRequestException) throw e;
			if (isVocabAbort(e, ac.signal)) throw new VocabDetailCancelledError();
			const message = e instanceof Error ? e.message : String(e);
			this.logger.warn(
				`vocab detail generate failed: ${message.slice(0, 200)}`,
			);
			throw new BadGatewayException('详解生成失败，请重试');
		} finally {
			stopWatch();
			vocabRuns.end(runKey, ac);
		}
	}

	/** 别的进程点了停止：本地这条模型调用也要 abort。ponytail: 300ms 轮询；多实例要改成 Redis 订阅才能更快。 */
	private watchCancel(cacheKey: string, ac: AbortController): () => void {
		const timer = setInterval(() => {
			void this.cancelMarked(cacheKey).then((marked) => {
				if (marked && !ac.signal.aborted) ac.abort();
			});
		}, CANCEL_MARK_POLL_MS);
		timer.unref?.();
		return () => clearInterval(timer);
	}

	private async throwIfCancelled(cacheKey: string): Promise<void> {
		if (vocabRuns.stopped(cacheKey)) throw new VocabDetailCancelledError();
		if (await this.cancelMarked(cacheKey)) {
			throw new VocabDetailCancelledError();
		}
	}

	private cancelMarkKey(cacheKey: string): string {
		return `vocab-detail:cancel:${cacheKey}`;
	}

	private async markCancel(cacheKey: string): Promise<void> {
		try {
			const client = await this.lockClient();
			if (!client) return;
			await client.eval(
				`redis.call("set", KEYS[1], "1", "PX", ARGV[1]) return 1`,
				{
					keys: [this.cancelMarkKey(cacheKey)],
					arguments: [String(CANCEL_MARK_MS)],
				},
			);
		} catch (e) {
			this.logger.warn(
				`vocab detail cancel mark failed: ${
					e instanceof Error ? e.message.slice(0, 200) : String(e)
				}`,
			);
		}
	}

	private async clearCancelMark(cacheKey: string): Promise<void> {
		try {
			const client = await this.lockClient();
			if (!client) return;
			await client.eval(`return redis.call("del", KEYS[1])`, {
				keys: [this.cancelMarkKey(cacheKey)],
				arguments: [],
			});
		} catch {
			/* 标记过期后跟随者自己会停 */
		}
	}

	private async cancelMarked(cacheKey: string): Promise<boolean> {
		try {
			const client = await this.lockClient();
			if (!client) return false;
			return (await client.get(this.cancelMarkKey(cacheKey))) != null;
		} catch {
			return false;
		}
	}

	/** 与 assertVocabularyLibraryOwned 同一条件。导入接口对非所有者返回 403。 */
	private async assertOwner(userId: number, libraryId: string): Promise<void> {
		const lib = await this.libraries.findOne({
			where: { id: libraryId, userId },
		});
		if (!lib) throw new ForbiddenException('需要词库所有者权限');
	}

	private async lemmasInLibrary(libraryId: string): Promise<string[]> {
		const rows = await this.libraryItems.find({
			where: { libraryId },
			select: { lemma: true },
		});
		return [
			...new Set(
				rows
					.map((row) => row.lemma)
					.filter((lemma): lemma is string => Boolean(lemma)),
			),
		];
	}

	private async readVocabVersions(
		userId: number,
		lemma: string,
	): Promise<VocabVersions> {
		const [manual, generated, regen] = await Promise.all([
			this.readManual(userId, lemma),
			this.findCachedDetail(lemma),
			this.readRegen(userId, lemma),
		]);
		return { manual, generated, regen };
	}

	private async findCachedDetail(lemma: string): Promise<VocabDetail | null> {
		const row = await this.repo.findOne({
			where: {
				cacheKey: vocabDetailCacheKey(lemma),
				schemaVersion: VOCAB_DETAIL_CACHE_VERSION,
			},
		});
		return row ? parseVocabDetail(row.detail, lemma) : null;
	}

	private async readRegen(
		userId: number,
		lemma: string,
	): Promise<VocabDetail | null> {
		const row = await this.regenRepo.findOne({
			where: {
				userId,
				lemma,
				schemaVersion: VOCAB_DETAIL_CACHE_VERSION,
			},
		});
		return row ? parseVocabDetail(row.detail, lemma) : null;
	}

	private async readManual(
		userId: number,
		lemma: string,
	): Promise<VocabDetail | null> {
		const manual = await this.manualRepo.findOne({
			where: {
				userId,
				lemma,
				schemaVersion: VOCAB_DETAIL_CACHE_VERSION,
			},
		});
		return manual ? parseVocabDetail(manual.detail, lemma) : null;
	}

	/** 本库已导入的手动详解。按更新时间倒序，每页 50 条。 */
	async listImportedWords(
		userId: number,
		libraryId: string,
		cursor?: string,
	): Promise<ImportedWordPage> {
		await this.assertOwner(userId, libraryId);
		// 首页没有游标；有游标时拆成「上一页最后一条的更新时间 + 词形」，格式不对直接 400
		const parsed = cursor ? parseImportCursor(cursor) : null;
		// 释义抽取语句按当前连接的数据库写，MySQL 和 Postgres 的 JSON 路径不一样
		const type = this.manualRepo.manager.connection.options.type;
		// 默认走 MySQL：只取出详解 JSON 里第一条义项的中文释义，不把整份 detail 传给列表
		let gloss = `JSON_UNQUOTE(JSON_EXTRACT(m.detail, '$.senses[0].glossZh'))`;
		// 只有 Postgres 换路径；MySQL 保持上面那句
		if (type === 'postgres') {
			// Postgres：detail->'senses' 取出义项数组，->0 取第一条，->>'glossZh' 取出中文释义并变成普通文本
			gloss = `m.detail->'senses'->0->>'glossZh'`;
		}
		// 子查询只收集这本库里的词形，用来把「用户的全部手动详解」收窄到当前词库
		const lemmaSub = this.libraryItems
			// 词条表别名 i，后面的库 id 和空词形条件都写在这张表上
			.createQueryBuilder('i')
			// 同一个词在库里有多条时只保留一个 lemma，避免和详解连接后一行变多行
			.distinct(true)
			// 子查询只拿出词形这一列，作为和手动详解连接的键
			.select('i.lemma', 'lemma')
			// 限定当前打开的这本库，其它库的同形词不参与
			.where('i.libraryId = :libraryId', { libraryId })
			// lemma 仍为空的词条没有可对齐的词形，不参与这本库的已导入列表
			.andWhere("i.lemma <> ''");
		// 从手动详解表出发，别名 m，后面的用户、版本、排序都落在这张表上
		const qb = this.manualRepo
			// 手动详解表别名 m，用户、版本和排序条件都写在 m 上
			.createQueryBuilder('m')
			// 内连接：详解的词形必须出现在这本库的子查询里，库外的导入词不会进这本库的列表
			.innerJoin(`(${lemmaSub.getQuery()})`, 'i', 'i.lemma = m.lemma')
			// 列表每行的词就是详解上的 lemma，不再回表取 word
			.select('m.lemma', 'lemma')
			// 用详解自己的更新时间排序和做游标，不取词条上的时间
			.addSelect('m.updatedAt', 'updatedAt')
			// 把上面按数据库选好的 gloss 表达式挂成 glossZh 列
			.addSelect(gloss, 'glossZh')
			// 手动详解按用户隔离，这里只留当前登录用户的行
			.where('m.userId = :userId', { userId })
			// 旧模式版本的详解不再展示，避免栏目变了还把过期 JSON 列出来
			.andWhere('m.schemaVersion = :v', { v: VOCAB_DETAIL_CACHE_VERSION })
			// 子查询的 :libraryId 和主查询的 :userId、:v 要放进同一次执行，否则内连接参数会丢
			.setParameters({
				// 带上子查询里的 :libraryId
				...lemmaSub.getParameters(),
				// 主查询的 :userId
				userId,
				// 主查询的 :v，即当前详解模式版本
				v: VOCAB_DETAIL_CACHE_VERSION,
			});
		// 总数在加翻页条件之前算，所以 total 是这本库已导入的全部条数，不随页变小
		const counted = await qb
			// 克隆一份，避免 COUNT 把后面要用来取列表的排序和 limit 污染掉
			.clone()
			.select('COUNT(*)', 'cnt')
			.getRawOne<{ cnt?: string | number }>();
		// 只有带着游标的下一页才收窄范围，首页 parsed 为空，总数和第一页都看全量
		if (parsed) {
			// 键集翻页：时间更旧的进下一页；时间相同则只要词形更小的，避免同一秒的词被重复或漏掉
			qb.andWhere(
				// 与排序方向相反：更新时间更小，或时间相同且词形更小
				'(m.updatedAt < :t OR (m.updatedAt = :t AND m.lemma < :lemma))',
				// :t、:lemma 来自上一页最后一条，保证接着那一条往后翻
				{ t: new Date(parsed.updatedAt), lemma: parsed.lemma },
			);
		}
		// 翻页条件已经加在 qb 上，这里才取当前页的行
		const rows = await qb
			// 新导入或刚覆盖的排在前面
			.orderBy('m.updatedAt', 'DESC')
			// 同一时刻多条时按词形倒序，和游标里 lemma < 的方向一致
			.addOrderBy('m.lemma', 'DESC')
			// 多取 1 条只用来判断还有没有下一页，返回给前端时会丢掉
			.limit(IMPORT_PAGE + 1)
			// getRawMany 拿到的是列名扁平对象，不是实体；下面三个字段就是列表要用的列
			.getRawMany<{
				lemma?: unknown;
				updatedAt?: unknown;
				glossZh?: unknown;
			}>();
		// 多出来的那一条说明这一页后面还有数据
		const hasMore = rows.length > IMPORT_PAGE;
		// 有下一页时只留满页的 50 条，否则这一页就是剩余的全部
		const page = hasMore ? rows.slice(0, IMPORT_PAGE) : rows;
		// 本页最后一条是下一页游标的锚点；本页为空时没有游标
		const last = page.at(-1);
		// 先当作没有下一页；本页满了且还有锚点时再写成游标
		let nextCursor: string | null = null;
		// 多取的那条被丢掉之后，本页最后一条才是下一页的起点
		if (hasMore && last) {
			// 游标写成「ISO 时间|词形」，下一页用它接着往旧的方向切
			nextCursor = `${new Date(last.updatedAt as string | Date).toISOString()}${LIST_CURSOR_SEP}${String(last.lemma)}`;
		}
		return {
			items: page.map((row) => ({
				lemma: String(row.lemma),
				glossZh: typeof row.glossZh === 'string' ? row.glossZh : '',
				updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
			})),
			nextCursor,
			total: Number(counted?.cnt) || 0,
		};
	}

	async importManualDetails(
		userId: number,
		libraryId: string,
		items: unknown[],
	): Promise<{
		imported: number;
		overwritten: number;
		skippedNotInLibrary: number;
		skippedInvalid: number;
		skippedNotInLibrarySample: string[];
		skippedInvalidSample: string[];
		overwrittenSample: string[];
	}> {
		if (items.length > 2000) {
			throw new BadRequestException('一次最多导入 2000 条');
		}
		await this.assertOwner(userId, libraryId);
		const allowed = new Set(await this.lemmasInLibrary(libraryId));
		const latest = new Map<string, VocabDetail>();
		let skippedNotInLibrary = 0;
		let skippedInvalid = 0;
		const skippedNotInLibrarySample: string[] = [];
		const skippedInvalidSample: string[] = [];
		const sample = (bucket: string[], word: string) => {
			if (word) bucket.push(word);
		};
		for (const item of items) {
			const row =
				item && typeof item === 'object'
					? (item as { word?: unknown; detail?: unknown })
					: null;
			const raw = typeof row?.word === 'string' ? row.word : '';
			const lemma = normalizeVocabLemma(raw);
			if (!lemma || !allowed.has(lemma)) {
				skippedNotInLibrary += 1;
				sample(skippedNotInLibrarySample, raw.trim() || lemma);
				continue;
			}
			const detail = parseVocabDetail(row?.detail, lemma);
			if (!detail) {
				skippedInvalid += 1;
				sample(skippedInvalidSample, raw.trim() || lemma);
				continue;
			}
			latest.set(lemma, detail);
		}
		if (latest.size === 0) {
			return {
				imported: 0,
				overwritten: 0,
				skippedNotInLibrary,
				skippedInvalid,
				skippedNotInLibrarySample,
				skippedInvalidSample,
				overwrittenSample: [],
			};
		}
		const had = new Set(
			(
				await this.manualRepo.find({
					where: { userId, lemma: In([...latest.keys()]) },
					select: { id: true, lemma: true },
				})
			).map((row) => row.lemma),
		);
		let imported = 0;
		let overwritten = 0;
		const overwrittenSample: string[] = [];
		for (const [lemma, detail] of latest) {
			await this.manualRepo.upsert(
				{
					userId,
					lemma,
					schemaVersion: VOCAB_DETAIL_CACHE_VERSION,
					detail,
				},
				['userId', 'lemma'],
			);
			if (had.has(lemma)) {
				overwritten += 1;
				overwrittenSample.push(lemma);
			} else imported += 1;
			await this.patchLemmaForUser(userId, lemma);
		}
		return {
			imported,
			overwritten,
			skippedNotInLibrary,
			skippedInvalid,
			skippedNotInLibrarySample,
			skippedInvalidSample,
			overwrittenSample,
		};
	}

	async deleteManualDetails(
		userId: number,
		libraryId: string,
	): Promise<{ deleted: number }> {
		await this.assertOwner(userId, libraryId);
		const lemmas = await this.lemmasInLibrary(libraryId);
		if (lemmas.length === 0) return { deleted: 0 };
		const result = await this.manualRepo.delete({
			userId,
			lemma: In(lemmas),
		});
		for (const lemma of lemmas) await this.patchLemmaForUser(userId, lemma);
		return { deleted: result.affected ?? 0 };
	}

	/** 与 assertVocabularyLibraryReadable 相同：所有者或公开库，否则 404。 */
	private async assertLibraryReadable(
		userId: number,
		libraryId: string,
	): Promise<void> {
		const lib = await this.libraries.findOne({
			where: [
				{ id: libraryId, userId },
				{ id: libraryId, isPublic: true },
			],
		});
		if (!lib) throw new NotFoundException('单词库不存在或无权访问');
	}

	private async buildLibraryDetailRows(
		userId: number,
		libraryId: string,
	): Promise<MergedRow[]> {
		const rows = await this.libraryItems.find({
			where: { libraryId },
			select: { id: true, word: true, lemma: true },
		});
		const lemmas = [
			...new Set(
				rows
					.map((row) => row.lemma || normalizeVocabLemma(row.word ?? ''))
					.filter((lemma) => lemma.length > 0 && lemma.length <= 120),
			),
		];
		if (lemmas.length === 0) return [];
		const hits: ListHit[] = [];
		for (let i = 0; i < lemmas.length; i += 1000) {
			hits.push(
				...(await this.loadListHits(userId, lemmas.slice(i, i + 1000))),
			);
		}
		return mergeLibraryDetailHits(hits);
	}

	private async buildListOnce(
		userId: number,
		libraryId: string,
	): Promise<MergedRow[]> {
		const key = `${userId}:${libraryId}`;
		const pending = this.listBuilds.get(key);
		if (pending) return pending;
		const job = this.buildLibraryDetailRows(userId, libraryId).finally(() => {
			this.listBuilds.delete(key);
		});
		this.listBuilds.set(key, job);
		return job;
	}

	private async writeListZset(
		client: RedisLockClient,
		userId: number,
		libraryId: string,
		rows: MergedRow[],
		epoch: string,
	): Promise<void> {
		const zkey = listZsetKey(userId, libraryId);
		const hkey = listHashKey(userId, libraryId);
		await client.del([zkey, hkey]);
		for (let i = 0; i < rows.length; i += 1000) {
			const group = rows.slice(i, i + 1000);
			await client.zAdd(
				zkey,
				group.map((row) => ({
					score: row.updatedAt.getTime(),
					value: row.lemma,
				})),
			);
			const payload: Record<string, string> = {};
			for (const row of group) {
				payload[row.lemma] = JSON.stringify({
					glossZh: row.glossZh,
					source: row.source,
					updatedAt: row.updatedAt.toISOString(),
				});
			}
			await client.hSet(hkey, payload);
		}
		await client.set(listReadyKey(userId, libraryId), epoch);
		await client.sAdd(listViewersKey(libraryId), String(userId));
		await this.touchListKeys(client, userId, libraryId);
	}

	private async touchListKeys(
		client: RedisLockClient,
		userId: number,
		libraryId: string,
	): Promise<void> {
		for (const key of [
			listZsetKey(userId, libraryId),
			listHashKey(userId, libraryId),
			listReadyKey(userId, libraryId),
			listViewersKey(libraryId),
		]) {
			await client.pExpire(key, EL_LIB_LIST_TTL_MS);
		}
		await client.sAdd(listViewersKey(libraryId), String(userId));
		await client.pExpire(listViewersKey(libraryId), EL_LIB_LIST_TTL_MS);
	}

	private async pageMembers(
		client: RedisLockClient,
		zkey: string,
		cursor: ListCursor | null,
	): Promise<string[]> {
		const limit = LIST_PAGE_SIZE + 1;
		if (!cursor) {
			return client.zRange(zkey, '+inf', '-inf', {
				BY: 'SCORE',
				REV: true,
				LIMIT: { offset: 0, count: limit },
			});
		}
		const same = await client.zRange(zkey, cursor.updatedAt, cursor.updatedAt, {
			BY: 'SCORE',
			REV: true,
		});
		const restSame = same.filter((lemma) => lemma < cursor.lemma);
		const lower = await client.zRange(zkey, `(${cursor.updatedAt}`, '-inf', {
			BY: 'SCORE',
			REV: true,
			LIMIT: { offset: 0, count: limit },
		});
		return [...restSame, ...lower].slice(0, limit);
	}

	private async pageListZset(
		client: RedisLockClient,
		userId: number,
		libraryId: string,
		cursor: ListCursor | null,
	): Promise<VocabDetailListPage> {
		const members = await this.pageMembers(
			client,
			listZsetKey(userId, libraryId),
			cursor,
		);
		const hasMore = members.length > LIST_PAGE_SIZE;
		const page = hasMore ? members.slice(0, LIST_PAGE_SIZE) : members;
		const raw = page.length
			? await client.hmGet(listHashKey(userId, libraryId), page)
			: [];
		const items = page.map((lemma, index) => {
			const cell = raw[index];
			if (!cell) throw new Error('list cache thin row missing');
			const parsed = JSON.parse(cell) as {
				glossZh: string;
				source: VocabOpenSource;
				updatedAt: string;
			};
			return {
				lemma,
				glossZh: parsed.glossZh,
				updatedAt: parsed.updatedAt,
				source: parsed.source,
			};
		});
		const total = await client.zCard(listZsetKey(userId, libraryId));
		const last = items.at(-1);
		const nextCursor =
			hasMore && last
				? `${last.updatedAt}${LIST_CURSOR_SEP}${last.lemma}`
				: null;
		return { items, nextCursor, total };
	}

	private async loadListHits(
		userId: number,
		lemmas: string[],
	): Promise<ListHit[]> {
		if (lemmas.length === 0) return [];
		const keys = lemmas.map((lemma) => vocabDetailCacheKey(lemma));
		const [generated, manual, regen] = await Promise.all([
			this.slotRows(this.repo, 'c', keys, null),
			this.slotRows(this.manualRepo, 'm', lemmas, userId),
			this.slotRows(this.regenRepo, 'r', lemmas, userId),
		]);
		return [
			...generated.map((row) => this.toHit(row, 'generated')),
			...manual.map((row) => this.toHit(row, 'manual')),
			...regen.map((row) => this.toHit(row, 'regen')),
		].filter((row): row is ListHit => row !== null);
	}

	private slotRows(
		repo: Repository<{ lemma: string }>,
		alias: string,
		keys: string[],
		userId: number | null,
	) {
		const type = this.repo.manager.connection.options.type;
		const gloss =
			type === 'postgres'
				? `${alias}.detail->'senses'->0->>'glossZh'`
				: `JSON_UNQUOTE(JSON_EXTRACT(${alias}.detail, '$.senses[0].glossZh'))`;
		const qb = repo.createQueryBuilder(alias);
		qb.select(`${alias}.lemma`, 'lemma');
		qb.addSelect(`${alias}.updatedAt`, 'updatedAt');
		qb.addSelect(gloss, 'glossZh');
		qb.where(`${alias}.schemaVersion = :v`, { v: VOCAB_DETAIL_CACHE_VERSION });
		if (userId != null) {
			qb.andWhere(
				`${alias}.userId = :userId AND ${alias}.lemma IN (:...keys)`,
				{ userId, keys },
			);
		} else {
			qb.andWhere(`${alias}.cacheKey IN (:...keys)`, { keys });
		}
		return qb.getRawMany<{
			lemma?: unknown;
			updatedAt?: unknown;
			glossZh?: unknown;
		}>();
	}

	private toHit(
		row: { lemma?: unknown; updatedAt?: unknown; glossZh?: unknown },
		source: VocabOpenSource,
	): ListHit | null {
		if (typeof row.lemma !== 'string' || !row.lemma) return null;
		const updatedAt = new Date(row.updatedAt as string | Date);
		if (Number.isNaN(updatedAt.getTime())) return null;
		return {
			lemma: row.lemma,
			source,
			glossZh: typeof row.glossZh === 'string' ? row.glossZh : '',
			updatedAt,
		};
	}

	private async patchListLemma(
		userId: number,
		libraryId: string,
		lemma: string,
	): Promise<void> {
		try {
			const client = await this.lockClient();
			if (!client) return;
			const epoch = String((await client.get(LIST_EPOCH_KEY)) ?? '0');
			const ready = await client.get(listReadyKey(userId, libraryId));
			if (ready !== epoch) return;
			const row = mergeLibraryDetailHits(
				await this.loadListHits(userId, [lemma]),
			)[0];
			const zkey = listZsetKey(userId, libraryId);
			const hkey = listHashKey(userId, libraryId);
			if (!row) {
				await client.zRem(zkey, lemma);
				await client.hDel(hkey, lemma);
			} else {
				await client.zAdd(zkey, {
					score: row.updatedAt.getTime(),
					value: lemma,
				});
				await client.hSet(
					hkey,
					lemma,
					JSON.stringify({
						glossZh: row.glossZh,
						source: row.source,
						updatedAt: row.updatedAt.toISOString(),
					}),
				);
			}
			await this.touchListKeys(client, userId, libraryId);
		} catch (e) {
			this.logger.warn(
				`vocab detail list patch failed: ${
					e instanceof Error ? e.message.slice(0, 200) : String(e)
				}`,
			);
		}
	}

	private async libraryIdsForLemma(lemma: string): Promise<string[]> {
		const rows = await this.libraryItems.find({
			where: { lemma },
			select: { libraryId: true },
		});
		return [...new Set(rows.map((row) => row.libraryId))];
	}

	private async patchLemmaForViewers(lemma: string): Promise<void> {
		const client = await this.lockClient();
		if (!client) return;
		const libraryIds = await this.libraryIdsForLemma(lemma);
		for (const libraryId of libraryIds) {
			const viewers = await client.sMembers(listViewersKey(libraryId));
			for (const viewer of viewers) {
				await this.patchListLemma(Number(viewer), libraryId, lemma);
			}
		}
	}

	private async patchLemmaForUser(
		userId: number,
		lemma: string,
	): Promise<void> {
		const libraryIds = await this.libraryIdsForLemma(lemma);
		for (const libraryId of libraryIds) {
			await this.patchListLemma(userId, libraryId, lemma);
		}
	}

	private async bumpListEpoch(): Promise<void> {
		try {
			const client = await this.lockClient();
			if (!client) return;
			await client.incr(LIST_EPOCH_KEY);
		} catch (e) {
			this.logger.warn(
				`vocab detail list epoch failed: ${
					e instanceof Error ? e.message.slice(0, 200) : String(e)
				}`,
			);
		}
	}

	async dropLibraryListCache(libraryId: string): Promise<void> {
		try {
			const client = await this.lockClient();
			if (!client) return;
			const viewers = await client.sMembers(listViewersKey(libraryId));
			for (const viewer of viewers) {
				const userId = Number(viewer);
				await client.del([
					listZsetKey(userId, libraryId),
					listHashKey(userId, libraryId),
					listReadyKey(userId, libraryId),
				]);
			}
			await client.del(listViewersKey(libraryId));
		} catch (e) {
			this.logger.warn(
				`vocab detail list drop failed: ${
					e instanceof Error ? e.message.slice(0, 200) : String(e)
				}`,
			);
		}
	}
}

function vocabDetailCacheKey(lemma: string): string {
	return createHash('sha256')
		.update(`${VOCAB_DETAIL_CACHE_VERSION}\0${lemma}`, 'utf8')
		.digest('hex');
}

function regenRunKey(userId: number, lemma: string): string {
	return `regen:${userId}:${vocabDetailCacheKey(lemma)}`;
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
