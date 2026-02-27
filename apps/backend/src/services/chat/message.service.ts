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
		isRegenerate: boolean = false,
	) {
		console.log(isRegenerate, 'isRegenerate-----parentId', parentId);
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

			// 获取会话中的所有消息
			const allMessages = await this.chatMessagesRepository.find({
				where: { session: { id: sessionId } },
				order: { createdAt: 'ASC' },
			});

			// 情况一：正常对话，第一个消息的 parentId 应为 null
			// 情况二：编辑之前的 user 对话，parentId 应为离当前 user 会话最近的上一条 assistant 会话的 id
			// 情况三：重新生成 assistant 会话，parentId 应为上一条 user 消息的 id

			// 如果没有提供 parentId，根据场景确定 parentId
			if (!parentId) {
				if (allMessages.length === 0) {
					// 情况一：第一个消息，parentId 为 null
					parentId = null;
				} else {
					// 查找最后一条消息
					const lastMessage = allMessages[allMessages.length - 1];

					if (role === MessageRole.USER) {
						// 用户消息
						if (lastMessage.role === MessageRole.ASSISTANT) {
							// 正常对话：parentId 应为最后一条 assistant 消息的 id
							parentId = lastMessage.id;
						} else if (lastMessage.role === MessageRole.USER) {
							// 情况二：编辑 user 对话，需要找到最近的 assistant 消息
							// 从后往前查找最近的 assistant 消息
							const recentAssistant = [...allMessages]
								.reverse()
								.find((msg) => msg.role === MessageRole.ASSISTANT);
							parentId = recentAssistant?.id || null;
						}
					} else if (role === MessageRole.ASSISTANT) {
						// AI 回复消息
						if (isRegenerate) {
							// 情况三：重新生成，parentId 应为上一条 user 消息的 id
							const lastUserMessage = [...allMessages]
								.reverse()
								.find((msg) => msg.role === MessageRole.USER);
							parentId = lastUserMessage?.id || null;
						} else {
							// 正常回复：parentId 应为最后一条消息的 id
							parentId = lastMessage.id;
						}
					}
				}
			} else {
				// 如果提供了 parentId，验证父消息
				const parentMsg = await this.findOneMessage(parentId);
				if (!parentMsg) {
					// 父消息不存在，重置为 null
					parentId = null;
				} else if (
					role === MessageRole.USER &&
					parentMsg.role === MessageRole.USER
				) {
					// 情况二：编辑 user 对话，parentId 指向的是 user 消息
					// 需要找到该 user 消息的父消息（应该是 assistant 消息）
					const grandParentId = parentMsg.parentId;
					if (grandParentId) {
						const grandParentMsg = await this.findOneMessage(grandParentId);
						if (
							grandParentMsg &&
							grandParentMsg.role === MessageRole.ASSISTANT
						) {
							// 情况二：编辑 user 对话，parentId 应为上一条 assistant 消息
							parentId = grandParentId;
						}
					}
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

			// 调试日志：记录重新生成 assistant 的情况
			if (role === MessageRole.ASSISTANT && isRegenerate) {
				console.log('重新生成 assistant 消息:');
				console.log('parentId:', parentId);
				console.log('savedMessage.id:', savedMessage.id);

				// 查找上一条 user 消息
				const lastUserMessage = [...allMessages]
					.reverse()
					.find((msg) => msg.role === MessageRole.USER);

				if (lastUserMessage) {
					console.log('上一条 user 消息 id:', lastUserMessage.id);
					console.log(
						'上一条 user 消息 childrenIds:',
						lastUserMessage.childrenIds,
					);

					// 如果 parentId 是 user 消息的 id，那么 childrenIds 应该已经更新了
					// 如果不是，需要手动添加
					if (lastUserMessage.id !== parentId) {
						console.log(
							'警告：重新生成的 assistant 的 parentId 不是上一条 user 消息',
						);
						if (!lastUserMessage.childrenIds) {
							lastUserMessage.childrenIds = [];
						}
						if (!lastUserMessage.childrenIds.includes(savedMessage.id)) {
							lastUserMessage.childrenIds.push(savedMessage.id);
							await this.chatMessagesRepository.save(lastUserMessage);
							console.log('已添加新 assistant 到 user 消息的 childrenIds');
						}
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
