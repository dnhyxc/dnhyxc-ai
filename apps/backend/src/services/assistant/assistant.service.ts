import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import {
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
import { Observable } from 'rxjs';
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

	async createSession(userId: number, dto?: CreateAssistantSessionDto) {
		const id = randomUUID();
		const session = this.sessionRepo.create({
			id,
			userId,
			title: dto?.title?.trim() || null,
		});
		await this.sessionRepo.save(session);
		return { sessionId: id, title: session.title };
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
		if (!session) {
			throw new NotFoundException('会话不存在');
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
				let session: AssistantSession;
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
					if (sessionId) {
						session = await this.assertSessionOwned(userId, sessionId);
					} else {
						const id = randomUUID();
						session = this.sessionRepo.create({
							id,
							userId,
							title: null,
						});
						await this.sessionRepo.save(session);
						sessionId = id;
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

					const budget = this.getHistoryTurnBudgetTokens(dto);
					let contextTurns = takeRecentMessagesWithinTokenBudget(
						allTurns,
						budget,
					);

					if (contextTurns.length === 0 && allTurns.length > 0) {
						const last = allTurns[allTurns.length - 1];
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
					this.logger.error?.('[AssistantService] chatStream failed', {
						message: err?.message,
						stack: err?.stack,
					});
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
		await this.assertSessionOwned(userId, sessionId);
		const busy = await this.cache.get(this.streamBusyKey(sessionId));
		if (!busy) {
			return { success: false, message: '当前无进行中的生成' };
		}
		// 任意实例调用：Redis 递增 epoch，持有 fetch 的实例在读循环中比对后本地 abort
		await this.incrementStreamEpoch(sessionId);
		return { success: true, message: '已停止生成' };
	}
}
