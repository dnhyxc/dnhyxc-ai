import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	type LoggerService,
	NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Observable, type Subscriber } from 'rxjs';
import { ModelEnum } from 'src/enum/config.enum';
import { DataSource, Repository } from 'typeorm';
import { ZhipuStreamData } from '../chat/dto/zhipu-stream-data.dto';
import {
	type AssistantChatTurn,
	estimateTokenCount,
	takeRecentMessagesWithinTokenBudget,
	truncateContentToMaxTokens,
} from './assistant-context.util';
import {
	AssistantMessage,
	AssistantMessageRole,
} from './assistant-message.entity';
import { AssistantSession } from './assistant-session.entity';
import { AssistantChatDto } from './dto/assistant-chat.dto';
import { AssistantSessionListDto } from './dto/assistant-session-list.dto';
import { CreateAssistantSessionDto } from './dto/create-assistant-session.dto';
import { ImportAssistantTranscriptDto } from './dto/import-assistant-transcript.dto';

const DEFAULT_SYSTEM_PROMPT = `你是一个通用智能助手，基于智谱 GLM 模型回答用户问题。请做到：准确、有条理、礼貌；不确定时请说明不确定；不要编造事实。`;

/** 智谱文档：GLM-4.7 上下文 200K（可被 ASSISTANT_MODEL_MAX_INPUT_TOKENS 覆盖） */
const GLM_47_DEFAULT_MAX_INPUT_TOKENS = 200_000;

/** 除 system 正文外，为 role/JSON 等预留的 token（相对 200K 很小，仅防越界） */
const MESSAGE_FRAMING_OVERHEAD = 256;

/** 与 chat.service 流式取消一致：Redis 存世代号，多实例共享；AbortController 仅本进程持有 */
const ASSISTANT_STREAM_STATE_TTL_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class AssistantService {
	constructor(
		@InjectRepository(AssistantSession)
		private readonly sessionRepo: Repository<AssistantSession>,
		@InjectRepository(AssistantMessage)
		private readonly messageRepo: Repository<AssistantMessage>,
		@InjectDataSource()
		private readonly dataSource: DataSource,
		private readonly cache: Cache,
		private readonly configService: ConfigService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	private streamEpochKey(sessionId: string): string {
		return `assistant:glm_stream_epoch:${sessionId}`;
	}

	private streamBusyKey(sessionId: string): string {
		return `assistant:glm_stream_busy:${sessionId}`;
	}

	/** ephemeral（不落库）流式：按用户隔离的 epoch/busy key */
	private ephemeralStreamEpochKey(userId: number, streamId: string): string {
		return `assistant:ephemeral_stream_epoch:${userId}:${streamId}`;
	}

	private ephemeralStreamBusyKey(userId: number, streamId: string): string {
		return `assistant:ephemeral_stream_busy:${userId}:${streamId}`;
	}

	private parseEpoch(v: unknown): number {
		if (typeof v === 'number' && Number.isFinite(v)) return v;
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}

	/** 递增会话流世代号，返回递增后的值（新流开始 / 停止流 时调用） */
	private async incrementStreamEpoch(sessionId: string): Promise<number> {
		const key = this.streamEpochKey(sessionId);
		const prev = this.parseEpoch(await this.cache.get(key));
		const next = prev + 1;
		await this.cache.set(key, next, ASSISTANT_STREAM_STATE_TTL_MS);
		return next;
	}

	private async getStreamEpoch(sessionId: string): Promise<number> {
		return this.parseEpoch(
			await this.cache.get(this.streamEpochKey(sessionId)),
		);
	}

	/** 递增 ephemeral 流世代号（用于 stop）；返回递增后的值 */
	private async incrementEphemeralStreamEpoch(
		userId: number,
		streamId: string,
	): Promise<number> {
		const key = this.ephemeralStreamEpochKey(userId, streamId);
		const prev = this.parseEpoch(await this.cache.get(key));
		const next = prev + 1;
		await this.cache.set(key, next, ASSISTANT_STREAM_STATE_TTL_MS);
		return next;
	}

	private async getEphemeralStreamEpoch(
		userId: number,
		streamId: string,
	): Promise<number> {
		return this.parseEpoch(
			await this.cache.get(this.ephemeralStreamEpochKey(userId, streamId)),
		);
	}

	/**
	 * 用户调用 stopStream 后读循环里会 `abortController.abort()`，fetch/read 抛 AbortError（或 cause 链上为 AbortError），属预期中断，不应打 error 日志。
	 */
	private isAssistantChatStreamUserAbortError(err: unknown): boolean {
		let cur: unknown = err;
		for (let i = 0; i < 8 && cur != null && typeof cur === 'object'; i++) {
			const o = cur as { name?: string; code?: unknown; cause?: unknown };
			if (o.name === 'AbortError') return true;
			if (o.code === 'ABORT_ERR' || o.code === 20) return true;
			cur = o.cause;
		}
		return false;
	}

	private getGlmModelName(): string {
		return (
			this.configService.get<string>(ModelEnum.ASSISTANT_GLM_MODEL_NAME) ||
			this.configService.get<string>(ModelEnum.ZHIPU_MODEL_NAME) ||
			'glm-4.7'
		);
	}

	/**
	 * 按模型名推断官方「最大输入上下文」；优先读 ASSISTANT_MODEL_MAX_INPUT_TOKENS。
	 */
	private getModelOfficialMaxInputTokens(modelName: string): number {
		const raw = this.configService.get<string>(
			ModelEnum.ASSISTANT_MODEL_MAX_INPUT_TOKENS,
		);
		const fromEnv =
			raw != null && raw !== '' ? Number.parseInt(raw, 10) : Number.NaN;
		if (Number.isFinite(fromEnv) && fromEnv >= 4096) {
			return Math.floor(fromEnv);
		}

		const name = modelName.toLowerCase();
		if (name.includes('glm-4.7')) {
			return GLM_47_DEFAULT_MAX_INPUT_TOKENS;
		}
		if (name.includes('glm-4')) {
			return 128_000;
		}
		return 32_000;
	}

	/** system 提示词 + 消息封装余量（从模型最大输入中扣除，不参与「最近几条」截断额度） */
	private getStructureReserveTokens(): number {
		return estimateTokenCount(DEFAULT_SYSTEM_PROMPT) + MESSAGE_FRAMING_OVERHEAD;
	}

	/**
	 * 多轮历史可用的估算 token 上限：
	 * 模型最大输入 − 本次 max_tokens（输出占用）− system/结构预留；
	 * 若配置了 ASSISTANT_MAX_CONTEXT_TOKENS，则再与上述结果取 min（不超过模型官方上限）。
	 */
	private getHistoryTurnBudgetTokens(dto: AssistantChatDto): number {
		const modelName = this.getGlmModelName();
		let inputCap = this.getModelOfficialMaxInputTokens(modelName);

		const clampRaw = this.configService.get<string>(
			ModelEnum.ASSISTANT_MAX_CONTEXT_TOKENS,
		);
		const clamp =
			clampRaw != null && clampRaw !== ''
				? Number.parseInt(clampRaw, 10)
				: Number.NaN;
		if (Number.isFinite(clamp) && clamp >= 2048) {
			inputCap = Math.min(inputCap, Math.floor(clamp));
		}

		const maxOut = Math.min(Math.max(dto.maxTokens ?? 4096, 1), 131_072);
		const reserve = this.getStructureReserveTokens();
		return Math.max(512, inputCap - maxOut - reserve);
	}

	private parseGlmStreamData(dataStr: string): ZhipuStreamData | null {
		if (dataStr.trim() === '[DONE]') return null;
		try {
			const data = JSON.parse(dataStr);
			if (data.choices?.[0]?.delta?.content) {
				return { type: 'content', data: data.choices[0].delta.content };
			}
			if (data.choices?.[0]?.message?.content) {
				return { type: 'content', data: data.choices[0].message.content };
			}
			if (data.choices?.[0]?.delta?.reasoning_content) {
				return {
					type: 'thinking',
					data: data.choices[0].delta.reasoning_content,
				};
			}
			if (data.usage) {
				return { type: 'usage', data: data.usage };
			}
			return null;
		} catch {
			return null;
		}
	}

	private async findLatestSessionIdByKnowledgeArticle(
		userId: number,
		knowledgeArticleId: string,
	): Promise<string | null> {
		const row = await this.sessionRepo.findOne({
			where: { userId, knowledgeArticleId },
			order: { updatedAt: 'DESC' },
			select: ['id'],
		});
		return row?.id ?? null;
	}

	async createSession(userId: number, dto?: CreateAssistantSessionDto) {
		const articleId = dto?.knowledgeArticleId?.trim();
		if (articleId) {
			const existingId = await this.findLatestSessionIdByKnowledgeArticle(
				userId,
				articleId,
			);
			if (existingId) {
				const existing = await this.sessionRepo.findOne({
					where: { id: existingId, userId },
					select: ['id', 'title'],
				});
				if (existing) {
					return { sessionId: existing.id, title: existing.title };
				}
			}
		}
		const id = randomUUID();
		const session = this.sessionRepo.create({
			id,
			userId,
			title: dto?.title?.trim() || null,
			knowledgeArticleId: articleId || null,
		});
		await this.sessionRepo.save(session);
		return { sessionId: id, title: session.title };
	}

	/**
	 * 按知识条目标识取「最近活跃」的助手会话及消息（用于切换文章时恢复历史）
	 */
	async getSessionDetailByKnowledgeArticle(
		userId: number,
		knowledgeArticleId: string,
	) {
		const sid = await this.findLatestSessionIdByKnowledgeArticle(
			userId,
			knowledgeArticleId.trim(),
		);
		if (!sid) {
			return null;
		}
		return this.getSessionDetail(userId, sid);
	}

	/** 草稿保存为正式条目等场景：将会话改绑到新的条目标识 */
	async updateSessionKnowledgeArticleId(
		userId: number,
		sessionId: string,
		knowledgeArticleId: string,
	): Promise<{ sessionId: string; knowledgeArticleId: string }> {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id'],
		});
		if (!session) {
			throw new NotFoundException('会话不存在');
		}
		const next = knowledgeArticleId.trim();
		await this.sessionRepo.update(
			{ id: sessionId, userId },
			{ knowledgeArticleId: next },
		);
		return { sessionId, knowledgeArticleId: next };
	}

	async listSessions(userId: number, query: AssistantSessionListDto) {
		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 20;
		const [list, total] = await this.sessionRepo.findAndCount({
			where: { userId },
			select: ['id', 'userId', 'title', 'createdAt', 'updatedAt'],
			order: { updatedAt: 'DESC' },
			skip: (pageNo - 1) * pageSize,
			take: pageSize,
		});
		return {
			list: list.map((s) => ({
				sessionId: s.id,
				title: s.title,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
			})),
			total,
			pageNo,
			pageSize,
		};
	}

	async getSessionDetail(userId: number, sessionId: string) {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id', 'userId', 'title', 'createdAt', 'updatedAt'],
		});
		// 知识删除会级联清理助手会话；前端可能仍持旧 sessionId 拉取详情，勿抛 404 以免全局 Toast 打扰用户
		if (!session) {
			return { session: null, messages: [] };
		}
		const messages = await this.messageRepo.find({
			where: { session: { id: sessionId } },
			order: { createdAt: 'ASC' },
			select: ['id', 'turnId', 'role', 'content', 'createdAt'],
		});
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
				createdAt: m.createdAt,
			})),
		};
	}

	private async assertSessionOwned(
		userId: number,
		sessionId: string,
	): Promise<AssistantSession> {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id', 'userId', 'title', 'createdAt', 'updatedAt'],
		});
		if (!session) {
			throw new NotFoundException('会话不存在');
		}
		return session;
	}

	/**
	 * 仅拉取构建上下文所需列，减少 ORM  hydrate 与网络传输（逻辑与 find 全表一致）。
	 */
	private async loadMessagesForSessionContext(
		sessionId: string,
	): Promise<AssistantMessage[]> {
		return this.messageRepo
			.createQueryBuilder('m')
			.select(['m.id', 'm.role', 'm.content', 'm.turnId', 'm.createdAt'])
			.where('m.session_id = :sid', { sid: sessionId })
			.orderBy('m.created_at', 'ASC')
			.getMany();
	}

	/**
	 * 从库中消息构建多轮上下文：同一 turnId 下助手若仍为空正文则仅带上用户一句（当前轮在流式中）。
	 * 入参须已按 createdAt 升序（与 loadMessagesForSessionContext 一致）。
	 */
	private buildTurnsForContext(
		messages: AssistantMessage[],
	): AssistantChatTurn[] {
		const out: AssistantChatTurn[] = [];
		for (let i = 0; i < messages.length; i++) {
			const m = messages[i];
			if (m.role !== AssistantMessageRole.USER) continue;
			out.push({ role: 'user', content: m.content });
			const next = messages[i + 1];
			const sameTurn =
				next?.role === AssistantMessageRole.ASSISTANT &&
				(m.turnId && next.turnId
					? m.turnId === next.turnId
					: !m.turnId && !next.turnId);
			if (sameTurn) {
				if ((next.content ?? '').trim() !== '') {
					out.push({ role: 'assistant', content: next.content });
				}
				i++;
			}
		}
		return out;
	}

	/** 同一 turn 的用户+助手行一并删除（接口异常时不应留下孤立用户消息） */
	private async deleteTurnPair(
		sessionId: string,
		turnId: string,
	): Promise<void> {
		await this.messageRepo
			.createQueryBuilder()
			.delete()
			.from(AssistantMessage)
			.where('session_id = :sid', { sid: sessionId })
			.andWhere('turn_id = :tid', { tid: turnId })
			.execute();
	}

	private async updateAssistantContent(
		assistantMessageId: string,
		content: string,
		session: AssistantSession,
	): Promise<void> {
		const now = new Date();
		await Promise.all([
			this.messageRepo.update({ id: assistantMessageId }, { content }),
			this.sessionRepo.update({ id: session.id }, { updatedAt: now }),
		]);
		session.updatedAt = now;
	}

	/**
	 * 单事务内写入本轮「用户 + 助手占位」两行，共用 turnId，禁止只插入用户。
	 */
	private async insertUserAndAssistantPlaceholder(
		session: AssistantSession,
		turnId: string,
		userContent: string,
	): Promise<{ userMessageId: string; assistantMessageId: string }> {
		const qr = this.dataSource.createQueryRunner();
		await qr.connect();
		await qr.startTransaction();
		try {
			const user = qr.manager.create(AssistantMessage, {
				session,
				role: AssistantMessageRole.USER,
				content: userContent,
				turnId,
			});
			await qr.manager.save(user);
			const assistant = qr.manager.create(AssistantMessage, {
				session,
				role: AssistantMessageRole.ASSISTANT,
				content: '',
				turnId,
			});
			await qr.manager.save(assistant);
			// 首轮标题与会话首条用户消息同事务提交，少一次往返
			if (!session.title?.trim()) {
				const t = userContent.slice(0, 60) || '新对话';
				await qr.manager.update(
					AssistantSession,
					{ id: session.id },
					{ title: t },
				);
				session.title = t;
			}
			await qr.commitTransaction();
			return { userMessageId: user.id, assistantMessageId: assistant.id };
		} catch (e) {
			await qr.rollbackTransaction();
			throw e;
		} finally {
			await qr.release();
		}
	}

	private buildEphemeralTurns(dto: AssistantChatDto): AssistantChatTurn[] {
		const turns: AssistantChatTurn[] = [];
		for (const r of dto.contextTurns ?? []) {
			if (r.role !== 'user' && r.role !== 'assistant') continue;
			turns.push({ role: r.role, content: r.content ?? '' });
		}
		const extra = dto.extraUserContentForModel?.trim();
		const tail = extra
			? `${dto.content.trim()}\n\n${extra}`
			: dto.content.trim();
		turns.push({ role: 'user', content: tail });
		return turns;
	}

	/** 将「仅给模型」的补充正文拼到上下文末尾最近一条 user 上（用于已按短 content 落库的场景） */
	private mergeExtraUserContentForModelIntoTurns(
		turns: AssistantChatTurn[],
		extra?: string,
	): AssistantChatTurn[] {
		const t = extra?.trim();
		if (!t) return turns;
		const out = turns.map((x) => ({ ...x }));
		for (let i = out.length - 1; i >= 0; i--) {
			if (out[i].role === 'user') {
				out[i] = {
					...out[i],
					content: `${out[i].content}\n\n${t}`,
				};
				break;
			}
		}
		return out;
	}

	/** 不落库：仅智谱流式输出（知识库未保存草稿） */
	private async runEphemeralChatStream(
		subscriber: Subscriber<ZhipuStreamData>,
		dto: AssistantChatDto,
		options: { streamId: string; userId: number },
	): Promise<void> {
		const { streamId, userId } = options;
		const allTurns = this.buildEphemeralTurns(dto);
		const budget = this.getHistoryTurnBudgetTokens(dto);
		let contextTurns = takeRecentMessagesWithinTokenBudget(allTurns, budget);
		if (contextTurns.length === 0 && allTurns.length > 0) {
			const last = allTurns[allTurns.length - 1]!;
			contextTurns = [
				{
					role: last.role,
					content: truncateContentToMaxTokens(last.content, budget - 16),
				},
			];
		}
		const requestMessages = [
			{ role: 'system' as const, content: DEFAULT_SYSTEM_PROMPT },
			...contextTurns.map((t) => ({
				role: t.role,
				content: t.content,
			})),
		];

		const apiKey = this.configService.get<string>(ModelEnum.ZHIPU_API_KEY);
		const baseURL =
			this.configService.get<string>(ModelEnum.ZHIPU_BASE_URL) ||
			'https://open.bigmodel.cn/api/paas/v4';
		if (!apiKey) {
			throw new HttpException(
				'智谱 API 密钥未配置（ZHIPU_API_KEY）',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
		const modelName = this.getGlmModelName();
		const abortController = new AbortController();
		// 与持久化 stop 一致：用 Redis epoch 做跨实例停止信号；本实例在读循环中轮询 epoch 并 abort。
		const startEpoch = await this.getEphemeralStreamEpoch(userId, streamId);
		const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: modelName,
				messages: requestMessages,
				thinking: { type: 'disabled' },
				stream: true,
				max_tokens: dto.maxTokens ?? 4096,
				temperature: dto.temperature ?? 0.3,
			}),
			signal: abortController.signal,
		});
		if (!response.ok) {
			const errText = await response.text();
			throw new HttpException(
				`智谱 API 请求失败：${response.status} ${errText}`,
				response.status,
			);
		}
		const reader = response.body?.getReader();
		if (!reader) {
			throw new HttpException(
				'无法读取响应流',
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}
		const decoder = new TextDecoder('utf-8');
		let buffer = '';
		try {
			while (true) {
				// stop 触发时 epoch 会递增；发现变化即主动 abort（预期中断）
				const curEpoch = await this.getEphemeralStreamEpoch(userId, streamId);
				if (curEpoch !== startEpoch) {
					abortController.abort();
				}
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				buffer += chunk;
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';
				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || !trimmed.startsWith('data:')) continue;
					const dataStr = trimmed.slice(5).trim();
					if (dataStr === '[DONE]') {
						subscriber.complete();
						return;
					}
					const streamData = this.parseGlmStreamData(dataStr);
					if (streamData) {
						subscriber.next(streamData);
					}
				}
			}
			if (buffer.trim().startsWith('data:')) {
				const dataStr = buffer.trim().slice(5).trim();
				if (dataStr !== '[DONE]') {
					const streamData = this.parseGlmStreamData(dataStr);
					if (streamData) {
						subscriber.next(streamData);
					}
				}
			}
			subscriber.complete();
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * 将草稿阶段对话迁入已绑定知识条目的会话（用于首次保存后落库）。
	 *
	 * `dto.lines` 须为时间升序；客户端仅提交「最近 200 条」时，会话标题取 **本批 lines 内** 首条非空 user 的前 60 字（未必等于整段草稿历史上第一条用户消息）。
	 */
	async importTranscript(
		userId: number,
		dto: ImportAssistantTranscriptDto,
	): Promise<{ sessionId: string; inserted: number }> {
		const articleId = dto.knowledgeArticleId.trim();
		let sessionId = await this.findLatestSessionIdByKnowledgeArticle(
			userId,
			articleId,
		);
		if (!sessionId) {
			const id = randomUUID();
			await this.sessionRepo.save(
				this.sessionRepo.create({
					id,
					userId,
					title: null,
					knowledgeArticleId: articleId,
				}),
			);
			sessionId = id;
		} else {
			await this.assertSessionOwned(userId, sessionId);
			await this.messageRepo
				.createQueryBuilder()
				.delete()
				.from(AssistantMessage)
				.where('session_id = :sid', { sid: sessionId })
				.execute();
		}

		const session = await this.assertSessionOwned(userId, sessionId);
		let inserted = 0;
		let titleFromFirstUser: string | null = null;
		let i = 0;
		while (i < dto.lines.length) {
			const u = dto.lines[i];
			i++;
			if (u.role !== 'user') {
				continue;
			}
			if (!titleFromFirstUser && (u.content ?? '').trim()) {
				titleFromFirstUser = (u.content ?? '').trim().slice(0, 60);
			}
			const turnId = randomUUID();
			await this.messageRepo.save(
				this.messageRepo.create({
					session,
					role: AssistantMessageRole.USER,
					content: u.content ?? '',
					turnId,
				}),
			);
			inserted++;
			const next = dto.lines[i];
			const assistantContent =
				next?.role === 'assistant' ? (next.content ?? '') : '';
			if (next?.role === 'assistant') {
				i++;
			}
			await this.messageRepo.save(
				this.messageRepo.create({
					session,
					role: AssistantMessageRole.ASSISTANT,
					content: assistantContent,
					turnId,
				}),
			);
			inserted++;
		}
		const now = new Date();
		await this.sessionRepo.update(
			{ id: sessionId, userId },
			{
				title: titleFromFirstUser,
				updatedAt: now,
			},
		);
		return { sessionId, inserted };
	}

	/**
	 * 流式问答：用户与助手占位在同一事务落库并关联 turnId；成功后 UPDATE 助手正文；
	 * 模型/流异常时删除该 turn 成对记录；用户主动中止且有已生成片段则写入部分内容。
	 */
	chatStream(
		userId: number,
		dto: AssistantChatDto,
	): Observable<ZhipuStreamData> {
		return new Observable<ZhipuStreamData>((subscriber) => {
			(async () => {
				let sessionId = dto.sessionId;
				// 各分支在发起流式请求前均会赋值；占位满足 TS 对闭包内引用的检查
				let session!: AssistantSession;
				let accumulated = '';
				let assistantMessageId: string | undefined;
				let activeTurnId: string | undefined;
				let streamSessionId: string | undefined;

				const finalizeTurn = async () => {
					if (
						!streamSessionId ||
						!activeTurnId ||
						!assistantMessageId ||
						!session
					) {
						return;
					}
					if (!accumulated.trim()) {
						await this.deleteTurnPair(streamSessionId, activeTurnId);
						return;
					}
					await this.updateAssistantContent(
						assistantMessageId,
						accumulated,
						session,
					);
				};

				const cleanupTurnOnFailure = async () => {
					if (!streamSessionId || !activeTurnId || !assistantMessageId) {
						return;
					}
					try {
						if (accumulated.trim()) {
							await this.updateAssistantContent(
								assistantMessageId,
								accumulated,
								session,
							);
						} else {
							await this.deleteTurnPair(streamSessionId, activeTurnId);
						}
					} catch (cleanupErr: any) {
						this.logger.error?.(
							'[AssistantService] 本轮消息收尾失败',
							cleanupErr,
						);
					}
				};

				try {
					if (dto.ephemeral === true) {
						if (dto.sessionId) {
							throw new BadRequestException('ephemeral 模式下请勿传 sessionId');
						}
						if (dto.knowledgeArticleId?.trim()) {
							throw new BadRequestException(
								'ephemeral 模式下请勿传 knowledgeArticleId',
							);
						}
						// ephemeral 模式：生成一个可 stop 的 streamId，并在 SSE 开始时下发给前端
						const streamId = randomUUID();
						await this.cache.set(
							this.ephemeralStreamBusyKey(userId, streamId),
							1,
							ASSISTANT_STREAM_STATE_TTL_MS,
						);
						await this.cache.set(
							this.ephemeralStreamEpochKey(userId, streamId),
							0,
							ASSISTANT_STREAM_STATE_TTL_MS,
						);
						// meta：前端可拿到 streamId 用于 stop（不落库，不影响原 content/thinking 协议）
						subscriber.next({
							type: 'meta',
							data: { streamId },
						} as any);
						try {
							await this.runEphemeralChatStream(subscriber, dto, {
								streamId,
								userId,
							});
						} finally {
							await this.cache.del(
								this.ephemeralStreamBusyKey(userId, streamId),
							);
						}
						return;
					}
					if (sessionId) {
						session = await this.assertSessionOwned(userId, sessionId);
					} else {
						const articleId = dto.knowledgeArticleId?.trim();
						if (articleId) {
							const existingId =
								await this.findLatestSessionIdByKnowledgeArticle(
									userId,
									articleId,
								);
							if (existingId) {
								session = await this.assertSessionOwned(userId, existingId);
								sessionId = session.id;
							}
						}
						if (!sessionId) {
							const id = randomUUID();
							session = this.sessionRepo.create({
								id,
								userId,
								title: null,
								knowledgeArticleId: articleId || null,
							});
							await this.sessionRepo.save(session);
							sessionId = id;
						}
					}
					streamSessionId = sessionId!;

					const turnId = randomUUID();
					activeTurnId = turnId;
					const { assistantMessageId: aid } =
						await this.insertUserAndAssistantPlaceholder(
							session,
							turnId,
							dto.content.trim(),
						);
					assistantMessageId = aid;

					const allDb = await this.loadMessagesForSessionContext(sessionId!);

					const allTurns = this.buildTurnsForContext(allDb);
					const allTurnsForModel = this.mergeExtraUserContentForModelIntoTurns(
						allTurns,
						dto.extraUserContentForModel,
					);

					const budget = this.getHistoryTurnBudgetTokens(dto);
					let contextTurns = takeRecentMessagesWithinTokenBudget(
						allTurnsForModel,
						budget,
					);

					if (contextTurns.length === 0 && allTurnsForModel.length > 0) {
						const last = allTurnsForModel[allTurnsForModel.length - 1];
						contextTurns = [
							{
								role: last.role,
								content: truncateContentToMaxTokens(last.content, budget - 16),
							},
						];
					}

					const requestMessages = [
						{ role: 'system' as const, content: DEFAULT_SYSTEM_PROMPT },
						...contextTurns.map((t) => ({
							role: t.role,
							content: t.content,
						})),
					];

					const apiKey = this.configService.get<string>(
						ModelEnum.ZHIPU_API_KEY,
					);
					const baseURL =
						this.configService.get<string>(ModelEnum.ZHIPU_BASE_URL) ||
						'https://open.bigmodel.cn/api/paas/v4';
					if (!apiKey) {
						throw new HttpException(
							'智谱 API 密钥未配置（ZHIPU_API_KEY）',
							HttpStatus.SERVICE_UNAVAILABLE,
						);
					}

					const modelName = this.getGlmModelName();
					// 新流开始：先递增 epoch，使其它实例上仍在跑的同会话流检测到并 abort
					const epochAtStart = await this.incrementStreamEpoch(sessionId!);
					await this.cache.set(
						this.streamBusyKey(sessionId!),
						String(epochAtStart),
						ASSISTANT_STREAM_STATE_TTL_MS,
					);
					const abortController = new AbortController();

					const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
					const response = await fetch(url, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${apiKey}`,
						},
						body: JSON.stringify({
							model: modelName,
							messages: requestMessages,
							thinking: { type: 'disabled' },
							stream: true,
							max_tokens: dto.maxTokens ?? 4096,
							temperature: dto.temperature ?? 0.3,
						}),
						signal: abortController.signal,
					});

					if (!response.ok) {
						const errText = await response.text();
						throw new HttpException(
							`智谱 API 请求失败：${response.status} ${errText}`,
							response.status,
						);
					}

					const reader = response.body?.getReader();
					if (!reader) {
						throw new HttpException(
							'无法读取响应流',
							HttpStatus.INTERNAL_SERVER_ERROR,
						);
					}

					const decoder = new TextDecoder('utf-8');
					let buffer = '';

					try {
						while (true) {
							const curEpoch = await this.getStreamEpoch(sessionId!);
							if (curEpoch !== epochAtStart) {
								abortController.abort();
							}
							const { done, value } = await reader.read();
							if (done) break;
							const chunk = decoder.decode(value, { stream: true });
							buffer += chunk;
							const lines = buffer.split('\n');
							buffer = lines.pop() || '';

							for (const line of lines) {
								const trimmed = line.trim();
								if (!trimmed || !trimmed.startsWith('data:')) continue;
								const dataStr = trimmed.slice(5).trim();
								if (dataStr === '[DONE]') {
									await finalizeTurn();
									subscriber.complete();
									return;
								}
								const streamData = this.parseGlmStreamData(dataStr);
								if (streamData) {
									subscriber.next(streamData);
									if (streamData.type === 'content') {
										accumulated += streamData.data as string;
									}
								}
							}
						}

						if (buffer.trim().startsWith('data:')) {
							const dataStr = buffer.trim().slice(5).trim();
							if (dataStr !== '[DONE]') {
								const streamData = this.parseGlmStreamData(dataStr);
								if (streamData) {
									subscriber.next(streamData);
									if (streamData.type === 'content') {
										accumulated += streamData.data as string;
									}
								}
							}
						}

						await finalizeTurn();
						subscriber.complete();
					} finally {
						reader.releaseLock();
					}
				} catch (err: any) {
					if (!this.isAssistantChatStreamUserAbortError(err)) {
						this.logger.error?.('[AssistantService] chatStream failed', {
							message: err?.message,
							stack: err?.stack,
						});
					}
					await cleanupTurnOnFailure();
					subscriber.error(err);
				} finally {
					if (sessionId) {
						await this.cache.del(this.streamBusyKey(sessionId));
					}
				}
			})().catch((e) => subscriber.error(e));
		});
	}

	async stopStream(sessionId: string, userId: number) {
		const owned = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id'],
		});
		// 删除知识时已物理删除会话；此时停止流式应幂等成功，避免「会话不存在」
		if (!owned) {
			return { success: true, message: '会话已不存在，无需停止' };
		}
		const busy = await this.cache.get(this.streamBusyKey(sessionId));
		if (!busy) {
			return { success: false, message: '当前无进行中的生成' };
		}
		// 任意实例调用：Redis 递增 epoch，持有 fetch 的实例在读循环中比对后本地 abort
		await this.incrementStreamEpoch(sessionId);
		return { success: true, message: '已停止生成' };
	}

	/**
	 * 停止 ephemeral（不落库）流式输出。
	 *
	 * 说明：
	 * - 通过 Redis 递增 epoch 向“持有 fetch/read 的实例”发信号；
	 * - 读循环会轮询 epoch，发现变化后 abort，从而停止下游流式输出。
	 */
	async stopEphemeralStream(streamId: string, userId: number) {
		const busy = await this.cache.get(
			this.ephemeralStreamBusyKey(userId, streamId),
		);
		if (!busy) {
			return { success: false, message: '当前无进行中的生成' };
		}
		await this.incrementEphemeralStreamEpoch(userId, streamId);
		return { success: true, message: '已停止生成' };
	}
}
