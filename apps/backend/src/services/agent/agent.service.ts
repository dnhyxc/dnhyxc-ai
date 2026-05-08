import { randomUUID } from 'node:crypto';
import type { AIMessageChunk } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
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
import { InjectRepository } from '@nestjs/typeorm';
import { createAgent } from 'langchain';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Observable, type Subscriber } from 'rxjs';
import { ModelEnum } from 'src/enum/config.enum';
import { Repository } from 'typeorm';
import { KnowledgeQaService } from '../knowledge-qa/knowledge-qa.service';
import { WebSearchService } from '../web-search/web-search.service';
import { AgentMemoryService } from './agent-memory.service';
import { buildAgentLangchainMiddleware } from './agent-middleware';
import { AgentSession } from './agent-session.entity';
import { buildAgentLangChainTools } from './agent-tools';
import { AgentChatDto } from './dto/agent-chat.dto';
import { CreateAgentSessionDto } from './dto/create-agent-session.dto';

// 默认Agent系统提示语（中文，指令型，包含工具使用指引）
const DEFAULT_AGENT_SYSTEM_PROMPT = `你是一个具备工具调用能力的智能助手（ReAct Agent）。请准确、有条理地回答；不确定时请说明；不要编造事实。
涉及用户自有文档、笔记、已入库知识时优先使用「知识库检索」工具；需要时效信息或公开网页时使用互联网搜索工具。`;

// Agent会话流式相关状态缓存的存活时间（12小时）
const AGENT_STREAM_STATE_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * 从LangChain流式chunk对象中提取模型输出的可见文本
 * @param chunk AIMessageChunk类型，可能为undefined
 * @returns 提取到的文本内容
 */
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
	  };

@Injectable()
export class AgentService {
	constructor(
		@InjectRepository(AgentSession)
		private readonly sessionRepo: Repository<AgentSession>, // TypeORM仓库，操作会话表
		private readonly memory: AgentMemoryService, // 管理Agent记忆的服务，处理历史消息等
		private readonly cache: Cache, // 使用NestJS缓存，存流式状态
		private readonly configService: ConfigService, // 读取环境配置
		private readonly webSearchService: WebSearchService, // 提供Web搜索工具
		private readonly knowledgeQaService: KnowledgeQaService, // 提供知识库 RAG 工具工厂
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService, // 日志
	) {}

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
		const session = this.sessionRepo.create({
			id,
			userId,
			title: dto?.title?.trim() || null,
		});
		await this.sessionRepo.save(session);
		return { sessionId: id, title: session.title };
	}

	/**
	 * 查询会话详情及全部消息（升序）
	 * @param userId 用户ID（做权限隔离）
	 * @param sessionId 会话ID
	 */
	async getSessionDetail(userId: number, sessionId: string) {
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
	 * 与 Assistant 模块一致：智谱 GLM 模型名解析顺序
	 */
	private getGlmModelName(): string {
		return (
			this.configService.get<string>(ModelEnum.ASSISTANT_GLM_MODEL_NAME) ||
			this.configService.get<string>(ModelEnum.ZHIPU_MODEL_NAME) ||
			'glm-4.7'
		);
	}

	/**
	 * 构建主模型与摘要模型（智谱 OpenAI 兼容接口 + ChatOpenAI）
	 * @param options maxTokens|temperature|signal
	 */
	private buildModels(options: {
		maxTokens?: number;
		temperature?: number;
		signal?: AbortSignal;
	}): { main: ChatOpenAI; summary: ChatOpenAI } {
		const apiKey = this.configService.get<string>(ModelEnum.ZHIPU_API_KEY);
		const baseURL =
			this.configService.get<string>(ModelEnum.ZHIPU_BASE_URL) ||
			'https://open.bigmodel.cn/api/paas/v4';
		const modelName = this.getGlmModelName();
		if (!apiKey) {
			throw new HttpException(
				'智谱 GLM 未正确配置（ZHIPU_API_KEY）',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
		// 与 assistant.service 中智谱请求一致：关闭 thinking（思考链），避免干扰工具调用与流式正文
		const modelKwargs = { thinking: { type: 'disabled' as const } };
		// 主模型：用于主会话推理，流式
		const main = new ChatOpenAI({
			apiKey,
			modelName,
			streaming: true,
			temperature: options.temperature ?? 0.3,
			maxTokens: options.maxTokens ?? 4096,
			configuration: { baseURL },
			modelKwargs,
			...(options.signal && {
				callOptions: { signal: options.signal },
			}),
		});
		// 摘要模型：非流式、温度低，用于 summarizationMiddleware / 折叠摘要
		const summaryModelName =
			this.configService.get<string>('AGENT_SUMMARY_MODEL_NAME')?.trim() ||
			modelName;
		const summary = new ChatOpenAI({
			apiKey,
			modelName: summaryModelName,
			streaming: false,
			temperature: 0.2,
			maxTokens: 2048,
			configuration: { baseURL },
			modelKwargs,
		});
		return { main, summary };
	}

	/**
	 * Agent聊天接口，返回Observable流，每个事件即为SSE chunk
	 * @param userId 用户ID
	 * @param dto 请求体，包含会话信息、文本、参数
	 */
	chatStream(userId: number, dto: AgentChatDto): Observable<AgentSseChunk> {
		return new Observable<AgentSseChunk>((subscriber) => {
			// 捕获异常落日志给observable error
			void this.runChatStream(subscriber, userId, dto).catch((e) =>
				subscriber.error(e),
			);
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
		let sessionId = dto.sessionId; // 可能是新会话
		let session!: AgentSession;
		let accumulated = ''; // 用户本轮assistant回复内容临时拼接
		let assistantMessageId: string | undefined;
		let activeTurnId: string | undefined;
		let streamSessionId: string | undefined;

		/**
		 * 当前turn完成时的存储收尾，更新内容/清理无回复
		 */
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
				// 若assistant回复为空，删掉本轮消息
				await this.memory.deleteTurnPair(streamSessionId, activeTurnId);
				return;
			}
			// 正常则补全assistant message内容
			await this.memory.updateAssistantContent(
				streamSessionId,
				assistantMessageId,
				accumulated,
			);
		};

		/**
		 * 流式中异常/中断时的兜底数据一致性处理
		 * （如用户abort，assistant内容有就存，没有则删）
		 */
		const cleanupTurnOnFailure = async () => {
			if (!streamSessionId || !activeTurnId || !assistantMessageId) {
				return;
			}
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
				this.logger.error?.('[AgentService] 本轮消息收尾失败', cleanupErr);
			}
		};

		try {
			// （1）会话校验/新建
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
			streamSessionId = sessionId;

			// （2）会话自动摘要压缩（如需要）
			await this.memory.compactSessionIfNeeded(sessionId);

			// （3）新一轮对话turn占位
			const turnId = randomUUID();
			activeTurnId = turnId;
			const { assistantMessageId: aid } =
				await this.memory.insertUserAndAssistantPlaceholder(
					session,
					turnId,
					dto.content.trim(),
				);
			assistantMessageId = aid;

			// （4）构建 langchain message 历史
			const lcMessages =
				await this.memory.buildLangChainMessagesFromDb(sessionId);

			// （5）流式并发控制（epoch机制），每次流式启动+1，高并发终止旧流
			const abortController = new AbortController();
			const epochAtStart = await this.incrementStreamEpoch(sessionId);
			await this.cache.set(
				this.streamBusyKey(sessionId),
				String(epochAtStart),
				AGENT_STREAM_STATE_TTL_MS,
			);

			// （6）构建主模型与摘要模型
			const { main: mainLlm, summary: summaryLlm } = this.buildModels({
				maxTokens: dto.maxTokens,
				temperature: dto.temperature,
				signal: abortController.signal,
			});

			// （7）拼装工具集（见 agent-langchain-tools.ts）
			const tools = buildAgentLangChainTools({
				webSearchService: this.webSearchService,
				knowledgeQaService: this.knowledgeQaService,
				userId,
			});

			// （8）创建Agent
			const agent = createAgent({
				// 构建Agent所需核心参数，包括主模型、工具集、系统提示与中间件
				model: mainLlm, // 主聊天大模型，流式推理
				tools, // 工具列表（如Web检索、rag、获取时间等）
				systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT, // 系统级指令型提示语，统一Agent行为
				middleware: buildAgentLangchainMiddleware({
					summaryLlm: summaryLlm,
					estimatePromptTokens: (msgs) =>
						this.memory.estimatePromptTokens(msgs),
				}),
			});

			// （9）开始流式事件主循环
			const eventStream = agent.streamEvents(
				{ messages: lcMessages },
				{ version: 'v2', signal: abortController.signal },
			);

			for await (const ev of eventStream) {
				// 并发安全：若epoch被外部+1（如stopStream），abort终止
				const curEpoch = await this.getStreamEpoch(sessionId);
				if (curEpoch !== epochAtStart) {
					abortController.abort();
				}

				// 模型主内容流
				if (ev.event === 'on_chat_model_stream') {
					const chunk = ev.data?.chunk as AIMessageChunk | undefined;
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

			// 最后收尾，完整保存assistant内容
			await finalizeTurn();
			// 通知流结束
			subscriber.complete();
		} catch (err: unknown) {
			// 仅非用户abort时记录err
			if (!this.isUserAbortError(err)) {
				this.logger.error?.('[AgentService] chatStream failed', err);
			}
			await cleanupTurnOnFailure();
			// 向外传播异常
			subscriber.error(err);
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
		// 清理busy态
		await this.cache.del(this.streamBusyKey(sid));
		// 清理记忆摘要
		await this.memory.deleteSummary(sid);
		// 删数据库会话本体
		await this.sessionRepo.delete({ id: sid, userId });
		return { sessionId: sid };
	}
}
