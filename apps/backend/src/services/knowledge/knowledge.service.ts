import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { AssistantSession } from '../assistant/assistant-session.entity';
import { KnowledgeEmbeddingService } from '../knowledge-embedding/knowledge-embedding.service';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { QueryKnowledgeTrashDto } from './dto/query-knowledge-trash.dto';
import { SaveKnowledgeDto } from './dto/save-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { Knowledge } from './knowledge.entity';
import { KnowledgeTrash } from './knowledge-trash.entity';

/** 与前端知识库回收站预览的 `knowledgeArticleId` 前缀一致 */
const ASSISTANT_KNOWLEDGE_TRASH_PREFIX = '__knowledge_trash__:';

function assistantArticleIdForTrashRow(trashRowId: string): string {
	return `${ASSISTANT_KNOWLEDGE_TRASH_PREFIX}${trashRowId}`;
}

/** 列表项：不含大字段 content，减轻列表接口体积 */
export type KnowledgeListItem = Pick<
	Knowledge,
	'id' | 'title' | 'author' | 'authorId' | 'createdAt' | 'updatedAt'
>;

/** 回收站列表项：不含 content */
export type KnowledgeTrashListItem = Pick<
	KnowledgeTrash,
	'id' | 'originalId' | 'title' | 'author' | 'authorId' | 'deletedAt'
>;

@Injectable()
export class KnowledgeService {
	constructor(
		@InjectRepository(Knowledge)
		private readonly knowledgeRepository: Repository<Knowledge>,
		@InjectRepository(KnowledgeTrash)
		private readonly knowledgeTrashRepository: Repository<KnowledgeTrash>,
		private readonly embeddingService: KnowledgeEmbeddingService,
	) {}

	/** 新建一条知识库记录 */
	async saveMarkdown(dto: SaveKnowledgeDto): Promise<{ id: string }> {
		const row = this.knowledgeRepository.create({
			title: dto.title?.trim() ? dto.title.trim() : null,
			content: dto.content,
			author: dto.author ?? null,
			authorId: dto.authorId ?? null,
		} satisfies Partial<Knowledge>);
		const saved = await this.knowledgeRepository.save(row);
		// 异步触发向量入库：不阻塞保存主流程
		void this.embeddingService.safeIndexKnowledge({
			knowledgeId: saved.id,
			authorId: saved.authorId ?? null,
			title: saved.title ?? null,
			content: saved.content ?? '',
			createdAt: saved.createdAt,
			updatedAt: saved.updatedAt,
		});
		return { id: saved.id };
	}

	/**
	 * 按 id 更新；未传任何可更新字段时抛 BadRequestException
	 */
	async update(dto: UpdateKnowledgeDto): Promise<Knowledge> {
		const { title, content, author, authorId } = dto;
		if (
			title === undefined &&
			content === undefined &&
			author === undefined &&
			authorId === undefined
		) {
			throw new BadRequestException('请至少提供一项要更新的字段');
		}
		const row = await this.requireById(dto.id);
		if (title !== undefined) row.title = title.trim() || null;
		if (content !== undefined) row.content = content;
		if (author !== undefined) row.author = author;
		if (authorId !== undefined) row.authorId = authorId;
		const saved = await this.knowledgeRepository.save(row);
		// 异步触发向量入库：更新正文/标题后同步到 Qdrant
		void this.embeddingService.safeIndexKnowledge({
			knowledgeId: saved.id,
			authorId: saved.authorId ?? null,
			title: saved.title ?? null,
			content: saved.content ?? '',
			createdAt: saved.createdAt,
			updatedAt: saved.updatedAt,
		});
		return saved;
	}

	/**
	 * 删除知识库条目：写入回收站快照后，再从主表物理删除。
	 */
	async remove(id: string): Promise<void> {
		await this.knowledgeRepository.manager.transaction(async (manager) => {
			const knowledgeRepo = manager.getRepository(Knowledge);
			const trashRepo = manager.getRepository(KnowledgeTrash);
			const assistantSessionRepo = manager.getRepository(AssistantSession);

			const row = await knowledgeRepo.findOne({ where: { id } });
			if (!row) {
				throw new NotFoundException('知识库条目不存在');
			}

			const trash = trashRepo.create({
				originalId: row.id,
				title: row.title ?? null,
				content: row.content ?? null,
				author: row.author ?? null,
				authorId: row.authorId ?? null,
				sourceCreatedAt: row.createdAt ?? null,
				sourceUpdatedAt: row.updatedAt ?? null,
			} satisfies Partial<KnowledgeTrash>);

			await trashRepo.save(trash);
			// 助手会话按知识条目 uuid 绑定，主表删除前一并清理（消息随 session CASCADE）
			await assistantSessionRepo.delete({ knowledgeArticleId: row.id });
			await knowledgeRepo.delete({ id });
		});
	}

	/**
	 * 分页列表；默认按更新时间倒序
	 */
	async findPage(
		query: QueryKnowledgeDto,
	): Promise<{ list: KnowledgeListItem[]; total: number }> {
		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 10;
		const take = pageSize;
		const skip = (pageNo - 1) * take;
		const title = query.title?.trim();
		const authorId = query.authorId;

		const where: Record<string, unknown> = {};
		if (title) where.title = Like(`%${title}%`);
		if (authorId != null) where.authorId = authorId;

		const [list, total] = await this.knowledgeRepository.findAndCount({
			select: {
				id: true,
				title: true,
				author: true,
				authorId: true,
				createdAt: true,
				updatedAt: true,
			},
			where,
			order: { updatedAt: 'DESC' },
			take,
			skip,
		});

		return { list, total };
	}

	/** 单条详情（含正文） */
	async findOneById(id: string): Promise<Knowledge> {
		return this.requireById(id);
	}

	// ---------------- 回收站 ----------------

	/**
	 * 回收站分页列表；默认按删除时间倒序
	 */
	async findTrashPage(
		query: QueryKnowledgeTrashDto,
	): Promise<{ list: KnowledgeTrashListItem[]; total: number }> {
		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 10;
		const take = pageSize;
		const skip = (pageNo - 1) * take;
		const title = query.title?.trim();
		const authorId = query.authorId;

		const where: Record<string, unknown> = {};
		if (title) where.title = Like(`%${title}%`);
		if (authorId != null) where.authorId = authorId;

		const [list, total] = await this.knowledgeTrashRepository.findAndCount({
			select: {
				id: true,
				originalId: true,
				title: true,
				author: true,
				authorId: true,
				deletedAt: true,
			},
			where,
			order: { deletedAt: 'DESC' },
			take,
			skip,
		});
		return { list, total };
	}

	/** 回收站单条物理删除 */
	async removeTrash(id: string): Promise<void> {
		await this.knowledgeTrashRepository.manager.transaction(async (manager) => {
			const trashRepo = manager.getRepository(KnowledgeTrash);
			const assistantSessionRepo = manager.getRepository(AssistantSession);
			const trashRow = await trashRepo.findOne({ where: { id } });
			if (!trashRow) {
				throw new NotFoundException('回收站条目不存在');
			}
			// 物理删除回收站条目时，同步清理该知识条目在向量库中的残留
			await this.embeddingService.deleteKnowledgeVectors({
				knowledgeId: trashRow.originalId,
			});
			const articleId = assistantArticleIdForTrashRow(id);
			await assistantSessionRepo.delete({ knowledgeArticleId: articleId });
			const res = await trashRepo.delete({ id });
			if (!res.affected) {
				throw new NotFoundException('回收站条目不存在');
			}
		});
	}

	/** 回收站单条详情（含正文） */
	async findTrashOneById(id: string): Promise<KnowledgeTrash> {
		const row = await this.knowledgeTrashRepository.findOne({ where: { id } });
		if (!row) {
			throw new NotFoundException('回收站条目不存在');
		}
		return row;
	}

	/** 回收站批量物理删除 */
	async removeTrashBatch(ids: string[]): Promise<{ affected: number }> {
		const uniq = Array.from(new Set(ids)).filter(Boolean);
		if (uniq.length === 0) {
			throw new BadRequestException('请至少提供一条要删除的回收站 id');
		}
		return await this.knowledgeTrashRepository.manager.transaction(
			async (manager) => {
				const trashRepo = manager.getRepository(KnowledgeTrash);
				const assistantSessionRepo = manager.getRepository(AssistantSession);
				const rows = await trashRepo.find({
					select: { id: true, originalId: true },
					where: { id: In(uniq) },
				});
				const originalIds = rows.map((r) => r.originalId).filter(Boolean);
				// 批量物理删除回收站条目时，批量清理向量库残留（按 originalId）
				for (const knowledgeId of Array.from(new Set(originalIds))) {
					await this.embeddingService.deleteKnowledgeVectors({ knowledgeId });
				}
				for (const tid of uniq) {
					await assistantSessionRepo.delete({
						knowledgeArticleId: assistantArticleIdForTrashRow(tid),
					});
				}
				const res = await trashRepo.delete({ id: In(uniq) });
				return { affected: res.affected ?? 0 };
			},
		);
	}

	private async requireById(id: string): Promise<Knowledge> {
		const row = await this.knowledgeRepository.findOne({ where: { id } });
		if (!row) {
			throw new NotFoundException('知识库条目不存在');
		}
		return row;
	}
}
