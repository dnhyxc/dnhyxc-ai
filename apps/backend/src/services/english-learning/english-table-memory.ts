import {
	AIMessage,
	BaseMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
	createLlm,
	GLM_THINKING_DISABLED_KWARGS,
} from '../../utils/create-llm';
import type {
	AgentTurnMemory,
	UpdateAssistantContentOpts,
} from '../agent/agent-turn-memory';
import { LlmConfigService } from '../llm-config/llm-config.service';
import {
	EnglishAgentMessage,
	EnglishAgentMessageRole,
} from './entity/english-agent-message.entity';
import { EnglishAgentSession } from './entity/english-agent-session.entity';
import { EnglishAgentSessionSummary } from './entity/english-agent-session-summary.entity';

const MAX_TAIL_MESSAGE_ROWS = 45;
const COMPACT_ROW_THRESHOLD = 53;

/** 英语学习业务记忆 → english_agent_* */
@Injectable()
export class EnglishTableMemory implements AgentTurnMemory {
	constructor(
		@InjectRepository(EnglishAgentSession)
		private readonly sessionRepo: Repository<EnglishAgentSession>,
		@InjectRepository(EnglishAgentMessage)
		private readonly messageRepo: Repository<EnglishAgentMessage>,
		@InjectRepository(EnglishAgentSessionSummary)
		private readonly summaryRepo: Repository<EnglishAgentSessionSummary>,
		private readonly configService: ConfigService,
		private readonly llmConfigService: LlmConfigService,
	) {}

	private async buildCompactionModel(userId: number): Promise<ChatOpenAI> {
		return createLlm(
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
	}

	async compactSessionIfNeeded(
		sessionId: string,
		userId: number,
	): Promise<void> {
		const summaryRow =
			(await this.summaryRepo.findOne({ where: { sessionId } })) ??
			this.summaryRepo.create({
				sessionId,
				summary: '',
				coversBeforeAt: null,
			});

		const qb = this.messageRepo
			.createQueryBuilder('m')
			.where('m.session_id = :sid', { sid: sessionId })
			.orderBy('m.created_at', 'ASC');
		if (summaryRow.coversBeforeAt) {
			qb.andWhere('m.created_at > :t', { t: summaryRow.coversBeforeAt });
		}
		const rows = await qb.getMany();
		if (rows.length <= COMPACT_ROW_THRESHOLD) return;
		const foldCount = rows.length - MAX_TAIL_MESSAGE_ROWS;
		if (foldCount <= 0) return;

		const toFold = rows.slice(0, foldCount);
		const transcript = toFold
			.map((r) => {
				const tag = r.role === EnglishAgentMessageRole.USER ? '用户' : '助手';
				return `${tag}: ${r.content ?? ''}`;
			})
			.join('\n');
		const model = await this.buildCompactionModel(userId);
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
			if (r.role === EnglishAgentMessageRole.USER) {
				messages.push(new HumanMessage(r.content ?? ''));
			} else if (
				r.role === EnglishAgentMessageRole.ASSISTANT &&
				(r.content ?? '').trim()
			) {
				messages.push(new AIMessage(r.content ?? ''));
			}
		}
		return messages;
	}

	async insertUserAndAssistantPlaceholder(
		sessionId: string,
		turnId: string,
		userContent: string,
	): Promise<{ userMessageId: string; assistantMessageId: string }> {
		const session = await this.sessionRepo.findOne({
			where: { id: sessionId },
		});
		if (!session) {
			throw new Error(`英语学习会话不存在: ${sessionId}`);
		}
		const user = this.messageRepo.create({
			session,
			role: EnglishAgentMessageRole.USER,
			content: userContent,
			turnId,
		});
		await this.messageRepo.save(user);
		const assistant = this.messageRepo.create({
			session,
			role: EnglishAgentMessageRole.ASSISTANT,
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
		opts?: UpdateAssistantContentOpts,
	): Promise<void> {
		const now = new Date();
		const patch: {
			content: string;
			searchOrganic?: UpdateAssistantContentOpts['searchOrganic'];
		} = { content };
		if (opts?.searchOrganic !== undefined) {
			patch.searchOrganic = opts.searchOrganic;
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
			.from(EnglishAgentMessage)
			.where('session_id = :sid', { sid: sessionId })
			.andWhere('turn_id = :tid', { tid: turnId })
			.execute();
	}

	async listMessagesAsc(sessionId: string) {
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
