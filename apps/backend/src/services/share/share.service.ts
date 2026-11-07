/**
 * 分享服务：AI 库 shares 权威 + Redis 旁路；创建时写正文快照；公开读可活读回退快照。
 */

import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import {
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	type LoggerService,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Repository } from 'typeorm';
import { AgentMessage } from '../agent/agent-message.entity';
import { AgentSession } from '../agent/agent-session.entity';
import { AssistantMessage } from '../assistant/assistant-message.entity';
import { AssistantSession } from '../assistant/assistant-session.entity';
import { Attachments } from '../chat/attachments.entity';
import { ChatMessages } from '../chat/chat.entity';
import { MessageService } from '../chat/message.service';
import { EbookAssistantMessage } from '../ebook-assistant/ebook-assistant-message.entity';
import { EbookAssistantSession } from '../ebook-assistant/ebook-assistant-session.entity';
import { EnglishAgentMessage } from '../english-learning/entity/english-agent-message.entity';
import { EnglishAgentSession } from '../english-learning/entity/english-agent-session.entity';
import { Knowledge } from '../knowledge/knowledge.entity';
import { SkillTryMessage } from '../skill/skill-try-message.entity';
import { SkillTrySession } from '../skill/skill-try-session.entity';
import {
	CreateShareDto,
	CreateShareResponseDto,
	GetShareResponseDto,
	ShareCacheData,
} from './dto/share.dto';
import { Share } from './share.entity';

// 默认过期时间：7天（毫秒）
const DEFAULT_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000;
// 最短 1 小时；0 在部分 Redis 客户端会被当成永不过期
const MIN_EXPIRES_IN = 60 * 60 * 1000;
// 最长 30 天，避免分享键一直占着
const MAX_EXPIRES_IN = 30 * 24 * 60 * 60 * 1000;
/** 快照最多保留消息条数，避免 json 过大 */
const MAX_SNAPSHOT_MESSAGES = 80;
/** 单条消息正文截断上限 */
const MAX_SNAPSHOT_CONTENT_CHARS = 20_000;

/** 缺省 7 天；越界拒绝，避免静默改成另一个时长 */
function resolveExpiresIn(expiresInMs?: number): number {
	if (expiresInMs == null) return DEFAULT_EXPIRES_IN;
	if (
		!Number.isInteger(expiresInMs) ||
		expiresInMs < MIN_EXPIRES_IN ||
		expiresInMs > MAX_EXPIRES_IN
	) {
		throw new HttpException('过期时间超出允许范围', HttpStatus.BAD_REQUEST);
	}
	return expiresInMs;
}

@Injectable()
export class ShareService {
	// 缓存键前缀，用于区分分享数据
	private readonly CACHE_KEY_PREFIX = 'share:';

	constructor(
		private cache: Cache,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
		private readonly messageService: MessageService,
		@InjectRepository(Share)
		private readonly shareRepo: Repository<Share>,
		@InjectRepository(AssistantSession)
		private readonly assistantSessionRepo: Repository<AssistantSession>,
		@InjectRepository(AssistantMessage)
		private readonly assistantMessageRepo: Repository<AssistantMessage>,
		@InjectRepository(AgentSession)
		private readonly agentSessionRepo: Repository<AgentSession>,
		@InjectRepository(AgentMessage)
		private readonly agentMessageRepo: Repository<AgentMessage>,
		@InjectRepository(EnglishAgentSession)
		private readonly englishAgentSessionRepo: Repository<EnglishAgentSession>,
		@InjectRepository(EnglishAgentMessage)
		private readonly englishAgentMessageRepo: Repository<EnglishAgentMessage>,
		@InjectRepository(SkillTrySession)
		private readonly skillTrySessionRepo: Repository<SkillTrySession>,
		@InjectRepository(SkillTryMessage)
		private readonly skillTryMessageRepo: Repository<SkillTryMessage>,
		@InjectRepository(EbookAssistantSession)
		private readonly ebookAssistantSessionRepo: Repository<EbookAssistantSession>,
		@InjectRepository(EbookAssistantMessage)
		private readonly ebookAssistantMessageRepo: Repository<EbookAssistantMessage>,
		@InjectRepository(Knowledge)
		private readonly knowledgeRepo: Repository<Knowledge>,
	) {}
	/**
	 * 按 sessionId 拉取分享消息：先查主聊天（chat_sessions），不存在则回退查助手（assistant_sessions）。
	 * 目标：对外只暴露一个接口参数（chatSessionId），实现层统一封装，便于维护。
	 */
	private async resolveShareMessagesBySessionId(params: {
		sessionId: string;
		sessionType: 'chat' | 'assistant' | 'agent' | 'ebook';
		messageIds?: string[];
	}): Promise<{
		title: string;
		messages: Array<{
			id: string;
			chatId: string;
			role: 'user' | 'assistant';
			content: string;
			timestamp: number;
			attachments?: Array<{
				id: string;
				uuid: string;
				path: string;
				filename: string;
				originalname: string;
				mimetype: string;
				size: number;
			}>;
			/** 英语 Agent 清单卡；分享页靠它画 [[el:]]，不走需登录的词库接口 */
			elResources?: EnglishAgentMessage['elResources'];
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
				messages: (session.messages ?? []).map((m: ChatMessages) => ({
					id: m.id,
					chatId: m.chatId,
					role: (m.role === 'assistant' ? 'assistant' : 'user') as
						| 'user'
						| 'assistant',
					content: m.content ?? '',
					timestamp: this.toEpochMs(m.createdAt),
					attachments: this.mapShareAttachments(m.attachments),
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
						const at = this.toEpochMs(a.createdAt, 0);
						const bt = this.toEpochMs(b.createdAt, 0);
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
				timestamp: this.toEpochMs(m.createdAt),
			}));
			return {
				title:
					session.title ||
					this.generateTitle(messages as unknown as ChatMessages[]),
				messages,
			};
		}

		// 3) Agent 系：优先英语业务表 → Skill 试跑表 → 遗留 agent_messages
		if (params.sessionType === 'agent') {
			const mapAgentLikeRows = (
				session: { id: string; title: string | null },
				rows: Array<{
					id: string;
					role: string;
					content: string;
					createdAt: Date;
					elResources?: EnglishAgentMessage['elResources'];
				}>,
			) => {
				let orderedRows = rows;
				if (params.messageIds?.length) {
					const orderIndex = new Map(params.messageIds.map((id, i) => [id, i]));
					orderedRows = [...rows].sort((a, b) => {
						const ai = orderIndex.get(a.id);
						const bi = orderIndex.get(b.id);
						if (ai == null && bi == null) {
							const at = this.toEpochMs(a.createdAt, 0);
							const bt = this.toEpochMs(b.createdAt, 0);
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
					timestamp: this.toEpochMs(m.createdAt),
					...(m.elResources?.length ? { elResources: m.elResources } : {}),
				}));
				return {
					title:
						session.title ||
						this.generateTitle(messages as unknown as ChatMessages[]),
					messages,
				};
			};

			const loadFromRepo = async <
				T extends EnglishAgentMessage | SkillTryMessage | AgentMessage,
			>(
				messageRepo: Repository<T>,
				extraSelect: string[] = [],
			) => {
				const qb = messageRepo
					.createQueryBuilder('m')
					.select([
						'm.id',
						'm.role',
						'm.content',
						'm.createdAt',
						...extraSelect,
					])
					.where('m.session_id = :sid', { sid: params.sessionId });
				if (params.messageIds?.length) {
					qb.andWhere('m.id IN (:...ids)', { ids: params.messageIds });
				}
				return qb
					.orderBy('m.created_at', 'ASC')
					.addOrderBy("CASE WHEN m.role = 'user' THEN 0 ELSE 1 END", 'ASC')
					.addOrderBy('m.id', 'ASC')
					.getMany();
			};

			const engSession = await this.englishAgentSessionRepo.findOne({
				where: { id: params.sessionId },
				select: ['id', 'title'],
			});
			if (engSession) {
				const rows = await loadFromRepo(this.englishAgentMessageRepo, [
					'm.elResources',
				]);
				return mapAgentLikeRows(engSession, rows);
			}

			const trySession = await this.skillTrySessionRepo.findOne({
				where: { id: params.sessionId },
				select: ['id'],
			});
			if (trySession) {
				const agentSession = await this.agentSessionRepo.findOne({
					where: { id: params.sessionId },
					select: ['id', 'title'],
				});
				if (!agentSession) {
					throw new NotFoundException('会话不存在');
				}
				const rows = await loadFromRepo(this.skillTryMessageRepo);
				return mapAgentLikeRows(agentSession, rows);
			}

			const session = await this.agentSessionRepo.findOne({
				where: { id: params.sessionId },
				select: ['id', 'title', 'createdAt', 'updatedAt'],
			});
			if (!session) {
				throw new NotFoundException('会话不存在');
			}
			const rows = await loadFromRepo(this.agentMessageRepo);
			return mapAgentLikeRows(session, rows);
		}

		// 4) 电子书阅读助手：ebook_assistant_sessions / ebook_assistant_messages
		if (params.sessionType === 'ebook') {
			const session = await this.ebookAssistantSessionRepo.findOne({
				where: { id: params.sessionId },
				select: ['id', 'title', 'createdAt', 'updatedAt'],
			});
			if (!session) {
				throw new NotFoundException('会话不存在');
			}

			const qb = this.ebookAssistantMessageRepo
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
						const at = this.toEpochMs(a.createdAt, 0);
						const bt = this.toEpochMs(b.createdAt, 0);
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
				timestamp: this.toEpochMs(m.createdAt),
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

	/** 将 DB/TypeORM 日期字段统一转为毫秒时间戳（兼容 Date、ISO 字符串、MySQL datetime 字符串） */
	private toEpochMs(
		value: Date | string | number | null | undefined,
		fallback = Date.now(),
	): number {
		if (value == null) return fallback;
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		const ms =
			value instanceof Date ? value.getTime() : new Date(value).getTime();
		return Number.isFinite(ms) ? ms : fallback;
	}

	/** 分享页 / ChatFileList 所需附件结构（与前端 UploadedFile 对齐） */
	private mapShareAttachments(attachments?: Attachments[]) {
		if (!attachments?.length) return undefined;
		return attachments.map((a) => ({
			id: String(a.id),
			uuid: String(a.id),
			path: a.path,
			filename: a.filename,
			originalname: a.originalname ?? a.filename,
			mimetype: a.mimetype ?? 'application/octet-stream',
			size: a.size,
		}));
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

	private ms(v: string | number | null | undefined): number {
		if (v == null) return 0;
		const n = typeof v === 'number' ? v : Number(v);
		return Number.isFinite(n) ? n : 0;
	}

	/** 创建时 resolve 一次，供 Admin 台账与公开回退 */
	private async buildSnapshot(dto: CreateShareDto): Promise<{
		title: string;
		payload: Record<string, unknown>;
		truncated: boolean;
	}> {
		const shareType = dto.shareType ?? 'session';
		if (shareType === 'knowledge') {
			const id = (dto.chatSessionId ?? '').trim();
			const row = await this.knowledgeRepo.findOne({
				where: { id },
				select: ['id', 'title', 'content'],
			});
			if (!row) throw new NotFoundException('知识文章不存在');
			let content = row.content ?? '';
			let truncated = false;
			if (content.length > MAX_SNAPSHOT_CONTENT_CHARS) {
				content = content.slice(0, MAX_SNAPSHOT_CONTENT_CHARS);
				truncated = true;
			}
			const title = row.title?.trim() || '知识分享';
			return {
				title,
				truncated,
				payload: {
					kind: 'knowledge',
					id: row.id,
					title: row.title,
					content,
				},
			};
		}

		const resolved = await this.resolveShareMessagesBySessionId({
			sessionId: dto.chatSessionId,
			sessionType: dto.sessionType ?? 'chat',
			messageIds: dto.messageIds,
		});
		let truncated = false;
		let messages = resolved.messages;
		if (messages.length > MAX_SNAPSHOT_MESSAGES) {
			messages = messages.slice(0, MAX_SNAPSHOT_MESSAGES);
			truncated = true;
		}
		const slim = messages.map((m) => {
			let content = m.content ?? '';
			if (content.length > MAX_SNAPSHOT_CONTENT_CHARS) {
				content = content.slice(0, MAX_SNAPSHOT_CONTENT_CHARS);
				truncated = true;
			}
			return {
				id: m.id,
				chatId: m.chatId,
				role: m.role,
				content,
				timestamp: m.timestamp,
				...(m.elResources?.length ? { elResources: m.elResources } : {}),
			};
		});
		return {
			title: resolved.title,
			truncated,
			payload: { kind: 'session', messages: slim },
		};
	}

	private async loadShareMeta(shareId: string): Promise<ShareCacheData> {
		const key = this.getCacheKey(shareId);
		let meta = await this.cache.get<ShareCacheData>(key);
		if (!meta) {
			const row = await this.shareRepo.findOne({ where: { shareId } });
			if (!row || row.revokedAt != null) {
				throw new HttpException('分享不存在或已过期', HttpStatus.BAD_REQUEST);
			}
			meta = {
				shareId: row.shareId,
				chatSessionId: row.chatSessionId,
				shareType: row.shareType,
				sessionType: row.sessionType ?? undefined,
				messageIds: row.messageIds ?? undefined,
				createdAt: this.ms(row.createdAt),
				expiresAt: this.ms(row.expiresAt),
			};
		}
		if (meta.expiresAt && Date.now() > meta.expiresAt) {
			await this.cache.del(key);
			throw new HttpException('分享已失效', HttpStatus.BAD_REQUEST);
		}
		const remain = Math.max(0, (meta.expiresAt ?? 0) - Date.now());
		if (remain > 0) {
			try {
				await this.cache.set(key, meta, remain);
			} catch (e) {
				this.logger.warn(`分享缓存回填失败 ${shareId}: ${String(e)}`);
			}
		}
		return meta;
	}

	private async loadLiveContent(
		meta: ShareCacheData,
	): Promise<GetShareResponseDto> {
		if ((meta.shareType ?? 'session') === 'knowledge') {
			const id = (meta.chatSessionId ?? '').trim();
			const row = await this.knowledgeRepo.findOne({
				where: { id },
				select: ['id', 'title', 'content', 'createdAt', 'updatedAt'],
			});
			if (!row) throw new NotFoundException('知识文章不存在');
			if (!(row.content ?? '').trim()) {
				throw new NotFoundException('知识文章内容为空');
			}
			return {
				shareId: meta.shareId,
				shareType: 'knowledge',
				title: row.title?.trim() || '知识分享',
				createdAt: meta.createdAt,
				expiresAt: meta.expiresAt,
				knowledge: {
					id: row.id,
					title: row.title,
					content: row.content ?? '',
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
				},
			} as unknown as GetShareResponseDto;
		}

		const resolved = await this.resolveShareMessagesBySessionId({
			sessionId: meta.chatSessionId,
			sessionType: meta.sessionType ?? 'chat',
			messageIds: meta.messageIds,
		});
		if (!resolved.messages?.length) {
			throw new NotFoundException('分享消息为空');
		}
		return {
			...(resolved.session ? resolved.session : {}),
			messages: resolved.messages,
			shareMessageIds: meta.messageIds,
			shareId: meta.shareId,
			shareType: 'session',
			title: resolved.title,
			createdAt: meta.createdAt,
			expiresAt: meta.expiresAt,
		} as unknown as GetShareResponseDto;
	}

	private dtoFromSnapshot(row: Share, viewCount: number): GetShareResponseDto {
		const snap = row.contentSnapshot ?? {};
		const kind = snap.kind as string | undefined;
		if (kind === 'knowledge' || row.shareType === 'knowledge') {
			return {
				shareId: row.shareId,
				shareType: 'knowledge',
				title: row.title || '知识分享',
				createdAt: this.ms(row.createdAt),
				expiresAt: this.ms(row.expiresAt),
				viewCount,
				knowledge: {
					id: row.chatSessionId,
					title: (snap.title as string | null) ?? row.title,
					content: String(snap.content ?? ''),
					createdAt: this.ms(row.createdAt),
					updatedAt: this.ms(row.createdAt),
				},
			} as unknown as GetShareResponseDto;
		}
		const messages = Array.isArray(snap.messages) ? snap.messages : [];
		return {
			messages,
			shareMessageIds: row.messageIds ?? undefined,
			shareId: row.shareId,
			shareType: 'session',
			title: row.title || '对话分享',
			createdAt: this.ms(row.createdAt),
			expiresAt: this.ms(row.expiresAt),
			viewCount,
		} as unknown as GetShareResponseDto;
	}

	/**
	 * 创建分享：先 DB（含快照）再 Redis meta
	 */
	async createShare(
		dto: CreateShareDto,
		userId?: number,
	): Promise<CreateShareResponseDto> {
		const shareId = randomUUID().replace(/-/g, '');
		const now = Date.now();
		const ttl = resolveExpiresIn(dto.expiresInMs);
		const expiresAt = now + ttl;
		const shareType = dto.shareType ?? 'session';
		const snap = await this.buildSnapshot(dto);

		await this.shareRepo.insert({
			shareId,
			chatSessionId: dto.chatSessionId,
			shareType,
			sessionType: dto.sessionType ?? null,
			messageIds: dto.messageIds ?? null,
			title: snap.title.slice(0, 500),
			contentSnapshot: snap.payload as any,
			snapshotTruncated: snap.truncated,
			createdBy: userId ?? null,
			createdAt: String(now),
			expiresAt: String(expiresAt),
			revokedAt: null,
			viewCount: 0,
		});

		const cacheData: ShareCacheData = {
			shareId,
			chatSessionId: dto.chatSessionId,
			shareType,
			sessionType: dto.sessionType,
			messageIds: dto.messageIds,
			createdAt: now,
			expiresAt,
		};
		try {
			await this.cache.set(this.getCacheKey(shareId), cacheData, ttl);
		} catch (e) {
			this.logger.warn(`分享缓存写入失败 ${shareId}: ${String(e)}`);
		}

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
	 * 获取分享：meta 回源 → 计数 → 活读，空则快照回退
	 */
	async getShare(shareId: string): Promise<GetShareResponseDto> {
		const meta = await this.loadShareMeta(shareId);

		let viewCount = 0;
		try {
			await this.shareRepo.increment({ shareId }, 'viewCount', 1);
			const counted = await this.shareRepo.findOne({
				where: { shareId },
				select: ['viewCount'],
			});
			viewCount = counted?.viewCount ?? 0;
		} catch (e) {
			this.logger.warn(`分享计数失败 ${shareId}: ${String(e)}`);
		}

		try {
			const live = await this.loadLiveContent(meta);
			return { ...live, viewCount };
		} catch (e) {
			this.logger.warn(
				`分享活读失败，回退快照 ${shareId}: ${e instanceof Error ? e.message : String(e)}`,
			);
			const row = await this.shareRepo.findOne({ where: { shareId } });
			if (!row?.contentSnapshot) {
				throw new HttpException('分享不存在或已过期', HttpStatus.BAD_REQUEST);
			}
			return this.dtoFromSnapshot(row, viewCount);
		}
	}

	async deleteShare(shareId: string): Promise<void> {
		const row = await this.shareRepo.findOne({ where: { shareId } });
		if (!row || row.revokedAt != null) {
			throw new NotFoundException('分享不存在');
		}
		await this.shareRepo.update({ shareId }, { revokedAt: String(Date.now()) });
		await this.cache.del(this.getCacheKey(shareId));
		this.logger.log(`删除分享: ${shareId}`);
	}

	async existsShare(shareId: string): Promise<boolean> {
		try {
			await this.loadShareMeta(shareId);
			return true;
		} catch {
			return false;
		}
	}
}
