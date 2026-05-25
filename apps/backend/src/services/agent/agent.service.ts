import { randomUUID } from 'node:crypto';
import { type AIMessageChunk, HumanMessage } from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import { Cache } from '@nestjs/cache-manager';
import {
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
import { KnowledgeQaService } from '../knowledge-qa/knowledge-qa.service';
import { WebSearchService } from '../web-search/web-search.service';
import type {
	SerperOrganicItem,
	WebSearchOrganicItem,
} from '../web-search/web-search.types';
import { AgentMemoryService } from './agent-memory.service';
import { buildAgentLangchainMiddleware } from './agent-middleware';
import { AgentSession } from './agent-session.entity';
import { buildAgentLangChainTools } from './agent-tools';
import { AgentChatDto } from './dto/agent-chat.dto';
import { CreateAgentSessionDto } from './dto/create-agent-session.dto';

// 默认Agent系统提示语（中文，指令型，包含工具使用指引）
const DEFAULT_AGENT_SYSTEM_PROMPT = `你是一个具备工具调用能力的智能助手（ReAct Agent）。请准确、有条理地回答；不确定时请说明；不要编造事实。
涉及用户自有文档、笔记、已入库知识时优先使用「知识库检索」工具；需要时效信息或公开网页时使用互联网搜索工具。
引用互联网检索摘录时，在句末使用【1】【2】等与摘录序号一致的角标（全角方括号），便于展示来源胶囊。`;

/** 英语学习场景下追加的系统提示（assistMode=english_learning） */
const ENGLISH_LEARNING_SYSTEM_APPEND = `【英语学习专项约束】
你面向希望提升英语（English）的普通话使用者，内容可覆盖单词、短语、短文、口语表达与即时翻译需求。
0）服务范围（优先遵守）：仅回答与英语学习直接相关的问题，例如词汇与短语、语法、阅读与写作、口语表达、中英互译、英文材料理解、学习方法与练习设计等。若用户问题明显与英语学习无关（如编程调试、数学/物理等非英语学科作业、生活百科、财经投资建议、非英语学习类长文创作、闲聊八卦等），不得调用任何工具，也不要展开无关解答；应礼貌说明本对话为「英语学习助手」，当前问题超出服务范围，并简短建议用户改用通用智能对话或其它合适渠道。语气友善、克制，一两段即可，勿训斥用户。
1）词汇与短语：给出释义、常见搭配、1～2 个地道例句；凡列出单词或短语须标注 IPA 音标（国际音标）；表格或列表逐条给出读音标注；说明仅供参考，以权威词典为准。
2）短文：可按用户水平（如 A1～C1 或初中/高中/四级等自述）生成或改写精读材料，配关键句讲解；长文分段输出便于跟读。
3）口语：提供场景对话范例、可替换说法、常用应答；说明无法替代真人纠音与外教课。
4）实时翻译：用户粘贴中英文段落时给出对应译文；可逐句对照或先原文后译文；专有名词、歧义词简要注明取舍理由；不声称等同专业同声传译或法律医学认证译文。
5）名著与文献：以导读、节选、摘要、讨论为主；公版作品可短节选并注释；仍在版权期的现代作品避免大段复制原文，以摘要与仿写练习为主。
6）工具：仅在问题属于英语学习范畴时调用；用户生词本与笔记已入库时优先「知识库检索」；需核查用法或新闻英语时可适度「互联网搜索」摘要并标注信息性质。
7）边界：拒绝违规内容；敏感话题以中性语言学习角度处理或礼貌拒绝。`;

function resolveAgentSystemPrompt(dto: AgentChatDto): string {
	if (dto.assistMode === 'english_learning') {
		return `${DEFAULT_AGENT_SYSTEM_PROMPT}\n\n${ENGLISH_LEARNING_SYSTEM_APPEND}`;
	}
	return DEFAULT_AGENT_SYSTEM_PROMPT;
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
	  }
	| { type: 'searchOrganic'; data: { organic: SerperOrganicItem[] } }
	| {
			type: 'messageIds';
			data: { userMessageId: string; assistantMessageId: string };
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
			updatedAt: new Date(),
		});
		await this.sessionRepo.save(session);
		return { sessionId: id, title: session.title };
	}

	/**
	 * 分页列出当前用户的 Agent 会话（按更新时间倒序，供英语学习历史抽屉）
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
		const qb = this.sessionRepo
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
	private buildModels(options: {
		maxTokens?: number;
		temperature?: number;
		signal?: AbortSignal;
	}): { main: ChatOpenAI; summary: ChatOpenAI } {
		const main = createLlm(this.configService, {
			preset: 'chat',
			streaming: true,
			temperature: options.temperature,
			defaultTemperature: 0.3,
			maxTokens: options.maxTokens,
			defaultMaxTokens: 4096,
			abortSignal: options.signal,
			modelKwargs: GLM_THINKING_DISABLED_KWARGS,
		});
		const summary = createLlm(this.configService, {
			preset: 'chat',
			streaming: false,
			temperature: 0.2,
			maxTokens: 2048,
			modelKwargs: GLM_THINKING_DISABLED_KWARGS,
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
		/** 本轮合并后的联网检索列表（去重），落库与 SSE 推送前补 position */
		let turnSearchOrganic: WebSearchOrganicItem[] = [];
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
			// 正常则补全 assistant 正文与联网胶囊数据源
			const organicToSave =
				turnSearchOrganic.length > 0
					? withAgentOrganicPositions(turnSearchOrganic)
					: null;
			await this.memory.updateAssistantContent(
				streamSessionId,
				assistantMessageId,
				accumulated,
				organicToSave,
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
					const organicToSave =
						turnSearchOrganic.length > 0
							? withAgentOrganicPositions(turnSearchOrganic)
							: null;
					await this.memory.updateAssistantContent(
						streamSessionId,
						assistantMessageId,
						accumulated,
						organicToSave,
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

			// （4）构建 langchain message 历史（user 行入库为纯 `content`；intentPrefix 仅注入本轮模型输入）
			const lcMessages =
				await this.memory.buildLangChainMessagesFromDb(sessionId);
			const intent =
				dto.assistMode === 'english_learning'
					? dto.intentPrefix?.trim()
					: undefined;
			if (intent) {
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
					lcMessages[i] = new HumanMessage(`${intent}\n\n${plain}`);
					break;
				}
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
			const { main: mainLlm, summary: summaryLlm } = this.buildModels({
				maxTokens: dto.maxTokens,
				temperature: dto.temperature,
				signal: abortController.signal,
			});

			// （7）拼装工具集（见 agent-langchain-tools.ts）
			const tools = buildAgentLangChainTools(
				{
					webSearchService: this.webSearchService,
					knowledgeQaService: this.knowledgeQaService,
					userId,
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
			);

			// （8）创建Agent
			const agent = createAgent({
				// 构建Agent所需核心参数，包括主模型、工具集、系统提示与中间件
				model: mainLlm, // 主聊天大模型，流式推理
				tools, // 工具列表（如 Web 检索、RAG、当前日期等）
				systemPrompt: resolveAgentSystemPrompt(dto),
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
