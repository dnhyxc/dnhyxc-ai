import { unlink } from 'node:fs';
import { promisify } from 'node:util';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { decodeChineseFilename } from '../../utils';
import { normalizeUploadPublicPath } from '../../utils/upload-paths';
import { isCosObjectKey } from '../upload/cos.config';
import { UploadService } from '../upload/upload.service';
import { UserService } from '../user/user.service';
import { AddEbookPathDto } from './dto/add-ebook-path.dto';
import { CreateEbookCategoryDto } from './dto/create-ebook-category.dto';
import { QueryEbookCategoriesSummaryDto } from './dto/query-ebook-categories-summary.dto';
import { QueryEbookShelfDto } from './dto/query-ebook-shelf.dto';
import { ReorderEbookCategoriesDto } from './dto/reorder-ebook-categories.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { UpdateEbookCategoryDto } from './dto/update-ebook-category.dto';
import { UpdateEbookTitleDto } from './dto/update-ebook-title.dto';
import { EbookBook } from './ebook-book.entity';
import { EbookCategory } from './ebook-category.entity';
import { EbookProgress } from './ebook-progress.entity';

export type EbookBookDto = {
	id: string;
	fmt: 'epub' | 'pdf';
	title: string;
	author?: string;
	src: { kind: 'path'; path: string } | { kind: 'store'; localPath?: string };
	size?: number;
	coverUrl?: string;
	addedAt: string;
	categoryId?: string | null;
};

export type EbookCategoryDto = {
	id: string;
	name: string;
	sortOrder: number;
	bookCount: number;
};

export type EbookCategoriesSummaryDto = {
	categories: EbookCategoryDto[];
	uncategorizedCount: number;
	totalBookCount: number;
};

export type EbookProgDto = {
	bookId: string;
	epubCfi?: string;
	pdfPage?: number;
	percent?: number;
	updatedAt: string;
};

export type EbookShelfPageDto = {
	books: EbookBookDto[];
	progMap: Record<string, EbookProgDto>;
	total: number;
	pageNo: number;
	pageSize: number;
};

export type EbookBookDetailDto = {
	book: EbookBookDto;
	prog?: EbookProgDto;
};

export type EbookFilePayload =
	| { kind: 'disk'; abs: string; fmt: 'epub' | 'pdf' }
	| { kind: 'cos'; key: string; fmt: 'epub' | 'pdf' };

const unlinkAsync = promisify(unlink);

function titleFromPath(path: string): string {
	const name = path.split(/[/\\]/).pop() ?? path;
	const base = name.replace(/\.[^.]+$/, '').trim();
	return base || name;
}

function fmtFromName(name: string): 'epub' | 'pdf' | null {
	const lower = name.toLowerCase();
	if (lower.endsWith('.epub')) return 'epub';
	if (lower.endsWith('.pdf')) return 'pdf';
	return null;
}

function isCosEbookKey(filePath: string): boolean {
	return isCosObjectKey(filePath) && filePath.startsWith('ebooks/');
}

const MAX_EBOOK_CATEGORIES = 50;

const DEFAULT_CATEGORY_NAMES: Record<'zh-CN' | 'en-US', string[]> = {
	'zh-CN': ['技术', '学习', '文学', '工作', '其他'],
	'en-US': ['Tech', 'Learning', 'Literature', 'Work', 'Other'],
};

@Injectable()
export class EbookService {
	constructor(
		@InjectRepository(EbookBook)
		private readonly bookRepo: Repository<EbookBook>,
		@InjectRepository(EbookProgress)
		private readonly progRepo: Repository<EbookProgress>,
		@InjectRepository(EbookCategory)
		private readonly categoryRepo: Repository<EbookCategory>,
		private readonly uploadService: UploadService,
		private readonly userService: UserService,
	) {}

	private toBookDto(book: EbookBook): EbookBookDto {
		let src: EbookBookDto['src'];
		if (book.filePath) {
			src = book.localPath
				? { kind: 'store', localPath: book.localPath }
				: { kind: 'store' };
		} else if (book.localPath) {
			src = { kind: 'path', path: book.localPath };
		} else {
			src = { kind: 'store' };
		}

		const dto: EbookBookDto = {
			id: book.id,
			fmt: book.fmt,
			title: book.title,
			src,
			addedAt: book.createdAt.toISOString(),
		};
		if (book.author) dto.author = book.author;
		if (book.size != null) dto.size = Number(book.size);
		if (book.coverPath) dto.coverUrl = book.coverPath;
		if (book.categoryId != null) dto.categoryId = book.categoryId;
		else dto.categoryId = null;
		return dto;
	}

	private toProgDto(prog: EbookProgress): EbookProgDto {
		const dto: EbookProgDto = {
			bookId: prog.bookId,
			updatedAt: prog.updatedAt.toISOString(),
		};
		if (prog.epubCfi) dto.epubCfi = prog.epubCfi;
		if (prog.pdfPage != null) dto.pdfPage = prog.pdfPage;
		if (prog.percent != null) dto.percent = prog.percent;
		return dto;
	}

	async getShelf(
		userId: number,
		query: QueryEbookShelfDto = {},
	): Promise<EbookShelfPageDto> {
		if (query.categoryId && query.uncategorizedOnly) {
			throw new BadRequestException(
				'categoryId 与 uncategorizedOnly 不能同时使用',
			);
		}

		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 20;
		const take = pageSize;
		const skip = (pageNo - 1) * take;

		const where: FindOptionsWhere<EbookBook> = { userId };
		if (query.categoryId) {
			const cat = await this.categoryRepo.findOne({
				where: { id: query.categoryId, userId },
			});
			if (!cat) {
				throw new NotFoundException('分类不存在');
			}
			where.categoryId = query.categoryId;
		} else if (query.uncategorizedOnly) {
			where.categoryId = IsNull();
		}

		const [books, total] = await this.bookRepo.findAndCount({
			where,
			order: { createdAt: 'DESC' },
			take,
			skip,
		});
		const ids = books.map((b) => b.id);
		const progresses =
			ids.length === 0
				? []
				: await this.progRepo.find({
						where: { userId, bookId: In(ids) },
					});
		const progMap: Record<string, EbookProgDto> = {};
		for (const p of progresses) {
			progMap[p.bookId] = this.toProgDto(p);
		}
		return {
			books: books.map((b) => this.toBookDto(b)),
			progMap,
			total,
			pageNo,
			pageSize,
		};
	}

	async getBook(userId: number, bookId: string): Promise<EbookBookDetailDto> {
		const book = await this.bookRepo.findOne({
			where: { id: bookId, userId },
		});
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}
		const prog = await this.progRepo.findOne({
			where: { bookId, userId },
		});
		return {
			book: this.toBookDto(book),
			prog: prog ? this.toProgDto(prog) : undefined,
		};
	}

	/** 按桌面 local_path 查找当前用户是否已登记该书 */
	async findBookByLocalPath(
		userId: number,
		path: string,
	): Promise<EbookBookDto | null> {
		const trimmed = path.trim();
		if (!trimmed) {
			return null;
		}
		const book = await this.bookRepo.findOne({
			where: { userId, localPath: trimmed },
		});
		return book ? this.toBookDto(book) : null;
	}

	/** 登记桌面本地路径，先上架；后台上传 COS 后保留 localPath */
	async addFromPath(
		userId: number,
		dto: AddEbookPathDto,
	): Promise<EbookBookDto> {
		const path = dto.path.trim();
		if (!path) {
			throw new BadRequestException('path 不能为空');
		}
		const fmt = dto.fmt ?? fmtFromName(path);
		if (!fmt) {
			throw new BadRequestException('仅支持 epub / pdf');
		}

		const dup = await this.bookRepo.findOne({
			where: { userId, localPath: path },
		});
		if (dup) {
			return this.toBookDto(dup);
		}

		const title = (dto.title?.trim() || titleFromPath(path)).slice(0, 512);
		const categoryId = await this.resolveUserCategoryId(userId, dto.categoryId);
		const book = this.bookRepo.create({
			userId,
			fmt,
			title,
			srcKind: 'path',
			localPath: path,
			categoryId,
		});
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}

	async addFromUpload(
		userId: number,
		file: Express.Multer.File,
		opts?: { bookId?: string; categoryId?: string },
	): Promise<EbookBookDto> {
		if (!file?.path || !file.size) {
			throw new BadRequestException('请上传 epub / pdf 文件');
		}
		const originalname = decodeChineseFilename(file.originalname);
		const fmt = fmtFromName(originalname);
		if (!fmt) {
			throw new BadRequestException('仅支持 epub / pdf');
		}

		const isMember = await this.userService.isUserMembershipActive(userId);
		if (!isMember) {
			throw new ForbiddenException('开通会员后可上传书籍至云端');
		}

		try {
			const stored = await this.storeEbookToCos(file);
			return await this.saveUploadedBook(userId, file, fmt, stored, opts);
		} finally {
			await this.tryDeleteTempUpload(file.path);
		}
	}

	private async saveUploadedBook(
		userId: number,
		file: Express.Multer.File,
		fmt: 'epub' | 'pdf',
		stored: { filePath: string; size: number },
		opts?: { bookId?: string; categoryId?: string },
	): Promise<EbookBookDto> {
		if (opts?.bookId) {
			const book = await this.bookRepo.findOne({
				where: { id: opts.bookId, userId },
			});
			if (!book) {
				throw new NotFoundException('书籍不存在');
			}
			if (book.fmt !== fmt) {
				throw new BadRequestException('文件格式与已登记书籍不一致');
			}
			book.filePath = stored.filePath;
			book.srcKind = 'store';
			book.size = String(stored.size);
			await this.bookRepo.save(book);
			return this.toBookDto(book);
		}

		const originalname = decodeChineseFilename(file.originalname);
		const title = titleFromPath(originalname).slice(0, 512);
		const categoryId = await this.resolveUserCategoryId(
			userId,
			opts?.categoryId,
		);
		const book = this.bookRepo.create({
			userId,
			fmt,
			title,
			srcKind: 'store',
			filePath: stored.filePath,
			size: String(stored.size),
			categoryId,
		});
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}

	private async tryDeleteTempUpload(path: string | undefined): Promise<void> {
		if (!path) return;
		try {
			await unlinkAsync(path);
		} catch {
			// 临时文件清理失败不阻塞主流程
		}
	}

	/** 会员：流式上传至 COS ebooks/ 前缀 */
	private async storeEbookToCos(file: Express.Multer.File) {
		const cosResult = await this.uploadService.uploadLocalFileToCos({
			localPath: file.path,
			originalname: file.originalname,
			mimetype: file.mimetype,
			size: file.size,
			prefix: 'ebooks',
		});
		return { filePath: cosResult.key, size: cosResult.size };
	}

	async remove(userId: number, bookId: string): Promise<void> {
		const book = await this.bookRepo.findOne({ where: { id: bookId, userId } });
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}
		if (book.srcKind === 'store' && book.filePath) {
			await this.tryDeleteStoredEbookFile(book.filePath);
		}
		await this.tryDeleteCoverFile(book.coverPath);
		await this.progRepo.delete({ bookId, userId });
		await this.bookRepo.delete({ id: bookId, userId });
	}

	/** 删除 COS 上的电子书对象（filePath 为 ebooks/ 对象键） */
	private async tryDeleteStoredEbookFile(filePath: string): Promise<void> {
		if (!isCosEbookKey(filePath)) return;
		try {
			await this.uploadService.deleteCosObject(filePath);
		} catch {
			// COS 删除失败不阻塞移出书架
		}
	}

	async saveCover(
		userId: number,
		bookId: string,
		file: Express.Multer.File,
	): Promise<EbookBookDto> {
		if (!file?.path) {
			throw new BadRequestException('请上传封面图片');
		}
		const book = await this.bookRepo.findOne({
			where: { id: bookId, userId },
		});
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}
		const coverPath = normalizeUploadPublicPath(
			this.uploadService.getStaticPath(file.path, file.mimetype),
		);
		await this.tryDeleteCoverFile(book.coverPath);
		book.coverPath = coverPath;
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}

	private async tryDeleteCoverFile(coverPath: string | null): Promise<void> {
		if (!coverPath) return;
		const matched = coverPath.match(/^\/images\/([^/]+)$/);
		if (!matched) return;
		try {
			await this.uploadService.deleteFile(matched[1]);
		} catch {
			// 旧封面删除失败不阻塞
		}
	}

	async updateTitle(
		userId: number,
		dto: UpdateEbookTitleDto,
	): Promise<EbookBookDto> {
		const title = dto.title.trim();
		if (!title) {
			throw new BadRequestException('书名不能为空');
		}
		const book = await this.bookRepo.findOne({
			where: { id: dto.bookId, userId },
		});
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}
		book.title = title.slice(0, 512);
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}

	async saveProgress(
		userId: number,
		dto: SaveEbookProgressDto,
	): Promise<EbookProgDto> {
		const book = await this.bookRepo.findOne({
			where: { id: dto.bookId, userId },
		});
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}

		let prog = await this.progRepo.findOne({
			where: { bookId: dto.bookId, userId },
		});
		if (!prog) {
			prog = this.progRepo.create({
				bookId: dto.bookId,
				userId,
			});
		}
		prog.epubCfi = dto.epubCfi ?? prog.epubCfi;
		prog.pdfPage = dto.pdfPage ?? prog.pdfPage;
		prog.percent = dto.percent ?? prog.percent;
		await this.progRepo.save(prog);
		return this.toProgDto(prog);
	}

	async getFileForDownload(
		userId: number,
		bookId: string,
	): Promise<EbookFilePayload> {
		const book = await this.bookRepo.findOne({ where: { id: bookId, userId } });
		if (!book || book.srcKind !== 'store' || !book.filePath) {
			throw new NotFoundException('文件不存在');
		}

		if (!isCosEbookKey(book.filePath)) {
			throw new NotFoundException('云端文件不存在');
		}

		return { kind: 'cos', key: book.filePath, fmt: book.fmt };
	}

	async pipeFileToResponse(
		userId: number,
		bookId: string,
		res: Response,
	): Promise<void> {
		const payload = await this.getFileForDownload(userId, bookId);
		res.setHeader('Content-Type', this.getEbookMime(payload.fmt));
		if (payload.kind === 'disk') {
			res.sendFile(payload.abs);
			return;
		}
		await this.uploadService.pipeObjectToWritable(payload.key, res);
	}

	getEbookMime(fmt: 'epub' | 'pdf'): string {
		return fmt === 'pdf' ? 'application/pdf' : 'application/epub+zip';
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
		query: QueryEbookCategoriesSummaryDto = {},
	): Promise<EbookCategoriesSummaryDto> {
		await this.ensureDefaultCategories(userId, query.locale);
		const categories = await this.categoryRepo.find({
			where: { userId },
			order: { sortOrder: 'ASC', createdAt: 'ASC' },
		});
		const countRows = await this.bookRepo
			.createQueryBuilder('b')
			.select('b.category_id', 'categoryId')
			.addSelect('COUNT(*)', 'cnt')
			.where('b.user_id = :userId', { userId })
			.groupBy('b.category_id')
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
		const totalBookCount = await this.bookRepo.count({ where: { userId } });
		return {
			categories: categories.map((c) => ({
				id: c.id,
				name: c.name,
				sortOrder: c.sortOrder,
				bookCount: countMap.get(c.id) ?? 0,
			})),
			uncategorizedCount,
			totalBookCount,
		};
	}

	async createCategory(
		userId: number,
		dto: CreateEbookCategoryDto,
	): Promise<EbookCategoryDto> {
		const name = this.normalizeCategoryName(dto.name);
		if (!name) {
			throw new BadRequestException('分类名称不能为空');
		}
		const total = await this.categoryRepo.count({ where: { userId } });
		if (total >= MAX_EBOOK_CATEGORIES) {
			throw new BadRequestException(`最多创建 ${MAX_EBOOK_CATEGORIES} 个分类`);
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
			bookCount: 0,
		};
	}

	async updateCategory(
		userId: number,
		categoryId: string,
		dto: UpdateEbookCategoryDto,
	): Promise<EbookCategoryDto> {
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
		const bookCount = await this.bookRepo.count({
			where: { userId, categoryId: row.id },
		});
		return {
			id: row.id,
			name: row.name,
			sortOrder: row.sortOrder,
			bookCount,
		};
	}

	async removeCategory(userId: number, categoryId: string): Promise<void> {
		const row = await this.categoryRepo.findOne({
			where: { id: categoryId, userId },
		});
		if (!row) {
			throw new NotFoundException('分类不存在');
		}
		// 迁移未建 FK ON DELETE SET NULL，删除前显式归入未分类
		await this.bookRepo.update({ userId, categoryId }, { categoryId: null });
		await this.categoryRepo.remove(row);
	}

	async reorderCategories(
		userId: number,
		dto: ReorderEbookCategoriesDto,
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

	async assignBookCategory(
		userId: number,
		bookId: string,
		categoryId: string | null,
	): Promise<EbookBookDto> {
		const book = await this.bookRepo.findOne({ where: { id: bookId, userId } });
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}
		if (categoryId) {
			await this.resolveUserCategoryId(userId, categoryId);
			book.categoryId = categoryId;
		} else {
			book.categoryId = null;
		}
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}
}
