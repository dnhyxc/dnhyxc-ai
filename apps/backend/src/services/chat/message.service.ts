import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOneOptions, Repository } from 'typeorm';
import { Attachments } from './attachments.entity';
import { ChatMessages } from './chat.entity';
import { CreateSessionDto } from './dto/chat-request.dto';
import { HistoryDto, MessageDto, SaveDto } from './dto/message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { ChatSessions } from './session.entity';

@Injectable()
export class MessageService {
	constructor(
		@InjectRepository(ChatMessages)
		private readonly chatMessagesRepository: Repository<ChatMessages>,
		@InjectRepository(ChatSessions)
		private readonly chatSessionsRepository: Repository<ChatSessions>,
		@InjectRepository(Attachments)
		private readonly attachmentsRepository: Repository<Attachments>,
	) {}

	// 获取会话
	async findOneSession(
		sessionId: string,
		options?: FindOneOptions<ChatSessions>,
	) {
		return this.chatSessionsRepository.findOne({
			where: {
				id: sessionId,
			},
			relations: options?.relations,
			order: options?.order,
		});
	}

	// 获取单个消息（通过id）
	async findOneMessage(id: string, options?: FindOneOptions<ChatSessions>) {
		return this.chatMessagesRepository.findOne({
			where: {
				id,
			},
			relations: options?.relations,
			order: options?.order,
		});
	}

	// 通过chatId获取单个消息
	async findOneMessageByChatId(
		chatId: string,
		options?: FindOneOptions<ChatSessions>,
	) {
		return this.chatMessagesRepository.findOne({
			where: {
				chatId,
			},
			relations: options?.relations,
			order: options?.order,
		});
	}

	async findMessages(dto: { chatSessionId: string; messageIds?: string[] }) {
		if (!dto.messageIds || dto.messageIds.length === 0) {
			// 如果没有指定 message_ids，返回空的 messages
			const chatSession = await this.chatSessionsRepository.findOne({
				where: { id: dto.chatSessionId },
				relations: ['messages'],
				order: {
					messages: {
						createdAt: 'ASC',
					},
				},
			});

			if (!chatSession) {
				throw new NotFoundException('会话不存在');
			}

			return chatSession;
		}

		const chatSession = await this.chatSessionsRepository
			.createQueryBuilder('chatSession')
			.leftJoinAndSelect(
				'chatSession.messages',
				'message',
				'message.chatId IN (:...messageIds)',
				{ messageIds: dto.messageIds },
			)
			.where('chatSession.id = :chatSessionId', {
				chatSessionId: dto.chatSessionId,
			})
			.orderBy('message.createdAt', 'ASC')
			.getOne();

		if (!chatSession) {
			throw new NotFoundException('会话不存在');
		}

		return chatSession;
	}

	async createSession(dto: CreateSessionDto) {
		const sessionId = dto.sessionId || randomUUID();
		let session = await this.findOneSession(sessionId);
		if (!session) {
			session = this.chatSessionsRepository.create({
				id: sessionId,
				isActive: true,
			});
			await this.chatSessionsRepository.save(session);
		}
		return sessionId;
	}

	// 保存消息到数据库
	async saveMessage(params: SaveDto) {
		const {
			sessionId,
			role,
			content,
			attachments = [],
			parentId = null,
			// isRegenerate = false,
			chatId,
			childrenIds = [],
			currentChatId,
		} = params;

		try {
			// 检查是否已存在相同 chatId 的消息
			let message: ChatMessages | null = null;
			const existingMessage = chatId
				? await this.findOneMessageByChatId(chatId)
				: null;

			if (existingMessage) {
				// 更新现有消息
				// 对于继续生成，应该追加内容而不是替换
				// 但前端传递的是完整内容，所以直接替换
				existingMessage.content = content;
				existingMessage.childrenIds =
					childrenIds || existingMessage.childrenIds || [];
				existingMessage.currentChatId =
					currentChatId || existingMessage.currentChatId || chatId || '';
				message = existingMessage;
			} else {
				const session = await this.findOneSession(sessionId);
				if (!session) return null;
				// 创建新消息
				message = this.chatMessagesRepository.create({
					role,
					content,
					session,
					parentId,
					childrenIds: childrenIds || [], // 使用前端传递的 childrenIds
					chatId: chatId || '', // 保存 chatId 字段
					currentChatId: currentChatId || chatId || '', // 保存 currentChatId 字段，以前端传递的为准
					sessionId,
				});
			}

			// 保存消息
			const savedMessage = await this.chatMessagesRepository.save(message);

			// 更新父消息的 childrenIds（适用于所有消息类型）
			// 严格参照前端逻辑：如果消息有 parentId，需要更新父消息的 childrenIds
			// 注意：这个逻辑适用于所有消息类型，包括 user 和 assistant
			// 当 user 消息的 parentId 指向 assistant 消息时，需要更新 assistant 消息的 childrenIds
			// 当 assistant 消息的 parentId 指向 user 消息时，需要更新 user 消息的 childrenIds
			// 对于重新生成的情况：新的 assistant 消息与原始 assistant 消息有相同的 parentId（指向 user 消息）
			// user 消息的 childrenIds 应该包含所有 assistant 消息的 chatId（原始的和重新生成的）
			if (parentId) {
				// 查找父消息（通过chatId查找，因为parentId存储的是chatId）
				const parentMessage = await this.findOneMessageByChatId(parentId);
				if (parentMessage) {
					// 确保 childrenIds 数组存在
					if (!parentMessage.childrenIds) {
						parentMessage.childrenIds = [];
					}

					// 添加当前消息的 chatId 到父消息的 childrenIds（不重复添加）
					// 严格参照前端逻辑：检查是否已包含，避免重复添加
					// 对于重新生成的 assistant 消息，user 消息的 childrenIds 应该包含所有 assistant 消息的 chatId
					if (!parentMessage.childrenIds.includes(savedMessage.chatId)) {
						parentMessage.childrenIds.push(savedMessage.chatId);
						await this.chatMessagesRepository.save(parentMessage);
					}
				}
			}

			// 如果有附件，保存附件信息
			if (attachments?.length > 0) {
				const files = attachments.map((attachment) => {
					const createdAttachment = this.attachmentsRepository.create({
						...attachment,
						message: savedMessage,
					});
					return createdAttachment;
				});
				await this.attachmentsRepository.save(files);
			}

			return savedMessage.id;
		} catch (dbError) {
			console.error('Failed to save message to database:', dbError);
			return null;
		}
	}

	deleteSessionById(id: string) {
		return this.chatSessionsRepository.delete(id);
	}

	findSession(dto: MessageDto) {
		return this.findOneSession(dto.sessionId, {
			relations: ['messages'],
			order: {
				createdAt: 'DESC',
				// 这里注意一定要按顺序排序，否则前端如果没有排序会导致分支渲染出错
				messages: {
					createdAt: 'ASC',
				},
			},
		});
	}

	// 更新 session title
	async updateSession(dto: UpdateChatDto) {
		const session = await this.findOneSession(dto.sessionId);
		if (session) {
			const newMenu = this.chatSessionsRepository.merge(session, dto);
			return this.chatSessionsRepository.save(newMenu);
		} else {
			throw new NotFoundException('会话不存在');
		}
	}

	getHistory(dto: HistoryDto) {
		const { pageSize = 9999, pageNo = 1 } = dto;
		const take = pageSize || 10;
		const skip = ((pageNo || 1) - 1) * take;
		return this.chatMessagesRepository.findAndCount({
			// where: {
			//   session: {
			//     userId: dto.userId,
			//   },
			// },
			relations: ['session', 'attachments'],
			take,
			skip,
			order: {
				id: 'DESC',
			},
		});
	}

	async getSessionList(
		dto: HistoryDto,
	): Promise<{ list: ChatSessions[]; total: number }> {
		const { pageSize = 9999, pageNo = 1 } = dto;
		const take = pageSize || 10;
		const skip = ((pageNo || 1) - 1) * take;
		const [list, total] = await this.chatSessionsRepository.findAndCount({
			relations: ['messages', 'messages.attachments'],
			take,
			skip,
			order: {
				createdAt: 'DESC',
				messages: {
					createdAt: 'ASC',
				},
			},
		});

		return { list, total };
	}
}
