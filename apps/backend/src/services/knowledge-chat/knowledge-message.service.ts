import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { HistoryDto, MessageDto } from './dto/message.dto';
import type { UpdateChatDto } from './dto/update-chat.dto';
import {
	KnowledgeChatMessages,
	KnowledgeMessageRole,
} from './knowledge-chat-message.entity';
import { KnowledgeChatSessions } from './knowledge-chat-session.entity';

@Injectable()
export class KnowledgeMessageService {
	constructor(
		@InjectRepository(KnowledgeChatMessages)
		private readonly chatMessagesRepository: Repository<KnowledgeChatMessages>,
		@InjectRepository(KnowledgeChatSessions)
		private readonly chatSessionsRepository: Repository<KnowledgeChatSessions>,
	) {}

	async findOneSession(sessionId: string) {
		return this.chatSessionsRepository.findOne({
			where: { id: sessionId },
		});
	}

	async findOneMessageByChatId(chatId: string) {
		return this.chatMessagesRepository.findOne({
			where: { chatId },
		});
	}

	async createSession(sessionId?: string): Promise<string> {
		const id = sessionId || randomUUID();
		let session = await this.findOneSession(id);
		if (!session) {
			session = this.chatSessionsRepository.create({ id, isActive: true });
			await this.chatSessionsRepository.save(session);
		}
		return id;
	}

	deleteSessionById(id: string) {
		return this.chatSessionsRepository.delete(id);
	}

	findSession(dto: MessageDto) {
		return this.chatSessionsRepository.findOne({
			where: { id: dto.sessionId },
			relations: ['messages'],
			order: {
				createdAt: 'DESC',
				messages: { createdAt: 'ASC' },
			},
		});
	}

	async updateSession(dto: UpdateChatDto) {
		const session = await this.findOneSession(dto.sessionId);
		if (session) {
			const merged = this.chatSessionsRepository.merge(session, dto);
			return this.chatSessionsRepository.save(merged);
		}
		throw new NotFoundException('会话不存在');
	}

	async getSessionList(
		dto: HistoryDto,
	): Promise<{ list: KnowledgeChatSessions[]; total: number }> {
		const take = dto.pageSize != null && dto.pageSize > 0 ? dto.pageSize : 20;
		const pageNo = dto.pageNo != null && dto.pageNo > 0 ? dto.pageNo : 1;
		const skip = (pageNo - 1) * take;

		const { ids, total } = await this.getSessionListIdPageWithTotal(skip, take);
		if (ids.length === 0) return { list: [], total };

		const list = await this.chatSessionsRepository.find({
			where: { id: In(ids) },
			relations: ['messages'],
			order: {
				messages: { createdAt: 'ASC' },
			},
		});

		const orderIndex = new Map(ids.map((id, i) => [id, i]));
		list.sort(
			(a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
		);

		return { list, total };
	}

	private async getSessionListIdPageWithTotal(
		skip: number,
		take: number,
	): Promise<{ ids: string[]; total: number }> {
		const raw = await this.chatSessionsRepository
			.createQueryBuilder('s')
			.select('s.id', 'id')
			.addSelect('COUNT(*) OVER ()', 'session_total')
			.orderBy('s.createdAt', 'DESC')
			.skip(skip)
			.take(take)
			.getRawMany<Record<string, unknown>>();

		if (raw.length === 0) {
			const total = await this.chatSessionsRepository.count();
			return { ids: [], total };
		}

		const totalVal = raw[0].session_total ?? raw[0].SESSION_TOTAL;
		const total =
			typeof totalVal === 'number'
				? totalVal
				: Number.parseInt(String(totalVal), 10);

		return {
			ids: raw.map((row) => String(row.id)),
			total: Number.isFinite(total) ? total : 0,
		};
	}

	async saveMessage(params: {
		sessionId: string;
		role: KnowledgeMessageRole;
		content: string;
		parentId: string | null;
		chatId?: string;
		childrenIds?: string[];
		currentChatId?: string;
		isContinuation?: boolean;
	}): Promise<string | null> {
		const {
			sessionId,
			role,
			content,
			parentId,
			chatId,
			childrenIds = [],
			currentChatId,
			isContinuation = false,
		} = params;

		const existing = chatId ? await this.findOneMessageByChatId(chatId) : null;
		let message: KnowledgeChatMessages | null = null;

		if (existing) {
			if (isContinuation && role === KnowledgeMessageRole.ASSISTANT) {
				existing.content = existing.content + content;
			} else {
				existing.content = content;
			}
			existing.childrenIds = childrenIds || existing.childrenIds || [];
			existing.currentChatId =
				currentChatId || existing.currentChatId || chatId || '';
			message = existing;
		} else {
			const session = await this.findOneSession(sessionId);
			if (!session) return null;
			message = this.chatMessagesRepository.create({
				role,
				content,
				session,
				parentId,
				childrenIds: childrenIds || [],
				chatId: chatId || '',
				currentChatId: currentChatId || chatId || '',
				sessionId,
			});
		}

		const saved = await this.chatMessagesRepository.save(message);

		if (parentId) {
			const parentMessage = await this.findOneMessageByChatId(parentId);
			if (parentMessage) {
				if (!parentMessage.childrenIds) parentMessage.childrenIds = [];
				if (!parentMessage.childrenIds.includes(saved.chatId)) {
					parentMessage.childrenIds.push(saved.chatId);
					await this.chatMessagesRepository.save(parentMessage);
				}
			}
		}

		return saved.id;
	}
}
