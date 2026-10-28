import { randomUUID } from 'node:crypto';
import { type AIMessageChunk, HumanMessage } from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import { Cache } from '@nestjs/cache-manager';
import {
	BadRequestException,
	Inject,
	Injectable,
	type LoggerService,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createAgent } from 'langchain';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Observable, type Subscriber } from 'rxjs';
import { Repository } from 'typeorm';
import {
	createLlm,
	GLM_THINKING_DISABLED_KWARGS,
} from '../../utils/create-llm';
import { AssistantTableMemory } from '../assistant/assistant-table-memory';
import { EnglishDailyReadingService } from '../english-learning/english-daily-reading.service';
import { EnglishLearningService } from '../english-learning/english-learning.service';
import { EnglishLearningStreamAbortRegistry } from '../english-learning/english-learning-stream-abort.registry';
import { EnglishTableMemory } from '../english-learning/english-table-memory';
import { EnglishAgentSession } from '../english-learning/entity/english-agent-session.entity';
import { KnowledgeQaService } from '../knowledge-qa/knowledge-qa.service';
import { LearningNotesService } from '../learning-notes/learning-notes.service';
import { LlmConfigService } from '../llm-config/llm-config.service';
import { SkillService } from '../skill/skill.service';
import { SkillTrySession } from '../skill/skill-try-session.entity';
import { SkillTryTableMemory } from '../skill/skill-try-table-memory';
import { WebSearchService } from '../web-search/web-search.service';
import type {
	SerperOrganicItem,
	WebSearchOrganicItem,
} from '../web-search/web-search.types';
import {
	DEFAULT_AGENT_SYSTEM_PROMPT,
	ENGLISH_LEARNING_SYSTEM_APPEND,
	SKILL_GENERATE_SYSTEM_APPEND,
} from './agent.prompt';
import { AgentMemoryService } from './agent-memory.service';
import {
	agentStreamRecursionLimit,
	buildAgentLangchainMiddleware,
} from './agent-middleware';
import { AgentSession } from './agent-session.entity';
import type { AgentTurnMemory, AppliedSkillRef } from './agent-turn-memory';
import { AgentChatDto } from './dto/agent-chat.dto';
import type { CommitElProposalDto } from './dto/commit-el-proposal.dto';
import { CreateAgentSessionDto } from './dto/create-agent-session.dto';
import {
	buildAgentSkillTools,
	formatSkillsSystemAppend,
	formatSkillsUserForcePrefix,
	preseedApplySkillMessages,
} from './tools/agent-skill-tools';
import { buildAgentLangChainTools } from './tools/agent-tools';
import {
	applyElProposal,
	proposalReceipt,
} from './tools/english/apply-proposal';
import {
	ElArtifactStore,
	type ElResourceListPayload,
} from './tools/english/artifact.store';
import {
	buildEnglishLearningDomainTools,
	type ElDomainMutation,
	missingNoteCard,
	startConfirmedPack,
	startConfirmedReading,
} from './tools/english/domain-tools';
import {
	favoriteAsk,
	pickFavoriteCard,
	proposeFavoriteRows,
} from './tools/english/favorite-ask';
import { ElProposalStore } from './tools/english/proposal.store';
import {
	type ElListSurface,
	elCardAnchor,
	forSse,
	inventoryFallback,
	placeCardHint,
	stripDumpedList,
} from './tools/english/spill';

function resolveAgentSystemPrompt(dto: AgentChatDto, skillAppend = ''): string {
	let base = DEFAULT_AGENT_SYSTEM_PROMPT;
	if (dto.assistMode === 'english_learning') {
		base = `${base}\n\n${ENGLISH_LEARNING_SYSTEM_APPEND}`;
	} else if (dto.assistMode === 'skill_generate') {
		base = `${base}\n\n${SKILL_GENERATE_SYSTEM_APPEND}`;
	}
	return skillAppend ? `${base}${skillAppend}` : base;
}

/** 合并多轮 internet_search 的 organic，按 link 去重 */
function mergeAgentSearchOrganic(
	prev: WebSearchOrganicItem[],
	batch: WebSearchOrganicItem[] | null | undefined,
): WebSearchOrganicItem[] {
	if (!batch?.length) return prev;
	const seen = new Set(
		prev.map((x) => (x.link ?? '').trim()).filter((k) => k.length > 0),
	);
	const out = [...prev];
	for (const item of batch) {
		const k = (item.link ?? '').trim();
		if (!k || seen.has(k)) continue;
		seen.add(k);
		out.push({ ...item });
	}
	return out;
}

/** 与 Chat 一致：写入 1-based position，供正文【n】与胶囊对齐 */
function withAgentOrganicPositions(
	items: WebSearchOrganicItem[],
): SerperOrganicItem[] {
	return items.map((item, i) => ({ ...item, position: i + 1 }));
}

// Agent会话流式相关状态缓存的存活时间（12小时）
const AGENT_STREAM_STATE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * 从LangChain流式chunk对象中提取模型输出的可见文本
 * @param chunk AIMessageChunk类型，可能为undefined
 * @returns 提取到的文本内容
 */
function readFinishReason(
	chunk: AIMessageChunk | undefined,
): 'length' | 'stop' | undefined {
	const meta = chunk?.response_metadata;
	if (!meta || typeof meta !== 'object') return undefined;
	const raw =
		(meta as { finish_reason?: unknown }).finish_reason ??
		(meta as { finishReason?: unknown }).finishReason;
	if (raw === 'length' || raw === 'max_tokens') return 'length';
	if (raw === 'stop') return 'stop';
	return undefined;
}

function extractChunkText(chunk: AIMessageChunk | undefined): string {
	if (!chunk) return '';
	const { content } = chunk;
	// content为string时直接返回
	if (typeof content === 'string') return content;
	// content为数组时，遍历各部分抽取text属性
	if (!Array.isArray(content)) return '';
	return content
		.map((part: unknown) => {
			if (typeof part === 'string') return part;
			if (
				part &&
				typeof part === 'object' &&
				'text' in part &&
				typeof (part as { text?: string }).text === 'string'
			) {
				return (part as { text: string }).text;
			}
			return '';
		})
		.join('');
}

/** 从 LangChain / HTTP 异常中抽出可读文案（含 429 限流嵌套 message） */
export function formatAgentStreamError(err: unknown): string {
	if (
		(err instanceof Error && err.message.includes('Recursion limit')) ||
		(typeof err === 'string' && err.includes('Recursion limit'))
	) {
		return '这次没有查完，请把问题再说得具体一些。';
	}
	if (err == null) return '处理失败';
	if (typeof err === 'string' && err.trim()) return err.trim();
	if (err instanceof Error && err.message.trim()) return err.message.trim();
	if (typeof err === 'object') {
		const o = err as Record<string, unknown>;
		if (typeof o.message === 'string' && o.message.trim()) {
			if (o.message.includes('Recursion limit')) {
				return '这次没有查完，请把问题再说得具体一些。';
			}
			return o.message.trim();
		}
		const nested = o.error;
		if (nested && typeof nested === 'object') {
			const m = (nested as { message?: unknown }).message;
			if (typeof m === 'string' && m.includes('Recursion limit')) {
				return '这次没有查完，请把问题再说得具体一些。';
			}
			if (typeof m === 'string' && m.trim()) return m.trim();
		}
		if (o.lc_error_code === 'MODEL_RATE_LIMIT' || o.status === 429) {
			return '模型请求过于频繁，请稍后再试';
		}
	}
	return '处理失败';
}

// SSE消息类型定义，支持普通文本和tool相关事件
export type AgentSseChunk =
	| { type: 'content'; data: string }
	| {
			type: 'tool';
			data: {
				phase: 'start' | 'end';
				name?: string;
				input?: unknown;
				output?: unknown;
			};
	  }
	| { type: 'searchOrganic'; data: { organic: SerperOrganicItem[] } }
	| {
			type: 'messageIds';
			data: { userMessageId: string; assistantMessageId: string };
	  }
	/** 本轮实际加载并强制执行的 Skill（供前端展示） */
	| {
			type: 'skillsApplied';
			data: { skills: Array<{ id: string; title: string }> };
	  }
	/** 英语领域写成功后通知前端刷新侧栏/列表 */
	| { type: 'domainMutation'; data: { domain: ElDomainMutation } }
	/** 大列表旁路：全量不进模型正文 */
	| { type: 'elResourceList'; data: ElResourceListPayload }
	/** 剥掉模型复述的长表后，用导语替换已流出的正文 */
	| { type: 'contentReplace'; data: string }
	/** 最后一轮 completion 触顶：只续散文，清单仍在旁路 */
	| {
			type: 'finish';
			data: { reason: 'length' | 'stop'; maxTokensReached: boolean };
	  }
	/** 业务失败：须 next+complete，勿 subscriber.error（Nest SSE 中途 error 常丢帧） */
	| { type: 'error'; data: string };

@Injectable()
export class AgentService {
	constructor(
		@InjectRepository(AgentSession)
		private readonly sessionRepo: Repository<AgentSession>,
		@InjectRepository(SkillTrySession)
		private readonly skillTrySessionRepo: Repository<SkillTrySession>,
		@InjectRepository(EnglishAgentSession)
		private readonly englishSessionRepo: Repository<EnglishAgentSession>,
		private readonly memory: AgentMemoryService,
		private readonly assistantTableMemory: AssistantTableMemory,
		private readonly englishTableMemory: EnglishTableMemory,
		private readonly skillTryTableMemory: SkillTryTableMemory,
		private readonly cache: Cache,
		private readonly configService: ConfigService,
		private readonly llmConfigService: LlmConfigService,
		private readonly webSearchService: WebSearchService,
		private readonly knowledgeQaService: KnowledgeQaService,
		private readonly skillService: SkillService,
		private readonly englishLearningService: EnglishLearningService,
		private readonly englishDailyReadingService: EnglishDailyReadingService,
		private readonly learningNotesService: LearningNotesService,
		private readonly elStreams: EnglishLearningStreamAbortRegistry,
		private readonly elProposalStore: ElProposalStore,
		private readonly elArtifactStore: ElArtifactStore,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	/** 按会话归属推断业务记忆（未显式传 memorySource 时）；业务表未建则当作无归属 */
	private async inferMemorySource(
		sessionId: string,
	): Promise<'english_learning' | 'skill_try' | null> {
		try {
			const eng = await this.englishSessionRepo.exist({
				where: { id: sessionId },
			});
			if (eng) return 'english_learning';
		} catch (e) {
			this.logger.warn?.(
				`[AgentService] 推断 english 记忆跳过: ${e instanceof Error ? e.message : e}`,
			);
		}
		try {
			const tryRow = await this.skillTrySessionRepo.exist({
				where: { id: sessionId },
			});
			if (tryRow) return 'skill_try';
		} catch (e) {
			this.logger.warn?.(
				`[AgentService] 推断 skill_try 记忆跳过: ${e instanceof Error ? e.message : e}`,
			);
		}
		return null;
	}

	/**
	 * 解析本轮业务记忆实现与 businessSessionId。
	 * runSessionId（agent session）仍用于停流/epoch；消息读写走 turnMemory。
	 */
	private async resolveTurnMemory(
		userId: number,
		dto: AgentChatDto,
		runSessionId: string,
	): Promise<{ turnMemory: AgentTurnMemory; businessSessionId: string }> {
		let source = dto.memorySource;
		if (!source) {
			source = (await this.inferMemorySource(runSessionId)) ?? 'agent';
		}

		if (source === 'assistant') {
			const aid = (dto.assistantSessionId ?? '').trim();
			if (!aid) {
				throw new BadRequestException(
					'memorySource=assistant 时须提供 assistantSessionId',
				);
			}
			return {
				turnMemory: this.assistantTableMemory.forUser(userId),
				businessSessionId: aid,
			};
		}
		if (source === 'english_learning') {
			return {
				turnMemory: this.englishTableMemory,
				businessSessionId: runSessionId,
			};
		}
		if (source === 'skill_try') {
			return {
				turnMemory: this.skillTryTableMemory,
				businessSessionId: runSessionId,
			};
		}
		if (source === 'agent') {
			// M4：产品路径应已迁出；保留实现供遗留/未建业务行的句柄
			return {
				turnMemory: this.memory,
				businessSessionId: runSessionId,
			};
		}
		throw new BadRequestException(`不支持的 memorySource: ${source}`);
	}

	/**
	 * 获取特定session的流式epoch缓存key
	 * @param sessionId 会话ID
	 */
	/**
	 * 生成当前 session 的流式 epoch 缓存 key
	 * 用于记录/区分 Agent 会话最新的一轮流式对话 epoch；
	 * 每当 stream 启动新一轮对话时自增（见 incrementStreamEpoch），
	 * 以便前一轮被自动终止或区分多端并发。
	 */
	private streamEpochKey(sessionId: string): string {
		return `agent:lc_stream_epoch:${sessionId}`;
	}

	/**
	 * 生成当前 session 的流式 busy 缓存 key
	 * 用于标志该会话此刻是否有正在进行的流式请求；
	 * 例如限制用户同一 session 下只能有一个活跃流式任务，避免并发/状态混乱。
	 */
	private streamBusyKey(sessionId: string): string {
		return `agent:lc_stream_busy:${sessionId}`;
	}

	/**
	 * 解析epoch值（缓存读到的可能为string/number/undefined）
	 * @param v 缓存中的值
	 */
	private parseEpoch(v: unknown): number {
		if (typeof v === 'number' && Number.isFinite(v)) return v;
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}

	/**
	 * 自增指定会话流式epoch（用于终止前一轮流式，防并发）
	 * @param sessionId 会话ID
	 */
	private async incrementStreamEpoch(sessionId: string): Promise<number> {
		const key = this.streamEpochKey(sessionId);
		const prev = this.parseEpoch(await this.cache.get(key));
		const next = prev + 1;
		await this.cache.set(key, next, AGENT_STREAM_STATE_TTL_MS);
		return next;
	}

	/**
	 * 查询会话当前流式epoch
	 * @param sessionId 会话ID
	 */
	private async getStreamEpoch(sessionId: string): Promise<number> {
		return this.parseEpoch(
			await this.cache.get(this.streamEpochKey(sessionId)),
		);
	}

	/**
	 * 判断异常是否为用户主动中止流式（如abort/sse断开）
	 * @param err 错误对象
	 */
	private isUserAbortError(err: unknown): boolean {
		let cur: unknown = err;
		// 支持嵌套cause：最多找8级
		for (let i = 0; i < 8 && cur != null && typeof cur === 'object'; i++) {
			const o = cur as { name?: string; code?: unknown; cause?: unknown };
			if (o.name === 'AbortError') return true;
			if (o.code === 'ABORT_ERR' || o.code === 20) return true;
			cur = o.cause;
		}
		return false;
	}

	/**
	 * 新建Agent会话
	 * @param userId 用户ID
	 * @param dto （可选）会话标题
	 */
	async createSession(userId: number, dto?: CreateAgentSessionDto) {
		const id = randomUUID();
		const title = dto?.title?.trim() || null;
		const session = this.sessionRepo.create({
			id,
			userId,
			title,
			updatedAt: new Date(),
		});
		await this.sessionRepo.save(session);
		if (dto?.memorySource === 'english_learning') {
			await this.englishSessionRepo.save(
				this.englishSessionRepo.create({
					id,
					userId,
					title,
					updatedAt: new Date(),
				}),
			);
		}
		return { sessionId: id, title: session.title };
	}

	/** 更新会话标题（智能对话 / Skill 历史编辑共用） */
	async updateSessionTitle(
		userId: number,
		sessionId: string,
		rawTitle: string,
	) {
		const sid = (sessionId ?? '').trim();
		const title = (rawTitle ?? '').trim().slice(0, 255);
		if (!sid) {
			throw new NotFoundException('会话不存在');
		}
		if (!title) {
			throw new BadRequestException('标题不能为空');
		}
		await this.assertSessionOwned(userId, sid);
		const now = new Date();
		await this.sessionRepo.update(
			{ id: sid, userId },
			{ title, updatedAt: now },
		);
		await this.englishSessionRepo.update(
			{ id: sid, userId },
			{ title, updatedAt: now },
		);
		return { sessionId: sid, title };
	}

	/**
	 * 分页列出英语学习会话（english_agent_sessions）。
	 * 不再扫全部 agent_sessions，避免知识库 Skill 运行句柄混入列表。
	 */
	async listSessions(
		userId: number,
		pageNo = 1,
		pageSize = 20,
	): Promise<{
		list: Array<{
			sessionId: string;
			title: string | null;
			createdAt: Date;
			updatedAt: Date;
		}>;
		pageNo: number;
		pageSize: number;
		total: number;
	}> {
		const pn = Math.max(1, Math.floor(pageNo));
		const ps = Math.min(50, Math.max(1, Math.floor(pageSize)));
		const qb = this.englishSessionRepo
			.createQueryBuilder('s')
			.where('s.user_id = :uid', { uid: userId })
			.orderBy('s.updated_at', 'DESC')
			.skip((pn - 1) * ps)
			.take(ps);
		const [rows, total] = await qb.getManyAndCount();
		return {
			list: rows.map((r) => ({
				sessionId: r.id,
				title: r.title,
				createdAt: r.createdAt,
				updatedAt: r.updatedAt,
			})),
			pageNo: pn,
			pageSize: ps,
			total,
		};
	}

	/**
	 * 查询会话详情及全部消息（升序）；按业务表路由。
	 */
	async getSessionDetail(userId: number, sessionId: string) {
		const eng = await this.englishSessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id', 'title', 'createdAt', 'updatedAt'],
		});
		if (eng) {
			const messages = await this.englishTableMemory.listMessagesAsc(sessionId);
			return {
				session: {
					sessionId: eng.id,
					title: eng.title,
					createdAt: eng.createdAt,
					updatedAt: eng.updatedAt,
				},
				messages: messages.map((m) => ({
					id: m.id,
					turnId: m.turnId,
					role: m.role,
					content: m.content,
					searchOrganic: m.searchOrganic ?? null,
					elResources: m.elResources ?? null,
					createdAt: m.createdAt,
				})),
			};
		}

		const tryRow = await this.skillTrySessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id'],
		});
		if (tryRow) {
			const session = await this.sessionRepo.findOne({
				where: { id: sessionId, userId },
				select: ['id', 'title', 'createdAt', 'updatedAt'],
			});
			if (!session) {
				return { session: null, messages: [] };
			}
			const messages =
				await this.skillTryTableMemory.listMessagesAsc(sessionId);
			return {
				session: {
					sessionId: session.id,
					title: session.title,
					createdAt: session.createdAt,
					updatedAt: session.updatedAt,
				},
				messages: messages.map((m) => ({
					id: m.id,
					turnId: m.turnId,
					role: m.role,
					content: m.content,
					searchOrganic: m.searchOrganic ?? null,
					appliedSkills: m.appliedSkills ?? null,
					createdAt: m.createdAt,
				})),
			};
		}

		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id', 'title', 'createdAt', 'updatedAt'],
		});
		if (!session) {
			return { session: null, messages: [] };
		}
		const messages = await this.memory.listMessagesAsc(sessionId);
		return {
			session: {
				sessionId: session.id,
				title: session.title,
				createdAt: session.createdAt,
				updatedAt: session.updatedAt,
			},
			messages: messages.map((m) => ({
				id: m.id,
				turnId: m.turnId,
				role: m.role,
				content: m.content,
				searchOrganic: m.searchOrganic ?? null,
				createdAt: m.createdAt,
			})),
		};
	}

	/**
	 * 校验用户是否拥有某会话，不存在则抛404
	 * @param userId 用户ID
	 * @param sessionId 会话ID
	 */
	private async assertSessionOwned(
		userId: number,
		sessionId: string,
	): Promise<AgentSession> {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
		});
		if (!session) {
			throw new NotFoundException('会话不存在');
		}
		return session;
	}

	/**
	 * 构建主模型与摘要模型（preset `chat`：与主站对话共用凭证与模型名）
	 * @param options maxTokens|temperature|signal
	 */
	async getElArtifact(userId: number, artifactId: string) {
		return this.elArtifactStore.get(userId, artifactId);
	}

	/**
	 * 确认条直提交：消费提案、落库、只插一条助手回执。
	 * 不开启模型轮，因此不会在会话里出现「请对提案调用 commit」。
	 */
	async commitElProposal(userId: number, dto: CommitElProposalDto) {
		const session = await this.englishSessionRepo.findOne({
			where: { id: dto.sessionId, userId },
		});
		if (!session) {
			return {
				ok: false as const,
				code: 'forbidden' as const,
				message: '会话不存在',
			};
		}
		const pending = await this.elProposalStore.peek(userId, dto.proposalId);
		if (!pending) {
			return {
				ok: false as const,
				code: 'expired' as const,
				message: '提案已过期',
			};
		}
		if (pending.kind === 'pack_generate' && this.elStreams.hasUser(userId)) {
			return {
				ok: false as const,
				code: 'failed' as const,
				message: '已有生成进行中',
			};
		}
		if (
			pending.kind === 'reading_generate' &&
			this.englishDailyReadingService.peekManualRun(userId)
		) {
			return {
				ok: false as const,
				code: 'failed' as const,
				message: '已有自选生成进行中',
			};
		}
		const payload = await this.elProposalStore.consume(userId, dto.proposalId);
		if (!payload) {
			return {
				ok: false as const,
				code: 'expired' as const,
				message: '提案已过期',
			};
		}
		if (
			payload.kind === 'pack_generate' ||
			payload.kind === 'reading_generate'
		) {
			const content =
				payload.kind === 'pack_generate' ? '已开始生成。' : '已开始自选生成。';
			if (payload.kind === 'pack_generate') {
				startConfirmedPack(
					this.englishLearningService,
					this.elStreams,
					userId,
					payload.body,
				);
			} else {
				startConfirmedReading(
					this.englishDailyReadingService,
					userId,
					payload.body,
				);
			}
			const messageId = await this.englishTableMemory.insertAssistantNote(
				dto.sessionId,
				content,
			);
			return {
				ok: true as const,
				messageId,
				content,
				kind: payload.kind,
				domain:
					payload.kind === 'pack_generate'
						? ('pack' as const)
						: ('daily_reading' as const),
				created: 0,
				existed: 0,
				failed: 0,
				truncated: false,
				gaps: [] as Array<'cap' | 'list' | 'judge'>,
			};
		}
		const stats = await applyElProposal(
			this.englishLearningService,
			userId,
			payload,
		);
		const lang = dto.lang === 'en-US' ? 'en-US' : 'zh-CN';
		const content = proposalReceipt(
			lang,
			payload.kind,
			stats,
			Boolean(payload.truncated),
			payload.gaps,
		);
		const messageId = await this.englishTableMemory.insertAssistantNote(
			dto.sessionId,
			content,
		);
		return {
			ok: true as const,
			messageId,
			content,
			kind: payload.kind,
			domain: stats.domain,
			created: stats.created,
			existed: stats.existed,
			failed: stats.failed,
			truncated: Boolean(payload.truncated),
			gaps: payload.gaps ?? [],
		};
	}

	private async buildModels(
		userId: number,
		options: {
			maxTokens?: number;
			temperature?: number;
			signal?: AbortSignal;
			/** 英语学习：抬高导语上限，清单本身不靠 completion */
			english?: boolean;
		},
	): Promise<{ main: ChatOpenAI; summary: ChatOpenAI }> {
		const main = await createLlm(
			this.configService,
			{
				preset: 'chat',
				userId,
				streaming: true,
				temperature: options.temperature,
				defaultTemperature: 0.3,
				maxTokens: options.maxTokens,
				defaultMaxTokens: options.english ? 8192 : 4096,
				abortSignal: options.signal,
				modelKwargs: GLM_THINKING_DISABLED_KWARGS,
			},
			this.llmConfigService,
		);
		const summary = await createLlm(
			this.configService,
			{
				preset: 'chat',
				userId,
				streaming: false,
				temperature: 0.2,
				maxTokens: 2048,
				modelKwargs: GLM_THINKING_DISABLED_KWARGS,
			},
			this.llmConfigService,
		);
		return { main, summary };
	}

	/**
	 * Agent聊天接口，返回Observable流，每个事件即为SSE chunk
	 * @param userId 用户ID
	 * @param dto 请求体，包含会话信息、文本、参数
	 */
	chatStream(userId: number, dto: AgentChatDto): Observable<AgentSseChunk> {
		return new Observable<AgentSseChunk>((subscriber) => {
			void this.runChatStream(subscriber, userId, dto).catch((e) => {
				// 兜底：runChatStream 内未收口时仍走 next(error)+complete，避免 Nest SSE 丢错
				if (subscriber.closed) return;
				subscriber.next({
					type: 'error',
					data: formatAgentStreamError(e),
				});
				subscriber.complete();
			});
		});
	}

	/**
	 * 负责Agent流式主循环，逐步推理并记录会话，处理中间/异常等流程
	 */
	private async runChatStream(
		subscriber: Subscriber<AgentSseChunk>,
		userId: number,
		dto: AgentChatDto,
	): Promise<void> {
		let sessionId = dto.sessionId; // agent 运行句柄（停流/epoch）
		let session!: AgentSession;
		let accumulated = ''; // 用户本轮assistant回复内容临时拼接
		let sawStopTools = false;
		/** 本轮合并后的联网检索列表（去重），落库与 SSE 推送前补 position */
		let turnSearchOrganic: WebSearchOrganicItem[] = [];
		let assistantMessageId: string | undefined;
		let activeTurnId: string | undefined;
		/** 业务消息表 sessionId：与 turnMemory 同源 */
		let businessSessionId: string | undefined;
		let turnMemory: AgentTurnMemory = this.memory;
		/** 本轮强制 Skill（收尾写入业务表 applied_skills） */
		let turnAppliedSkills: AppliedSkillRef[] | null = null;
		/** 本轮外溢清单（含全量行，落库快照） */
		const turnElResources: ElResourceListPayload[] = [];
		const elSurface: ElListSurface = {
			userText: dto.content,
			libraryLists: [],
			presented: false,
			shownLibraryIds: new Set(),
			catalog: [],
		};
		const pushInventoryCard = async () => {
			const rows = inventoryFallback(
				elSurface.userText,
				elSurface.libraryLists,
				elSurface.shownLibraryIds,
			);
			for (const picked of rows) {
				elSurface.presented = true;
				let payload = picked.payload;
				if (picked.restash) {
					const { artifactId: _old, ...rest } = payload;
					const artifactId = await this.elArtifactStore.put(userId, rest);
					payload = { ...rest, artifactId };
				}
				elSurface.shownLibraryIds.add(payload.libraryId ?? payload.artifactId);
				turnElResources.push(payload);
				subscriber.next({ type: 'elResourceList', data: forSse(payload) });
			}
		};

		/**
		 * 当前turn完成时的存储收尾，更新内容/清理无回复
		 */
		const resolvedAssistantText = (): string => {
			const spilled = turnElResources.length > 0;
			const cardItems = turnElResources.reduce(
				(max, row) => Math.max(max, row.totalCount ?? 0),
				0,
			);
			let text = stripDumpedList(accumulated, spilled, cardItems);
			const fullLibrary = turnElResources.some(
				(row) =>
					row.source === 'library' &&
					Boolean(row.libraryId) &&
					(row.contentKind === 'vocab' || row.contentKind === 'classic'),
			);
			text = placeCardHint(text, spilled, fullLibrary);
			if (!text.trim() && spilled) {
				text = turnElResources
					.map(
						(r) => `${r.title}：共 ${r.totalCount} 条，完整内容在清单卡片中。`,
					)
					.join('\n');
			}
			return text;
		};
		const assistantSaveOpts = () => ({
			searchOrganic:
				turnSearchOrganic.length > 0
					? withAgentOrganicPositions(turnSearchOrganic)
					: null,
			...(turnAppliedSkills?.length
				? { appliedSkills: turnAppliedSkills }
				: {}),
			...(turnElResources.length ? { elResources: turnElResources } : {}),
		});

		const finalizeTurn = async () => {
			if (
				!businessSessionId ||
				!activeTurnId ||
				!assistantMessageId ||
				!session
			) {
				return;
			}
			await pushInventoryCard();
			const text = resolvedAssistantText();
			if (text !== accumulated) {
				subscriber.next({ type: 'contentReplace', data: text });
				accumulated = text;
			}
			if (!accumulated.trim()) {
				// 若assistant回复为空，删掉本轮消息
				await turnMemory.deleteTurnPair(businessSessionId, activeTurnId);
				return;
			}
			// 正常则补全 assistant 正文与联网胶囊数据源
			await turnMemory.updateAssistantContent(
				businessSessionId,
				assistantMessageId,
				accumulated,
				assistantSaveOpts(),
			);
		};

		/**
		 * 流式中异常/中断时的兜底数据一致性处理
		 * （如用户abort，assistant内容有就存，没有则删）
		 */
		const cleanupTurnOnFailure = async () => {
			if (!businessSessionId || !activeTurnId || !assistantMessageId) {
				return;
			}
			try {
				await pushInventoryCard();
				const text = resolvedAssistantText();
				if (text !== accumulated) {
					accumulated = text;
				}
				if (accumulated.trim()) {
					await turnMemory.updateAssistantContent(
						businessSessionId,
						assistantMessageId,
						accumulated,
						assistantSaveOpts(),
					);
				} else {
					await turnMemory.deleteTurnPair(businessSessionId, activeTurnId);
				}
			} catch (cleanupErr: unknown) {
				this.logger.error?.('[AgentService] 本轮消息收尾失败', cleanupErr);
			}
		};

		try {
			// （1）会话校验/新建（agent 运行句柄）
			if (!sessionId) {
				const id = randomUUID();
				session = this.sessionRepo.create({
					id,
					userId,
					title: dto.title?.trim() || null,
				});
				await this.sessionRepo.save(session);
				sessionId = id;
			} else {
				session = await this.assertSessionOwned(userId, sessionId);
			}

			const resolved = await this.resolveTurnMemory(userId, dto, sessionId);
			turnMemory = resolved.turnMemory;
			businessSessionId = resolved.businessSessionId;

			// （2）会话自动摘要压缩（如需要；assistant Memory 为 no-op）
			await turnMemory.compactSessionIfNeeded(businessSessionId, userId);

			// （3）新一轮对话turn占位（写入业务表）
			const turnId = randomUUID();
			activeTurnId = turnId;
			const { userMessageId: uid, assistantMessageId: aid } =
				// 插入用户和助手消息占位符，用于后续的对话记录
				await turnMemory.insertUserAndAssistantPlaceholder(
					businessSessionId,
					turnId,
					dto.content.trim(),
				);
			assistantMessageId = aid;
			subscriber.next({
				type: 'messageIds',
				data: { userMessageId: uid, assistantMessageId: aid },
			});

			// （4）构建 langchain message 历史（与业务表同源）
			const lcMessages =
				await turnMemory.buildLangChainMessagesFromDb(businessSessionId);
			const intent = dto.intentPrefix?.trim();
			const activeCtx = dto.activeContext?.trim();
			const turnPrefix = [
				activeCtx ? `【当前侧栏上下文】\n${activeCtx}` : '',
				intent || '',
			]
				.filter(Boolean)
				.join('\n\n');
			if (turnPrefix) {
				for (let i = lcMessages.length - 1; i >= 0; i -= 1) {
					const msg = lcMessages[i];
					if (!(msg instanceof HumanMessage)) continue;
					const c = msg.content;
					const plain =
						typeof c === 'string'
							? c
							: Array.isArray(c)
								? (c as { text?: string }[])
										.map((p) => (typeof p?.text === 'string' ? p.text : ''))
										.join('')
								: String(c ?? '');
					lcMessages[i] = new HumanMessage(`${turnPrefix}\n\n${plain}`);
					break;
				}
			}

			const skillBodies = await this.skillService.findByIdsForUser(
				dto.skillIds,
				userId,
			);
			if (skillBodies.length) {
				turnAppliedSkills = skillBodies.map((s) => ({
					id: s.id,
					title: s.title,
				}));
				subscriber.next({
					type: 'skillsApplied',
					data: {
						skills: turnAppliedSkills,
					},
				});
				/**
				 * 立刻把本轮强制 Skill 快照写入业务助手行（applied_skills）。
				 *
				 * 为何在这里、而不是只等流结束 finalizeTurn：
				 * - 上文 insertUserAndAssistantPlaceholder 已插入助手占位行，此时 content 仍是空串；
				 *   正文要等模型流完才由 finalizeTurn / cleanupTurnOnFailure 补全。
				 * - 前端此时已通过 SSE `skillsApplied` 展示「已应用 Skill」；若进程在流中崩溃、
				 *   或客户端只依赖落库字段做刷新回读，仅 finalize 一次写入会丢快照。
				 * - 此处先写 appliedSkills，流结束后 finalize 会再带同一快照 + 完整正文更新同一行
				 *   （AssistantTableMemory 仅在 appliedSkills.length>0 时写列，不会被 null 清掉）。
				 *
				 * 第三个参数传 ''：与占位行现状一致，只借 updateAssistantContent 通道改元数据，
				 * 不提前写入半成品正文；真正正文仍由后续 finalize 用 accumulated 覆盖。
				 */
				await turnMemory.updateAssistantContent(
					// 业务会话 id（assistant_* / english_* / skill_try_* 与 memorySource 对齐）
					businessSessionId,
					// 本轮助手占位行 id（与 messageIds SSE 下发的一致）
					assistantMessageId,
					// 保持空正文：流尚未开始，避免把半成品写进库
					'',
					// 仅落库本轮 Skill 的 {id,title}[]，供刷新后 UI 回显
					{ appliedSkills: turnAppliedSkills },
				);
				const force = formatSkillsUserForcePrefix(skillBodies);
				if (force) {
					for (let i = lcMessages.length - 1; i >= 0; i -= 1) {
						const msg = lcMessages[i];
						if (!(msg instanceof HumanMessage)) continue;
						const c = msg.content;
						const plain =
							typeof c === 'string'
								? c
								: Array.isArray(c)
									? (c as { text?: string }[])
											.map((p) => (typeof p?.text === 'string' ? p.text : ''))
											.join('')
									: String(c ?? '');
						lcMessages[i] = new HumanMessage(`${force}${plain}`);
						break;
					}
				}
				const preseed = preseedApplySkillMessages(skillBodies);
				let insertAt = lcMessages.length;
				for (let i = lcMessages.length - 1; i >= 0; i -= 1) {
					if (lcMessages[i] instanceof HumanMessage) {
						insertAt = i;
						break;
					}
				}
				lcMessages.splice(insertAt, 0, ...preseed);
			}

			// （5）流式并发控制（epoch机制），每次流式启动+1，高并发终止旧流
			const abortController = new AbortController();
			const epochAtStart = await this.incrementStreamEpoch(sessionId);
			await this.cache.set(
				this.streamBusyKey(sessionId),
				String(epochAtStart),
				AGENT_STREAM_STATE_TTL_MS,
			);

			// （6）构建主模型与摘要模型
			const { main: mainLlm, summary: summaryLlm } = await this.buildModels(
				userId,
				{
					maxTokens: dto.maxTokens,
					temperature: dto.temperature,
					signal: abortController.signal,
					english: dto.assistMode === 'english_learning',
				},
			);

			// （7）拼装工具集（见 agent-tools.ts）+ 英语领域工具 + 本轮 Skill 工具
			const elWhitelist = new Set<string>();
			const tools = [
				...buildAgentLangChainTools(
					{
						webSearchService: this.webSearchService,
						knowledgeQaService: this.knowledgeQaService,
						userId,
						...(dto.assistMode === 'english_learning'
							? { maxInternetSearchCallsPerRun: 3 }
							: {}),
					},
					{
						onInternetSearchComplete: (r) => {
							const batch = r.organic;
							if (!batch?.length) return;
							turnSearchOrganic = mergeAgentSearchOrganic(
								turnSearchOrganic,
								batch,
							);
							subscriber.next({
								type: 'searchOrganic',
								data: {
									organic: withAgentOrganicPositions(turnSearchOrganic),
								},
							});
						},
					},
				),
				...(dto.assistMode === 'english_learning'
					? buildEnglishLearningDomainTools({
							userId,
							learning: this.englishLearningService,
							dailyReading: this.englishDailyReadingService,
							notes: this.learningNotesService,
							streams: this.elStreams,
							proposals: this.elProposalStore,
							artifacts: this.elArtifactStore,
							logger: this.logger,
							config: this.configService,
							onResourceList: (payload) => {
								turnElResources.push(payload);
								subscriber.next({
									type: 'elResourceList',
									data: forSse(payload),
								});
							},
							onPresented: (payload) => {
								turnElResources.push(payload);
								const anchor = elCardAnchor(payload.artifactId);
								accumulated += anchor;
								subscriber.next({ type: 'content', data: anchor });
								subscriber.next({
									type: 'elResourceList',
									data: forSse(payload),
								});
							},
							whitelist: elWhitelist,
							surface: elSurface,
							onMutation: (domain) => {
								subscriber.next({
									type: 'domainMutation',
									data: { domain },
								});
							},
						})
					: []),
				...buildAgentSkillTools(skillBodies),
			];

			const agentProfile =
				dto.assistMode === 'english_learning'
					? ('english_learning' as const)
					: ('default' as const);

			// （8）创建Agent
			const agent = createAgent({
				// 构建Agent所需核心参数，包括主模型、工具集、系统提示与中间件
				model: mainLlm, // 主聊天大模型，流式推理
				tools, // 工具列表（如 Web 检索、RAG、当前日期等）
				// 按 assistMode 选基础/英语学习/技能生成人设，再拼技能正文附录
				systemPrompt: resolveAgentSystemPrompt(
					// 本轮请求（含 assistMode）决定系统提示分支
					dto,
					// 把已加载 skill 标题与正文格式化后追加到 systemPrompt 末尾
					formatSkillsSystemAppend(skillBodies),
				),
				// 摘要截断。英语学习不按次数封工具，只在空转时收束
				middleware: buildAgentLangchainMiddleware({
					// 非流式副模型，仅供 summarizationMiddleware 压缩长上下文
					summaryLlm: summaryLlm,
					// 用 memory 侧同一套估算，与摘要 trigger.tokens 阈值一致
					estimatePromptTokens: (msgs) =>
						this.memory.estimatePromptTokens(msgs),
					// english_learning 用安静收束防空转，不按会话累计工具次数
					profile: agentProfile,
				}),
			});

			// （9）开始流式事件主循环
			const eventStream = agent.streamEvents(
				{ messages: lcMessages },
				{
					version: 'v2',
					signal: abortController.signal,
					// 英语图步由安静来回数推出，晚于收束，只防图自身死循环
					recursionLimit: agentStreamRecursionLimit(agentProfile),
				},
			);

			let finishReason: 'length' | 'stop' | undefined;
			for await (const ev of eventStream) {
				// 并发安全：若epoch被外部+1（如stopStream），abort终止
				const curEpoch = await this.getStreamEpoch(sessionId);
				if (curEpoch !== epochAtStart) {
					abortController.abort();
				}

				if (ev.event === 'on_chat_model_start') {
					finishReason = undefined;
				}
				// 模型主内容流
				else if (ev.event === 'on_chat_model_stream') {
					const chunk = ev.data?.chunk as AIMessageChunk | undefined;
					const reason = readFinishReason(chunk);
					if (reason) finishReason = reason;
					const text = extractChunkText(chunk);
					if (text) {
						accumulated += text;
						subscriber.next({ type: 'content', data: text });
					}
				}
				// 工具调用开始，发送事件
				else if (ev.event === 'on_tool_start') {
					subscriber.next({
						type: 'tool',
						data: {
							phase: 'start',
							name: typeof ev.name === 'string' ? ev.name : undefined,
							input: ev.data?.input,
						},
					});
				}
				// 工具调用结束，发送事件
				else if (ev.event === 'on_tool_end') {
					const output = ev.data?.output;
					const outputText =
						typeof output === 'string'
							? output
							: output && typeof output === 'object' && 'content' in output
								? String((output as { content?: unknown }).content ?? '')
								: '';
					if (outputText.includes('"code":"stop_tools"')) sawStopTools = true;
					subscriber.next({
						type: 'tool',
						data: {
							phase: 'end',
							name: typeof ev.name === 'string' ? ev.name : undefined,
							output: ev.data?.output,
						},
					});
				}
			}

			if (!accumulated.trim() && sawStopTools) {
				accumulated = '已有待确认提案，请直接点确认。';
				subscriber.next({ type: 'content', data: accumulated });
			}

			if (
				dto.assistMode === 'english_learning' &&
				!turnElResources.some((row) => row.source === 'notes')
			) {
				try {
					const draft = await missingNoteCard(
						this.learningNotesService,
						userId,
						dto.content,
					);
					if (draft) {
						const artifactId = await this.elArtifactStore.put(userId, draft);
						const payload = { ...draft, artifactId };
						turnElResources.push(payload);
						subscriber.next({ type: 'elResourceList', data: forSse(payload) });
					}
				} catch (e: unknown) {
					this.logger.warn?.(
						`[AgentService] 补笔记卡失败: ${e instanceof Error ? e.message : e}`,
					);
				}
			}

			if (dto.assistMode === 'english_learning' && !elSurface.openProposalId) {
				try {
					const ask = favoriteAsk(dto.content);
					let card = ask ? pickFavoriteCard(ask, turnElResources) : null;
					if (ask && !card) {
						const history =
							await this.englishTableMemory.listMessagesAsc(businessSessionId);
						for (let i = history.length - 1; i >= 0; i -= 1) {
							const row = history[i];
							if (row.role !== 'assistant' || row.id === assistantMessageId)
								continue;
							const saved = row.elResources ?? [];
							card = pickFavoriteCard(ask, saved);
							if (card) break;
							const stub = [...saved]
								.reverse()
								.find((item) => item.artifactId && !item.items?.length);
							if (!stub?.artifactId) continue;
							const stored = await this.elArtifactStore.get(
								userId,
								stub.artifactId,
							);
							if (!stored) continue;
							card = pickFavoriteCard(ask, [stored]);
							if (card) break;
						}
					}
					if (
						ask &&
						card?.items?.length &&
						(card.contentKind === 'vocab' || card.contentKind === 'classic')
					) {
						const rows = card.items.filter(
							(row): row is Record<string, unknown> =>
								!!row && typeof row === 'object' && !Array.isArray(row),
						);
						const proposed = await proposeFavoriteRows(
							this.englishLearningService,
							this.elProposalStore,
							userId,
							card.contentKind,
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
							elSurface.openProposalId = proposalId;
							subscriber.next({
								type: 'tool',
								data: {
									phase: 'end',
									name: 'el_favorites',
									output: proposed,
								},
							});
						}
					}
				} catch (e: unknown) {
					this.logger.warn?.(
						`[AgentService] 补收藏确认失败: ${e instanceof Error ? e.message : e}`,
					);
				}
			}

			// 最后收尾，完整保存assistant内容
			await finalizeTurn();
			if (finishReason === 'length') {
				subscriber.next({
					type: 'finish',
					data: { reason: 'length', maxTokensReached: true },
				});
			}
			// 通知流结束
			subscriber.complete();
		} catch (err: unknown) {
			const aborted = this.isUserAbortError(err);
			if (!aborted) {
				this.logger.error?.('[AgentService] chatStream failed', err);
			}
			await cleanupTurnOnFailure();
			if (aborted) {
				subscriber.complete();
			} else {
				// 用 error 帧而非 subscriber.error：否则浏览器常只看到流结束、正文空白
				subscriber.next({
					type: 'error',
					data: formatAgentStreamError(err),
				});
				subscriber.complete();
			}
		} finally {
			// 清理会话busy态，防止流式残留
			if (sessionId) {
				await this.cache.del(this.streamBusyKey(sessionId));
			}
		}
	}

	/**
	 * 主动中止指定会话的流式生成
	 * 通过自增epoch方式，让runChatStream检测终止
	 * @param sessionId 会话ID
	 * @param userId 用户ID
	 */
	async stopStream(sessionId: string, userId: number) {
		// 权限校验，避免越权stop
		const owned = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id'],
		});
		if (!owned) {
			return { success: true, message: '会话已不存在，无需停止' };
		}
		const busy = await this.cache.get(this.streamBusyKey(sessionId));
		if (!busy) {
			return { success: false, message: '当前无进行中的生成' };
		}
		// epoch+1触发runChatStream感知并abort
		await this.incrementStreamEpoch(sessionId);
		return { success: true, message: '已停止生成' };
	}

	/**
	 * 删除会话及摘要、状态等，并终止stream
	 * @param userId 用户ID
	 * @param sessionId 会话ID
	 */
	async deleteSession(userId: number, sessionId: string) {
		const sid = (sessionId ?? '').trim();
		if (!sid) {
			throw new NotFoundException('会话不存在');
		}
		const session = await this.sessionRepo.findOne({
			where: { id: sid, userId },
			select: ['id'],
		});
		if (!session) {
			throw new NotFoundException('会话不存在');
		}
		// 终止所有正在进行的流（epoch+1）
		await this.incrementStreamEpoch(sid);
		await this.cache.del(this.streamBusyKey(sid));
		await this.englishTableMemory.deleteSummary(sid);
		await this.skillTryTableMemory.deleteSummary(sid);
		await this.memory.deleteSummary(sid);
		await this.englishSessionRepo.delete({ id: sid, userId });
		await this.skillTrySessionRepo.delete({ id: sid, userId });
		await this.sessionRepo.delete({ id: sid, userId });
		return { sessionId: sid };
	}
}
