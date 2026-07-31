import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { QueryLearningNoteDto } from './dto/query-learning-note.dto';
import { SaveLearningNoteDto } from './dto/save-learning-note.dto';
import { UpdateLearningNoteDto } from './dto/update-learning-note.dto';
import { UpdateNoteVisibilityDto } from './dto/update-note-visibility.dto';
import { EnglishLearningNote } from './english-learning-note.entity';
import {
	buildLearningNoteDocxBuffer,
	NOTE_DOCX_HTML_MAX_CHARS,
} from './learning-note-docx.builder';

export type LearningNoteListItem = Pick<
	EnglishLearningNote,
	'id' | 'title' | 'userId' | 'isPublic' | 'createdAt' | 'updatedAt'
> & { isOwned: boolean; author: string };

@Injectable()
export class LearningNotesService {
	constructor(
		@InjectRepository(EnglishLearningNote)
		private readonly noteRepo: Repository<EnglishLearningNote>,
		@InjectRepository(User)
		private readonly userRepo: Repository<User>,
	) {}

	async save(
		userId: number,
		dto: SaveLearningNoteDto,
	): Promise<{ id: string }> {
		const row = this.noteRepo.create({
			userId,
			title: dto.title?.trim() ? dto.title.trim() : null,
			content: dto.content ?? '',
			isPublic: false,
		});
		const saved = await this.noteRepo.save(row);
		return { id: saved.id };
	}

	async update(
		userId: number,
		dto: UpdateLearningNoteDto,
	): Promise<EnglishLearningNote> {
		if (dto.title === undefined && dto.content === undefined) {
			throw new BadRequestException('请至少提供一项要更新的字段');
		}
		const row = await this.requireOwned(userId, dto.id);
		if (dto.title !== undefined) row.title = dto.title.trim() || null;
		if (dto.content !== undefined) row.content = dto.content;
		return this.noteRepo.save(row);
	}

	/** 所有者设置是否全站公开 */
	async setVisibility(
		userId: number,
		id: string,
		dto: UpdateNoteVisibilityDto,
	): Promise<LearningNoteListItem> {
		const row = await this.requireOwned(userId, id);
		row.isPublic = dto.isPublic;
		const saved = await this.noteRepo.save(row);
		const authors = await this.authorMap([saved.userId]);
		return this.toListItem(saved, userId, authors.get(saved.userId));
	}

	async remove(userId: number, id: string): Promise<void> {
		const row = await this.requireOwned(userId, id);
		await this.noteRepo.delete({ id: row.id, userId });
	}

	/** 本人笔记，或已公开笔记（任意登录用户可读） */
	async findOne(
		userId: number,
		id: string,
	): Promise<EnglishLearningNote & { isOwned: boolean; author: string }> {
		const owned = await this.noteRepo.findOne({ where: { id, userId } });
		if (owned) {
			const authors = await this.authorMap([owned.userId]);
			return Object.assign(owned, {
				isOwned: true,
				author: authors.get(owned.userId) ?? String(owned.userId),
			});
		}
		const pub = await this.noteRepo.findOne({
			where: { id, isPublic: true },
		});
		if (!pub) throw new NotFoundException('笔记不存在');
		const authors = await this.authorMap([pub.userId]);
		return Object.assign(pub, {
			isOwned: false,
			author: authors.get(pub.userId) ?? String(pub.userId),
		});
	}

	/** 分页：本人笔记 + 他人公开笔记（对齐词库可见范围） */
	async findPage(
		userId: number,
		query: QueryLearningNoteDto,
	): Promise<{ list: LearningNoteListItem[]; total: number }> {
		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 20;
		const take = Math.min(pageSize, 100);
		const skip = (pageNo - 1) * take;
		const title = query.title?.trim();

		const qb = this.noteRepo
			.createQueryBuilder('n')
			.select([
				'n.id',
				'n.title',
				'n.userId',
				'n.isPublic',
				'n.createdAt',
				'n.updatedAt',
			])
			.where('(n.userId = :userId OR n.isPublic = true)', { userId })
			.orderBy('n.updatedAt', 'DESC')
			.take(take)
			.skip(skip);

		if (title) {
			qb.andWhere('n.title LIKE :title', { title: `%${title}%` });
		}

		const [rows, total] = await qb.getManyAndCount();
		const authors = await this.authorMap(rows.map((r) => r.userId));
		return {
			list: rows.map((row) =>
				this.toListItem(row, userId, authors.get(row.userId)),
			),
			total,
		};
	}

	/**
	 * 导出单篇笔记为 DOCX（保留正文图片；超大图缩小显示，极端体积才跳过）。
	 */
	async exportDocxBuffer(userId: number, id: string): Promise<Buffer> {
		const row = await this.requireOwned(userId, id);
		const html = row.content ?? '';
		if (html.length > NOTE_DOCX_HTML_MAX_CHARS) {
			throw new BadRequestException(
				`笔记内容过大（>${NOTE_DOCX_HTML_MAX_CHARS} 字符），请精简后再导出`,
			);
		}
		try {
			return await buildLearningNoteDocxBuffer({
				title: row.title?.trim() || '无标题笔记',
				html,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			throw new BadRequestException(msg || '导出失败');
		}
	}

	private async authorMap(userIds: number[]): Promise<Map<number, string>> {
		const unique = [...new Set(userIds.filter((id) => id > 0))];
		const map = new Map<number, string>();
		if (unique.length === 0) return map;
		const users = await this.userRepo.find({
			where: { id: In(unique) },
			select: { id: true, username: true },
		});
		for (const u of users) map.set(u.id, u.username);
		for (const id of unique) {
			if (!map.has(id)) map.set(id, String(id));
		}
		return map;
	}

	private toListItem(
		row: Pick<
			EnglishLearningNote,
			'id' | 'title' | 'userId' | 'isPublic' | 'createdAt' | 'updatedAt'
		>,
		viewerUserId: number,
		author?: string,
	): LearningNoteListItem {
		return {
			id: row.id,
			title: row.title,
			userId: row.userId,
			isPublic: row.isPublic,
			isOwned: row.userId === viewerUserId,
			author: author?.trim() || String(row.userId),
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}

	private async requireOwned(
		userId: number,
		id: string,
	): Promise<EnglishLearningNote> {
		const row = await this.noteRepo.findOne({ where: { id, userId } });
		if (!row) throw new NotFoundException('笔记不存在');
		return row;
	}
}
