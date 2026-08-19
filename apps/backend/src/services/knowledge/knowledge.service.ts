import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';
import { AssistantSession } from '../assistant/assistant-session.entity';
import { KnowledgeEmbeddingService } from '../knowledge-embedding/knowledge-embedding.service';
import { CreateKnowledgeCategoryDto } from './dto/create-knowledge-category.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { QueryKnowledgeCategoriesSummaryDto } from './dto/query-knowledge-categories-summary.dto';
import { QueryKnowledgeTrashDto } from './dto/query-knowledge-trash.dto';
import { ReorderKnowledgeCategoriesDto } from './dto/reorder-knowledge-categories.dto';
import { SaveKnowledgeDto } from './dto/save-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { UpdateKnowledgeCategoryDto } from './dto/update-knowledge-category.dto';
import { UpdateKnowledgeVisibilityDto } from './dto/update-knowledge-visibility.dto';
import { Knowledge } from './knowledge.entity';
import { KnowledgeCategory } from './knowledge-category.entity';
import { KnowledgeTrash } from './knowledge-trash.entity';

/** 与前端知识库回收站预览的 `knowledgeArticleId` 前缀一致 */
const ASSISTANT_KNOWLEDGE_TRASH_PREFIX = '__knowledge_trash__:';

function assistantArticleIdForTrashRow(trashRowId: string): string {
	return `${ASSISTANT_KNOWLEDGE_TRASH_PREFIX}${trashRowId}`;
}

/** 列表项：不含大字段 content，减轻列表接口体积 */
export type KnowledgeListItem = Pick<
	Knowledge,
	| 'id'
	| 'title'
	| 'author'
	| 'authorId'
	| 'isPublic'
	| 'categoryId'
	| 'createdAt'
	| 'updatedAt'
> & { isOwned: boolean };

export type KnowledgeCategoryDto = {
	id: string;
	name: string;
	sortOrder: number;
	itemCount: number;
};

export type KnowledgeCategoriesSummaryDto = {
	categories: KnowledgeCategoryDto[];
	uncategorizedCount: number;
	totalItemCount: number;
};

const MAX_KNOWLEDGE_CATEGORIES = 50;

const DEFAULT_CATEGORY_NAMES: Record<'zh-CN' | 'en-US', string[]> = {
	'zh-CN': ['笔记', '文档', '教程', '工作', '其他'],
	'en-US': ['Notes', 'Docs', 'Tutorials', 'Work', 'Other'],
};

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
		@InjectRepository(KnowledgeCategory)
		private readonly categoryRepo: Repository<KnowledgeCategory>,
		private readonly embeddingService: KnowledgeEmbeddingService,
	) {}

	/** 新建一条知识库记录 */
	async saveMarkdown(dto: SaveKnowledgeDto): Promise<{ id: string }> {
		const row = this.knowledgeRepository.create({
			title: dto.title?.trim() ? dto.title.trim() : null,
			content: dto.content,
			author: dto.author ?? null,
			authorId: dto.authorId ?? null,
			isPublic: false,
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
	async update(userId: number, dto: UpdateKnowledgeDto): Promise<Knowledge> {
		const { title, content, author, authorId } = dto;
		if (
			title === undefined &&
			content === undefined &&
			author === undefined &&
			authorId === undefined
		) {
			throw new BadRequestException('请至少提供一项要更新的字段');
		}
		const row = await this.requireOwned(userId, dto.id);
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

	/** 所有者设置是否全站公开 */
	async setVisibility(
		userId: number,
		id: string,
		dto: UpdateKnowledgeVisibilityDto,
	): Promise<KnowledgeListItem> {
		const row = await this.requireOwned(userId, id);
		row.isPublic = dto.isPublic;
		const saved = await this.knowledgeRepository.save(row);
		return this.toListItem(saved, userId);
	}

	/**
	 * 删除知识库条目：写入回收站快照后，再从主表物理删除。
	 */
	async remove(userId: number, id: string): Promise<void> {
		await this.knowledgeRepository.manager.transaction(async (manager) => {
			const knowledgeRepo = manager.getRepository(Knowledge);
			const trashRepo = manager.getRepository(KnowledgeTrash);
			const assistantSessionRepo = manager.getRepository(AssistantSession);

			const row = await knowledgeRepo.findOne({
				where: { id, authorId: userId },
			});
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
	 * 分页列表：本人条目 + 他人公开条目；默认按更新时间倒序
	 */
	async findPage(
		userId: number,
		query: QueryKnowledgeDto,
	): Promise<{ list: KnowledgeListItem[]; total: number }> {
		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 10;
		const take = pageSize;
		const skip = (pageNo - 1) * take;
		const title = query.title?.trim();
		if (query.categoryId && query.uncategorizedOnly) {
			throw new BadRequestException(
				'categoryId 与 uncategorizedOnly 不能同时使用',
			);
		}

		const qb = this.knowledgeRepository
			.createQueryBuilder('k')
			.select([
				'k.id',
				'k.title',
				'k.author',
				'k.authorId',
				'k.isPublic',
				'k.categoryId',
				'k.createdAt',
				'k.updatedAt',
			])
			.orderBy('k.isPublic', 'DESC')
			.addOrderBy('k.updatedAt', 'DESC')
			.take(take)
			.skip(skip);

		if (query.categoryId || query.uncategorizedOnly) {
			qb.where('k.authorId = :userId', { userId });
			if (query.categoryId) {
				await this.resolveUserCategoryId(userId, query.categoryId);
				qb.andWhere('k.category_id = :categoryId', {
					categoryId: query.categoryId,
				});
			} else {
				qb.andWhere('k.category_id IS NULL');
			}
		} else {
			qb.where('(k.authorId = :userId OR k.isPublic = true)', { userId });
		}

		if (title) {
			qb.andWhere('LOWER(k.title) LIKE :title', {
				title: `%${title.toLowerCase()}%`,
			});
		}

		const [rows, total] = await qb.getManyAndCount();
		return {
			list: rows.map((row) => this.toListItem(row, userId)),
			total,
		};
	}

	/** 本人任意，或已公开条目（任意登录用户可读） */
	async findOneById(
		userId: number,
		id: string,
	): Promise<Knowledge & { isOwned: boolean }> {
		const owned = await this.knowledgeRepository.findOne({
			where: { id, authorId: userId },
		});
		if (owned) {
			return Object.assign(owned, { isOwned: true });
		}
		const pub = await this.knowledgeRepository.findOne({
			where: { id, isPublic: true },
		});
		if (!pub) {
			throw new NotFoundException('知识库条目不存在');
		}
		return Object.assign(pub, { isOwned: false });
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
		if (title) {
			where.title = Raw((alias) => `LOWER(${alias}) LIKE :title`, {
				title: `%${title.toLowerCase()}%`,
			});
		}
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
				authorId: trashRow.authorId,
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
					select: { id: true, originalId: true, authorId: true },
					where: { id: In(uniq) },
				});
				for (const row of rows) {
					if (!row.originalId) continue;
					await this.embeddingService.deleteKnowledgeVectors({
						knowledgeId: row.originalId,
						authorId: row.authorId,
					});
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

	private toListItem(
		row: Pick<
			Knowledge,
			| 'id'
			| 'title'
			| 'author'
			| 'authorId'
			| 'isPublic'
			| 'categoryId'
			| 'createdAt'
			| 'updatedAt'
		>,
		viewerUserId: number,
	): KnowledgeListItem {
		return {
			id: row.id,
			title: row.title,
			author: row.author,
			authorId: row.authorId,
			isPublic: row.isPublic,
			categoryId: row.categoryId ?? null,
			isOwned: row.authorId === viewerUserId,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}

	private normalizeCategoryName(name: string): string {
		return name.trim();
	}

	private async resolveUserCategoryId(
		userId: number,
		categoryId?: string | null,
	): Promise<string | null> {
		if (!categoryId) return null;
		const cat = await this.categoryRepo.findOne({
			where: { id: categoryId, userId },
		});
		if (!cat) {
			throw new BadRequestException('分类不存在');
		}
		return cat.id;
	}

	private async assertCategoryNameUnique(
		userId: number,
		name: string,
		excludeId?: string,
	): Promise<void> {
		const normalized = this.normalizeCategoryName(name);
		if (!normalized) {
			throw new BadRequestException('分类名称不能为空');
		}
		const rows = await this.categoryRepo
			.createQueryBuilder('c')
			.where('c.user_id = :userId', { userId })
			.andWhere('LOWER(c.name) = LOWER(:name)', { name: normalized })
			.getMany();
		const dup = rows.find((r) => r.id !== excludeId);
		if (dup) {
			throw new ConflictException('分类名称已存在');
		}
	}

	private async ensureDefaultCategories(
		userId: number,
		locale?: 'zh-CN' | 'en-US',
	): Promise<void> {
		const count = await this.categoryRepo.count({ where: { userId } });
		if (count > 0) return;
		const lang = locale === 'en-US' ? 'en-US' : 'zh-CN';
		const names = DEFAULT_CATEGORY_NAMES[lang];
		const rows = names.map((name, index) =>
			this.categoryRepo.create({ userId, name, sortOrder: index }),
		);
		await this.categoryRepo.save(rows);
	}

	async getCategoriesSummary(
		userId: number,
		query: QueryKnowledgeCategoriesSummaryDto = {},
	): Promise<KnowledgeCategoriesSummaryDto> {
		await this.ensureDefaultCategories(userId, query.locale);
		const categories = await this.categoryRepo.find({
			where: { userId },
			order: { sortOrder: 'ASC', createdAt: 'ASC' },
		});
		const countRows = await this.knowledgeRepository
			.createQueryBuilder('k')
			.select('k.category_id', 'categoryId')
			.addSelect('COUNT(*)', 'cnt')
			.where('k.authorId = :userId', { userId })
			.groupBy('k.category_id')
			.getRawMany<{ categoryId: string | null; cnt: string }>();
		const countMap = new Map<string, number>();
		let uncategorizedCount = 0;
		for (const row of countRows) {
			const cnt = Number(row.cnt) || 0;
			if (row.categoryId == null) {
				uncategorizedCount = cnt;
			} else {
				countMap.set(row.categoryId, cnt);
			}
		}
		const totalItemCount = await this.knowledgeRepository.count({
			where: { authorId: userId },
		});
		return {
			categories: categories.map((c) => ({
				id: c.id,
				name: c.name,
				sortOrder: c.sortOrder,
				itemCount: countMap.get(c.id) ?? 0,
			})),
			uncategorizedCount,
			totalItemCount,
		};
	}

	async createCategory(
		userId: number,
		dto: CreateKnowledgeCategoryDto,
	): Promise<KnowledgeCategoryDto> {
		const name = this.normalizeCategoryName(dto.name);
		if (!name) {
			throw new BadRequestException('分类名称不能为空');
		}
		const total = await this.categoryRepo.count({ where: { userId } });
		if (total >= MAX_KNOWLEDGE_CATEGORIES) {
			throw new BadRequestException(
				`最多创建 ${MAX_KNOWLEDGE_CATEGORIES} 个分类`,
			);
		}
		await this.assertCategoryNameUnique(userId, name);
		const maxSort = await this.categoryRepo
			.createQueryBuilder('c')
			.select('MAX(c.sort_order)', 'max')
			.where('c.user_id = :userId', { userId })
			.getRawOne<{ max: string | null }>();
		const sortOrder = (Number(maxSort?.max) || 0) + 1;
		const row = this.categoryRepo.create({ userId, name, sortOrder });
		await this.categoryRepo.save(row);
		return {
			id: row.id,
			name: row.name,
			sortOrder: row.sortOrder,
			itemCount: 0,
		};
	}

	async updateCategory(
		userId: number,
		categoryId: string,
		dto: UpdateKnowledgeCategoryDto,
	): Promise<KnowledgeCategoryDto> {
		const row = await this.categoryRepo.findOne({
			where: { id: categoryId, userId },
		});
		if (!row) {
			throw new NotFoundException('分类不存在');
		}
		if (dto.name !== undefined) {
			const name = this.normalizeCategoryName(dto.name);
			if (!name) {
				throw new BadRequestException('分类名称不能为空');
			}
			await this.assertCategoryNameUnique(userId, name, categoryId);
			row.name = name;
		}
		if (dto.sortOrder !== undefined) {
			row.sortOrder = dto.sortOrder;
		}
		await this.categoryRepo.save(row);
		const itemCount = await this.knowledgeRepository.count({
			where: { authorId: userId, categoryId: row.id },
		});
		return {
			id: row.id,
			name: row.name,
			sortOrder: row.sortOrder,
			itemCount,
		};
	}

	async removeCategory(userId: number, categoryId: string): Promise<void> {
		const row = await this.categoryRepo.findOne({
			where: { id: categoryId, userId },
		});
		if (!row) {
			throw new NotFoundException('分类不存在');
		}
		await this.knowledgeRepository.update(
			{ authorId: userId, categoryId },
			{ categoryId: null },
		);
		await this.categoryRepo.remove(row);
	}

	async reorderCategories(
		userId: number,
		dto: ReorderKnowledgeCategoriesDto,
	): Promise<void> {
		const rows = await this.categoryRepo.find({ where: { userId } });
		const idSet = new Set(rows.map((r) => r.id));
		if (dto.orderedIds.some((id) => !idSet.has(id))) {
			throw new BadRequestException('orderedIds 包含无效分类');
		}
		if (dto.orderedIds.length !== rows.length) {
			throw new BadRequestException('orderedIds 须包含全部分类');
		}
		const orderMap = new Map(dto.orderedIds.map((id, index) => [id, index]));
		for (const row of rows) {
			row.sortOrder = orderMap.get(row.id) ?? row.sortOrder;
		}
		await this.categoryRepo.save(rows);
	}

	async assignItemCategory(
		userId: number,
		id: string,
		categoryId: string | null,
	): Promise<KnowledgeListItem> {
		const row = await this.requireOwned(userId, id);
		if (categoryId) {
			await this.resolveUserCategoryId(userId, categoryId);
			row.categoryId = categoryId;
		} else {
			row.categoryId = null;
		}
		const saved = await this.knowledgeRepository.save(row);
		return this.toListItem(saved, userId);
	}

	private async requireOwned(userId: number, id: string): Promise<Knowledge> {
		const row = await this.knowledgeRepository.findOne({
			where: { id, authorId: userId },
		});
		if (!row) {
			throw new NotFoundException('知识库条目不存在');
		}
		return row;
	}
}
