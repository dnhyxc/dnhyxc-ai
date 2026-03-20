/**
 * 分享服务 - NestJS + Redis
 * 使用 Cache (Redis) 存储分享数据，过期自动清理
 * 根据 chat_session_id 和 message_ids 从数据库查询消息
 */

import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import {
	GoneException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { ChatMessages } from '../chat/chat.entity';
import { MessageService } from '../chat/message.service';
import {
	CreateShareDto,
	CreateShareResponseDto,
	GetShareResponseDto,
	ShareCacheData,
} from './dto/share.dto';

// 默认过期时间：1天（毫秒）
const DEFAULT_EXPIRES_IN = 1 * 24 * 60 * 60 * 1000;

@Injectable()
export class ShareService {
	// 缓存键前缀，用于区分分享数据
	private readonly CACHE_KEY_PREFIX = 'share:';

	constructor(
		private cache: Cache,
		private logger: Logger,
		private readonly messageService: MessageService,
	) {}

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

		// 存储到 Redis
		const cacheData: ShareCacheData = {
			shareId,
			chatSessionId: dto.chatSessionId,
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
			`创建分享: ${shareId}, 会话: ${dto.chatSessionId}, 消息: ${dto?.messageIds?.length} 条`,
		);

		return {
			shareId,
			shareUrl: dto.baseUrl
				? `${dto.baseUrl}/share/${shareId}`
				: `/share/${shareId}`,
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
			throw new NotFoundException('分享不存在或已过期');
		}

		// 检查过期
		if (cacheData.expiresAt && Date.now() > cacheData.expiresAt) {
			await this.cache.del(key);
			throw new GoneException('分享已过期');
		}

		// 查询数据库获取消息
		const session = await this.messageService.findMessages({
			chatSessionId: cacheData.chatSessionId,
			messageIds: cacheData.messageIds,
		});

		return {
			shareId: cacheData.shareId,
			title: session.title || this.generateTitle(session.messages),
			session,
			createdAt: cacheData.createdAt,
			expiresAt: cacheData.expiresAt,
		};
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
