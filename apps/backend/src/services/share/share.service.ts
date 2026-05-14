/**
 * 分享服务 - NestJS + Redis
 * 使用 Cache (Redis) 存储分享数据，过期自动清理
 * 根据 chat_session_id 和 message_ids 从数据库查询消息
 */

import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import {
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentMessage } from '../agent/agent-message.entity';
import { AgentSession } from '../agent/agent-session.entity';
import { AssistantMessage } from '../assistant/assistant-message.entity';
import { AssistantSession } from '../assistant/assistant-session.entity';
import { ChatMessages } from '../chat/chat.entity';
import { MessageService } from '../chat/message.service';
import { Knowledge } from '../knowledge/knowledge.entity';
import {
	CreateShareDto,
	CreateShareResponseDto,
	GetShareResponseDto,
	ShareCacheData,
} from './dto/share.dto';

// 默认过期时间：7天（毫秒）
const DEFAULT_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ShareService {
	// 缓存键前缀，用于区分分享数据
	private readonly CACHE_KEY_PREFIX = 'share:';

	constructor(
		private cache: Cache,
		private logger: Logger,
		private readonly messageService: MessageService,
		@InjectRepository(AssistantSession)
		private readonly assistantSessionRepo: Repository<AssistantSession>,
		@InjectRepository(AssistantMessage)
		private readonly assistantMessageRepo: Repository<AssistantMessage>,
		@InjectRepository(AgentSession)
		private readonly agentSessionRepo: Repository<AgentSession>,
		@InjectRepository(AgentMessage)
		private readonly agentMessageRepo: Repository<AgentMessage>,
		@InjectRepository(Knowledge)
		private readonly knowledgeRepo: Repository<Knowledge>,
	) {}
	/**
	 * 按 sessionId 拉取分享消息：先查主聊天（chat_sessions），不存在则回退查助手（assistant_sessions）。
	 * 目标：对外只暴露一个接口参数（chatSessionId），实现层统一封装，便于维护。
	 */
	private async resolveShareMessagesBySessionId(params: {
		sessionId: string;
		sessionType: 'chat' | 'assistant' | 'agent';
		messageIds?: string[];
	}): Promise<{
		title: string;
		messages: Array<{
			id: string;
			chatId: string;
			role: 'user' | 'assistant';
			content: string;
			timestamp: number;
		}>;
		// share 页还会透传 session（chat 分支为 ChatSessions；assistant 分支不需要）
		session?: any;
	}> {
		// 1) 主聊天：按 chat_sessions 查询（保持原逻辑与排序/重排行为）
		if (params.sessionType === 'chat') {
			const session = await this.messageService.findMessages({
				chatSessionId: params.sessionId,
				messageIds: params.messageIds,
			});
			return {
				session,
				title: session.title || this.generateTitle(session.messages),
				messages: (session.messages ?? []).map((m: any) => ({
					id: m.id,
					chatId: m.chatId,
					role: (m.role === 'assistant' ? 'assistant' : 'user') as
						| 'user'
						| 'assistant',
					content: m.content ?? '',
					timestamp: m.createdAt?.getTime?.() ?? Date.now(),
				})),
			};
		}

		// 2) 知识库助手：按 assistant_sessions 查询
		if (params.sessionType === 'assistant') {
			const session = await this.assistantSessionRepo.findOne({
				where: { id: params.sessionId },
				select: ['id', 'title', 'createdAt', 'updatedAt'],
			});
			if (!session) {
				throw new NotFoundException('会话不存在');
			}

			const qb = this.assistantMessageRepo
				.createQueryBuilder('m')
				.select(['m.id', 'm.role', 'm.content', 'm.createdAt'])
				.where('m.session_id = :sid', { sid: params.sessionId });

			if (params.messageIds?.length) {
				qb.andWhere('m.id IN (:...ids)', { ids: params.messageIds });
			}

			const rows = await qb
				.orderBy('m.created_at', 'ASC')
				.addOrderBy("CASE WHEN m.role = 'user' THEN 0 ELSE 1 END", 'ASC')
				.addOrderBy('m.id', 'ASC')
				.getMany();

			let orderedRows = rows;
			if (params.messageIds?.length) {
				const orderIndex = new Map(params.messageIds.map((id, i) => [id, i]));
				orderedRows = [...rows].sort((a, b) => {
					const ai = orderIndex.get(a.id);
					const bi = orderIndex.get(b.id);
					if (ai == null && bi == null) {
						const at = a.createdAt?.getTime?.() ?? 0;
						const bt = b.createdAt?.getTime?.() ?? 0;
						if (at !== bt) return at - bt;
						return String(a.id).localeCompare(String(b.id));
					}
					if (ai == null) return 1;
					if (bi == null) return -1;
					return ai - bi;
				});
			}

			const messages = orderedRows.map((m) => ({
				id: m.id,
				chatId: m.id,
				role: (m.role === 'assistant' ? 'assistant' : 'user') as
					| 'user'
					| 'assistant',
				content: m.content ?? '',
				timestamp: m.createdAt?.getTime?.() ?? Date.now(),
			}));
			return {
				title:
					session.title ||
					this.generateTitle(messages as unknown as ChatMessages[]),
				messages,
			};
		}

		// 3) LangChain Agent 专项会话（英语学习等）：agent_sessions / agent_messages
		if (params.sessionType === 'agent') {
			const session = await this.agentSessionRepo.findOne({
				where: { id: params.sessionId },
				select: ['id', 'title', 'createdAt', 'updatedAt'],
			});
			if (!session) {
				throw new NotFoundException('会话不存在');
			}

			const qb = this.agentMessageRepo
				.createQueryBuilder('m')
				.select(['m.id', 'm.role', 'm.content', 'm.createdAt'])
				.where('m.session_id = :sid', { sid: params.sessionId });

			if (params.messageIds?.length) {
				qb.andWhere('m.id IN (:...ids)', { ids: params.messageIds });
			}

			const rows = await qb
				.orderBy('m.created_at', 'ASC')
				.addOrderBy("CASE WHEN m.role = 'user' THEN 0 ELSE 1 END", 'ASC')
				.addOrderBy('m.id', 'ASC')
				.getMany();

			let orderedRows = rows;
			if (params.messageIds?.length) {
				const orderIndex = new Map(params.messageIds.map((id, i) => [id, i]));
				orderedRows = [...rows].sort((a, b) => {
					const ai = orderIndex.get(a.id);
					const bi = orderIndex.get(b.id);
					if (ai == null && bi == null) {
						const at = a.createdAt?.getTime?.() ?? 0;
						const bt = b.createdAt?.getTime?.() ?? 0;
						if (at !== bt) return at - bt;
						return String(a.id).localeCompare(String(b.id));
					}
					if (ai == null) return 1;
					if (bi == null) return -1;
					return ai - bi;
				});
			}

			const messages = orderedRows.map((m) => ({
				id: m.id,
				chatId: m.id,
				role: (m.role === 'assistant' ? 'assistant' : 'user') as
					| 'user'
					| 'assistant',
				content: m.content ?? '',
				timestamp: m.createdAt?.getTime?.() ?? Date.now(),
			}));
			return {
				title:
					session.title ||
					this.generateTitle(messages as unknown as ChatMessages[]),
				messages,
			};
		}

		throw new NotFoundException('会话不存在');
	}

	/**
	 * 生成缓存键
	 */
	private getCacheKey(shareId: string): string {
		return `${this.CACHE_KEY_PREFIX}${shareId}`;
	}

	/**
	 * 生成标题
	 */
	private generateTitle(messages: ChatMessages[]): string {
		const first = messages.find((m) => m.role === 'user');
		if (first?.content) {
			return first.content.trim();
		}
		return '对话分享';
	}

	/**
	 * 创建分享
	 * 只存储参数到 Redis，不查询数据库
	 */
	async createShare(dto: CreateShareDto): Promise<CreateShareResponseDto> {
		const shareId = randomUUID().replace(/-/g, '');
		const now = Date.now();
		const expiresAt = now + DEFAULT_EXPIRES_IN;
		const shareType = dto.shareType ?? 'session';

		// 存储到 Redis
		const cacheData: ShareCacheData = {
			shareId,
			chatSessionId: dto.chatSessionId,
			shareType,
			sessionType: dto.sessionType,
			messageIds: dto.messageIds,
			createdAt: now,
			expiresAt,
		};

		await this.cache.set(
			this.getCacheKey(shareId),
			cacheData,
			DEFAULT_EXPIRES_IN,
		);

		this.logger.log(
			`创建分享: ${shareId}, 会话: ${dto.chatSessionId} ${dto?.messageIds?.length ? `, 消息: ${dto?.messageIds?.length} 条` : ''}`,
		);

		return {
			shareId,
			shareUrl: dto.baseUrl
				? `${dto.baseUrl}/share/${shareId}${shareType === 'knowledge' ? '?type=knowledge' : ''}`
				: `/share/${shareId}${shareType === 'knowledge' ? '?type=knowledge' : ''}`,
			createdAt: now,
			expiresAt,
		};
	}

	/**
	 * 获取分享
	 * 从 Redis 获取参数，再查询数据库
	 */
	async getShare(shareId: string): Promise<GetShareResponseDto> {
		const key = this.getCacheKey(shareId);
		const cacheData = await this.cache.get<ShareCacheData>(key);

		if (!cacheData) {
			throw new HttpException('分享不存在或已过期', HttpStatus.BAD_REQUEST);
		}

		// 检查过期
		if (cacheData.expiresAt && Date.now() > cacheData.expiresAt) {
			await this.cache.del(key);
			throw new HttpException('分享已失效', HttpStatus.BAD_REQUEST);
		}

		// 1) 分享知识文章：chatSessionId 复用为 knowledgeId（保持接口兼容）
		if ((cacheData.shareType ?? 'session') === 'knowledge') {
			const id = (cacheData.chatSessionId ?? '').trim();
			const row = await this.knowledgeRepo.findOne({
				where: { id },
				select: ['id', 'title', 'content', 'createdAt', 'updatedAt'],
			});
			if (!row) {
				throw new NotFoundException('知识文章不存在');
			}
			return {
				shareId: cacheData.shareId,
				shareType: 'knowledge',
				title: row.title?.trim() || '知识分享',
				createdAt: cacheData.createdAt,
				expiresAt: cacheData.expiresAt,
				knowledge: {
					id: row.id,
					title: row.title,
					content: row.content ?? '',
					createdAt: row.createdAt?.getTime?.() ?? Date.now(),
					updatedAt: row.updatedAt?.getTime?.() ?? Date.now(),
				},
			} as any;
		}

		// 2) 分享会话（chat / assistant）
		const resolved = await this.resolveShareMessagesBySessionId({
			sessionId: cacheData.chatSessionId,
			sessionType: cacheData.sessionType ?? 'chat',
			messageIds: cacheData.messageIds,
		});

		return {
			...(resolved.session ? resolved.session : {}),
			// assistant 回退分支没有 chat session 实体，这里直接透传 messages 即可
			messages: resolved.messages,
			// 与创建分享时 ChatBot getDisplayMessages 顺序一致（前端按此对齐展示）
			shareMessageIds: cacheData.messageIds,
			shareId: cacheData.shareId,
			shareType: 'session',
			title: resolved.title,
			createdAt: cacheData.createdAt,
			expiresAt: cacheData.expiresAt,
		} as any;
	}
	/**
	 * 删除分享
	 */
	async deleteShare(shareId: string): Promise<void> {
		const key = this.getCacheKey(shareId);
		const exists = await this.cache.get(key);
		if (!exists) throw new NotFoundException('分享不存在');
		await this.cache.del(key);
		this.logger.log(`删除分享: ${shareId}`);
	}

	/**
	 * 检查分享是否存在
	 */
	async existsShare(shareId: string): Promise<boolean> {
		const key = this.getCacheKey(shareId);
		const data = await this.cache.get<ShareCacheData>(key);
		if (!data) return false;
		if (data.expiresAt && Date.now() > data.expiresAt) {
			await this.cache.del(key);
			return false;
		}
		return true;
	}
}
