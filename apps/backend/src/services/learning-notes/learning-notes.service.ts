import {
	BadRequestException,
	Inject,
	Injectable,
	type LoggerService,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { In, LessThan, Repository } from 'typeorm';
import { UploadService } from '../upload/upload.service';
import { User } from '../user/user.entity';
import { QueryLearningNoteDto } from './dto/query-learning-note.dto';
import { SaveLearningNoteDto } from './dto/save-learning-note.dto';
import { UpdateLearningNoteDto } from './dto/update-learning-note.dto';
import { UpdateNoteVisibilityDto } from './dto/update-note-visibility.dto';
import { EnglishLearningNote } from './english-learning-note.entity';
import { EnglishLearningNoteAttachment } from './english-learning-note-attachment.entity';
import { EnglishLearningNotePendingUpload } from './english-learning-note-pending-upload.entity';
import {
	buildLearningNoteDocxBuffer,
	NOTE_DOCX_HTML_MAX_CHARS,
} from './learning-note-docx.builder';
import { extractNoteImageRefsFromHtml } from './note-image-refs';

export type LearningNoteListItem = Pick<
	EnglishLearningNote,
	'id' | 'title' | 'userId' | 'isPublic' | 'createdAt' | 'updatedAt'
> & { isOwned: boolean; author: string };

/** 未保存会话 pending 保留时长（keepalive 失败时的服务端兜底） */
const PENDING_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class LearningNotesService {
	constructor(
		@InjectRepository(EnglishLearningNote)
		private readonly noteRepo: Repository<EnglishLearningNote>,
		@InjectRepository(EnglishLearningNoteAttachment)
		private readonly attachmentRepo: Repository<EnglishLearningNoteAttachment>,
		@InjectRepository(EnglishLearningNotePendingUpload)
		private readonly pendingRepo: Repository<EnglishLearningNotePendingUpload>,
		@InjectRepository(User)
		private readonly userRepo: Repository<User>,
		private readonly uploadService: UploadService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	/** 保存笔记：保存标题/正文/上传会话 */
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
		await this.syncAttachmentsFromContent(saved.id, saved.content ?? '');
		if (dto.uploadSessionId?.trim()) {
			await this.settlePendingSession(
				userId,
				dto.uploadSessionId.trim(),
				saved.content ?? '',
			);
		}
		void this.gcExpiredPending(userId);
		return { id: saved.id };
	}

	/** 更新笔记：更新标题/正文/上传会话 */
	async update(
		userId: number,
		dto: UpdateLearningNoteDto,
	): Promise<{ id: string }> {
		if (
			dto.title === undefined &&
			dto.content === undefined &&
			!dto.uploadSessionId?.trim()
		) {
			throw new BadRequestException('请至少提供一项要更新的字段');
		}
		const row = await this.requireOwned(userId, dto.id);
		if (dto.title !== undefined) row.title = dto.title.trim() || null;
		if (dto.content !== undefined) row.content = dto.content;
		const saved =
			dto.title !== undefined || dto.content !== undefined
				? await this.noteRepo.save(row)
				: row;
		if (dto.content !== undefined) {
			await this.syncAttachmentsFromContent(saved.id, saved.content ?? '');
		}
		if (dto.uploadSessionId?.trim()) {
			await this.settlePendingSession(
				userId,
				dto.uploadSessionId.trim(),
				saved.content ?? '',
			);
		}
		void this.gcExpiredPending(userId);
		return { id: saved.id };
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
		const fromTable = await this.attachmentKeysForNote(row.id);
		// ponytail: 附件表无 FK CASCADE，须先删行再删 COS；旧笔记可能只有 HTML 无行
		const fromHtml = extractNoteImageRefsFromHtml(row.content ?? '').map(
			(r) => r.key,
		);
		const keys = [...new Set([...fromTable, ...fromHtml])];
		await this.attachmentRepo.delete({ noteId: row.id });
		await this.noteRepo.delete({ id: row.id, userId });
		await this.deleteOrphanCosKeys(keys);
	}

	/**
	 * 笔记图片上传（COS 前缀 notes/）。
	 * 有 uploadSessionId 时一律记 pending（含已保存笔记的本次编辑），
	 * 保存/回到干净态/放弃会话时再结算，避免「上传又删且未保存」孤儿。
	 */
	async uploadImage(
		userId: number,
		file: Express.Multer.File,
		noteId?: string,
		sessionId?: string,
	) {
		if (!file?.buffer?.length) {
			throw new BadRequestException('请上传图片文件');
		}
		if (!file.mimetype?.startsWith('image/')) {
			throw new BadRequestException('仅支持图片文件');
		}
		const uploaded = await this.uploadService.uploadObjectToCos(file, 'notes');
		const sid = sessionId?.trim();
		const nid = noteId?.trim();
		if (sid) {
			await this.ensurePendingRow(userId, sid, uploaded.key, uploaded.url);
		} else if (nid) {
			await this.ensureAttachmentRow(userId, nid, uploaded.key, uploaded.url);
		}
		void this.gcExpiredPending(userId);
		return uploaded;
	}

	/** 放弃上传会话：删除该会话全部 pending + 无引用的 COS 对象 */
	async discardUploadSession(
		userId: number,
		sessionId: string,
	): Promise<{ ok: true }> {
		const sid = sessionId?.trim();
		if (!sid) throw new BadRequestException('缺少 uploadSessionId');
		await this.deletePendingSession(userId, sid);
		void this.gcExpiredPending(userId);
		return { ok: true };
	}

	/**
	 * 按当前正文结算会话（不写笔记）：正文里没有的 pending 删 COS。
	 * 用于「上传又删、内容回到基线无需保存」时立刻回收。
	 */
	async settleUploadSession(
		userId: number,
		sessionId: string,
		content: string,
	): Promise<{ ok: true }> {
		const sid = sessionId?.trim();
		if (!sid) throw new BadRequestException('缺少 uploadSessionId');
		await this.settlePendingSession(userId, sid, content ?? '');
		void this.gcExpiredPending(userId);
		return { ok: true };
	}

	/** 本人笔记，或已公开笔记（任意登录用户可读） */
	async findOne(
		userId: number,
		id: string,
	): Promise<EnglishLearningNote & { isOwned: boolean; author: string }> {
		void this.gcExpiredPending(userId);
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
		void this.gcExpiredPending(userId);
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

	/** 确保附件行：仅 notes/ 前缀的 key */
	private async ensureAttachmentRow(
		userId: number,
		noteId: string,
		cosKey: string,
		url: string,
	): Promise<void> {
		if (!cosKey.startsWith('notes/')) return;
		await this.requireOwned(userId, noteId);
		const existing = await this.attachmentRepo.findOne({
			where: { noteId, cosKey },
			select: { id: true },
		});
		if (existing) return;
		await this.attachmentRepo.save(
			this.attachmentRepo.create({ noteId, cosKey, url }),
		);
	}

	/** 确保 pending 行：仅 notes/ 前缀的 key */
	private async ensurePendingRow(
		userId: number,
		sessionId: string,
		cosKey: string,
		url: string,
	): Promise<void> {
		if (!cosKey.startsWith('notes/')) return;
		const existing = await this.pendingRepo.findOne({
			where: { userId, sessionId, cosKey },
			select: { id: true },
		});
		if (existing) return;
		await this.pendingRepo.save(
			this.pendingRepo.create({ userId, sessionId, cosKey, url }),
		);
	}

	/**
	 * 保存后结算会话：正文里没有的 pending → 删 COS；已认领的只删 pending 行。
	 */
	private async settlePendingSession(
		userId: number,
		sessionId: string,
		html: string,
	): Promise<void> {
		const kept = new Set(extractNoteImageRefsFromHtml(html).map((r) => r.key));
		const rows = await this.pendingRepo.find({
			where: { userId, sessionId },
			select: { id: true, cosKey: true },
		});
		if (!rows.length) return;

		const orphanKeys = rows
			.filter((r) => !kept.has(r.cosKey))
			.map((r) => r.cosKey);
		await this.pendingRepo.delete({
			id: In(rows.map((r) => r.id)),
		});
		await this.deleteOrphanCosKeys(orphanKeys);
	}

	/** 删除上传会话：仅删除 pending 行 + 无引用的 COS 对象 */
	private async deletePendingSession(
		userId: number,
		sessionId: string,
	): Promise<void> {
		const rows = await this.pendingRepo.find({
			where: { userId, sessionId },
			select: { id: true, cosKey: true },
		});
		if (!rows.length) return;
		const keys = rows.map((r) => r.cosKey);
		await this.pendingRepo.delete({ id: In(rows.map((r) => r.id)) });
		await this.deleteOrphanCosKeys(keys);
	}

	/** 过期 pending（崩溃未放弃的会话） */
	private async gcExpiredPending(userId: number): Promise<void> {
		try {
			const cutoff = new Date(Date.now() - PENDING_TTL_MS);
			const rows = await this.pendingRepo.find({
				where: { userId, createdAt: LessThan(cutoff) },
				select: { id: true, cosKey: true },
				take: 100,
			});
			if (!rows.length) return;
			const keys = rows.map((r) => r.cosKey);
			await this.pendingRepo.delete({ id: In(rows.map((r) => r.id)) });
			await this.deleteOrphanCosKeys(keys);
		} catch (e) {
			this.logger.error?.(
				`清理过期 pending 失败: ${e instanceof Error ? e.message : e}`,
			);
		}
	}

	/**
	 * 以正文 HTML 为真相源，同步本笔记附件行；对本篇移除的 key 做引用计数后删 COS。
	 */
	private async syncAttachmentsFromContent(
		noteId: string,
		html: string,
	): Promise<void> {
		const refs = extractNoteImageRefsFromHtml(html);
		const nextKeys = new Set(refs.map((r) => r.key));
		const existing = await this.attachmentRepo.find({
			where: { noteId },
			select: { id: true, cosKey: true },
		});
		const existingKeys = new Set(existing.map((a) => a.cosKey));

		const toRemove = existing.filter((a) => !nextKeys.has(a.cosKey));
		if (toRemove.length) {
			await this.attachmentRepo.delete({
				id: In(toRemove.map((a) => a.id)),
			});
		}

		const toAdd = refs.filter((r) => !existingKeys.has(r.key));
		if (toAdd.length) {
			await this.attachmentRepo.save(
				toAdd.map((r) =>
					this.attachmentRepo.create({
						noteId,
						cosKey: r.key,
						url: r.url || this.uploadService.buildCosPublicUrl(r.key),
					}),
				),
			);
		}

		await this.deleteOrphanCosKeys(toRemove.map((a) => a.cosKey));
	}

	private async attachmentKeysForNote(noteId: string): Promise<string[]> {
		const rows = await this.attachmentRepo.find({
			where: { noteId },
			select: { cosKey: true },
		});
		return [...new Set(rows.map((r) => r.cosKey))];
	}

	/** 回收笔记图片：仅无引用的 COS 对象（无 pending 且无附件行） */
	private async deleteOrphanCosKeys(keys: string[]): Promise<void> {
		// 仅 notes/ 前缀的 key
		const unique = [...new Set(keys.filter((k) => k.startsWith('notes/')))];
		/** 仅无引用的 COS 对象 */
		await Promise.all(
			unique.map(async (key) => {
				try {
					const [inNote, inPending] = await Promise.all([
						this.attachmentRepo.count({ where: { cosKey: key } }),
						this.pendingRepo.count({ where: { cosKey: key } }),
					]);
					if (inNote > 0 || inPending > 0) return;
					await this.uploadService.deleteCosObject(key);
				} catch (e) {
					this.logger.error?.(
						`回收笔记图片失败 key=${key}: ${e instanceof Error ? e.message : e}`,
					);
				}
			}),
		);
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
