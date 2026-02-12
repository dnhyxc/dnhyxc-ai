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

	// 获取单个消息
	async findOneMessage(id: string, options?: FindOneOptions<ChatSessions>) {
		return this.chatMessagesRepository.findOne({
			where: {
				id,
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
	) {
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

			// 如果提供了 parentId，验证父消息是否存在
			if (parentId) {
				const parentMsg = await this.findOneMessage(parentId);
				if (!parentMsg) {
					// 如果父消息不存在，可能是一个新会话的开始或者数据不一致
					// 这里我们可以选择置为 null，作为根消息
					parentId = null;
				}
			}

			// 创建消息
			const message = this.chatMessagesRepository.create({
				role,
				content,
				session,
				parentId,
				childrenIds: [], // 初始化为空数组
			});
			// 保存消息
			const savedMessage = await this.chatMessagesRepository.save(message);

			// 更新父消息的 childrenIds
			if (parentId) {
				const parentMsg = await this.findOneMessage(parentId);
				if (parentMsg) {
					if (!parentMsg.childrenIds) {
						parentMsg.childrenIds = [];
					}
					// 确保不重复添加
					if (!parentMsg.childrenIds.includes(savedMessage.id)) {
						parentMsg.childrenIds.push(savedMessage.id);
						await this.chatMessagesRepository.save(parentMsg);
					}
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
				id: 'DESC',
			},
		});

		return {
			list,
			total,
		};
	}
}
