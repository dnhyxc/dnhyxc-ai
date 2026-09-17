import {
	AIMessage,
	BaseMessage,
	HumanMessage,
	SystemMessage,
} from '@langchain/core/messages';
import type { ChatOpenAI } from '@langchain/openai';
import { Injectable, NotFoundException } from '@nestjs/common';
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
	AssistantMessage,
	AssistantMessageRole,
} from './assistant-message.entity';
import { AssistantSession } from './assistant-session.entity';
import { AssistantSessionSummary } from './assistant-session-summary.entity';

/** 水印之后保留进 prompt 的原文消息上限（与 Agent / 英语记忆对齐） */
const MAX_TAIL_MESSAGE_ROWS = 45;
/** 未折叠行数超过此阈值才触发摘要压缩 */
const COMPACT_ROW_THRESHOLD = 53;

/**
 * 知识库 Skill：消息读写 `assistant_*`，供 Agent SSE 组上下文。
 * 不写 `agent_messages`；停流 epoch 仍用请求里的 agent sessionId。
 * 长对话经 `assistant_session_summaries` 水印摘要折叠，避免只截尾丢历史。
 */
@Injectable()
export class AssistantTableMemory {
	constructor(
		@InjectRepository(AssistantSession)
		private readonly sessionRepo: Repository<AssistantSession>,
		@InjectRepository(AssistantMessage)
		private readonly messageRepo: Repository<AssistantMessage>,
		@InjectRepository(AssistantSessionSummary)
		private readonly summaryRepo: Repository<AssistantSessionSummary>,
		private readonly configService: ConfigService,
		private readonly llmConfigService: LlmConfigService,
	) {}

	/** 按用户绑定，保证只能写本人助手会话 */
	forUser(userId: number): AgentTurnMemory {
		return {
			compactSessionIfNeeded: (sid, uid) =>
				this.compactSessionIfNeeded(sid, uid),
			insertUserAndAssistantPlaceholder: (sid, turnId, content) =>
				this.insertUserAndAssistantPlaceholder(userId, sid, turnId, content),
			buildLangChainMessagesFromDb: (sid) =>
				this.buildLangChainMessagesFromDb(sid),
			updateAssistantContent: (sid, msgId, content, opts) =>
				this.updateAssistantContent(sid, msgId, content, opts),
			deleteTurnPair: (sid, turnId) => this.deleteTurnPair(sid, turnId),
		};
	}

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

	/** 将较早消息折叠进摘要表并推进水印 */
	async compactSessionIfNeeded(
		businessSessionId: string,
		userId: number,
	): Promise<void> {
		const summaryRow =
			(await this.summaryRepo.findOne({
				where: { sessionId: businessSessionId },
			})) ??
			this.summaryRepo.create({
				sessionId: businessSessionId,
				summary: '',
				coversBeforeAt: null,
			});

		const qb = this.messageRepo
			.createQueryBuilder('m')
			.where('m.session_id = :sid', { sid: businessSessionId })
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
				const tag = r.role === AssistantMessageRole.USER ? '用户' : '助手';
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

	async insertUserAndAssistantPlaceholder(
		userId: number,
		businessSessionId: string,
		turnId: string,
		userContent: string,
	): Promise<{ userMessageId: string; assistantMessageId: string }> {
		const session = await this.sessionRepo.findOne({
			where: { id: businessSessionId, userId },
		});
		if (!session) {
			throw new NotFoundException('助手会话不存在');
		}

		const user = this.messageRepo.create({
			session,
			role: AssistantMessageRole.USER,
			content: userContent,
			turnId,
		});
		await this.messageRepo.save(user);

		const assistant = this.messageRepo.create({
			session,
			role: AssistantMessageRole.ASSISTANT,
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

	async buildLangChainMessagesFromDb(
		businessSessionId: string,
	): Promise<BaseMessage[]> {
		const summaryRow = await this.summaryRepo.findOne({
			where: { sessionId: businessSessionId },
		});
		const qb = this.messageRepo
			.createQueryBuilder('m')
			.where('m.session_id = :sid', { sid: businessSessionId })
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
			if (r.role === AssistantMessageRole.USER) {
				messages.push(new HumanMessage(r.content ?? ''));
			} else if (
				r.role === AssistantMessageRole.ASSISTANT &&
				(r.content ?? '').trim()
			) {
				messages.push(new AIMessage(r.content ?? ''));
			}
		}
		return messages;
	}

	async updateAssistantContent(
		businessSessionId: string,
		assistantMessageId: string,
		content: string,
		opts?: UpdateAssistantContentOpts,
	): Promise<void> {
		// assistant_messages 无 search_organic；联网胶囊经 SSE 推前端，此处只落正文与 appliedSkills
		const now = new Date();
		const patch: {
			content: string;
			appliedSkills?: NonNullable<UpdateAssistantContentOpts['appliedSkills']>;
		} = { content };
		// 仅在有 Skill 时写入；勿用 null 覆盖（避免误清）
		if (opts?.appliedSkills?.length) {
			patch.appliedSkills = opts.appliedSkills;
		}
		await Promise.all([
			this.messageRepo.update({ id: assistantMessageId }, patch),
			this.sessionRepo.update({ id: businessSessionId }, { updatedAt: now }),
		]);
	}

	async deleteTurnPair(
		businessSessionId: string,
		turnId: string,
	): Promise<void> {
		await this.messageRepo
			.createQueryBuilder()
			.delete()
			.from(AssistantMessage)
			.where('session_id = :sid', { sid: businessSessionId })
			.andWhere('turn_id = :tid', { tid: turnId })
			.execute();
	}
}
