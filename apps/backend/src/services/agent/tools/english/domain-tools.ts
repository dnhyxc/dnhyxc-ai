/**
 * 英语学习侧栏领域工具（el_*）：只调 Service，统一信封，提案写，noop 触发生成。
 */
import { randomUUID } from 'node:crypto';
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
import { favoriteAsk, proposeFavoriteRows } from './favorite-ask';
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
	type ElListSurface,
	inventoryCardDecision,
	isIndexOp,
	isSearchOp,
	listIntent,
	matchLibraries,
	noteIdFromCardItems,
	presentRows,
	presentTooWide,
	shownTitle,
	slimPage,
	slimRow,
	spillListResult,
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

export function buildEnglishLearningDomainTools(
	deps: BuildEnglishLearningDomainToolsDeps,
): DynamicTool[] {
	const budgets: Budgets = { elWrites: 0, openProposalId: null, lastSig: '' };
	const favorite = favoriteAsk(deps.surface.userText);
	const occupy = (id: string) => {
		budgets.openProposalId = id;
		deps.surface.openProposalId = id;
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
					const spilled = await spillListResult(
						name,
						env,
						(row) => deps.artifacts.put(deps.userId, row),
						{
							slim: hideCard || noteOpen,
							always: hideCard || noteOpen,
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
								deps.surface.presented = true;
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
							deps.surface.presented = true;
							deps.surface.shownLibraryIds.add(
								spilled.full.libraryId ?? spilled.full.artifactId,
							);
							deps.onResourceList?.(spilled.full);
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
			deps.surface.presented = true;
			deps.onPresented?.({ ...cardBase, artifactId: cardId });
			const counted = liveLibrary
				? `卡片已列出全部 ${artifact.totalCount} 条。不要写已列出若干条、未穷尽或展示上限。`
				: fullCard
					? `卡片已列出全部 ${shown} 条。禁止写尚未展示、前若干条或还有剩余。`
					: `卡片已列出 ${shown} / 共 ${total} 条。按这个条数说明，不要改成上下文页大小。`;
			const cardKind = artifact.contentKind;
			const wantKind = favorite?.kind === 'card' ? cardKind : favorite?.kind;
			if (
				favorite &&
				(cardKind === 'vocab' || cardKind === 'classic') &&
				wantKind === cardKind &&
				fit.items.length > 0 &&
				fit.items.length <= 40 &&
				!budgets.openProposalId
			) {
				const rows = fit.items.filter(
					(row): row is Record<string, unknown> =>
						!!row && typeof row === 'object' && !Array.isArray(row),
				);
				const proposed = await proposeFavoriteRows(
					deps.learning,
					deps.proposals,
					deps.userId,
					cardKind,
					rows,
				);
				const proposalId =
					proposed.data &&
					typeof proposed.data === 'object' &&
					'proposalId' in proposed.data &&
					typeof (proposed.data as { proposalId?: unknown }).proposalId ===
						'string'
						? (proposed.data as { proposalId: string }).proposalId
						: '';
				if (proposed.ui && proposalId) {
					occupy(proposalId);
					return elOk(proposed.data, {
						message: `${counted}${proposed.message ?? ''}`,
						ui: proposed.ui,
					});
				}
				if (proposed.message && !proposed.ui) {
					return elOk(
						{
							matched: shown,
							dropped,
							total: artifact.items.length,
							truncated: cardBase.truncated,
						},
						{
							message: dropped.length
								? `${counted}已忽略不在该清单中的词：${dropped.slice(0, 20).join('、')}${proposed.message}`
								: `${counted}${proposed.message}`,
						},
					);
				}
			}
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
		'收藏：list/search/propose_add/propose_remove/commit。list 返回全部瘦索引且不出整表卡；search 也不出卡，要看再 el_present。可选 q 滤词面或释义。点名几个词一次 propose_add，items 为对象数组（word 或 english），禁止逐词调用。语句收藏必须带 english，不要只传 word。整类（某一类全部收藏）先 list，再 propose_add 只传 artifactId，不要传 items，不要翻 nextOffset 凑词。多个词一次 propose_remove，传 ids（收藏记录 id）或 words（词面），禁止逐条调用。add 与 propose_add 相同，必须等用户点确认后才写入。本轮不要 commit。入参 JSON 含 op、kind。',
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

	return [
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
