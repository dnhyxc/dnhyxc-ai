import {
	AIMessage,
	BaseMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelEnum } from 'src/enum/config.enum';
import { Repository } from 'typeorm';
import { estimateTokenCount } from '../assistant/assistant-context.util';
import type { SerperOrganicItem } from '../web-search/web-search.types';
import { AgentMessage, AgentMessageRole } from './agent-message.entity';
import { AgentSession } from './agent-session.entity';
import { AgentSessionSummary } from './agent-session-summary.entity';

/** 水印之后最多保留多少条消息行参与模型上下文（user/assistant 交错） */
const MAX_TAIL_MESSAGE_ROWS = 48;

/** 超过此行数则触发「持久化摘要折叠」 */
const COMPACT_ROW_THRESHOLD = 56;

/**
 * 基于 MySQL 实体维护 LangChain 所需的会话记忆（摘要表 + 消息表）
 */
@Injectable()
export class AgentMemoryService {
	constructor(
		@InjectRepository(AgentSession)
		private readonly sessionRepo: Repository<AgentSession>,
		@InjectRepository(AgentMessage)
		private readonly messageRepo: Repository<AgentMessage>,
		@InjectRepository(AgentSessionSummary)
		private readonly summaryRepo: Repository<AgentSessionSummary>,
		private readonly configService: ConfigService,
	) {}

	/** 与 Assistant 一致：智谱 GLM 模型名 */
	private getGlmModelName(): string {
		return (
			this.configService.get<string>(ModelEnum.SILICONFLOW_MODEL_NAME) ||
			this.configService.get<string>(ModelEnum.ZHIPU_MODEL_NAME) ||
			'glm-4.7'
		);
	}

	private buildCompactionModel(): ChatOpenAI {
		const apiKey = this.configService.get<string>(ModelEnum.ZHIPU_API_KEY);
		const baseURL =
			this.configService.get<string>(ModelEnum.ZHIPU_BASE_URL) ||
			'https://open.bigmodel.cn/api/paas/v4';
		const modelName =
			this.configService.get<string>('AGENT_SUMMARY_MODEL_NAME')?.trim() ||
			this.getGlmModelName();
		if (!apiKey) {
			throw new Error('智谱 API 密钥未配置（ZHIPU_API_KEY）');
		}
		return new ChatOpenAI({
			apiKey,
			modelName,
			temperature: 0.2,
			maxTokens: 2048,
			configuration: { baseURL },
			streaming: false,
			modelKwargs: { thinking: { type: 'disabled' as const } },
		});
	}

	private formatRowsTranscript(rows: AgentMessage[]): string {
		return rows
			.map((r) => {
				const tag = r.role === AgentMessageRole.USER ? '用户' : '助手';
				return `${tag}: ${r.content ?? ''}`;
			})
			.join('\n');
	}

	/**
	 * 将较早消息折叠进摘要表，并推进水印，避免跨请求上下文无限增长。
	 */
	async compactSessionIfNeeded(sessionId: string): Promise<void> {
		const summaryRow =
			(await this.summaryRepo.findOne({
				where: { sessionId },
			})) ??
			this.summaryRepo.create({ sessionId, summary: '', coversBeforeAt: null });

		const qb = this.messageRepo
			.createQueryBuilder('m')
			.where('m.session_id = :sid', { sid: sessionId })
			.orderBy('m.created_at', 'ASC');

		if (summaryRow.coversBeforeAt) {
			qb.andWhere('m.created_at > :t', { t: summaryRow.coversBeforeAt });
		}

		const rows = await qb.getMany();
		if (rows.length <= COMPACT_ROW_THRESHOLD) {
			return;
		}

		const foldCount = rows.length - MAX_TAIL_MESSAGE_ROWS;
		if (foldCount <= 0) {
			return;
		}

		const toFold = rows.slice(0, foldCount);
		const transcript = this.formatRowsTranscript(toFold);
		const model = this.buildCompactionModel();
		const merged = await model.invoke([
			new SystemMessage(
				'你是摘要助手。将「已有摘要」与「新增对话片段」合并为一条连贯的中文摘要，保留事实、结论与用户偏好；省略寒暄，控制在约 2000 字以内。',
			),
			new HumanMessage(
				`已有摘要：\n${summaryRow.summary?.trim() || '（无）'}\n\n新增片段：\n${transcript}`,
			),
		]);

		const text =
			typeof merged.content === 'string'
				? merged.content
				: Array.isArray(merged.content)
					? merged.content
							.map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
							.join('')
					: String(merged.content ?? '');

		summaryRow.summary = text.trim();
		summaryRow.coversBeforeAt = toFold[toFold.length - 1]!.createdAt;
		await this.summaryRepo.save(summaryRow);
	}

	/**
	 * 从数据库组装送入 createAgent 的消息列表（须在写入本轮 user 行之后调用，避免重复拼接用户句）
	 */
	async buildLangChainMessagesFromDb(
		sessionId: string,
	): Promise<BaseMessage[]> {
		const summaryRow = await this.summaryRepo.findOne({
			where: { sessionId },
		});

		const qb = this.messageRepo
			.createQueryBuilder('m')
			.where('m.session_id = :sid', { sid: sessionId })
			.orderBy('m.created_at', 'ASC');

		if (summaryRow?.coversBeforeAt) {
			qb.andWhere('m.created_at > :t', { t: summaryRow.coversBeforeAt });
		}

		const rows = await qb.getMany();
		const messages: BaseMessage[] = [];

		if (summaryRow?.summary?.trim()) {
			messages.push(
				new SystemMessage(
					`以下为更早对话的摘要（水印折叠），请视作上下文的一部分：\n${summaryRow.summary.trim()}`,
				),
			);
		}

		for (const r of rows) {
			if (r.role === AgentMessageRole.USER) {
				messages.push(new HumanMessage(r.content ?? ''));
			} else if (
				r.role === AgentMessageRole.ASSISTANT &&
				(r.content ?? '').trim()
			) {
				messages.push(new AIMessage(r.content ?? ''));
			}
		}

		return messages;
	}

	/** 诊断用：估算即将送入模型的历史 token（粗略） */
	estimatePromptTokens(messages: BaseMessage[]): number {
		let n = 0;
		for (const m of messages) {
			const c = m.content;
			if (typeof c === 'string') {
				n += estimateTokenCount(c);
			} else if (Array.isArray(c)) {
				n += estimateTokenCount(JSON.stringify(c));
			}
		}
		return n;
	}

	async insertUserAndAssistantPlaceholder(
		session: AgentSession,
		turnId: string,
		userContent: string,
	): Promise<{ userMessageId: string; assistantMessageId: string }> {
		const user = this.messageRepo.create({
			session,
			role: AgentMessageRole.USER,
			content: userContent,
			turnId,
		});
		await this.messageRepo.save(user);

		const assistant = this.messageRepo.create({
			session,
			role: AgentMessageRole.ASSISTANT,
			content: '',
			turnId,
		});
		await this.messageRepo.save(assistant);

		if (!session.title?.trim()) {
			const t = userContent.slice(0, 60) || '新对话';
			await this.sessionRepo.update({ id: session.id }, { title: t });
			session.title = t;
		}

		return { userMessageId: user.id, assistantMessageId: assistant.id };
	}

	async updateAssistantContent(
		sessionId: string,
		assistantMessageId: string,
		content: string,
		/** undefined：不修改 search_organic；null：清空；数组：落库 */
		searchOrganic?: SerperOrganicItem[] | null,
	): Promise<void> {
		const now = new Date();
		const patch: {
			content: string;
			searchOrganic?: SerperOrganicItem[] | null;
		} = { content };
		if (searchOrganic !== undefined) {
			patch.searchOrganic = searchOrganic;
		}
		await Promise.all([
			this.messageRepo.update({ id: assistantMessageId }, patch),
			this.sessionRepo.update({ id: sessionId }, { updatedAt: now }),
		]);
	}

	async deleteTurnPair(sessionId: string, turnId: string): Promise<void> {
		await this.messageRepo
			.createQueryBuilder()
			.delete()
			.from(AgentMessage)
			.where('session_id = :sid', { sid: sessionId })
			.andWhere('turn_id = :tid', { tid: turnId })
			.execute();
	}

	async listMessagesAsc(
		sessionId: string,
	): Promise<
		Pick<
			AgentMessage,
			'id' | 'turnId' | 'role' | 'content' | 'searchOrganic' | 'createdAt'
		>[]
	> {
		return this.messageRepo.find({
			where: { session: { id: sessionId } },
			order: { createdAt: 'ASC' },
			select: ['id', 'turnId', 'role', 'content', 'searchOrganic', 'createdAt'],
		});
	}

	async deleteSummary(sessionId: string): Promise<void> {
		await this.summaryRepo.delete({ sessionId });
	}
}
