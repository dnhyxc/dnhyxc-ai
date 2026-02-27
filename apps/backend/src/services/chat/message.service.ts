import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOneOptions, Repository } from 'typeorm';
import { Attachments } from './attachments.entity';
import { ChatMessages, MessageRole } from './chat.entity';
import { HistoryDto, MessageDto } from './dto/message.dto';
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

	// 辅助方法：从文件路径提取文件名
	private extractFileName(filePath: string): string {
		return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
	}

	// 辅助方法：获取文件MIME类型
	private getMimeType(filePath: string): string {
		const extension = filePath.split('.').pop()?.toLowerCase();
		const mimeTypes: Record<string, string> = {
			pdf: 'pdf',
			txt: 'txt',
			doc: 'doc',
			docx: 'docx',
			jpg: 'jpg',
			jpeg: 'jpeg',
			png: 'png',
			gif: 'gif',
			mp3: 'mpeg',
			mp4: 'mp4',
			csv: 'csv',
			xlsx: 'xlsx',
		};
		return mimeTypes[extension || ''] || 'application/octet-stream';
	}

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

	// 保存消息到数据库
	async saveMessage(
		sessionId: string,
		role: MessageRole,
		content: string,
		filePaths: string[] = [],
		parentId: string | null = null,
		isRegenerate: boolean = false,
		chatId?: string,
		childrenIds: string[] = [],
	) {
		console.log('saveMessage called:', {
			sessionId,
			role,
			contentLength: content.length,
			parentId,
			isRegenerate,
			chatId,
			childrenIds,
		});

		try {
			// 查找或创建会话
			let session = await this.findOneSession(sessionId);
			if (!session) {
				session = this.chatSessionsRepository.create({
					id: sessionId,
					partialContent: null,
					isActive: true,
				});
				await this.chatSessionsRepository.save(session);
			}

			// 创建消息
			const message = this.chatMessagesRepository.create({
				role,
				content,
				session,
				parentId,
				childrenIds: childrenIds || [], // 使用前端传递的 childrenIds
				chatId: chatId || '', // 保存 chatId 字段
				currentChatId: chatId || '', // 保存 currentChatId 字段
			});

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
				console.log('更新父消息 childrenIds:', {
					messageId: savedMessage.chatId,
					parentId,
					role,
					isRegenerate,
					messageType: isRegenerate ? '重新生成的assistant消息' : '普通消息',
				});

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
						console.log('已更新父消息 childrenIds:', parentMessage.childrenIds);
					} else {
						console.log('父消息 childrenIds 已包含此消息 id，跳过更新');
					}
				} else {
					console.log('未找到父消息，parentId:', parentId);
				}
			}

			// 如果有附件，保存附件信息
			if (filePaths && filePaths.length > 0) {
				const attachments = filePaths.map((filePath) => {
					const attachment = this.attachmentsRepository.create({
						filePath,
						originalName: this.extractFileName(filePath),
						mimeType: this.getMimeType(filePath),
						message: savedMessage,
					});
					return attachment;
				});
				await this.attachmentsRepository.save(attachments);
			}

			console.log('Message saved successfully:', {
				id: savedMessage.id,
				chatId: savedMessage.chatId,
				parentId: savedMessage.parentId,
				childrenIds: savedMessage.childrenIds,
				role: savedMessage.role,
				isRegenerate,
			});

			return savedMessage;
		} catch (dbError) {
			console.error('Failed to save message to database:', dbError);
			return null;
		}
	}

	// 更新数据库会话的 partialContent
	async updateSessionPartialContent(
		sessionId: string,
		partialContent: string | null,
		lastUserMessage: string | null,
	): Promise<void> {
		try {
			const session = await this.findOneSession(sessionId);
			if (session) {
				session.partialContent = partialContent;
				session.lastUserMessage = lastUserMessage;
				await this.chatSessionsRepository.save(session);
			}
		} catch (dbError) {
			// 静默失败，不抛出异常
			console.error('Failed to update session partial content:', dbError);
		}
	}

	create(_createChatDto: any) {
		return 'This action adds a new chat';
	}

	findAll() {
		return `This action returns all chat`;
	}

	update(id: number, _updateChatDto: any) {
		return `This action updates a #${id} chat`;
	}

	remove(id: number) {
		return `This action removes a #${id} chat`;
	}

	findSession(dto: MessageDto) {
		return this.findOneSession(dto.sessionId, {
			relations: ['messages'],
			order: {
				createdAt: 'DESC',
			},
		});
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
			// where: {
			//   session: {
			//     userId: dto.userId,
			//   },
			// },
			relations: ['messages'],
			take,
			skip,
			order: {
				createdAt: 'DESC',
				messages: {
					createdAt: 'ASC',
				},
			},
		});

		return {
			list,
			total,
		};
	}
}
