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
import { buildAgentLangchainMiddleware } from '../agent/agent-middleware';
import { LlmConfigService } from '../llm-config/llm-config.service';
import { CreateEbookAssistantSessionDto } from './dto/create-ebook-assistant-session.dto';
import { EbookAssistantChatDto } from './dto/ebook-assistant-chat.dto';
import { EbookAssistantMemoryService } from './ebook-assistant-memory.service';
import { EbookAssistantSession } from './ebook-assistant-session.entity';

const DEFAULT_EBOOK_SYSTEM_PROMPT = `你是一个电子书阅读助手。请帮助用户理解当前正在阅读的书籍内容：准确、有条理、礼貌；不确定时请说明；不要编造书中未出现的情节或事实。`;

const AGENT_STREAM_STATE_TTL_MS = 12 * 60 * 60 * 1000;

export type EbookAssistantSseChunk =
	| { type: 'content'; data: string }
	| {
			type: 'messageIds';
			data: { userMessageId: string; assistantMessageId: string };
	  };

function extractChunkText(chunk: AIMessageChunk | undefined): string {
	if (!chunk) return '';
	const { content } = chunk;
	if (typeof content === 'string') return content;
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

@Injectable()
export class EbookAssistantService {
	constructor(
		@InjectRepository(EbookAssistantSession)
		private readonly sessionRepo: Repository<EbookAssistantSession>,
		private readonly memory: EbookAssistantMemoryService,
		private readonly cache: Cache,
		private readonly configService: ConfigService,
		private readonly llmConfigService: LlmConfigService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	private streamEpochKey(sessionId: string): string {
		return `ebook_assistant:lc_stream_epoch:${sessionId}`;
	}

	private streamBusyKey(sessionId: string): string {
		return `ebook_assistant:lc_stream_busy:${sessionId}`;
	}

	private parseEpoch(v: unknown): number {
		if (typeof v === 'number' && Number.isFinite(v)) return v;
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}

	private async incrementStreamEpoch(sessionId: string): Promise<number> {
		const key = this.streamEpochKey(sessionId);
		const prev = this.parseEpoch(await this.cache.get(key));
		const next = prev + 1;
		await this.cache.set(key, next, AGENT_STREAM_STATE_TTL_MS);
		return next;
	}

	private async getStreamEpoch(sessionId: string): Promise<number> {
		return this.parseEpoch(
			await this.cache.get(this.streamEpochKey(sessionId)),
		);
	}

	private isUserAbortError(err: unknown): boolean {
		let cur: unknown = err;
		for (let i = 0; i < 8 && cur != null && typeof cur === 'object'; i++) {
			const o = cur as { name?: string; code?: unknown; cause?: unknown };
			if (o.name === 'AbortError') return true;
			if (o.code === 'ABORT_ERR' || o.code === 20) return true;
			cur = o.cause;
		}
		return false;
	}

	private async findLatestSessionIdByBook(
		userId: number,
		bookId: string,
	): Promise<string | null> {
		const row = await this.sessionRepo.findOne({
			where: { userId, bookId },
			order: { updatedAt: 'DESC' },
			select: ['id'],
		});
		return row?.id ?? null;
	}

	async createSession(userId: number, dto: CreateEbookAssistantSessionDto) {
		const bookId = dto.bookId.trim();
		if (!bookId) {
			throw new BadRequestException('bookId 不能为空');
		}
		const forceNew = dto.forceNew === true;
		if (!forceNew) {
			const existingId = await this.findLatestSessionIdByBook(userId, bookId);
			if (existingId) {
				const existing = await this.sessionRepo.findOne({
					where: { id: existingId, userId },
					select: ['id', 'title', 'bookId'],
				});
				if (existing) {
					return {
						sessionId: existing.id,
						title: existing.title,
						bookId: existing.bookId,
					};
				}
			}
		}
		const id = randomUUID();
		const session = this.sessionRepo.create({
			id,
			userId,
			bookId,
			title: dto.title?.trim() || null,
			updatedAt: new Date(),
		});
		await this.sessionRepo.save(session);
		return { sessionId: id, title: session.title, bookId };
	}

	async listSessionsByBook(
		userId: number,
		bookId: string,
		page?: { pageNo?: number; pageSize?: number },
	) {
		const bid = bookId.trim();
		if (!bid) {
			throw new BadRequestException('bookId 不能为空');
		}
		const pageNo = page?.pageNo ?? 1;
		const pageSize = page?.pageSize ?? 20;
		const [list, total] = await this.sessionRepo.findAndCount({
			where: { userId, bookId: bid },
			select: ['id', 'title', 'createdAt', 'updatedAt'],
			order: { updatedAt: 'DESC' },
			skip: (pageNo - 1) * pageSize,
			take: pageSize,
		});
		return {
			bookId: bid,
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

	async getSessionDetailByBook(userId: number, bookId: string) {
		const sid = await this.findLatestSessionIdByBook(userId, bookId.trim());
		if (!sid) return null;
		return this.getSessionDetail(userId, sid);
	}

	async getSessionDetail(userId: number, sessionId: string) {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
			select: ['id', 'bookId', 'title', 'createdAt', 'updatedAt'],
		});
		if (!session) {
			return { session: null, messages: [] };
		}
		const messages = await this.memory.listMessagesAsc(sessionId);
		return {
			session: {
				sessionId: session.id,
				bookId: session.bookId,
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
	): Promise<EbookAssistantSession> {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId, userId },
		});
		if (!session) {
			throw new NotFoundException('会话不存在');
		}
		return session;
	}

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
		await this.incrementStreamEpoch(sid);
		await this.cache.del(this.streamBusyKey(sid));
		await this.memory.deleteSummary(sid);
		await this.sessionRepo.delete({ id: sid, userId });
		return { sessionId: sid };
	}

	private async buildModels(
		userId: number,
		options: {
			maxTokens?: number;
			temperature?: number;
			signal?: AbortSignal;
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
				defaultMaxTokens: 4096,
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

	chatStream(
		userId: number,
		dto: EbookAssistantChatDto,
	): Observable<EbookAssistantSseChunk> {
		return new Observable<EbookAssistantSseChunk>((subscriber) => {
			void this.runChatStream(subscriber, userId, dto).catch((e) =>
				subscriber.error(e),
			);
		});
	}

	private async resolveOrCreateSession(
		userId: number,
		dto: EbookAssistantChatDto,
	): Promise<{ sessionId: string; session: EbookAssistantSession }> {
		const bookId = dto.bookId?.trim();

		if (dto.sessionId) {
			const session = await this.assertSessionOwned(userId, dto.sessionId);
			if (!bookId || session.bookId === bookId) {
				return { sessionId: session.id, session };
			}
			// 客户端切换书籍后可能仍携带旧 sessionId，改按 bookId 解析
		}

		if (!bookId) {
			throw new BadRequestException('缺少 sessionId 或 bookId');
		}

		const existingId = await this.findLatestSessionIdByBook(userId, bookId);
		if (existingId) {
			const session = await this.assertSessionOwned(userId, existingId);
			return { sessionId: session.id, session };
		}

		const id = randomUUID();
		const session = this.sessionRepo.create({
			id,
			userId,
			bookId,
			title: dto.title?.trim() || null,
		});
		await this.sessionRepo.save(session);
		return { sessionId: id, session };
	}

	private async runChatStream(
		subscriber: Subscriber<EbookAssistantSseChunk>,
		userId: number,
		dto: EbookAssistantChatDto,
	): Promise<void> {
		let sessionId: string | undefined;
		let session!: EbookAssistantSession;
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
				await this.memory.deleteTurnPair(streamSessionId, activeTurnId);
				return;
			}
			await this.memory.updateAssistantContent(
				streamSessionId,
				assistantMessageId,
				accumulated,
			);
		};

		const cleanupTurnOnFailure = async () => {
			if (!streamSessionId || !activeTurnId || !assistantMessageId) return;
			try {
				if (accumulated.trim()) {
					await this.memory.updateAssistantContent(
						streamSessionId,
						assistantMessageId,
						accumulated,
					);
				} else {
					await this.memory.deleteTurnPair(streamSessionId, activeTurnId);
				}
			} catch (cleanupErr: unknown) {
				this.logger.error?.(
					'[EbookAssistantService] 本轮消息收尾失败',
					cleanupErr,
				);
			}
		};

		try {
			const resolved = await this.resolveOrCreateSession(userId, dto);
			sessionId = resolved.sessionId;
			session = resolved.session;
			streamSessionId = sessionId;

			await this.memory.compactSessionIfNeeded(sessionId);

			const turnId = randomUUID();
			activeTurnId = turnId;
			const { userMessageId: uid, assistantMessageId: aid } =
				await this.memory.insertUserAndAssistantPlaceholder(
					session,
					turnId,
					dto.content.trim(),
				);
			assistantMessageId = aid;
			subscriber.next({
				type: 'messageIds',
				data: { userMessageId: uid, assistantMessageId: aid },
			});

			const lcMessages =
				await this.memory.buildLangChainMessagesFromDb(sessionId);
			const extra = dto.extraUserContentForModel?.trim();
			if (extra) {
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
					lcMessages[i] = new HumanMessage(`${plain}\n\n${extra}`);
					break;
				}
			}

			const abortController = new AbortController();
			const epochAtStart = await this.incrementStreamEpoch(sessionId);
			await this.cache.set(
				this.streamBusyKey(sessionId),
				String(epochAtStart),
				AGENT_STREAM_STATE_TTL_MS,
			);

			const { main: mainLlm, summary: summaryLlm } = await this.buildModels(
				userId,
				{
					maxTokens: dto.maxTokens,
					temperature: dto.temperature,
					signal: abortController.signal,
				},
			);

			// 暂不接入工具；后续可在 tools 参数扩展
			const agent = createAgent({
				model: mainLlm,
				tools: [],
				systemPrompt: DEFAULT_EBOOK_SYSTEM_PROMPT,
				middleware: buildAgentLangchainMiddleware({
					summaryLlm: summaryLlm,
					estimatePromptTokens: (msgs) =>
						this.memory.estimatePromptTokens(msgs),
				}),
			});

			const eventStream = agent.streamEvents(
				{ messages: lcMessages },
				{ version: 'v2', signal: abortController.signal },
			);

			for await (const ev of eventStream) {
				const curEpoch = await this.getStreamEpoch(sessionId);
				if (curEpoch !== epochAtStart) {
					abortController.abort();
				}

				if (ev.event === 'on_chat_model_stream') {
					const chunk = ev.data?.chunk as AIMessageChunk | undefined;
					const text = extractChunkText(chunk);
					if (text) {
						accumulated += text;
						subscriber.next({ type: 'content', data: text });
					}
				}
			}

			await finalizeTurn();
			subscriber.complete();
		} catch (err: unknown) {
			if (!this.isUserAbortError(err)) {
				this.logger.error?.('[EbookAssistantService] chatStream failed', err);
			}
			await cleanupTurnOnFailure();
			subscriber.error(err);
		} finally {
			if (sessionId) {
				await this.cache.del(this.streamBusyKey(sessionId));
			}
		}
	}

	async stopStream(sessionId: string, userId: number) {
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
		await this.incrementStreamEpoch(sessionId);
		return { success: true, message: '已停止生成' };
	}
}
