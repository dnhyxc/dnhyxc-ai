import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, QueryFailedError, Repository } from 'typeorm';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { User } from '../user/user.entity';
import { CreateKnowledgeCommentDto } from './dto/create-knowledge-comment.dto';
import { UpdateKnowledgeCommentDto } from './dto/update-knowledge-comment.dto';
import { KnowledgeComment } from './knowledge-comment.entity';
import { audienceForRoot, placeReply } from './knowledge-comment.rules';
import { KnowledgeCommentLike } from './knowledge-comment-like.entity';

/** 根列表与回复续页同一页大小。 */
const PAGE = 50;
/** 首屏每个根只带最早的回复，其余走回复分页。 */
const REPLY_PREVIEW = 2;

export type CommentView = {
	id: string;
	userId: number;
	parentId: string | null;
	replyToUserId: number | null;
	replyToUsername: string | null;
	/** 被回复的人是文档作者时，名字后同样带「作者」。 */
	replyToByDocAuthor: boolean;
	content: string;
	audience: 'owner' | 'readers';
	editedAt: string | null;
	createdAt: string;
	username: string;
	avatar: string | null;
	byDocAuthor: boolean;
	likeCount: number;
	liked: boolean;
	/** 当前用户是这条留言的作者，才能改。 */
	mine: boolean;
	/** 留言作者或文档作者可以删。 */
	canDelete: boolean;
	replies?: CommentView[];
	/** 该根下未删除回复的总数，含没放进首屏的。 */
	replyCount?: number;
	repliesNextCursor?: string | null;
};

@Injectable()
export class KnowledgeCommentService {
	constructor(
		@InjectRepository(KnowledgeComment)
		private readonly comments: Repository<KnowledgeComment>,
		@InjectRepository(KnowledgeCommentLike)
		private readonly likes: Repository<KnowledgeCommentLike>,
		@InjectRepository(User)
		private readonly users: Repository<User>,
		private readonly knowledgeService: KnowledgeService,
	) {}

	async list(
		userId: number,
		knowledgeId: string,
		cursor?: string,
	): Promise<{ roots: CommentView[]; nextCursor: string | null }> {
		const doc = await this.knowledgeService.findOneById(userId, knowledgeId);
		const qb = this.comments.createQueryBuilder('c');
		qb.where('c.knowledge_id = :knowledgeId', { knowledgeId });
		qb.andWhere('c.deleted_at IS NULL');
		qb.andWhere('c.hidden_at IS NULL');
		qb.andWhere('c.parent_id IS NULL');
		if (!doc.isOwned) qb.andWhere("c.audience = 'readers'");
		const mark = this.parseCursor(cursor);
		if (mark) {
			qb.andWhere(
				'(c.created_at < :time OR (c.created_at = :time AND c.id < :id))',
				mark,
			);
		}
		qb.orderBy('c.created_at', 'DESC');
		qb.addOrderBy('c.id', 'DESC');
		qb.take(PAGE + 1);
		const rows = await qb.getMany();
		const page = rows.slice(0, PAGE);
		const replies = await this.repliesFor(
			knowledgeId,
			page.map((row) => row.id),
			doc.isOwned,
		);
		const views = await this.toViews(page, doc.authorId, userId, replies);
		const last = page[page.length - 1];
		return {
			roots: views,
			nextCursor: rows.length > PAGE && last ? this.cursorOf(last) : null,
		};
	}

	async listReplies(
		userId: number,
		knowledgeId: string,
		rootId: string,
		cursor?: string,
	): Promise<{ replies: CommentView[]; nextCursor: string | null }> {
		const doc = await this.knowledgeService.findOneById(userId, knowledgeId);
		const root = await this.comments.findOne({
			where: {
				id: rootId,
				knowledgeId,
				parentId: IsNull(),
				deletedAt: IsNull(),
				hiddenAt: IsNull(),
			},
		});
		if (!root) throw new NotFoundException('要回复的留言不存在');
		if (root.audience === 'owner' && !doc.isOwned) {
			throw new NotFoundException('要回复的留言不存在');
		}
		const qb = this.comments.createQueryBuilder('c');
		qb.where('c.knowledge_id = :knowledgeId', { knowledgeId });
		qb.andWhere('c.parent_id = :rootId', { rootId });
		qb.andWhere('c.deleted_at IS NULL');
		qb.andWhere('c.hidden_at IS NULL');
		if (!doc.isOwned) qb.andWhere("c.audience = 'readers'");
		const mark = this.parseCursor(cursor);
		if (mark) {
			qb.andWhere(
				'(c.created_at < :time OR (c.created_at = :time AND c.id < :id))',
				mark,
			);
		}
		qb.orderBy('c.created_at', 'DESC');
		qb.addOrderBy('c.id', 'DESC');
		qb.take(PAGE + 1);
		const rows = await qb.getMany();
		const page = rows.slice(0, PAGE);
		const views = await this.toViews(page, doc.authorId, userId);
		const last = page[page.length - 1];
		return {
			replies: views,
			nextCursor: rows.length > PAGE && last ? this.cursorOf(last) : null,
		};
	}

	async summary(
		userId: number,
		knowledgeId: string,
	): Promise<{ readerCount: number; ownerOnlyCount: number }> {
		const doc = await this.knowledgeService.findOneById(userId, knowledgeId);
		const readerCount = await this.comments.count({
			where: {
				knowledgeId,
				audience: 'readers',
				deletedAt: IsNull(),
				hiddenAt: IsNull(),
			},
		});
		const ownerOnlyCount = doc.isOwned
			? await this.comments.count({
					where: {
						knowledgeId,
						audience: 'owner',
						deletedAt: IsNull(),
						hiddenAt: IsNull(),
					},
				})
			: 0;
		return { readerCount, ownerOnlyCount };
	}

	async create(
		userId: number,
		knowledgeId: string,
		dto: CreateKnowledgeCommentDto,
	): Promise<CommentView> {
		const doc = await this.knowledgeService.findOneById(userId, knowledgeId);
		const content = dto.content.trim();
		if (content.length < 1 || content.length > 1000) {
			throw new BadRequestException('留言须为 1～1000 字');
		}
		let audience = audienceForRoot(doc.isPublic);
		let parentId: string | null = null;
		let replyToUserId: number | null = null;
		if (dto.parentId) {
			const hit = await this.comments.findOne({
				where: { id: dto.parentId, knowledgeId, deletedAt: IsNull() },
			});
			if (!hit) throw new NotFoundException('要回复的留言不存在');
			const root = hit.parentId
				? await this.comments.findOne({
						where: {
							id: hit.parentId,
							knowledgeId,
							deletedAt: IsNull(),
						},
					})
				: null;
			const placed = placeReply(hit, root, doc.isOwned);
			if (placed.kind !== 'ok') {
				throw new NotFoundException('要回复的留言不存在');
			}
			audience = placed.audience;
			parentId = placed.parentId;
			replyToUserId = placed.replyToUserId;
		}
		const saved = await this.comments.save(
			this.comments.create({
				knowledgeId,
				userId,
				parentId,
				replyToUserId,
				content,
				audience,
				editedAt: null,
				deletedAt: null,
				hiddenAt: null,
			}),
		);
		const [view] = await this.toViews([saved], doc.authorId, userId);
		return view;
	}

	async release(
		userId: number,
		knowledgeId: string,
	): Promise<{ released: number }> {
		const doc = await this.knowledgeService.findOneById(userId, knowledgeId);
		if (!doc.isOwned) {
			throw new ForbiddenException('只有作者可以公开历史留言');
		}
		if (!doc.isPublic) throw new BadRequestException('文档尚未公开');
		const res = await this.comments.update(
			{ knowledgeId, audience: 'owner', deletedAt: IsNull() },
			{ audience: 'readers' },
		);
		return { released: res.affected ?? 0 };
	}

	async makePrivate(
		userId: number,
		commentId: string,
	): Promise<{ id: string; changed: number }> {
		const row = await this.visibleComment(userId, commentId);
		if (row.comment.userId !== userId || !row.doc.isOwned) {
			throw new ForbiddenException('只能把自己的留言改回仅自己可见');
		}
		if (row.comment.audience === 'owner') {
			return { id: row.comment.id, changed: 0 };
		}
		row.comment.audience = 'owner';
		await this.comments.save(row.comment);
		return { id: row.comment.id, changed: 1 };
	}

	async makePublic(
		userId: number,
		commentId: string,
	): Promise<{ id: string; changed: number }> {
		const row = await this.visibleComment(userId, commentId);
		if (row.comment.userId !== userId || !row.doc.isOwned) {
			throw new ForbiddenException('只能公开自己的留言');
		}
		if (!row.doc.isPublic) throw new BadRequestException('文档尚未公开');
		if (row.comment.audience === 'readers') {
			return { id: row.comment.id, changed: 0 };
		}
		row.comment.audience = 'readers';
		await this.comments.save(row.comment);
		return { id: row.comment.id, changed: 1 };
	}

	async update(
		userId: number,
		commentId: string,
		dto: UpdateKnowledgeCommentDto,
	): Promise<CommentView> {
		const row = await this.visibleComment(userId, commentId);
		if (row.comment.userId !== userId) {
			throw new ForbiddenException('只能修改自己的留言');
		}
		const content = dto.content.trim();
		if (content.length < 1 || content.length > 1000) {
			throw new BadRequestException('留言须为 1～1000 字');
		}
		row.comment.content = content;
		row.comment.editedAt = new Date();
		const saved = await this.comments.save(row.comment);
		const [view] = await this.toViews([saved], row.doc.authorId, userId);
		return view;
	}

	async remove(userId: number, commentId: string): Promise<{ id: string }> {
		const row = await this.visibleComment(userId, commentId);
		if (row.comment.userId !== userId) {
			throw new ForbiddenException('只能删除自己的留言');
		}
		const now = new Date();
		row.comment.deletedAt = now;
		await this.comments.save(row.comment);
		if (!row.comment.parentId) {
			await this.comments.update(
				{ parentId: row.comment.id, deletedAt: IsNull() },
				{ deletedAt: now },
			);
		}
		return { id: row.comment.id };
	}

	async like(
		userId: number,
		commentId: string,
	): Promise<{ liked: boolean; likeCount: number }> {
		const row = await this.visibleComment(userId, commentId);
		const existing = await this.likes.findOne({
			where: { commentId: row.comment.id, userId },
		});
		if (!existing) {
			try {
				await this.likes.save(
					this.likes.create({ commentId: row.comment.id, userId }),
				);
			} catch (error) {
				if (!this.isDup(error)) throw error;
			}
		}
		return this.likeState(row.comment.id, userId);
	}

	async unlike(
		userId: number,
		commentId: string,
	): Promise<{ liked: boolean; likeCount: number }> {
		const row = await this.visibleComment(userId, commentId);
		await this.likes.delete({ commentId: row.comment.id, userId });
		return this.likeState(row.comment.id, userId);
	}

	private async visibleComment(userId: number, commentId: string) {
		const comment = await this.comments.findOne({
			where: { id: commentId, deletedAt: IsNull() },
		});
		if (!comment) throw new NotFoundException('留言不存在');
		const doc = await this.knowledgeService.findOneById(
			userId,
			comment.knowledgeId,
		);
		if (comment.audience === 'owner' && !doc.isOwned) {
			throw new NotFoundException('留言不存在');
		}
		return { comment, doc };
	}

	private async likeState(commentId: string, userId: number) {
		const likeCount = await this.likes.count({ where: { commentId } });
		const mine = await this.likes.findOne({ where: { commentId, userId } });
		return { liked: Boolean(mine), likeCount };
	}

	private async repliesFor(
		knowledgeId: string,
		rootIds: string[],
		isOwned: boolean,
	): Promise<Map<string, { rows: KnowledgeComment[]; total: number }>> {
		const grouped = new Map<
			string,
			{ rows: KnowledgeComment[]; total: number }
		>();
		if (rootIds.length === 0) return grouped;
		const qb = this.comments.createQueryBuilder('c');
		qb.where('c.knowledge_id = :knowledgeId', { knowledgeId });
		qb.andWhere('c.parent_id IN (:...rootIds)', { rootIds });
		qb.andWhere('c.deleted_at IS NULL');
		qb.andWhere('c.hidden_at IS NULL');
		if (!isOwned) qb.andWhere("c.audience = 'readers'");
		qb.orderBy('c.created_at', 'DESC');
		qb.addOrderBy('c.id', 'DESC');
		const rows = await qb.getMany();
		for (const row of rows) {
			const key = row.parentId ?? '';
			const bucket = grouped.get(key) ?? { rows: [], total: 0 };
			bucket.total += 1;
			if (bucket.rows.length < REPLY_PREVIEW) bucket.rows.push(row);
			grouped.set(key, bucket);
		}
		return grouped;
	}

	private async toViews(
		rows: KnowledgeComment[],
		authorId: number | null,
		viewerId: number,
		replies?: Map<string, { rows: KnowledgeComment[]; total: number }>,
	): Promise<CommentView[]> {
		const replyRows = replies
			? [...replies.values()].flatMap((bucket) => bucket.rows)
			: [];
		const all = [...rows, ...replyRows];
		const ids = all.flatMap((row) =>
			row.replyToUserId ? [row.userId, row.replyToUserId] : [row.userId],
		);
		const people = await this.people(ids);
		const stats = await this.stats(
			all.map((row) => row.id),
			viewerId,
		);
		const attach = replies != null;
		const mapOne = (
			row: KnowledgeComment,
			withReplies: boolean,
		): CommentView => {
			const person = people.get(row.userId);
			const replyTo = row.replyToUserId
				? people.get(row.replyToUserId)
				: undefined;
			const bucket = withReplies ? replies?.get(row.id) : undefined;
			const mine = row.userId === viewerId;
			const view: CommentView = {
				id: row.id,
				userId: row.userId,
				parentId: row.parentId,
				replyToUserId: row.replyToUserId,
				replyToUsername: replyTo?.username ?? null,
				replyToByDocAuthor: authorId != null && row.replyToUserId === authorId,
				content: row.content,
				audience: row.audience,
				editedAt: row.editedAt ? row.editedAt.toISOString() : null,
				createdAt: row.createdAt.toISOString(),
				username: person?.username ?? '',
				avatar: person?.avatar ?? null,
				byDocAuthor: authorId != null && row.userId === authorId,
				likeCount: stats.counts.get(row.id) ?? 0,
				liked: stats.mine.has(row.id),
				mine,
				canDelete: mine,
			};
			if (withReplies) {
				const head = bucket?.rows ?? [];
				view.replies = head.map((reply) => mapOne(reply, false));
				view.replyCount = bucket?.total ?? 0;
				const last = head[head.length - 1];
				view.repliesNextCursor =
					bucket && bucket.total > head.length && last
						? this.cursorOf(last)
						: null;
			}
			return view;
		};
		return rows.map((row) => mapOne(row, attach));
	}

	private async people(ids: number[]) {
		const uniq = [...new Set(ids)];
		const map = new Map<number, { username: string; avatar: string | null }>();
		if (uniq.length === 0) return map;
		const users = await this.users.find({
			where: { id: In(uniq) },
			relations: { profile: true },
		});
		for (const user of users) {
			const avatar = user.profile?.avatar?.trim() || null;
			map.set(user.id, { username: user.username, avatar });
		}
		return map;
	}

	private async stats(ids: string[], viewerId: number) {
		const counts = new Map<string, number>();
		const mine = new Set<string>();
		if (ids.length === 0) return { counts, mine };
		const raw = await this.likes
			.createQueryBuilder('l')
			.select('l.comment_id', 'commentId')
			.addSelect('COUNT(*)', 'n')
			.where('l.comment_id IN (:...ids)', { ids })
			.groupBy('l.comment_id')
			.getRawMany<{ commentId: string; n: string }>();
		for (const row of raw) {
			counts.set(row.commentId, Number(row.n) || 0);
		}
		const liked = await this.likes.find({
			where: { userId: viewerId, commentId: In(ids) },
			select: { commentId: true },
		});
		for (const row of liked) mine.add(row.commentId);
		return { counts, mine };
	}

	private parseCursor(cursor?: string): { time: Date; id: string } | null {
		if (!cursor) return null;
		const cut = cursor.lastIndexOf('|');
		const time = new Date(cursor.slice(0, cut));
		const id = cursor.slice(cut + 1);
		if (cut <= 0 || !id || Number.isNaN(time.getTime())) {
			throw new BadRequestException('游标无效');
		}
		return { time, id };
	}

	private cursorOf(row: KnowledgeComment): string {
		return `${row.createdAt.toISOString()}|${row.id}`;
	}

	private isDup(error: unknown): boolean {
		if (!(error instanceof QueryFailedError)) return false;
		const driver = error.driverError as { errno?: number; code?: string };
		return driver?.errno === 1062 || driver?.code === 'ER_DUP_ENTRY';
	}
}
