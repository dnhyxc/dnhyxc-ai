/**
 * 英语学习侧栏领域工具（el_*）：只调 Service，统一信封，提案写，noop 触发生成。
 */
import { createHash, randomUUID } from 'node:crypto';
import { DynamicTool } from '@langchain/core/tools';
import type { LoggerService } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { shanghaiToday } from '../../../english-learning/daily-reading.rules';
import type { EnglishDailyReadingService } from '../../../english-learning/english-daily-reading.service';
import type { EnglishLearningService } from '../../../english-learning/english-learning.service';
import type { EnglishLearningStreamAbortRegistry } from '../../../english-learning/english-learning-stream-abort.registry';
import type { LearningNotesService } from '../../../learning-notes/learning-notes.service';
import { applyElProposal } from './apply-proposal';
import type { ElArtifactStore, ElResourceListPayload } from './artifact.store';
import { buildCategoryProposal, classifyChunk } from './category-propose';
import { favoriteIntentFrom, resolveEnglishIntent } from './english-intent';
import {
	asOp,
	asString,
	clampLimit,
	type ElEnvelope,
	elFail,
	elOk,
	fitItemsByChars,
	parseElArgs,
	stringifyEnvelope,
} from './envelope';
import {
	favoriteAsk,
	favoriteAsksBoth,
	unfavoriteFromCards,
} from './favorite-ask';
import { fetchAllPages } from './fetch-all-pages';
import { type PackSide, resolvePackAsk } from './pack-ask';
import type { ElProposalStore } from './proposal.store';
import {
	collectProposeBodies,
	collectRemoveRequest,
	inferContentKind,
} from './propose-bodies';
import { resolveAgentManualAsk } from './reading-ask';
import {
	cardAlreadyShown,
	categoryLabels,
	type ElListSurface,
	inheritedKind,
	inheritedLibrary,
	inventoryCardDecision,
	isAllClassicCategory,
	isAllVocabCategory,
	isCategoryAsk,
	isIndexOp,
	isSearchOp,
	listIntent,
	matchLibraries,
	noteIdFromCardItems,
	presentRows,
	presentTooWide,
	reclassifyAsked,
	resolveLibraryCue,
	resolveMentionedLibrary,
	resolveNamedLibrary,
	shownTitle,
	slimPage,
	slimRow,
	spillListResult,
	wantsLibraryCatalog,
} from './spill';

/** 整类口吻才读本轮词库。点名「收藏 cat」不扫清单。 */
const CATEGORY_ASK = /关于|全部|所有|这类|相关|找出|哪些|属于|挑出|筛/;

/** 本轮最后一份单词词库清单。后列出的库覆盖先列出的库。 */
export function latestLibraryRows(
	surface: ElListSurface,
	userText: string,
): ElResourceListPayload | null {
	if (!CATEGORY_ASK.test(userText)) return null;
	for (let i = surface.libraryLists.length - 1; i >= 0; i -= 1) {
		const row = surface.libraryLists[i];
		if (row.source !== 'library' || row.contentKind === 'classic') continue;
		if (!row.items?.length) continue;
		return row;
	}
	return null;
}

/** 本轮收藏、错题写入上限 */
const ENGLISH_EL_WRITE_RUN_LIMIT = 5;

export type ElDomainMutation = 'favorites' | 'mistakes' | 'daily_reading';

export type BuildEnglishLearningDomainToolsDeps = {
	userId: number;
	learning: EnglishLearningService;
	dailyReading: EnglishDailyReadingService;
	notes: LearningNotesService;
	streams: EnglishLearningStreamAbortRegistry;
	proposals: ElProposalStore;
	artifacts: ElArtifactStore;
	logger: LoggerService;
	config: ConfigService;
	/** 库列表等仍自动出卡，不插锚点 */
	onResourceList?: (payload: ElResourceListPayload) => void;
	/** 模型 el_present 成功：正文插锚点，卡片画在该处 */
	onPresented?: (payload: ElResourceListPayload) => void;
	/** 本轮写白名单：更早 el 工具返回过的词面 / 原句 */
	whitelist: Set<string>;
	/** 词库 list 的整库卡由服务端按库名挂上；筛选仍等 el_present */
	surface: ElListSurface;
	onMutation?: (domain: ElDomainMutation) => void;
	/** 主模型这轮的停止信号。分类请求跟着它中止。 */
	signal?: AbortSignal;
};

type Budgets = {
	elWrites: number;
	openProposalId: string | null;
	/** 紧挨着的上一次调用。只活在这一句，下一句用户消息会新建工具 */
	lastSig: string;
};

/** 词面搜索匹配窗。不是把库列完。 */
const SEARCH_MATCH_LIMIT = 500;
const PAGE_LIBS = 100;
const PAGE_LIB_ITEMS = 500;
const PAGE_USER_ROWS = 100;
const PAGE_READING = 100;

function kindOf(args: Record<string, unknown>): 'vocab' | 'classic' {
	return args.kind === 'classic' ? 'classic' : 'vocab';
}

/** 短页提前结束。不提条数硬顶，提示词只认这句才许说库没列完。 */
function unmetTotal(got: number, total: number): string {
	return `查询没有拿满总数（已取 ${got} / 共 ${total}）`;
}

const LITERAL_MISS =
	'字面未命中，索引仍是全量。请按标题、词面或释义筛选，不要宣称没有。';

async function pageIndex(
	deps: BuildEnglishLearningDomainToolsDeps,
	args: Record<string, unknown>,
): Promise<ElEnvelope | null> {
	const artifactId = asString(args.artifactId)?.trim();
	const offset =
		typeof args.offset === 'number' ? args.offset : Number(args.offset);
	if (!artifactId || !Number.isFinite(offset) || offset <= 0) return null;
	const art = await deps.artifacts.get(deps.userId, artifactId);
	if (!art?.items?.length)
		return elFail('not_found', '清单不存在或已过期，请重新 list');
	const page = slimPage(art.items, offset);
	return elOk(
		{
			artifactId,
			items: page.rows,
			returned: page.rows.length,
			totalCount: art.totalCount,
			...(page.nextOffset !== undefined ? { nextOffset: page.nextOffset } : {}),
		},
		{
			message:
				page.nextOffset !== undefined
					? '仍有下一页索引。'
					: '索引已到末页。筛选用 el_present，只能提交见过的 id 或词面。',
		},
	);
}

function harvestWhitelist(data: unknown, into: Set<string>): void {
	if (!data || typeof data !== 'object') return;
	const walk = (v: unknown) => {
		if (!v || typeof v !== 'object') return;
		if (Array.isArray(v)) {
			for (const x of v) walk(x);
			return;
		}
		const o = v as Record<string, unknown>;
		for (const k of ['word', 'english', 'wordKey'] as const) {
			const s = o[k];
			if (typeof s === 'string' && s.trim()) into.add(s.trim().toLowerCase());
		}
		for (const child of Object.values(o)) walk(child);
	};
	walk(data);
}

function manualReceipt(manual: {
	themes: string[];
	profile: {
		level: string;
		length: string;
		focus: string;
		questions: number | string;
		useWeb: boolean;
	};
}): string {
	const p = manual.profile;
	const length =
		p.length === 'short'
			? '短篇'
			: p.length === 'long'
				? '长篇'
				: p.length === 'random'
					? '随机'
					: '中篇';
	const focus =
		p.focus === 'vocab'
			? '附词汇'
			: p.focus === 'grammar'
				? '附语法'
				: p.focus === 'both'
					? '附词汇加语法'
					: p.focus === 'random'
						? '随机'
						: '只读短文';
	const questions =
		p.questions === 0
			? '不出题'
			: p.questions === 'random'
				? '随机'
				: `${p.questions} 题`;
	const level = p.level === 'random' ? '随机' : p.level;
	const web = p.useWeb ? '开启智能搜索' : '关闭智能搜索';
	return (
		`自选生成已开始。主题候选 ${manual.themes.join('、')}；难度 ${level}；篇幅 ${length}；` +
		`侧重 ${focus}；理解题 ${questions}；联网 ${web}。` +
		'未在原话里点名的字段来自已保存的自选生成配置。不要改成别的档，也不要说成系统日推。'
	);
}

/** 笔记卡片用的纯文本。去掉标签，保留用户写在正文里的字。 */
export function notePlain(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, ' ')
		.replace(/&gt;/gi, ' ')
		.replace(/&#\d+;/g, ' ')
		.replace(/&[a-z]+;/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const NOTE_LEAD = 24;
const NOTE_PAGE = 100;

/** 给模型的开头。去掉链接和尖括号，只留 24 字。 */
export function noteLead(plain: string): string {
	return plain
		.replace(/https?:\/\/\S+/gi, ' ')
		.replace(/[<>]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, NOTE_LEAD);
}

function noteTitle(raw: string): string {
	const title = raw
		.replace(/https?:\/\/\S+/gi, ' ')
		.replace(/[<>]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return title || '无标题';
}

/** 本轮要看最早或最新的一篇。上一轮说过「卡片已列出」不算。 */
export function noteReadAsk(userText: string): 'earliest' | 'latest' | null {
	const earliest = /最早|第一篇/.test(userText);
	const latest = /最新|最后一篇|最近一篇/.test(userText);
	if (!earliest && !latest) return null;
	if (!/笔记|内容|一篇/.test(userText)) return null;
	return earliest ? 'earliest' : 'latest';
}

/** 本轮没有笔记卡时，按原话补最早或最新的一篇。模型没再调用 get 也会挂上。 */
export async function missingNoteCard(
	notes: LearningNotesService,
	userId: number,
	userText: string,
): Promise<Omit<ElResourceListPayload, 'artifactId'> | null> {
	const which = noteReadAsk(userText);
	if (!which) return null;
	const rows: Awaited<ReturnType<LearningNotesService['findPage']>>['list'] =
		[];
	for (let pageNo = 1; ; pageNo += 1) {
		const page = await notes.findPage(userId, { pageNo, pageSize: NOTE_PAGE });
		rows.push(...page.list);
		if (rows.length >= page.total || page.list.length < NOTE_PAGE) break;
	}
	if (!rows.length) return null;
	const at = (v: Date | string) => {
		const t = new Date(v).getTime();
		return Number.isFinite(t) ? t : 0;
	};
	const picked = rows.reduce((best, row) => {
		const better =
			which === 'earliest'
				? at(row.createdAt) < at(best.createdAt)
				: at(row.createdAt) > at(best.createdAt);
		return better ? row : best;
	});
	const full = await notes.findOne(userId, picked.id);
	const plain = notePlain(full.content ?? '');
	const title = noteTitle(full.title ?? '');
	return {
		title,
		source: 'notes',
		totalCount: 1,
		truncated: false,
		items: [
			{
				id: full.id,
				titleZh: title,
				mine: full.isOwned ? '本人' : '他人公开',
				lead: noteLead(plain),
				english: plain,
				updatedAt:
					full.updatedAt instanceof Date
						? full.updatedAt.toISOString()
						: String(full.updatedAt ?? ''),
			},
		],
	};
}

async function generateVocab(
	deps: BuildEnglishLearningDomainToolsDeps,
	side: PackSide,
	streamId: string,
	signal: AbortSignal,
) {
	await deps.learning.runVocabularyGeneration(
		{ topic: side.topic, count: side.count },
		async (p) => {
			if (!p.newItems?.length) return;
			await deps.learning.saveVocabularyPackBatch({
				userId: deps.userId,
				streamId,
				round: p.round,
				topic: side.topic,
				targetCount: side.count,
				items: p.newItems,
			});
		},
		{
			userId: deps.userId,
			signal,
			onAgentTool: async (ev) => {
				if (
					ev.phase === 'organic' &&
					Array.isArray(ev.searchOrganic) &&
					ev.searchOrganic.length > 0
				) {
					await deps.learning.appendPackWebSearchRound({
						userId: deps.userId,
						streamId,
						packKind: 'vocabulary',
						query:
							typeof ev.searchQuery === 'string' ? ev.searchQuery : undefined,
						organic: ev.searchOrganic,
					});
				}
			},
		},
	);
	const all = await fetchAllPages(PAGE_USER_ROWS, async (limit, offset) => {
		const page = await deps.learning.listVocabularyPackItems(
			deps.userId,
			streamId,
			{
				limit,
				offset,
			},
		);
		return {
			items: page.items.map((it) => ({
				word: it.word,
				ipa: it.ipa,
				pos: it.pos,
				translationZh: it.translationZh,
				example: it.example,
			})),
			totalCount: page.itemCount,
		};
	});
	return all.items;
}

async function generateClassic(
	deps: BuildEnglishLearningDomainToolsDeps,
	side: PackSide,
	streamId: string,
	signal: AbortSignal,
) {
	await deps.learning.runClassicQuotesGeneration(
		{ topic: side.topic, count: side.count },
		async (p) => {
			if (!p.newItems?.length) return;
			await deps.learning.saveClassicQuotesPackBatch({
				userId: deps.userId,
				streamId,
				round: p.round,
				topic: side.topic,
				targetCount: side.count,
				items: p.newItems,
			});
		},
		{
			userId: deps.userId,
			signal,
			onAgentTool: async (ev) => {
				if (
					ev.phase === 'organic' &&
					Array.isArray(ev.searchOrganic) &&
					ev.searchOrganic.length > 0
				) {
					await deps.learning.appendPackWebSearchRound({
						userId: deps.userId,
						streamId,
						packKind: 'classic_quotes',
						query:
							typeof ev.searchQuery === 'string' ? ev.searchQuery : undefined,
						organic: ev.searchOrganic,
					});
				}
			},
		},
	);
	const all = await fetchAllPages(PAGE_USER_ROWS, async (limit, offset) => {
		const page = await deps.learning.listClassicQuotesPackItems(
			deps.userId,
			streamId,
			{
				limit,
				offset,
			},
		);
		return {
			items: page.items.map((it) => ({
				english: it.english,
				translationZh: it.translationZh,
				source: it.source,
			})),
			totalCount: page.itemCount,
		};
	});
	return all.items;
}

/** 用户点确认后才跑词书/语句生成，不把整表塞回本轮对话。 */
export function startConfirmedPack(
	learning: EnglishLearningService,
	streams: EnglishLearningStreamAbortRegistry,
	userId: number,
	body: Record<string, unknown>,
): void {
	const ask = body as { vocab?: PackSide; classic?: PackSide };
	const deps = { learning, userId } as BuildEnglishLearningDomainToolsDeps;
	const abort = new AbortController();
	const held: string[] = [];
	const hold = () => {
		const streamId = randomUUID();
		held.push(streamId);
		streams.register(userId, streamId, abort);
		return streamId;
	};
	void (async () => {
		try {
			if (ask.vocab) await generateVocab(deps, ask.vocab, hold(), abort.signal);
			if (ask.classic)
				await generateClassic(deps, ask.classic, hold(), abort.signal);
		} catch {
			/* 确认后后台生成，失败不再回对话 */
		} finally {
			for (const id of held) streams.unregister(id);
		}
	})();
}

/** 用户点确认后才插入自选阅读并开始写。 */
export function startConfirmedReading(
	dailyReading: EnglishDailyReadingService,
	userId: number,
	body: Record<string, unknown>,
): void {
	const runId = randomUUID();
	dailyReading.openManual(
		userId,
		{ themes: body.themes, profile: body.profile, runId },
		() => undefined,
	);
}

type LibraryLoad = {
	items: Array<Record<string, unknown>>;
	truncated: boolean;
};

/** 全库行，带 sortOrder，供版本哈希和分类共用同一字段。 */
async function readLibraryRows(
	learning: EnglishLearningService,
	userId: number,
	libId: string,
	kind: 'vocab' | 'classic',
): Promise<LibraryLoad> {
	return fetchAllPages(
		PAGE_LIB_ITEMS,
		async (
			limit,
			offset,
		): Promise<{ items: Record<string, unknown>[]; totalCount?: number }> => {
			if (kind === 'classic') {
				const page = await learning.listClassicQuotesLibraryItems(
					userId,
					libId,
					{
						limit,
						offset,
					},
				);
				return {
					items: page.items.map((item) => ({
						sortOrder: item.sortOrder,
						english: item.english,
						translationZh: item.translationZh,
						source: item.source,
						noteZh: item.noteZh,
					})),
					totalCount:
						typeof page.library.quoteCount === 'number'
							? page.library.quoteCount
							: undefined,
				};
			}
			const page = await learning.listVocabularyLibraryItems(userId, libId, {
				limit,
				offset,
			});
			return {
				items: page.items.map((item) => ({
					sortOrder: item.sortOrder,
					word: item.word,
					ipa: item.ipa,
					pos: item.pos,
					segmentation: item.segmentation,
					translationZh: item.translationZh,
					example: item.example,
				})),
				totalCount:
					typeof page.library.wordCount === 'number'
						? page.library.wordCount
						: undefined,
			};
		},
	);
}

/**
 * 按类别名把唯一库筛成清单。
 * libraryId 仍要留下：收藏和按库查找靠它。前端见到 filtered 才不会按整库重拉。
 * 零命中返回 null。失败批没有词时返回带「有批未能判断」的空清单，调用方据此不写缓存。
 */
export async function filterLibraryFallback(
	learning: EnglishLearningService,
	config: ConfigService,
	userId: number,
	lib: { id: string; title: string },
	userText: string,
	logger: LoggerService,
	kind: 'vocab' | 'classic',
	signal?: AbortSignal,
): Promise<Omit<ElResourceListPayload, 'artifactId'> | null> {
	const all = await readLibraryRows(learning, userId, lib.id, kind);
	if (!all.items.length) {
		logger.warn?.(`[AgentService] 库「${lib.title}」没有可筛选的行`);
		return null;
	}
	if (signal?.aborted) return null;
	const built = await buildCategoryProposal(
		all.items,
		userText,
		(chunk, text) => classifyChunk(config, chunk, text, signal),
		signal,
	);
	if (signal?.aborted) return null;
	if (!built.bodies.length) {
		if (built.failedChunks > 0) {
			return {
				title: `${lib.title}（有批未能判断）`,
				source: 'library',
				contentKind: kind,
				libraryId: lib.id,
				filtered: true,
				totalCount: 0,
				truncated: true,
				items: [],
			};
		}
		logger.warn?.(`[AgentService] 库「${lib.title}」筛选没有命中行`);
		return null;
	}
	const judgedShort = built.failedChunks > 0;
	return {
		title: judgedShort ? `${lib.title}（有批未能判断）` : lib.title,
		source: 'library',
		contentKind: kind,
		libraryId: lib.id,
		filtered: true,
		totalCount: built.bodies.length,
		truncated: judgedShort || all.truncated,
		items: built.bodies,
	};
}

/** 一行用来做版本和缓存键的原文。语句取 english，单词取 word。 */
export function categoryLineKey(row: Record<string, unknown>): string {
	const english = typeof row.english === 'string' ? row.english.trim() : '';
	if (english) return english;
	return typeof row.word === 'string' ? row.word.trim() : '';
}

/** 库内容版本。英文或顺序变了，旧的类别命中就不能再读。译文不进版本。 */
export function revisionOf(rows: Array<Record<string, unknown>>): string {
	const lines: string[] = [];
	for (const row of rows) {
		const order = typeof row.sortOrder === 'number' ? row.sortOrder : 0;
		const en = categoryLineKey(row);
		if (!en) continue;
		lines.push(`${order}\t${en}`);
	}
	return createHash('sha256')
		.update(lines.join('\n'))
		.digest('hex')
		.slice(0, 16);
}

/** 用记下的英文键找回当前行，译文用库里的新值。 */
export function mapKeysToRows(
	all: Array<Record<string, unknown>>,
	keys: string[],
): Record<string, unknown>[] {
	const by = new Map<string, Record<string, unknown>>();
	for (const row of all) {
		const key = categoryLineKey(row).toLowerCase();
		if (!key || by.has(key)) continue;
		const { sortOrder: _order, ...display } = row;
		by.set(key, display);
	}
	const items: Record<string, unknown>[] = [];
	for (const raw of keys) {
		const row = by.get(raw.trim().toLowerCase());
		if (row) items.push(row);
	}
	return items;
}

function englishKeys(items: unknown[] | undefined): string[] {
	const keys: string[] = [];
	for (const item of items ?? []) {
		if (!item || typeof item !== 'object') continue;
		const key = categoryLineKey(item as Record<string, unknown>);
		if (key) keys.push(key);
	}
	return keys;
}

function categoryMissTitle(title: string): boolean {
	return title.includes('有批未能判断');
}

/**
 * 同一库版本、同一类别只判一次。三个关于类入口都调它。
 * 未命中才把类别名送给 filterLibraryFallback，不送整句原话。
 */
export async function classifyLibrary(input: {
	learning: EnglishLearningService;
	config: ConfigService;
	userId: number;
	lib: { id: string; title: string };
	label: string;
	logger: LoggerService;
	kind: 'vocab' | 'classic';
	signal?: AbortSignal;
	artifacts: ElArtifactStore;
	jobs: Map<string, Promise<Omit<ElResourceListPayload, 'artifactId'> | null>>;
	skipCache: boolean;
}): Promise<Omit<ElResourceListPayload, 'artifactId'> | null> {
	const jobKey = `${input.kind}:${input.lib.id}:${input.label}`;
	const existing = input.jobs.get(jobKey);
	if (existing) return existing;
	const job = runClassifyLibrary(input);
	input.jobs.set(jobKey, job);
	return job;
}

async function runClassifyLibrary(input: {
	learning: EnglishLearningService;
	config: ConfigService;
	userId: number;
	lib: { id: string; title: string };
	label: string;
	logger: LoggerService;
	kind: 'vocab' | 'classic';
	signal?: AbortSignal;
	artifacts: ElArtifactStore;
	skipCache: boolean;
}): Promise<Omit<ElResourceListPayload, 'artifactId'> | null> {
	const all = await readLibraryRows(
		input.learning,
		input.userId,
		input.lib.id,
		input.kind,
	);
	const revision = revisionOf(all.items);
	// sem：按类别语义筛选，不点名某个类别的成员。换口径必须改这段，否则旧命中还会被读到。
	const key = `el_cat:${input.kind}:${input.lib.id}:${input.label}:${revision}:sem`;
	if (!input.skipCache) {
		const saved = await input.artifacts.getCategoryKeys(key);
		if (saved) {
			const items = mapKeysToRows(all.items, saved);
			return {
				title: input.lib.title,
				source: 'library',
				contentKind: input.kind,
				libraryId: input.lib.id,
				filtered: true,
				categoryLabels: [input.label],
				totalCount: items.length,
				truncated: false,
				items,
			};
		}
	}
	const draft = await filterLibraryFallback(
		input.learning,
		input.config,
		input.userId,
		input.lib,
		input.label,
		input.logger,
		input.kind,
		input.signal,
	);
	if (draft && categoryMissTitle(draft.title)) return draft;
	const keys = englishKeys(draft?.items);
	await input.artifacts.setCategoryKeys(key, keys);
	if (draft) return { ...draft, categoryLabels: [input.label] };
	return {
		title: input.lib.title,
		source: 'library',
		contentKind: input.kind,
		libraryId: input.lib.id,
		filtered: true,
		categoryLabels: [input.label],
		totalCount: 0,
		truncated: false,
		items: [],
	};
}

/** 筛选卡的固定正文。n 取行数。没有筛选卡时返回 null，整库说明保持原样。 */
export function categoryReply(cards: ElResourceListPayload[]): string | null {
	const filtered = cards.filter(
		(card) => card.filtered && (card.categoryLabels?.length ?? 0) > 0,
	);
	if (!filtered.length) return null;
	const lines: string[] = [];
	for (const card of filtered) {
		const n = card.items?.length ?? 0;
		const line =
			n > 0 ? `${card.title}：共 ${n} 条。` : `${card.title}：没有可展示的行。`;
		lines.push(line);
	}
	return lines.join('\n');
}

/** 跳过纯收藏句，取最近一条带类别的用户原话。当前这句「将这些进行收藏」不能拿来筛整库。 */
export function quoteCategoryText(userTexts: string[]): string {
	const cue = /关于|相关|有关|属于|问候|打招呼/;
	for (let i = userTexts.length - 1; i >= 0; i -= 1) {
		const text = userTexts[i]?.trim() ?? '';
		if (!text) continue;
		if (favoriteAsk(text) && !cue.test(text)) continue;
		if (cue.test(text)) return text;
	}
	return '';
}

/**
 * 收藏「这些」时，连续几轮分类各自的语句卡都要。
 * 从近到远，直到碰到不是分类的用户原话。不是收藏时只留最近一条助手消息。
 * 取消收藏不是新话题，收藏时一律跨过。
 * bridgeFavorites：再往前跳过「进行收藏」，避免把更早的分类卡挡在外面。
 * 返回的是助手消息下标，旧的在前。
 */
export function quoteThreadAssistantIndexes(
	messages: { role: string; id?: string; content?: string }[],
	currentAssistantId: string | undefined,
	saving: boolean,
	bridgeFavorites = false,
): number[] {
	const indexes: number[] = [];
	let seenUser = false;
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const row = messages[i];
		if (row.role === 'user') {
			if (!saving) continue;
			if (!seenUser) {
				seenUser = true;
				continue;
			}
			if (!isCategoryAsk(row.content ?? '')) {
				if (unfavoriteFromCards(row.content ?? '')) continue;
				if (bridgeFavorites && favoriteAsk(row.content ?? '')) continue;
				break;
			}
			continue;
		}
		if (row.role !== 'assistant') continue;
		if (currentAssistantId && row.id === currentAssistantId) continue;
		if (saving && !seenUser) continue;
		indexes.push(i);
		if (!saving) break;
	}
	return indexes.reverse();
}

/** 本轮和上一轮可合并的语句卡。没有句子的快照不参与。 */
export function classicCards(
	lists: ElResourceListPayload[],
): ElResourceListPayload[] {
	return lists.filter(
		(row) => row.contentKind === 'classic' && (row.items?.length ?? 0) > 0,
	);
}

/** 无分类标记且行数等于库内总数时，这是整库，不能直接收藏。 */
export function quoteCardIsFull(
	card: ElResourceListPayload,
	quoteCount: number | null,
): boolean {
	if (card.filtered) return false;
	if (!card.libraryId || quoteCount == null || quoteCount < 0) return false;
	return (card.items?.length ?? 0) === quoteCount;
}

/** 两本库里的同一句只留一次。 */
export function dedupeEnglish(
	rows: Record<string, unknown>[],
): Record<string, unknown>[] {
	const seen = new Set<string>();
	const items: Record<string, unknown>[] = [];
	for (const row of rows) {
		const english = typeof row.english === 'string' ? row.english.trim() : '';
		const key = english.toLowerCase();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		items.push(row);
	}
	return items;
}

export function dedupeWord(
	rows: Record<string, unknown>[],
): Record<string, unknown>[] {
	const seen = new Set<string>();
	const items: Record<string, unknown>[] = [];
	for (const row of rows) {
		const word =
			typeof row.word === 'string' ? row.word.trim().toLowerCase() : '';
		if (!word || seen.has(word)) continue;
		seen.add(word);
		items.push(row);
	}
	return items;
}

function rowItems(items: unknown[] | undefined): Record<string, unknown>[] {
	return (items ?? []).filter(
		(row): row is Record<string, unknown> =>
			!!row && typeof row === 'object' && !Array.isArray(row),
	);
}

/** 只认恰好这一类的卡。多类合并卡不能当成其中一类，否则家庭会带出问候。 */
function cachedLabelItems(
	cards: ElResourceListPayload[],
	libraryId: string,
	label: string,
	kind: 'vocab' | 'classic',
): Record<string, unknown>[] | null {
	for (let i = cards.length - 1; i >= 0; i -= 1) {
		const card = cards[i];
		if (card.libraryId !== libraryId || card.contentKind !== kind) continue;
		if (!card.filtered) continue;
		const names = card.categoryLabels ?? [];
		if (names.length !== 1 || names[0] !== label) continue;
		const items = rowItems(card.items);
		if (!items.length) continue;
		return items;
	}
	return null;
}

/** 类别集合相同才复用整张合并卡。 */
function cachedLabelSet(
	cards: ElResourceListPayload[],
	libraryId: string,
	labels: string[],
	kind: 'vocab' | 'classic',
): Record<string, unknown>[] | null {
	const want = [...labels].sort().join('\n');
	for (let i = cards.length - 1; i >= 0; i -= 1) {
		const card = cards[i];
		if (card.libraryId !== libraryId || card.contentKind !== kind) continue;
		if (!card.filtered) continue;
		const got = [...(card.categoryLabels ?? [])].sort().join('\n');
		if (got !== want) continue;
		const items = rowItems(card.items);
		if (!items.length) continue;
		return items;
	}
	return null;
}

function quoteRows(items: unknown[]): Record<string, unknown>[] {
	return items.filter(
		(row): row is Record<string, unknown> =>
			!!row && typeof row === 'object' && !Array.isArray(row),
	);
}

/**
 * 分类卡整卡进入。整库卡只用类别原文筛选；没有类别原文则跳过，避免收进整库。
 */
export async function rowsFromQuoteCards(
	learning: EnglishLearningService,
	config: ConfigService,
	userId: number,
	cards: ElResourceListPayload[],
	categoryText: string,
	signal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
	const rows: Record<string, unknown>[] = [];
	const counts = new Map<string, number | null>();
	for (const card of cards) {
		const items = quoteRows(card.items ?? []);
		if (!items.length) continue;
		let quoteCount: number | null = null;
		if (!card.filtered && card.libraryId) {
			const cached = counts.get(card.libraryId);
			if (cached !== undefined) {
				quoteCount = cached;
			} else {
				try {
					const page = await learning.listClassicQuotesLibraryItems(
						userId,
						card.libraryId,
						{ limit: 1, offset: 0 },
					);
					quoteCount =
						typeof page.library.quoteCount === 'number'
							? page.library.quoteCount
							: null;
				} catch {
					quoteCount = null;
				}
				counts.set(card.libraryId, quoteCount);
			}
		}
		if (!quoteCardIsFull(card, quoteCount)) {
			rows.push(...items);
			continue;
		}
		if (!categoryText) continue;
		const built = await buildCategoryProposal(
			items,
			categoryText,
			(chunk, text) => classifyChunk(config, chunk, text, signal),
			signal,
		);
		rows.push(...built.bodies);
	}
	return rows;
}

export function buildEnglishLearningDomainTools(
	deps: BuildEnglishLearningDomainToolsDeps,
): DynamicTool[] {
	const budgets: Budgets = { elWrites: 0, openProposalId: null, lastSig: '' };
	const intent = resolveEnglishIntent(deps.surface.userText, {
		priorUserTexts: deps.surface.priorUserTexts,
		priorLibraryCards: deps.surface.priorLibraryCards,
		openProposalKind: deps.surface.openProposalId ?? null,
	});
	deps.surface.intent = intent;
	const favoriteIntent = favoriteIntentFrom(intent);
	deps.surface.favoriteIntent = favoriteIntent;
	const favorite = favoriteAsk(deps.surface.userText);
	const bothAsk = favoriteAsksBoth(deps.surface.userText);
	const occupy = (id: string) => {
		budgets.openProposalId = id;
		deps.surface.openProposalId = id;
	};
	const rememberQuoteCard = (payload: ElResourceListPayload) => {
		if (payload.contentKind !== 'classic' || !payload.items?.length) return;
		deps.surface.libraryLists.push(payload);
	};
	const rememberVocabCard = (payload: ElResourceListPayload) => {
		if (!bothAsk || payload.contentKind !== 'vocab' || !payload.items?.length)
			return;
		deps.surface.vocabLists.push(payload);
	};
	const loadCatalog = async (kind: 'vocab' | 'classic') => {
		if (deps.surface.catalogKind === kind && deps.surface.catalog.length > 0) {
			return deps.surface.catalog;
		}
		const all = await fetchAllPages(PAGE_LIBS, async (limit, offset) => {
			const page =
				kind === 'vocab'
					? await deps.learning.listVocabularyLibraries(deps.userId, {
							limit,
							offset,
						})
					: await deps.learning.listClassicQuotesLibraries(deps.userId, {
							limit,
							offset,
						});
			return {
				items: page.items.map((it) => ({ id: it.id, title: it.title })),
			};
		});
		deps.surface.catalog = all.items;
		deps.surface.catalogKind = kind;
		return all.items;
	};

	const wrap = (
		name: string,
		description: string,
		handler: (args: Record<string, unknown>) => Promise<ElEnvelope>,
	): DynamicTool =>
		new DynamicTool({
			name,
			description,
			func: async (raw: string) => {
				const t0 = Date.now();
				let op = '';
				let code: string | undefined;
				let ok = false;
				try {
					const sig = `${name}\n${raw.trim()}`;
					if (sig === budgets.lastSig) {
						const env = elFail(
							'el_limit',
							'同样的查询已经做过。用已有结果直接作答。不要向用户提及次数或上限。',
						);
						code = env.code;
						return stringifyEnvelope(env);
					}
					budgets.lastSig = sig;
					let args: Record<string, unknown>;
					try {
						args = parseElArgs(raw);
					} catch {
						const env = elFail('bad_args', '参数须为 JSON 对象');
						code = env.code;
						return stringifyEnvelope(env);
					}
					op = asOp(args.op) || '(none)';
					if (isIndexOp(name, op) || isSearchOp(name, op)) {
						const paged = await pageIndex(deps, args);
						if (paged) return stringifyEnvelope(paged);
					}
					const env = await handler(args);
					ok = env.ok;
					code = env.code;
					if (env.ok && env.data !== undefined) {
						harvestWhitelist(env.data, deps.whitelist);
					}
					const hideCard = isIndexOp(name, op) || isSearchOp(name, op);
					const noteOpen = name === 'el_notes' && op === 'get';
					const inventory =
						hideCard &&
						isIndexOp(name, op) &&
						listIntent(deps.surface.userText) === 'inventory';
					/** 复合问「有哪些库 + 关于类」：挂库列表卡，但不标 presented，以免挡住后续 classify */
					const catalogAsk =
						name === 'el_libraries' &&
						op === 'list' &&
						wantsLibraryCatalog(deps.surface.userText);
					const spilled = await spillListResult(
						name,
						env,
						(row) => deps.artifacts.put(deps.userId, row),
						{
							slim: hideCard || noteOpen,
							always: hideCard || noteOpen || catalogAsk,
							inventory,
						},
					);
					if (spilled) {
						if (noteOpen) {
							const noteId = noteIdFromCardItems(spilled.full.items);
							if (noteId) deps.surface.shownLibraryIds.add(noteId);
							deps.surface.shownLibraryIds.add(spilled.full.artifactId);
							deps.surface.presented = true;
							deps.onResourceList?.(spilled.full);
							const data = spilled.model.data;
							if (data && typeof data === 'object' && !Array.isArray(data)) {
								const record = data as { items?: unknown[] };
								if (Array.isArray(record.items)) {
									record.items = record.items.map(slimRow);
								}
							}
							spilled.model.message =
								'卡片已列出这篇笔记。回执只有标题和开头 24 字。禁止再 el_present，禁止再出一张，禁止复述全文。';
							return stringifyEnvelope(spilled.model);
						}
						if (
							name === 'el_packs' &&
							op === 'generate' &&
							spilled.model.message
						) {
							spilled.model.message +=
								' 条数以原话为准，没写则是 100，禁止说成 12000 或 6000。';
						}
						if (
							inventory &&
							name === 'el_items_search' &&
							spilled.full.libraryId
						) {
							const kind =
								spilled.full.contentKind === 'classic' ? 'classic' : 'vocab';
							await loadCatalog(kind);
							const libraryId = spilled.full.libraryId;
							const decision = inventoryCardDecision(
								deps.surface.userText,
								deps.surface.catalog,
								libraryId,
								deps.surface.shownLibraryIds,
							);
							if (decision === 'hang') {
								deps.surface.shownLibraryIds.add(libraryId);
								if ((spilled.full.items?.length ?? 0) > 0) {
									deps.surface.presented = true;
								}
								deps.surface.libraryLists.push(spilled.full);
								deps.onResourceList?.(spilled.full);
							} else if (decision === 'skip-shown') {
								spilled.model.message = '整库卡片已经列出，禁止再出一张。';
							} else {
								const hits = matchLibraries(
									deps.surface.userText,
									deps.surface.catalog,
								);
								spilled.model.message =
									hits.length === 1
										? `没有挂出单词卡。原话只对上「${hits[0].title}」。请 list 该库，禁止写已经生成，也不要写见上方或见下方。`
										: '没有挂出单词卡。禁止写已经生成，也不要写见上方或见下方。请用户说出完整库名。';
							}
							return stringifyEnvelope(spilled.model);
						}
						if (inventory) {
							deps.surface.libraryLists.push(spilled.full);
							if ((spilled.full.items?.length ?? 0) > 0) {
								deps.surface.presented = true;
							}
							deps.surface.shownLibraryIds.add(
								spilled.full.libraryId ?? spilled.full.artifactId,
							);
							deps.onResourceList?.(spilled.full);
						} else if (catalogAsk) {
							deps.surface.libraryLists.push(spilled.full);
							deps.surface.shownLibraryIds.add(spilled.full.artifactId);
							deps.onResourceList?.(spilled.full);
							spilled.model.message = [
								spilled.model.message,
								'库列表卡片已列出。禁止用 Markdown 表复述库名。若还要按类别筛选，继续 classify，不要声称库卡未列出。',
							]
								.filter(Boolean)
								.join(' ');
						} else if (isIndexOp(name, op)) {
							deps.surface.libraryLists.push(spilled.full);
						} else if (!hideCard) deps.onResourceList?.(spilled.full);
						return stringifyEnvelope(spilled.model);
					}
					return stringifyEnvelope(env);
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e);
					deps.logger.warn?.(`[el_tool] ${name} op=${op} error=${msg}`);
					code = 'unavailable';
					return stringifyEnvelope(
						elFail('unavailable', msg.slice(0, 200) || '工具执行失败'),
					);
				} finally {
					deps.logger.log?.(
						`[el_tool] tool=${name} op=${op} ok=${ok} code=${code ?? '-'} userId=${deps.userId} latencyMs=${Date.now() - t0}`,
					);
				}
			},
		});

	const libraries = wrap(
		'el_libraries',
		'列出或对比英语学习词库/语料库。入参 JSON：{"op":"list"|"compare","kind":"vocab"|"classic","libraryIdA?:string","libraryIdB?:string","title?:string"}。list 一次拉全；多库同名看 ambiguous，禁止猜测。',
		async (args) => {
			const op = asOp(args.op);
			const kind = kindOf(args);
			if (op === 'list') {
				const titleQ = asString(args.title)?.trim().toLowerCase();
				const all = await fetchAllPages(PAGE_LIBS, async (limit, offset) => {
					const page =
						kind === 'vocab'
							? await deps.learning.listVocabularyLibraries(deps.userId, {
									limit,
									offset,
								})
							: await deps.learning.listClassicQuotesLibraries(deps.userId, {
									limit,
									offset,
								});
					return {
						items: page.items.map((it) => ({
							id: it.id,
							title: it.title,
							count: 'wordCount' in it ? it.wordCount : it.quoteCount,
							isPublic: it.isPublic,
							isOwned: it.isOwned,
						})),
					};
				});
				let items = all.items;
				deps.surface.catalog = all.items.map((it) => ({
					id: it.id,
					title: it.title,
				}));
				deps.surface.catalogKind = kind;
				const inventoryAsk = listIntent(deps.surface.userText) === 'inventory';
				const inventoryHits = inventoryAsk
					? matchLibraries(deps.surface.userText, deps.surface.catalog)
					: [];
				if (titleQ) {
					const matched = items.filter((it) =>
						it.title.toLowerCase().includes(titleQ),
					);
					if (matched.length === 0) {
						return elFail('not_found', `未找到标题含「${titleQ}」的库`, {
							candidates: items.slice(0, 10),
						});
					}
					if (matched.length > 1) {
						return elFail('ambiguous', '多个库标题匹配，请让用户选择 id', {
							candidates: matched.slice(0, 10),
						});
					}
					items = matched;
				}
				return elOk(
					{
						kind,
						items,
						returned: items.length,
						totalCount: titleQ ? items.length : all.totalCount,
					},
					{
						meta: {
							total: titleQ ? items.length : all.totalCount,
							limit: items.length,
							truncated: titleQ ? false : all.truncated,
						},
						message:
							[
								all.truncated
									? unmetTotal(all.items.length, all.totalCount)
									: '',
								inventoryAsk
									? inventoryHits.length === 1
										? `原话只对上库「${inventoryHits[0].title}」（id=${inventoryHits[0].id}）。请对该 id 调用 el_items_search list，卡片由工具挂上。`
										: '没有挂出单词卡。禁止写已经生成，也不要写见上方或见下方。请用户说出完整库名。'
									: '',
							]
								.filter(Boolean)
								.join(' ') || undefined,
						ui: [
							{
								type: 'navigate',
								href:
									kind === 'vocab'
										? '/english-learning/library?kind=vocab'
										: '/english-learning/library?kind=classic',
								label: '打开库列表',
							},
						],
					},
				);
			}
			if (op === 'compare') {
				const a = asString(args.libraryIdA)?.trim();
				const b = asString(args.libraryIdB)?.trim();
				if (!a || !b) {
					return elFail('bad_args', 'compare 需要 libraryIdA 与 libraryIdB');
				}
				const scan = 200;
				if (kind === 'vocab') {
					const [la, lb] = await Promise.all([
						deps.learning.listVocabularyLibraryItems(deps.userId, a, {
							limit: scan,
							offset: 0,
						}),
						deps.learning.listVocabularyLibraryItems(deps.userId, b, {
							limit: scan,
							offset: 0,
						}),
					]);
					const setB = new Set(
						lb.items.map((i) => i.word.trim().toLowerCase()),
					);
					const overlap = la.items
						.filter((i) => setB.has(i.word.trim().toLowerCase()))
						.map((i) => i.word)
						.slice(0, 20);
					return elOk({
						kind,
						libraryIdA: a,
						libraryIdB: b,
						overlapCount: overlap.length,
						overlapSample: overlap,
						scannedEach: scan,
					});
				}
				const [la, lb] = await Promise.all([
					deps.learning.listClassicQuotesLibraryItems(deps.userId, a, {
						limit: scan,
						offset: 0,
					}),
					deps.learning.listClassicQuotesLibraryItems(deps.userId, b, {
						limit: scan,
						offset: 0,
					}),
				]);
				const setB = new Set(
					lb.items.map((i) => i.english.trim().toLowerCase()),
				);
				const overlap = la.items
					.filter((i) => setB.has(i.english.trim().toLowerCase()))
					.map((i) => i.english.slice(0, 80))
					.slice(0, 20);
				return elOk({
					kind,
					libraryIdA: a,
					libraryIdB: b,
					overlapCount: overlap.length,
					overlapSample: overlap,
					scannedEach: scan,
				});
			}
			return elFail('bad_args', 'el_libraries 支持 op=list|compare');
		},
	);

	const itemsSearch = wrap(
		'el_items_search',
		'词库/语料库条目：list / search / sample。' +
			'入参 JSON：{"op":"list"|"search"|"sample","kind":"vocab"|"classic","libraryId?:string","q?:string","limit?:number","artifactId?:string","offset?:number"}。' +
			'整库问法且原话只对上一个库名时，list 挂上整库卡，回执写「卡片已列出」。回执写「没有挂出单词卡」时禁止声称已生成。其他 list 返回瘦索引且不出卡。search 不出卡，要看再 el_present。sample 才随机抽少量。',
		async (args) => {
			const op = asOp(args.op);
			const kind = kindOf(args);
			const limit = clampLimit(args.limit, 10);
			const libraryId = asString(args.libraryId)?.trim();

			if (
				libraryId &&
				deps.surface.intent?.kind === 'category_filter' &&
				!deps.surface.presented &&
				(op === 'list' || op === 'search')
			) {
				const known = deps.surface.catalog.find((row) => row.id === libraryId);
				const filterKind =
					kind === 'classic' || deps.surface.catalogKind === 'classic'
						? 'classic'
						: 'vocab';
				const labels = categoryLabels(deps.surface.userText);
				if (labels.length) {
					const listed = await presentByLabels(
						filterKind,
						[{ id: libraryId, title: known?.title ?? libraryId }],
						labels,
					);
					return elOk(
						{ libraryId, totalCount: listed.items.length },
						{
							message: listed.items.length
								? '卡片已列出。禁止再 search 或 el_present。filter_shown'
								: listed.failed
									? '有批未能判断。禁止再 search。filter_shown'
									: '没有可展示的行。禁止再 search。filter_shown',
						},
					);
				}
				const jobKey = `${filterKind}:${libraryId}`;
				let job = deps.surface.categoryJobs.get(jobKey);
				const owner = !job;
				if (!job) {
					job = filterLibraryFallback(
						deps.learning,
						deps.config,
						deps.userId,
						{ id: libraryId, title: known?.title ?? libraryId },
						deps.surface.userText,
						deps.logger,
						filterKind,
					);
					deps.surface.categoryJobs.set(jobKey, job);
				}
				const draft = await job;
				if (!owner) {
					return elOk(
						{ libraryId, alreadyShown: true },
						{
							message: '卡片已列出。禁止再 search 或 el_present。filter_shown',
						},
					);
				}
				if (!draft) {
					return elOk(
						{ libraryId, matched: 0 },
						{ message: '没有可展示的行。禁止再 search。filter_shown' },
					);
				}
				const artifactId = await deps.artifacts.put(deps.userId, draft);
				const payload = { ...draft, artifactId };
				deps.surface.presented = true;
				deps.surface.shownLibraryIds.add(libraryId);
				rememberQuoteCard(payload);
				rememberVocabCard(payload);
				deps.onResourceList?.(payload);
				return elOk(
					{ artifactId, totalCount: payload.totalCount },
					{
						message: '卡片已列出。禁止再 search 或 el_present。filter_shown',
					},
				);
			}

			if (op === 'list') {
				if (!libraryId) return elFail('bad_args', 'list 需要 libraryId');
				if (listIntent(deps.surface.userText) === 'inventory') {
					const head = 5;
					if (kind === 'vocab') {
						const page = await deps.learning.listVocabularyLibraryItems(
							deps.userId,
							libraryId,
							{ limit: head, offset: 0 },
						);
						const totalCount =
							typeof page.library.wordCount === 'number'
								? page.library.wordCount
								: page.items.length;
						const items = page.items.slice(0, head).map((i) => ({
							libraryId,
							libraryTitle: page.library.title,
							word: i.word,
							ipa: i.ipa,
							pos: i.pos,
							translationZh: i.translationZh,
							example: i.example,
						}));
						return elOk(
							{
								kind,
								libraryId,
								items,
								returned: items.length,
								totalCount,
							},
							{
								meta: {
									total: totalCount,
									truncated: false,
									limit: items.length,
								},
							},
						);
					}
					const page = await deps.learning.listClassicQuotesLibraryItems(
						deps.userId,
						libraryId,
						{ limit: head, offset: 0 },
					);
					const totalCount =
						typeof page.library.quoteCount === 'number'
							? page.library.quoteCount
							: page.items.length;
					const items = page.items.slice(0, head).map((i) => ({
						libraryId,
						libraryTitle: page.library.title,
						english: i.english,
						translationZh: i.translationZh,
						source: i.source,
						noteZh: i.noteZh,
					}));
					return elOk(
						{
							kind,
							libraryId,
							items,
							returned: items.length,
							totalCount,
						},
						{
							meta: {
								total: totalCount,
								truncated: false,
								limit: items.length,
							},
						},
					);
				}
				if (kind === 'vocab') {
					const all = await fetchAllPages(
						PAGE_LIB_ITEMS,
						async (lim, offset) => {
							const page = await deps.learning.listVocabularyLibraryItems(
								deps.userId,
								libraryId,
								{ limit: lim, offset },
							);
							return {
								items: page.items.map((i) => ({
									libraryId,
									word: i.word,
									ipa: i.ipa,
									pos: i.pos,
									translationZh: i.translationZh,
									example: i.example,
								})),
								totalCount:
									typeof page.library.wordCount === 'number'
										? page.library.wordCount
										: undefined,
							};
						},
					);
					return elOk(
						{
							kind,
							libraryId,
							items: all.items,
							returned: all.items.length,
							totalCount: all.totalCount,
						},
						{
							meta: {
								total: all.totalCount,
								limit: all.items.length,
								truncated: all.truncated,
							},
							message: all.truncated
								? unmetTotal(all.items.length, all.totalCount)
								: undefined,
						},
					);
				}
				const all = await fetchAllPages(PAGE_LIB_ITEMS, async (lim, offset) => {
					const page = await deps.learning.listClassicQuotesLibraryItems(
						deps.userId,
						libraryId,
						{ limit: lim, offset },
					);
					return {
						items: page.items.map((i) => ({
							libraryId,
							english: i.english,
							translationZh: i.translationZh,
							source: i.source,
							noteZh: i.noteZh,
						})),
						totalCount:
							typeof page.library.quoteCount === 'number'
								? page.library.quoteCount
								: undefined,
					};
				});
				return elOk(
					{
						kind,
						libraryId,
						items: all.items,
						returned: all.items.length,
						totalCount: all.totalCount,
					},
					{
						meta: {
							total: all.totalCount,
							limit: all.items.length,
							truncated: all.truncated,
						},
						message: all.truncated
							? unmetTotal(all.items.length, all.totalCount)
							: undefined,
					},
				);
			}

			if (op === 'search') {
				const q = asString(args.q)?.trim() ?? '';
				if (!q) return elFail('bad_args', 'search 需要非空 q');
				// 搜索是匹配窗，不是把库列完
				const searchLimit = SEARCH_MATCH_LIMIT;
				if (kind === 'vocab') {
					const { items } = await deps.learning.searchVocabularyLibraryItems(
						deps.userId,
						{ libraryId, q, limit: searchLimit },
					);
					return elOk(
						{ kind, items, returned: items.length },
						{
							meta: {
								limit: searchLimit,
								total: items.length,
								truncated: items.length >= searchLimit,
							},
						},
					);
				}
				const { items } = await deps.learning.searchClassicQuotesLibraryItems(
					deps.userId,
					{ libraryId, q, limit: searchLimit },
				);
				return elOk(
					{ kind, items, returned: items.length },
					{
						meta: {
							limit: searchLimit,
							total: items.length,
							truncated: items.length >= searchLimit,
						},
					},
				);
			}
			if (op === 'sample') {
				const q = asString(args.q)?.trim() || undefined;
				if (kind === 'vocab') {
					if (q) {
						const { items } = await deps.learning.searchVocabularyLibraryItems(
							deps.userId,
							{ libraryId, q, limit: Math.min(40, limit * 2) },
						);
						const shuffled = [...items].sort(() => Math.random() - 0.5);
						return elOk({ kind, items: shuffled.slice(0, limit) });
					}
					if (!libraryId) {
						return elFail('bad_args', '无 q 时 sample 需要 libraryId');
					}
					const page = await deps.learning.listVocabularyLibraryItems(
						deps.userId,
						libraryId,
						{ limit: Math.min(200, PAGE_LIB_ITEMS), offset: 0 },
					);
					const shuffled = [...page.items].sort(() => Math.random() - 0.5);
					return elOk({
						kind,
						items: shuffled.slice(0, limit).map((i) => ({
							libraryId,
							word: i.word,
							ipa: i.ipa,
							pos: i.pos,
							translationZh: i.translationZh,
							example: i.example,
						})),
					});
				}
				if (q) {
					const { items } = await deps.learning.searchClassicQuotesLibraryItems(
						deps.userId,
						{ libraryId, q, limit: Math.min(40, limit * 2) },
					);
					const shuffled = [...items].sort(() => Math.random() - 0.5);
					return elOk({ kind, items: shuffled.slice(0, limit) });
				}
				if (!libraryId) {
					return elFail('bad_args', '无 q 时 sample 需要 libraryId');
				}
				const page = await deps.learning.listClassicQuotesLibraryItems(
					deps.userId,
					libraryId,
					{ limit: Math.min(200, PAGE_LIB_ITEMS), offset: 0 },
				);
				const shuffled = [...page.items].sort(() => Math.random() - 0.5);
				return elOk({
					kind,
					items: shuffled.slice(0, limit).map((i) => ({
						libraryId,
						english: i.english,
						translationZh: i.translationZh,
						source: i.source,
						noteZh: i.noteZh,
					})),
				});
			}
			return elFail('bad_args', 'el_items_search 支持 list|search|sample');
		},
	);

	const present = wrap(
		'el_present',
		'把本轮已拉到的清单中、用户这次要看的行做成卡片。' +
			'入参 JSON：{"artifactId":"list 回执里的 id","mode":"subset"|"all","words"?:string[],"title"?:string}。' +
			'筛选题必须 mode=subset，words 只传命中 id（阅读）或词面（词条）。整表用 mode=all。成组列出只写组标题后调用，禁止再写顿号或逗号词表。禁止向用户提及导出。' +
			'对不上 artifact 的词会被丢弃。零命中不出卡片。',
		async (args) => {
			const artifactId = asString(args.artifactId)?.trim();
			if (!artifactId) return elFail('bad_args', 'el_present 需要 artifactId');
			const words = Array.isArray(args.words)
				? args.words.filter((w): w is string => typeof w === 'string')
				: [];
			const mode =
				args.mode === 'all' || args.mode === 'subset'
					? args.mode
					: words.length
						? 'subset'
						: '';
			if (mode !== 'all' && mode !== 'subset') {
				return elFail(
					'bad_args',
					'需要 mode=all，或 mode=subset 且 words 非空',
				);
			}
			if (mode === 'subset' && words.length === 0) {
				return elFail('bad_args', 'subset 需要 words');
			}
			const artifact = await deps.artifacts.get(deps.userId, artifactId);
			if (!artifact?.items?.length) {
				return elFail('not_found', '清单不存在或已过期，请重新 list');
			}
			if (
				cardAlreadyShown([artifactId], deps.surface.shownLibraryIds) ||
				cardAlreadyShown([artifact.libraryId], deps.surface.shownLibraryIds)
			) {
				return elOk(
					{ alreadyShown: true, artifactId },
					{ message: '这张卡片已经列出，禁止再出一张。' },
				);
			}
			const { matched, dropped } = presentRows(artifact.items, mode, words);
			if (
				presentTooWide(
					listIntent(deps.surface.userText),
					mode,
					matched.length,
					artifact.items.length,
				)
			) {
				return elFail(
					'present_too_wide',
					'这是筛选问题，不要提交整库。请 mode=subset，words 只包含命中的词面',
				);
			}
			if (!matched.length) {
				return elOk(
					{ matched: 0, dropped },
					{
						message: dropped.length
							? `没有命中。这些词不在该清单中：${dropped.slice(0, 20).join('、')}`
							: '没有可展示的行',
					},
				);
			}
			const matchedIds = matched.map((item) =>
				item &&
				typeof item === 'object' &&
				typeof (item as { id?: unknown }).id === 'string'
					? (item as { id: string }).id
					: undefined,
			);
			if (cardAlreadyShown(matchedIds, deps.surface.shownLibraryIds)) {
				return elOk(
					{ alreadyShown: true, artifactId },
					{ message: '这些内容的卡片已经列出，禁止再出一张。' },
				);
			}
			const fit = fitItemsByChars({ title: artifact.title }, matched);
			const shown = fit.items.length;
			const liveLibrary =
				mode === 'all' &&
				Boolean(artifact.libraryId) &&
				(artifact.contentKind === 'vocab' ||
					artifact.contentKind === 'classic');
			const total = mode === 'all' ? artifact.totalCount : matched.length;
			const fullCard = liveLibrary || (shown === total && !fit.truncated);
			const base = shownTitle(
				asString(args.title)?.trim().slice(0, 40) ?? '',
				fullCard,
				artifact.title,
			);
			const title =
				!liveLibrary && fit.truncated
					? `${base}（已列出 ${shown} / ${matched.length}）`
					: base;
			const cardBase = {
				title,
				source: artifact.source,
				...(artifact.contentKind ? { contentKind: artifact.contentKind } : {}),
				...(liveLibrary ? { libraryId: artifact.libraryId } : {}),
				totalCount: total,
				truncated: liveLibrary
					? false
					: fit.truncated || (mode === 'all' && artifact.truncated),
				items: fit.items,
			};
			const cardId = await deps.artifacts.put(deps.userId, cardBase);
			const shownCard = { ...cardBase, artifactId: cardId };
			deps.surface.presented = true;
			rememberQuoteCard(shownCard);
			rememberVocabCard(shownCard);
			deps.onPresented?.(shownCard);
			const counted = liveLibrary
				? `卡片已列出全部 ${artifact.totalCount} 条。不要写已列出若干条、未穷尽或展示上限。`
				: fullCard
					? `卡片已列出全部 ${shown} 条。禁止写尚未展示、前若干条或还有剩余。`
					: `卡片已列出 ${shown} / 共 ${total} 条。按这个条数说明，不要改成上下文页大小。`;
			return elOk(
				{
					matched: shown,
					dropped,
					total: artifact.items.length,
					truncated: cardBase.truncated,
				},
				{
					message: dropped.length
						? `${counted}已忽略不在该清单中的词：${dropped.slice(0, 20).join('、')}`
						: counted,
				},
			);
		},
	);

	const dailyReading = wrap(
		'el_daily_reading',
		'每日阅读：today/get/list/settings/generate_manual/gen_status。' +
			'list 用 origin=all 拉全部标题索引（id、中英标题、日期、开头 24 字），可选 q 做标题/开头子串；不出整表卡。' +
			'索引放不下时用 artifactId+offset 翻页。筛选后 el_present 传 id。get 最多核对 3 篇，禁止逐篇 get。' +
			'generate_manual 是自选生成，只挂确认条，用户点确认后才写入。长篇、短篇、中篇或「主题关于…」走这里，不要传 themes 或 profile，也不要触发系统日推。',
		async (args) => {
			const op = asOp(args.op);
			if (op === 'today') {
				const list = await deps.dailyReading.list(deps.userId, 1, 0, 'day');
				const today = list.today;
				if (!today) {
					return elOk({
						publishDate: shanghaiToday(),
						status: list.todayStatus,
						item: null,
					});
				}
				return elOk({
					publishDate: shanghaiToday(),
					status: list.todayStatus,
					item: {
						id: today.id,
						titleEn: today.titleEn,
						titleZh: today.titleZh,
						publishDate: today.publishDate,
						bodyPreview: (today.bodyEn ?? '').slice(0, 400),
					},
				});
			}
			if (op === 'get') {
				const id = asString(args.id)?.trim();
				if (!id) return elFail('bad_args', 'get 需要 id');
				const row = await deps.dailyReading.get(id, deps.userId);
				const glossary = Array.isArray(row.extras?.glossary)
					? row.extras.glossary.slice(0, 20)
					: [];
				return elOk({
					id: row.id,
					titleEn: row.titleEn,
					titleZh: row.titleZh,
					publishDate: row.publishDate,
					origin: row.origin,
					bodyEn: (row.bodyEn ?? '').slice(0, 3500),
					glossary,
				});
			}
			if (op === 'list') {
				const originRaw = asString(args.origin)?.trim().toLowerCase();
				const q = asString(args.q)?.trim() ?? '';
				const mapItem = (
					it: {
						id: string;
						titleEn: string;
						titleZh: string;
						publishDate: string;
						bodyZh?: string;
						bodyEn?: string;
					},
					origin: 'day' | 'manual',
				) => ({
					id: it.id,
					titleEn: it.titleEn,
					titleZh: it.titleZh,
					publishDate: it.publishDate,
					origin,
					lead: (it.bodyZh || it.bodyEn || '').slice(0, 24),
				});
				const applyQ = <
					T extends { titleEn: string; titleZh: string; lead: string },
				>(
					items: T[],
				): { items: T[]; literalMiss: boolean } => {
					if (!q) return { items, literalMiss: false };
					const n = q.toLowerCase();
					const matched = items.filter(
						(it) =>
							it.titleEn.toLowerCase().includes(n) ||
							it.titleZh.toLowerCase().includes(n) ||
							it.lead.toLowerCase().includes(n),
					);
					if (
						!matched.length &&
						listIntent(deps.surface.userText) === 'filter'
					) {
						return { items, literalMiss: true };
					}
					return { items: matched, literalMiss: false };
				};

				let todayStatus: 'ready' | 'generating' | 'exhausted' = 'generating';
				const fetchOrigin = (origin: 'day' | 'manual') =>
					fetchAllPages(PAGE_READING, async (lim, offset) => {
						const page = await deps.dailyReading.list(
							deps.userId,
							lim,
							offset,
							origin,
						);
						if (origin === 'day' && offset === 0) {
							todayStatus = page.todayStatus;
						}
						return {
							items: page.items.map((it) => mapItem(it, origin)),
							totalCount: page.totalCount,
						};
					});

				if (!originRaw || originRaw === 'all') {
					const [system, manual] = await Promise.all([
						fetchOrigin('day'),
						fetchOrigin('manual'),
					]);
					const sysQ = applyQ(system.items);
					const manQ = applyQ(manual.items);
					const literalMiss = sysQ.literalMiss || manQ.literalMiss;
					const totalCount = literalMiss
						? system.totalCount + manual.totalCount
						: sysQ.items.length + manQ.items.length;
					return elOk(
						{
							origin: 'all',
							todayStatus,
							system: {
								totalCount: literalMiss ? system.totalCount : sysQ.items.length,
								returned: sysQ.items.length,
								hasMore: system.truncated,
								items: sysQ.items,
							},
							manual: {
								totalCount: literalMiss ? manual.totalCount : manQ.items.length,
								returned: manQ.items.length,
								hasMore: manual.truncated,
								items: manQ.items,
							},
							totalCount,
						},
						{
							meta: {
								limit: sysQ.items.length + manQ.items.length,
								truncated: system.truncated || manual.truncated,
								total: totalCount,
							},
							message: literalMiss
								? LITERAL_MISS
								: system.truncated || manual.truncated
									? unmetTotal(
											system.items.length + manual.items.length,
											system.totalCount + manual.totalCount,
										)
									: undefined,
						},
					);
				}
				const origin =
					originRaw === 'manual' ? ('manual' as const) : ('day' as const);
				const page = await fetchOrigin(origin);
				if (origin === 'manual') {
					const dayMeta = await deps.dailyReading.list(
						deps.userId,
						1,
						0,
						'day',
					);
					todayStatus = dayMeta.todayStatus;
				}
				const filtered = applyQ(page.items);
				return elOk(
					{
						origin,
						todayStatus,
						items: filtered.items,
						totalCount: filtered.literalMiss
							? page.totalCount
							: filtered.items.length,
						returned: filtered.items.length,
						hasMore: page.truncated,
					},
					{
						meta: {
							limit: filtered.items.length,
							total: filtered.literalMiss
								? page.totalCount
								: filtered.items.length,
							truncated: page.truncated,
						},
						message: filtered.literalMiss
							? LITERAL_MISS
							: page.truncated
								? unmetTotal(page.items.length, page.totalCount)
								: undefined,
					},
				);
			}
			if (op === 'settings') {
				const s = await deps.dailyReading.readingSettings(deps.userId);
				return elOk(
					{ themes: s.themes, profile: s.profile },
					{
						ui: [
							{
								type: 'navigate',
								href: '/english-learning/daily-reading/settings',
								label: '打开资源生成配置',
							},
						],
					},
				);
			}
			if (op === 'gen_status') {
				const peek = deps.dailyReading.peekManualRun(deps.userId);
				if (peek) {
					return elOk({ status: 'running', ...peek });
				}
				return elOk({ status: 'idle' });
			}
			if (op === 'generate_manual') {
				const existing = deps.dailyReading.peekManualRun(deps.userId);
				if (existing) {
					return elFail(
						'already_running',
						'已有自选生成进行中',
						{ runId: existing.runId, phase: existing.phase },
						[
							{
								type: 'navigate',
								href: '/english-learning/daily-reading/settings',
								label: '查看生成进度',
							},
						],
					);
				}
				if (budgets.openProposalId) {
					return elFail('stop_tools', '本轮已有待确认提案，停止工具调用', {
						proposalId: budgets.openProposalId,
					});
				}
				const saved = await deps.dailyReading.readingSettings(deps.userId);
				const manual = await resolveAgentManualAsk(
					deps.config,
					{ themes: saved.themes, profile: saved.profile },
					deps.surface.userText,
				);
				const proposalId = await deps.proposals.put(deps.userId, {
					kind: 'reading_generate',
					contentKind: 'classic',
					body: {
						themes: manual.themes,
						profile: manual.profile,
					},
				});
				occupy(proposalId);
				return elOk(
					{ proposalId, themes: manual.themes, profile: manual.profile },
					{
						message: `请用户确认后再写入。${manualReceipt(manual)}`,
						ui: [
							{
								type: 'confirm_proposal',
								proposalId,
								label: '确认开始自选生成',
							},
						],
					},
				);
			}
			return elFail(
				'bad_args',
				'el_daily_reading 支持 today|get|list|settings|generate_manual|gen_status',
			);
		},
	);

	const proposeAdd = async (
		which: 'favorites' | 'mistakes',
		requestedKind: 'vocab' | 'classic',
		args: Record<string, unknown>,
	): Promise<ElEnvelope> => {
		if (budgets.openProposalId) {
			return elFail('stop_tools', '本轮已有待确认提案，停止工具调用', {
				proposalId: budgets.openProposalId,
			});
		}
		const inferred = inferContentKind(args);
		if (favorite?.kind === 'classic' && inferred !== 'classic') {
			return elFail('bad_args', '语句收藏需要 english，确认条未挂上');
		}
		let kind = requestedKind;
		if (favorite?.kind === 'classic') kind = 'classic';
		else if (favorite?.kind === 'vocab') kind = 'vocab';
		else kind = inferred;
		const artifactId = asString(args.artifactId)?.trim();
		const userText = deps.surface.userText.trim();
		if (
			which === 'favorites' &&
			deps.surface.favoriteIntent?.action === 'add' &&
			!/[A-Za-z]{2,}/.test(userText)
		) {
			return elOk(
				{ deferred: true },
				{
					message:
						'确认条按上面的卡片在本轮结束时挂上。不要再 propose_add，不要列举原话里没有的句子，也不要说已经发起收藏。',
				},
			);
		}
		const labels = categoryLabels(userText);
		if (which === 'favorites' && labels.length) {
			let labelKind: 'vocab' | 'classic' | null =
				favorite?.kind === 'vocab'
					? 'vocab'
					: favorite?.kind === 'classic'
						? 'classic'
						: null;
			if (!labelKind) {
				const fromHistory = new Set(
					deps.surface.labeledCards
						.map((card) => card.contentKind)
						.filter(
							(item): item is 'vocab' | 'classic' =>
								item === 'vocab' || item === 'classic',
						),
				);
				const inherited = inheritedKind(
					deps.surface.priorUserTexts,
					deps.surface.priorLibraryCards,
				);
				if (
					inherited &&
					(fromHistory.size === 0 || fromHistory.has(inherited))
				) {
					labelKind = inherited;
				} else if (fromHistory.size === 1) {
					labelKind = [...fromHistory][0];
				}
			}
			if (!labelKind) {
				return elFail('ambiguous', '没有唯一库。请让用户选定库名');
			}
			const picked = await pickLibraries(labelKind);
			if (!Array.isArray(picked)) return picked;
			const listed = await presentByLabels(labelKind, picked, labels);
			const items = listed.items;
			if (!items.length) {
				return elFail(
					'not_found',
					labelKind === 'vocab' ? '没有可收藏的词' : '没有可收藏的语句',
				);
			}
			const proposalId = await deps.proposals.put(deps.userId, {
				kind: 'favorite_add',
				contentKind: labelKind,
				body: items[0] ?? {},
				items,
			});
			occupy(proposalId);
			const n = items.length;
			const unit = labelKind === 'vocab' ? '个词' : '条语句';
			return elOk(
				{ proposalId, count: n },
				{
					message: '请用户确认后再写入',
					ui: [
						{
							type: 'confirm_proposal',
							proposalId,
							label: `确认收藏 ${n} ${unit}`,
						},
					],
				},
			);
		}
		let full: ElResourceListPayload | null = null;
		if (artifactId && kind === 'vocab') {
			if (!userText) return elFail('bad_args', '整类筛选需要用户原话');
			full = await deps.artifacts.get(deps.userId, artifactId);
			if (!full?.items?.length) {
				return elFail('not_found', '清单不存在或已过期');
			}
		} else if (kind === 'vocab' && userText) {
			full = latestLibraryRows(deps.surface, userText);
		}
		if (full?.items?.length && kind === 'vocab') {
			const rows = full.items.filter(
				(row): row is Record<string, unknown> =>
					!!row && typeof row === 'object' && !Array.isArray(row),
			);
			const built = await buildCategoryProposal(rows, userText, (chunk, text) =>
				classifyChunk(deps.config, chunk, text),
			);
			if (!built.bodies.length) {
				if (built.failedChunks > 0) {
					return elFail(
						'unavailable',
						`有 ${built.failedChunks} 批未能判断，没有可确认的词。不要说这个库里没有这类词`,
					);
				}
				return elFail(
					'not_found',
					which === 'mistakes' ? '没有可加入错题的词' : '没有可收藏的词',
				);
			}
			const gaps: Array<'list' | 'judge'> = [];
			if (full.truncated) gaps.push('list');
			if (built.failedChunks > 0) gaps.push('judge');
			const proposalId = await deps.proposals.put(deps.userId, {
				kind: which === 'favorites' ? 'favorite_add' : 'mistake_add',
				contentKind: 'vocab',
				body: built.bodies[0],
				items: built.bodies,
				truncated: gaps.length > 0,
				gaps,
			});
			occupy(proposalId);
			const cardId = await deps.artifacts.put(deps.userId, {
				title: which === 'mistakes' ? '将要加入错题的词' : '将要收藏的词',
				source: which === 'mistakes' ? 'mistakes' : 'favorites',
				contentKind: 'vocab',
				...(full.libraryId ? { libraryId: full.libraryId } : {}),
				totalCount: built.bodies.length,
				truncated: false,
				items: built.bodies,
			});
			deps.onPresented?.({
				artifactId: cardId,
				title: which === 'mistakes' ? '将要加入错题的词' : '将要收藏的词',
				source: which === 'mistakes' ? 'mistakes' : 'favorites',
				contentKind: 'vocab',
				...(full.libraryId ? { libraryId: full.libraryId } : {}),
				totalCount: built.bodies.length,
				truncated: false,
				items: built.bodies,
			});
			const n = built.bodies.length;
			const label =
				which === 'mistakes' ? `确认加入错题 ${n} 条` : `确认收藏 ${n} 个词`;
			const notes = ['请用户确认后再写入'];
			if (full.truncated) {
				notes.push(`只在已取出的 ${rows.length} 条里筛选过，清单未取尽`);
			}
			if (built.failedChunks > 0) {
				notes.push(`有 ${built.failedChunks} 批未能判断，这些词未纳入`);
			}
			return elOk(
				{ proposalId, count: n },
				{
					message: notes.join('。'),
					ui: [{ type: 'confirm_proposal', proposalId, label }],
				},
			);
		}
		const quoteAsk =
			which === 'favorites' &&
			(favorite?.kind === 'card' || favorite?.kind === 'classic');
		if (quoteAsk) {
			const cards = classicCards(deps.surface.libraryLists);
			const rows = await rowsFromQuoteCards(
				deps.learning,
				deps.config,
				deps.userId,
				cards,
				deps.surface.quoteCategoryText ?? '',
				deps.signal,
			);
			const items = dedupeEnglish(rows);
			if (items.length > 0) {
				const proposalId = await deps.proposals.put(deps.userId, {
					kind: 'favorite_add',
					contentKind: 'classic',
					body: items[0] ?? {},
					items,
				});
				occupy(proposalId);
				const n = items.length;
				return elOk(
					{ proposalId, count: n },
					{
						message: '请用户确认后再写入',
						ui: [
							{
								type: 'confirm_proposal',
								proposalId,
								label: `确认收藏 ${n} 条语句`,
							},
						],
					},
				);
			}
		}
		const built = collectProposeBodies(kind, args);
		if (!built.ok) return built.env;
		const proposalId = await deps.proposals.put(deps.userId, {
			kind: which === 'favorites' ? 'favorite_add' : 'mistake_add',
			contentKind: kind,
			body: built.items[0] ?? {},
			items: built.items,
		});
		occupy(proposalId);
		const n = built.items.length;
		const label =
			which === 'mistakes'
				? `确认加入错题 ${n} 条`
				: kind === 'vocab'
					? `确认收藏 ${n} 个词`
					: `确认收藏 ${n} 条语句`;
		return elOk(
			{
				proposalId,
				count: n,
				preview: built.items.map((row) => row.word ?? row.english),
			},
			{
				message: '请用户确认后再写入',
				ui: [{ type: 'confirm_proposal', proposalId, label }],
			},
		);
	};

	const commitProposal = async (
		allowed: Array<'favorite_add' | 'favorite_remove' | 'mistake_add'>,
		args: Record<string, unknown>,
	): Promise<ElEnvelope> => {
		const proposalId = asString(args.proposalId)?.trim();
		if (!proposalId) return elFail('bad_args', 'commit 需要 proposalId');
		if (budgets.openProposalId === proposalId) {
			return elFail('forbidden', '请等用户点确认，不要在本轮 commit');
		}
		if (budgets.elWrites >= ENGLISH_EL_WRITE_RUN_LIMIT) {
			return elFail('write_limit', '本轮写操作已达上限');
		}
		const peeked = await deps.proposals.peek(deps.userId, proposalId);
		if (!peeked) {
			return elFail('proposal_expired', '提案不存在、过期或类型不符');
		}
		if (peeked.kind === 'pack_generate' && deps.streams.hasUser(deps.userId)) {
			return elFail('already_running', '已有单词或语句生成进行中');
		}
		if (
			peeked.kind === 'reading_generate' &&
			deps.dailyReading.peekManualRun(deps.userId)
		) {
			return elFail('already_running', '已有自选生成进行中');
		}
		const payload = await deps.proposals.consume(deps.userId, proposalId);
		if (!payload) {
			return elFail('proposal_expired', '提案不存在、过期或类型不符');
		}
		if (
			payload.kind === 'pack_generate' ||
			payload.kind === 'reading_generate'
		) {
			budgets.elWrites += 1;
			if (payload.kind === 'pack_generate') {
				startConfirmedPack(
					deps.learning,
					deps.streams,
					deps.userId,
					payload.body,
				);
				return elOk({ status: 'started' }, { message: '已开始生成。' });
			}
			startConfirmedReading(deps.dailyReading, deps.userId, payload.body);
			deps.onMutation?.('daily_reading');
			return elOk({ status: 'started' }, { message: '已开始自选生成。' });
		}
		if (!allowed.includes(payload.kind)) {
			return elFail('proposal_expired', '提案不存在、过期或类型不符');
		}
		budgets.elWrites += 1;
		const stats = await applyElProposal(deps.learning, deps.userId, payload);
		deps.onMutation?.(stats.domain);
		return elOk(stats);
	};

	const favorites = wrap(
		'el_favorites',
		'收藏：list/search/propose_add/propose_remove/commit。list 返回全部瘦索引且不出整表卡；search 也不出卡，要看再 el_present。可选 q 滤词面或释义。点名几个词一次 propose_add，items 为对象数组（word 或 english），禁止逐词调用。语句收藏必须带 english，不要只传 word。整类（某一类全部收藏）先 list，再 propose_add 只传 artifactId，不要传 items，不要翻 nextOffset 凑词。语句整类不要传少量 items 再许诺确认后继续；有语句卡时一次提案即可。多个词一次 propose_remove，传 ids（收藏记录 id）或 words（词面），禁止逐条调用。add 与 propose_add 相同，必须等用户点确认后才写入。本轮不要 commit。入参 JSON 含 op、kind。',
		async (args) => {
			const op = asOp(args.op);
			const kind = kindOf(args);

			if (op === 'list' || op === 'search') {
				const q = asString(args.q)?.trim().toLowerCase();
				if (kind === 'vocab') {
					const all = await fetchAllPages(
						PAGE_USER_ROWS,
						async (lim, offset) => {
							const page = await deps.learning.listVocabularyFavoritesPage(
								deps.userId,
								{ limit: lim, offset },
							);
							return { items: page.items, totalCount: page.totalCount };
						},
					);
					let items = all.items;
					if (q) {
						items = items.filter(
							(i) =>
								i.word.toLowerCase().includes(q) ||
								i.translationZh.toLowerCase().includes(q),
						);
					}
					return elOk(
						{
							kind,
							items: items.map((i) => ({
								id: i.id,
								word: i.word,
								ipa: i.ipa,
								translationZh: i.translationZh,
							})),
							returned: items.length,
							totalCount: q ? items.length : all.totalCount,
						},
						{
							meta: {
								limit: items.length,
								total: q ? items.length : all.totalCount,
								truncated: q ? false : all.truncated,
							},
							message: all.truncated
								? unmetTotal(all.items.length, all.totalCount)
								: undefined,
							ui: [
								{
									type: 'navigate',
									href: '/english-learning/favorites?kind=vocab',
									label: '打开单词收藏',
								},
							],
						},
					);
				}
				const all = await fetchAllPages(PAGE_USER_ROWS, async (lim, offset) => {
					const page = await deps.learning.listClassicQuoteFavoritesPage(
						deps.userId,
						{ limit: lim, offset },
					);
					return { items: page.items, totalCount: page.totalCount };
				});
				let items = all.items;
				if (q) {
					items = items.filter(
						(i) =>
							i.english.toLowerCase().includes(q) ||
							i.translationZh.toLowerCase().includes(q),
					);
				}
				return elOk(
					{
						kind,
						items: items.map((i) => ({
							id: i.id,
							english: i.english.slice(0, 120),
							translationZh: i.translationZh.slice(0, 80),
						})),
						returned: items.length,
						totalCount: q ? items.length : all.totalCount,
					},
					{
						meta: {
							limit: items.length,
							total: q ? items.length : all.totalCount,
							truncated: q ? false : all.truncated,
						},
						message: all.truncated
							? unmetTotal(all.items.length, all.totalCount)
							: undefined,
						ui: [
							{
								type: 'navigate',
								href: '/english-learning/favorites?kind=classic',
								label: '打开语句收藏',
							},
						],
					},
				);
			}

			if (op === 'propose_add') {
				return proposeAdd('favorites', kind, args);
			}

			if (op === 'propose_remove') {
				if (
					deps.surface.favoriteIntent?.action === 'remove' ||
					unfavoriteFromCards(deps.surface.userText)
				) {
					return elOk(
						{ deferred: true },
						{
							message:
								'确认条按上一次收藏挂上。不要再 propose_remove，也不要告诉用户已经取消。',
						},
					);
				}
				if (budgets.openProposalId) {
					return elFail('stop_tools', '本轮已有待确认提案，停止工具调用', {
						proposalId: budgets.openProposalId,
					});
				}
				const req = collectRemoveRequest(args);
				const ids = [...req.ids];
				if (req.words.length) {
					const refs =
						kind === 'vocab'
							? await deps.learning.listVocabularyFavoriteRefsForWords(
									deps.userId,
									req.words,
								)
							: await deps.learning.listClassicQuoteFavoriteRefsForEnglishes(
									deps.userId,
									req.words,
								);
					ids.push(...refs.map((row) => row.id));
				}
				const seen = new Set<string>();
				const unique = ids.filter((id) => {
					if (seen.has(id)) return false;
					seen.add(id);
					return true;
				});
				if (!unique.length) {
					return elFail(
						req.words.length || req.ids.length ? 'not_found' : 'bad_args',
						req.words.length || req.ids.length
							? '这些词不在收藏里'
							: 'propose_remove 需要 ids 或 words',
					);
				}
				const proposalId = await deps.proposals.put(deps.userId, {
					kind: 'favorite_remove',
					contentKind: kind,
					body: {},
					id: unique[0],
					ids: unique,
				});
				occupy(proposalId);
				return elOk(
					{ proposalId, count: unique.length },
					{
						message: '请用户确认后再取消',
						ui: [
							{
								type: 'confirm_proposal',
								proposalId,
								label: `确认取消收藏 ${unique.length} 个`,
							},
						],
					},
				);
			}

			if (op === 'add') {
				return proposeAdd('favorites', kind, args);
			}

			if (op === 'commit') {
				return commitProposal(['favorite_add', 'favorite_remove'], args);
			}

			if (op === 'quiz') {
				// 规则组题：从收藏抽词做选义
				const page = await deps.learning.listVocabularyFavoritesPage(
					deps.userId,
					{ limit: 20, offset: 0 },
				);
				const pool = page.items.filter((i) => i.translationZh?.trim());
				if (pool.length < 4) {
					return elFail('not_found', '收藏词不足 4 个，无法组题');
				}
				const shuffled = [...pool].sort(() => Math.random() - 0.5);
				const stem = shuffled[0];
				const distractors = shuffled.slice(1, 4).map((i) => i.translationZh);
				const options = [stem.translationZh, ...distractors].sort(
					() => Math.random() - 0.5,
				);
				return elOk({
					type: 'choose_meaning',
					word: stem.word,
					ipa: stem.ipa,
					options,
					answer: stem.translationZh,
				});
			}

			return elFail(
				'bad_args',
				'el_favorites 支持 list|search|propose_add|propose_remove|add|commit|quiz',
			);
		},
	);

	const review = wrap(
		'el_review',
		'今日复习：summary / peek_queue。peek_queue 返回全部瘦行（词面与释义），不是 5 条预览，也不自动出整表卡。筛选后 el_present 传词面。入参 JSON：{"op":"summary"|"peek_queue","kind?:vocab|classic","artifactId?:string","offset?:number"}。不代交 SRS 评分。',
		async (args) => {
			const op = asOp(args.op);
			if (op === 'summary') {
				const s = await deps.learning.getPracticeReviewSummary(deps.userId);
				return elOk(s, {
					ui: [
						{
							type: 'navigate',
							href: '/english-learning/review?kind=vocab',
							label: '去复习',
						},
					],
				});
			}
			if (op === 'peek_queue') {
				const kind = kindOf(args);
				const all = await fetchAllPages(PAGE_USER_ROWS, async (lim, offset) => {
					const page = await deps.learning.listPracticeReviewDuePage(
						deps.userId,
						{ contentKind: kind, limit: lim, offset },
					);
					return { items: page.items, totalCount: page.totalCount };
				});
				const slim = all.items.map((item) =>
					'word' in item
						? { word: item.word, translationZh: item.translationZh }
						: {
								english: item.english.slice(0, 120),
								translationZh: item.translationZh.slice(0, 80),
							},
				);
				return elOk(
					{
						kind,
						items: slim,
						returned: slim.length,
						totalCount: all.totalCount,
					},
					{
						meta: {
							total: all.totalCount,
							limit: slim.length,
							truncated: all.truncated,
						},
						message: all.truncated
							? unmetTotal(slim.length, all.totalCount)
							: undefined,
						ui: [
							{
								type: 'navigate',
								href: `/english-learning/review?kind=${kind}`,
								label: '打开复习',
							},
						],
					},
				);
			}
			return elFail('bad_args', 'el_review 支持 summary|peek_queue');
		},
	);

	const mistakes = wrap(
		'el_mistakes',
		'错题：list / propose_add / commit。list 返回全部瘦索引且不出整表卡，可选 q 滤词面或释义；q 为 0 且用户在问主题时索引仍是全量。点名几个词一次 propose_add 的 items，禁止逐词调用。整类加入错题先 list，再 propose_add 只传 artifactId，不要传 items，不要翻 nextOffset。本轮不要 commit。入参 JSON 含 op、kind、q。',
		async (args) => {
			const op = asOp(args.op);
			const kind = kindOf(args);

			if (op === 'list') {
				const q = asString(args.q)?.trim().toLowerCase() ?? '';
				const narrow = <
					T extends { word?: string; english?: string; translationZh?: string },
				>(
					rows: T[],
				): { rows: T[]; literalMiss: boolean } => {
					if (!q) return { rows, literalMiss: false };
					const matched = rows.filter(
						(i) =>
							(i.word ?? i.english ?? '').toLowerCase().includes(q) ||
							(i.translationZh ?? '').toLowerCase().includes(q),
					);
					if (
						!matched.length &&
						listIntent(deps.surface.userText) === 'filter'
					) {
						return { rows, literalMiss: true };
					}
					return { rows: matched, literalMiss: false };
				};
				if (kind === 'vocab') {
					const all = await fetchAllPages(
						PAGE_USER_ROWS,
						async (lim, offset) => {
							const page = await deps.learning.listVocabularyMistakesPage(
								deps.userId,
								{ limit: lim, offset },
							);
							return { items: page.items, totalCount: page.totalCount };
						},
					);
					const mapped = all.items.map((i) => ({
						id: i.id,
						word: i.word,
						translationZh: i.translationZh,
						lastUserInput: i.lastUserInput,
					}));
					const picked = narrow(mapped);
					return elOk(
						{
							kind,
							items: picked.rows,
							returned: picked.rows.length,
							totalCount: picked.literalMiss
								? all.totalCount
								: picked.rows.length,
						},
						{
							meta: {
								total: picked.literalMiss ? all.totalCount : picked.rows.length,
								limit: picked.rows.length,
								truncated: all.truncated,
							},
							message: picked.literalMiss
								? LITERAL_MISS
								: all.truncated
									? unmetTotal(all.items.length, all.totalCount)
									: undefined,
						},
					);
				}
				const all = await fetchAllPages(PAGE_USER_ROWS, async (lim, offset) => {
					const page = await deps.learning.listClassicQuoteMistakesPage(
						deps.userId,
						{ limit: lim, offset },
					);
					return { items: page.items, totalCount: page.totalCount };
				});
				const mapped = all.items.map((i) => ({
					id: i.id,
					english: i.english.slice(0, 120),
					translationZh: i.translationZh.slice(0, 80),
				}));
				const picked = narrow(mapped);
				return elOk(
					{
						kind,
						items: picked.rows,
						returned: picked.rows.length,
						totalCount: picked.literalMiss
							? all.totalCount
							: picked.rows.length,
					},
					{
						meta: {
							total: picked.literalMiss ? all.totalCount : picked.rows.length,
							limit: picked.rows.length,
							truncated: all.truncated,
						},
						message: picked.literalMiss
							? LITERAL_MISS
							: all.truncated
								? unmetTotal(all.items.length, all.totalCount)
								: undefined,
					},
				);
			}

			if (op === 'propose_add') {
				return proposeAdd('mistakes', kind, args);
			}

			if (op === 'commit') {
				return commitProposal(['mistake_add'], args);
			}

			return elFail('bad_args', 'el_mistakes 支持 list|propose_add|commit');
		},
	);

	const dailyMemo = wrap(
		'el_daily_memo',
		'今日记词：summary / records。records 返回全部瘦索引且不出整表卡，可选 q 滤词面或释义；q 为 0 且用户在问主题时索引仍是全量。入参 JSON：{"op":"summary"|"records","q?:string"}。不代打卡。',
		async (args) => {
			const op = asOp(args.op);
			if (op === 'summary') {
				const s = await deps.learning.getDailyMemorizeSummary(deps.userId);
				return elOk(s, {
					ui: [
						{
							type: 'navigate',
							href: '/english-learning/daily',
							label: '打开今日记词',
						},
					],
				});
			}
			if (op === 'records') {
				const q = asString(args.q)?.trim().toLowerCase() ?? '';
				const all = await fetchAllPages(PAGE_USER_ROWS, async (lim, offset) => {
					const page = await deps.learning.listDailyMemorizeRecordsPage(
						deps.userId,
						{ limit: lim, offset },
					);
					return { items: page.items, totalCount: page.totalCount };
				});
				const mapped = all.items.map((i) => ({
					word: i.word,
					translationZh: i.translationZh,
					lastCorrect: i.lastCorrect,
					practicedAt: i.practicedAt,
				}));
				const matched = q
					? mapped.filter(
							(i) =>
								i.word.toLowerCase().includes(q) ||
								(i.translationZh ?? '').toLowerCase().includes(q),
						)
					: mapped;
				const literalMiss =
					!!q &&
					!matched.length &&
					listIntent(deps.surface.userText) === 'filter';
				const items = literalMiss ? mapped : matched;
				return elOk(
					{
						items,
						returned: items.length,
						totalCount: literalMiss ? all.totalCount : items.length,
					},
					{
						meta: {
							total: literalMiss ? all.totalCount : items.length,
							limit: items.length,
							truncated: all.truncated,
						},
						message: literalMiss
							? LITERAL_MISS
							: all.truncated
								? unmetTotal(all.items.length, all.totalCount)
								: undefined,
					},
				);
			}
			return elFail('bad_args', 'el_daily_memo 支持 summary|records');
		},
	);

	const packs = wrap(
		'el_packs',
		'单词资料（词书）与经典语句：history / items / generate。history 与 items 用 kind=vocab|classic，可选 q 滤主题或词面；都是瘦索引。列出全部才挂整表卡，筛选不出卡，要看再 el_present（历史传 streamId，词条传词面）。回执写「字面未命中」时索引仍是全量，禁止宣称没有。generate 不要传 topic 或 count，主题和条数只认用户原话；没写条数是 100，禁止说成 12000 或 6000。没有主题不要生成。generate 只挂确认条，用户点确认后才开始写库。出卡规则与词库、收藏相同。',
		async (args) => {
			const op = asOp(args.op);
			const kind = kindOf(args);
			const q = asString(args.q)?.trim().toLowerCase() ?? '';
			if (op === 'history') {
				const all = await fetchAllPages<{
					id: string;
					topic: string;
					targetCount: number;
					wordCount?: number;
					quoteCount?: number;
					updatedAt: string;
				}>(PAGE_USER_ROWS, async (limit, offset) => {
					if (kind === 'classic') {
						const page = await deps.learning.listClassicQuotesHistory(
							deps.userId,
							{
								limit,
								offset,
							},
						);
						return {
							items: page.map((row) => ({
								id: row.streamId,
								topic: row.topic,
								targetCount: row.targetCount,
								quoteCount: row.quoteCount,
								updatedAt: row.updatedAt,
							})),
						};
					}
					const page = await deps.learning.listVocabularyHistory(deps.userId, {
						limit,
						offset,
					});
					return {
						items: page.map((row) => ({
							id: row.streamId,
							topic: row.topic,
							targetCount: row.targetCount,
							wordCount: row.wordCount,
							updatedAt: row.updatedAt,
						})),
					};
				});
				const mapped = all.items;
				const matched = q
					? mapped.filter((row) => row.topic.toLowerCase().includes(q))
					: mapped;
				const literalMiss =
					!!q &&
					!matched.length &&
					listIntent(deps.surface.userText) === 'filter';
				const items = literalMiss ? mapped : matched;
				return elOk(
					{
						title: kind === 'classic' ? '经典语句历史' : '单词资料历史',
						kind,
						items,
						returned: items.length,
						totalCount: literalMiss ? mapped.length : items.length,
					},
					{
						meta: {
							total: literalMiss ? mapped.length : items.length,
							limit: items.length,
							truncated: all.truncated,
						},
						message: literalMiss
							? LITERAL_MISS
							: all.truncated
								? unmetTotal(all.items.length, all.totalCount)
								: undefined,
					},
				);
			}
			if (op === 'items') {
				const streamId = asString(args.streamId)?.trim();
				if (!streamId) return elFail('bad_args', 'items 需要 streamId');
				const all = await fetchAllPages<Record<string, string>>(
					PAGE_USER_ROWS,
					async (limit, offset) => {
						if (kind === 'classic') {
							const page = await deps.learning.listClassicQuotesPackItems(
								deps.userId,
								streamId,
								{ limit, offset },
							);
							return {
								items: page.items.map((it) => ({
									english: it.english,
									translationZh: it.translationZh,
									source: it.source,
								})),
								totalCount: page.itemCount,
							};
						}
						const page = await deps.learning.listVocabularyPackItems(
							deps.userId,
							streamId,
							{ limit, offset },
						);
						return {
							items: page.items.map((it) => ({
								word: it.word,
								ipa: it.ipa,
								pos: it.pos,
								translationZh: it.translationZh,
								example: it.example,
							})),
							totalCount: page.itemCount,
						};
					},
				);
				const face = (it: Record<string, string>) =>
					`${it.word ?? ''} ${it.english ?? ''} ${it.translationZh ?? ''}`.toLowerCase();
				const matched = q
					? all.items.filter((it) => face(it).includes(q))
					: all.items;
				const literalMiss =
					!!q &&
					!matched.length &&
					listIntent(deps.surface.userText) === 'filter';
				const items = literalMiss ? all.items : matched;
				return elOk(
					{
						title: kind === 'classic' ? '经典语句' : '单词资料',
						kind,
						items,
						returned: items.length,
						totalCount: literalMiss ? all.totalCount : items.length,
					},
					{
						meta: {
							total: literalMiss ? all.totalCount : items.length,
							limit: items.length,
							truncated: literalMiss ? false : all.truncated,
						},
						message: literalMiss
							? LITERAL_MISS
							: all.truncated
								? unmetTotal(all.items.length, all.totalCount)
								: undefined,
					},
				);
			}
			if (op === 'generate') {
				if (budgets.openProposalId) {
					return elFail('stop_tools', '本轮已有待确认提案，停止工具调用', {
						proposalId: budgets.openProposalId,
					});
				}
				const ask = await resolvePackAsk(deps.config, deps.surface.userText);
				if (!ask.vocab && !ask.classic) {
					return elOk(
						{ needTopic: true },
						{
							message:
								'没有主题，未生成。请用户补充单词或语句的主题。不要调用生成。',
						},
					);
				}
				const proposalId = await deps.proposals.put(deps.userId, {
					kind: 'pack_generate',
					contentKind: ask.classic && !ask.vocab ? 'classic' : 'vocab',
					body: ask,
				});
				occupy(proposalId);
				const bits = [
					ask.vocab ? `单词「${ask.vocab.topic}」${ask.vocab.count} 个` : '',
					ask.classic
						? `语句「${ask.classic.topic}」${ask.classic.count} 条`
						: '',
				].filter(Boolean);
				const label = `确认生成 ${bits.join('、')}`;
				return elOk(
					{ proposalId, topics: bits },
					{
						message: `请用户确认后再写入。${label}。没写条数时是 100，不是 12000 或 6000。`,
						ui: [{ type: 'confirm_proposal', proposalId, label }],
					},
				);
			}
			return elFail('bad_args', 'el_packs 支持 history|items|generate');
		},
	);

	const notes = wrap(
		'el_notes',
		'学习笔记：list / get。list 翻完标题（不是 20 条），可选 q 只匹配标题。列出全部挂整表卡；筛选不出卡，要看再 el_present 传 id。回执写「字面未命中」时索引仍是全量，禁止宣称没有笔记。get 传笔记行 id；若只有上一轮单篇卡片的 artifactId 也可 get。多篇清单的 artifactId 不能 get，须 list 后再传那一行的 id。卡片已是去标签全文，回执只有标题和开头 24 字。get 成功后禁止再 el_present 同一篇。不新建、不修改、不删除、不导出。',
		async (args) => {
			const op = asOp(args.op);
			if (op === 'list') {
				const q = asString(args.q)?.trim().toLowerCase() ?? '';
				const all = await fetchAllPages(NOTE_PAGE, async (limit, offset) => {
					const page = await deps.notes.findPage(deps.userId, {
						pageNo: Math.floor(offset / limit) + 1,
						pageSize: limit,
					});
					return { items: page.list, totalCount: page.total };
				});
				const mapped = all.items.map((row) => ({
					id: row.id,
					title: row.title,
					titleZh: noteTitle(row.title ?? ''),
					mine: row.isOwned ? '本人' : '他人公开',
					updatedAt:
						row.updatedAt instanceof Date
							? row.updatedAt.toISOString()
							: String(row.updatedAt ?? ''),
				}));
				const matched = q
					? mapped.filter((row) => row.titleZh.toLowerCase().includes(q))
					: mapped;
				const literalMiss =
					!!q &&
					!matched.length &&
					listIntent(deps.surface.userText) === 'filter';
				const items = literalMiss ? mapped : matched;
				return elOk(
					{
						title: '学习笔记',
						items,
						returned: items.length,
						totalCount: literalMiss ? all.totalCount : items.length,
					},
					{
						meta: {
							total: literalMiss ? all.totalCount : items.length,
							limit: items.length,
							truncated: literalMiss ? false : all.truncated,
						},
						message: literalMiss
							? LITERAL_MISS
							: all.truncated
								? unmetTotal(all.items.length, all.totalCount)
								: '按标题检索。正文里的词不在这份索引里。',
					},
				);
			}
			if (op === 'get') {
				const id = asString(args.id)?.trim();
				if (!id) return elFail('bad_args', 'get 需要 id');
				const already = (noteId: string) =>
					elOk(
						{ alreadyShown: true, id: noteId },
						{
							message:
								'这篇笔记的卡片已经列出，禁止再出一张，也不要再 el_present。',
						},
					);
				if (deps.surface.shownLibraryIds.has(id)) return already(id);
				let row: Awaited<ReturnType<LearningNotesService['findOne']>>;
				try {
					row = await deps.notes.findOne(deps.userId, id);
				} catch {
					const art = await deps.artifacts.get(deps.userId, id);
					const noteId = noteIdFromCardItems(art?.items);
					if (!noteId) {
						if (art?.items?.length) {
							return elFail(
								'bad_args',
								'这是多篇清单的卡片 id，不是笔记 id。请 list 后传那一行的 id。',
							);
						}
						return elFail('not_found', '笔记不存在');
					}
					if (deps.surface.shownLibraryIds.has(noteId)) return already(noteId);
					try {
						row = await deps.notes.findOne(deps.userId, noteId);
					} catch {
						return elFail('not_found', '笔记不存在');
					}
				}
				const plain = notePlain(row.content ?? '');
				return elOk({
					title: noteTitle(row.title ?? ''),
					items: [
						{
							id: row.id,
							titleZh: noteTitle(row.title ?? ''),
							mine: row.isOwned ? '本人' : '他人公开',
							lead: noteLead(plain),
							english: plain,
							updatedAt:
								row.updatedAt instanceof Date
									? row.updatedAt.toISOString()
									: String(row.updatedAt ?? ''),
						},
					],
					returned: 1,
					totalCount: 1,
				});
			}
			return elFail('bad_args', 'el_notes 支持 list|get');
		},
	);

	const pickLibraries = async (
		kind: 'vocab' | 'classic',
	): Promise<ElEnvelope | { id: string; title: string }[]> => {
		const text = deps.surface.userText;
		const noun = kind === 'classic' ? '语句' : '词汇';
		if (deps.surface.intent?.kind !== 'category_filter') {
			return elFail('not_found', `这句不是${noun}分类`);
		}
		const libs = await loadCatalog(kind);
		const mark = kind === 'classic' ? /语句库|语料库|经典语句/ : undefined;
		const exact = matchLibraries(text, libs);
		if (exact.length === 1) return exact;
		const mentioned = resolveMentionedLibrary(text, libs, mark);
		if (mentioned.kind === 'one') return [mentioned.lib];
		if (mentioned.kind === 'ambiguous' || mentioned.kind === 'none') {
			return elFail('ambiguous', `没有唯一${noun}库。请让用户选定库名`, {
				candidates:
					mentioned.kind === 'ambiguous'
						? mentioned.candidates
						: libs.slice(0, 10),
			});
		}
		const cue = await resolveLibraryCue(deps.config, text, libs);
		const named = cue ? resolveNamedLibrary(cue, libs) : null;
		if (named?.kind === 'one') return [named.lib];
		if (named?.kind === 'ambiguous') {
			return elFail('ambiguous', `没有唯一${noun}库。请让用户选定库名`, {
				candidates: named.candidates,
			});
		}
		const all =
			kind === 'classic'
				? isAllClassicCategory(text)
				: isAllVocabCategory(text);
		if (all) return libs;
		const inherited = inheritedLibrary(
			deps.surface.priorUserTexts,
			deps.surface.priorLibraryCards.filter(
				(card) => card.contentKind === kind,
			),
			libs,
			mark,
		);
		if (!inherited) {
			return elFail('ambiguous', `没有唯一${noun}库。请让用户选定库名`);
		}
		return [inherited];
	};

	const presentByLabels = async (
		kind: 'vocab' | 'classic',
		targets: { id: string; title: string }[],
		labels: string[],
	): Promise<{
		items: Record<string, unknown>[];
		titles: string[];
		failed: boolean;
	}> => {
		const skipCache = reclassifyAsked(deps.surface.userText);
		const mergedAll: Record<string, unknown>[] = [];
		const titles: string[] = [];
		let failed = false;
		for (const lib of targets) {
			if (deps.signal?.aborted) break;
			let rows: Record<string, unknown>[] | null = null;
			let used = labels.slice();
			let truncated = false;
			let libFailed = false;
			let failDraft: Omit<ElResourceListPayload, 'artifactId'> | null = null;
			if (!skipCache) {
				rows = cachedLabelSet(deps.surface.labeledCards, lib.id, labels, kind);
			}
			if (!rows) {
				const parts: Record<string, unknown>[] = [];
				used = [];
				for (const label of labels) {
					let hit = skipCache
						? null
						: cachedLabelItems(deps.surface.labeledCards, lib.id, label, kind);
					if (!hit) {
						const draft = await classifyLibrary({
							learning: deps.learning,
							config: deps.config,
							userId: deps.userId,
							lib,
							label,
							logger: deps.logger,
							kind,
							signal: deps.signal,
							artifacts: deps.artifacts,
							jobs: deps.surface.categoryJobs,
							skipCache,
						}).catch(() => null);
						if (!draft?.items?.length) {
							if (draft && categoryMissTitle(draft.title)) {
								libFailed = true;
								failDraft = draft;
							}
							continue;
						}
						hit = rowItems(draft.items);
						truncated = truncated || Boolean(draft.truncated);
						const slice: Omit<ElResourceListPayload, 'artifactId'> = {
							title: lib.title,
							source: 'library',
							contentKind: kind,
							libraryId: lib.id,
							filtered: true,
							categoryLabels: [label],
							totalCount: hit.length,
							truncated: Boolean(draft.truncated),
							items: hit,
						};
						const artifactId = await deps.artifacts.put(deps.userId, slice);
						deps.surface.labeledCards.push({ ...slice, artifactId });
					}
					if (!hit.length) continue;
					parts.push(...hit);
					used.push(label);
				}
				rows = kind === 'classic' ? dedupeEnglish(parts) : dedupeWord(parts);
			}
			if (!rows.length || !used.length) {
				if (libFailed && failDraft) {
					failed = true;
					const showKey = `${kind}:${lib.id}:fail`;
					if (!deps.surface.shownLibraryIds.has(showKey)) {
						const artifactId = await deps.artifacts.put(deps.userId, failDraft);
						const payload = { ...failDraft, artifactId };
						deps.surface.presented = true;
						deps.surface.shownLibraryIds.add(showKey);
						deps.surface.shownLibraryIds.add(lib.id);
						if (deps.onPresented) deps.onPresented(payload);
						else deps.onResourceList?.(payload);
					}
					continue;
				}
				if (!libFailed) {
					const showKey = `${kind}:${lib.id}:${[...labels].sort().join('\n')}`;
					if (!deps.surface.shownLibraryIds.has(showKey)) {
						const empty: Omit<ElResourceListPayload, 'artifactId'> = {
							title: lib.title,
							source: 'library',
							contentKind: kind,
							libraryId: lib.id,
							filtered: true,
							categoryLabels: labels,
							totalCount: 0,
							truncated: false,
							items: [],
						};
						const artifactId = await deps.artifacts.put(deps.userId, empty);
						const payload = { ...empty, artifactId };
						deps.surface.labeledCards.push(payload);
						deps.surface.presented = true;
						deps.surface.shownLibraryIds.add(showKey);
						deps.surface.shownLibraryIds.add(lib.id);
						if (kind === 'classic') rememberQuoteCard(payload);
						rememberVocabCard(payload);
						if (deps.onPresented) deps.onPresented(payload);
						else deps.onResourceList?.(payload);
					}
				} else {
					failed = true;
				}
				continue;
			}
			titles.push(lib.title);
			mergedAll.push(...rows);
			const showKey = `${kind}:${lib.id}:${[...used].sort().join('\n')}`;
			if (deps.surface.shownLibraryIds.has(showKey)) continue;
			if (libFailed) failed = true;
			const draft: Omit<ElResourceListPayload, 'artifactId'> = {
				title: libFailed ? `${lib.title}（有批未能判断）` : lib.title,
				source: 'library',
				contentKind: kind,
				libraryId: lib.id,
				filtered: true,
				...(libFailed ? {} : { categoryLabels: used }),
				totalCount: rows.length,
				truncated: truncated || libFailed,
				items: rows,
			};
			const artifactId = await deps.artifacts.put(deps.userId, draft);
			const payload = { ...draft, artifactId };
			deps.surface.labeledCards.push(payload);
			deps.surface.presented = true;
			deps.surface.shownLibraryIds.add(showKey);
			deps.surface.shownLibraryIds.add(lib.id);
			if (kind === 'classic') rememberQuoteCard(payload);
			rememberVocabCard(payload);
			if (deps.onPresented) deps.onPresented(payload);
			else deps.onResourceList?.(payload);
		}
		const items =
			kind === 'classic' ? dedupeEnglish(mergedAll) : dedupeWord(mergedAll);
		return { items, titles, failed };
	};

	const vocabClassify = wrap(
		'el_vocab_classify',
		'从词汇库按用户原话的类别分类并列出。用户要分类、筛选或列出某一类单词时调用。参数为 {}。不要传 libraryId。',
		async () => {
			if (deps.signal?.aborted) {
				return elFail('unavailable', '已停止');
			}
			const text = deps.surface.userText;
			const picked = await pickLibraries('vocab');
			if (!Array.isArray(picked)) return picked;
			const targets = picked;
			const labels = categoryLabels(text);
			if (labels.length) {
				const listed = await presentByLabels('vocab', targets, labels);
				if (!listed.items.length) {
					return elOk(
						{ titles: [], count: 0 },
						{
							message: listed.failed
								? '有批未能判断。禁止再分类。'
								: '没有可展示的行。禁止再分类。',
						},
					);
				}
				return elOk(
					{ titles: listed.titles, count: listed.items.length },
					{ message: '卡片已列出。禁止逐条复述。' },
				);
			}
			const titles: string[] = [];
			let count = 0;
			for (const lib of targets) {
				if (deps.signal?.aborted) break;
				const jobKey = `vocab:${lib.id}`;
				let job = deps.surface.categoryJobs.get(jobKey);
				const owner = !job;
				if (!job) {
					job = filterLibraryFallback(
						deps.learning,
						deps.config,
						deps.userId,
						lib,
						text,
						deps.logger,
						'vocab',
						deps.signal,
					);
					deps.surface.categoryJobs.set(jobKey, job);
				}
				const draft = await job.catch(() => null);
				if (!draft) continue;
				if (owner) {
					const artifactId = await deps.artifacts.put(deps.userId, draft);
					const payload = { ...draft, artifactId };
					deps.surface.presented = true;
					deps.surface.shownLibraryIds.add(artifactId);
					deps.surface.shownLibraryIds.add(lib.id);
					// 锚点插在模型接着写的正文之前，卡片画在开头。无锚点的卡一律落在正文后面。
					if (deps.onPresented) deps.onPresented(payload);
					else deps.onResourceList?.(payload);
				}
				titles.push(draft.title);
				count += draft.totalCount;
			}
			if (!titles.length) {
				return elOk(
					{ titles, count },
					{ message: '没有可展示的行。禁止再分类。' },
				);
			}
			return elOk({ titles, count }, { message: '卡片已列出。禁止逐条复述。' });
		},
	);

	const classicClassify = wrap(
		'el_classic_classify',
		'从语句库按用户原话的类别分类并列出。用户要分类、筛选或列出某一类语句时调用。参数为 {}。不要传 libraryId。',
		async () => {
			if (deps.signal?.aborted) {
				return elFail('unavailable', '已停止');
			}
			const text = deps.surface.userText;
			const picked = await pickLibraries('classic');
			if (!Array.isArray(picked)) return picked;
			const targets = picked;
			const labels = categoryLabels(text);
			if (labels.length) {
				const listed = await presentByLabels('classic', targets, labels);
				if (!listed.items.length) {
					return elOk(
						{ titles: [], count: 0 },
						{
							message: listed.failed
								? '有批未能判断。禁止再分类。'
								: '没有可展示的行。禁止再分类。',
						},
					);
				}
				return elOk(
					{ titles: listed.titles, count: listed.items.length },
					{ message: '卡片已列出。禁止逐条复述。' },
				);
			}
			const titles: string[] = [];
			let count = 0;
			for (const lib of targets) {
				if (deps.signal?.aborted) break;
				const jobKey = `classic:${lib.id}`;
				let job = deps.surface.categoryJobs.get(jobKey);
				const owner = !job;
				if (!job) {
					job = filterLibraryFallback(
						deps.learning,
						deps.config,
						deps.userId,
						lib,
						text,
						deps.logger,
						'classic',
						deps.signal,
					);
					deps.surface.categoryJobs.set(jobKey, job);
				}
				const draft = await job.catch(() => null);
				if (!draft) continue;
				if (owner) {
					const artifactId = await deps.artifacts.put(deps.userId, draft);
					const payload = { ...draft, artifactId };
					deps.surface.presented = true;
					deps.surface.shownLibraryIds.add(artifactId);
					deps.surface.shownLibraryIds.add(lib.id);
					rememberQuoteCard(payload);
					rememberVocabCard(payload);
					if (deps.onPresented) deps.onPresented(payload);
					else deps.onResourceList?.(payload);
				}
				titles.push(draft.title);
				count += draft.totalCount;
			}
			if (!titles.length) {
				return elOk(
					{ titles, count },
					{ message: '没有可展示的行。禁止再分类。' },
				);
			}
			return elOk({ titles, count }, { message: '卡片已列出。禁止逐条复述。' });
		},
	);

	return [
		vocabClassify,
		classicClassify,
		libraries,
		itemsSearch,
		present,
		dailyReading,
		favorites,
		review,
		mistakes,
		dailyMemo,
		packs,
		notes,
	];
}
