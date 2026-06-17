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
import {
	EbookAssistantMessage,
	EbookAssistantMessageRole,
} from './ebook-assistant-message.entity';
import { EbookAssistantSession } from './ebook-assistant-session.entity';
import { EbookAssistantSessionSummary } from './ebook-assistant-session-summary.entity';

const MAX_TAIL_MESSAGE_ROWS = 48;
const COMPACT_ROW_THRESHOLD = 56;

/** 占位标题：首条用户消息落库后会被真实摘要替换 */
const PLACEHOLDER_SESSION_TITLES = new Set(['阅读对话', '新对话']);

function shouldSetTitleFromUserMessage(
	title: string | null | undefined,
): boolean {
	const t = (title ?? '').trim();
	return !t || PLACEHOLDER_SESSION_TITLES.has(t);
}

function buildSessionTitleFromUserContent(userContent: string): string {
	const line = (userContent ?? '').trim().split(/\r?\n/)[0]?.trim() ?? '';
	return (line || '新对话').slice(0, 60);
}

/** 基于 MySQL 维护电子书助手 LangChain 会话记忆（摘要表 + 消息表） */
@Injectable()
export class EbookAssistantMemoryService {
	constructor(
		@InjectRepository(EbookAssistantSession)
		private readonly sessionRepo: Repository<EbookAssistantSession>,
		@InjectRepository(EbookAssistantMessage)
		private readonly messageRepo: Repository<EbookAssistantMessage>,
		@InjectRepository(EbookAssistantSessionSummary)
		private readonly summaryRepo: Repository<EbookAssistantSessionSummary>,
		private readonly configService: ConfigService,
	) {}

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

	private formatRowsTranscript(rows: EbookAssistantMessage[]): string {
		return rows
			.map((r) => {
				const tag = r.role === EbookAssistantMessageRole.USER ? '用户' : '助手';
				return `${tag}: ${r.content ?? ''}`;
			})
			.join('\n');
	}

	async compactSessionIfNeeded(sessionId: string): Promise<void> {
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
							.map((c: unknown) =>
								typeof c === 'object' &&
								c != null &&
								'text' in c &&
								typeof (c as { text?: unknown }).text === 'string'
									? (c as { text: string }).text
									: '',
							)
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
			if (r.role === EbookAssistantMessageRole.USER) {
				messages.push(new HumanMessage(r.content ?? ''));
			} else if (
				r.role === EbookAssistantMessageRole.ASSISTANT &&
				(r.content ?? '').trim()
			) {
				messages.push(new AIMessage(r.content ?? ''));
			}
		}

		return messages;
	}

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
		session: EbookAssistantSession,
		turnId: string,
		userContent: string,
	): Promise<{ userMessageId: string; assistantMessageId: string }> {
		const user = this.messageRepo.create({
			session,
			role: EbookAssistantMessageRole.USER,
			content: userContent,
			turnId,
		});
		await this.messageRepo.save(user);

		const assistant = this.messageRepo.create({
			session,
			role: EbookAssistantMessageRole.ASSISTANT,
			content: '',
			turnId,
		});
		await this.messageRepo.save(assistant);

		if (shouldSetTitleFromUserMessage(session.title)) {
			const t = buildSessionTitleFromUserContent(userContent);
			await this.sessionRepo.update({ id: session.id }, { title: t });
			session.title = t;
		}

		return { userMessageId: user.id, assistantMessageId: assistant.id };
	}

	async updateAssistantContent(
		sessionId: string,
		assistantMessageId: string,
		content: string,
	): Promise<void> {
		const now = new Date();
		await Promise.all([
			this.messageRepo.update({ id: assistantMessageId }, { content }),
			this.sessionRepo.update({ id: sessionId }, { updatedAt: now }),
		]);
	}

	async deleteTurnPair(sessionId: string, turnId: string): Promise<void> {
		await this.messageRepo
			.createQueryBuilder()
			.delete()
			.from(EbookAssistantMessage)
			.where('session_id = :sid', { sid: sessionId })
			.andWhere('turn_id = :tid', { tid: turnId })
			.execute();
	}

	async listMessagesAsc(sessionId: string) {
		return this.messageRepo.find({
			where: { session: { id: sessionId } },
			order: { createdAt: 'ASC' },
			select: ['id', 'turnId', 'role', 'content', 'createdAt'],
		});
	}

	async deleteSummary(sessionId: string): Promise<void> {
		await this.summaryRepo.delete({ sessionId });
	}
}
