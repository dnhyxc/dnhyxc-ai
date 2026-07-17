import { existsSync, readFile, unlink } from 'node:fs';
import { promisify } from 'node:util';
import { InjectQueue } from '@nestjs/bullmq';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import type { Response } from 'express';
import { Brackets, In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { decodeChineseFilename } from '../../utils';
import { normalizeUploadPublicPath } from '../../utils/upload-paths';
import { isCosObjectKey } from '../upload/cos.config';
import { UploadService } from '../upload/upload.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { AddEbookPathDto } from './dto/add-ebook-path.dto';
import { CreateEbookCategoryDto } from './dto/create-ebook-category.dto';
import { CreateEbookHighlightDto } from './dto/create-ebook-highlight.dto';
import { CreateEbookThoughtDto } from './dto/create-ebook-thought.dto';
import { QueryEbookCategoriesSummaryDto } from './dto/query-ebook-categories-summary.dto';
import { QueryEbookShelfDto } from './dto/query-ebook-shelf.dto';
import { ReorderEbookCategoriesDto } from './dto/reorder-ebook-categories.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { UpdateEbookCategoryDto } from './dto/update-ebook-category.dto';
import { UpdateEbookHighlightDto } from './dto/update-ebook-highlight.dto';
import { UpdateEbookThoughtDto } from './dto/update-ebook-thought.dto';
import { UpdateEbookTitleDto } from './dto/update-ebook-title.dto';
import { EbookBook } from './ebook-book.entity';
import { EbookCategory } from './ebook-category.entity';
import { EbookChapter } from './ebook-chapter.entity';
import { EbookHighlight } from './ebook-highlight.entity';
import { EbookProgress } from './ebook-progress.entity';
import { EbookThought } from './ebook-thought.entity';
import { EpubChapterParserService } from './epub-chapter-parser.service';
import { EPUB_PARSE_QUEUE } from './epub-parse.constants';
import { EpubParseQueueEvents } from './epub-parse-queue-events';

export type EbookBookOwnerDto = {
	userId: number;
	username: string;
	avatar: string;
};

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
	isPublic?: boolean;
	sourceBookId?: string | null;
	owner?: EbookBookOwnerDto;
	/** 公开书架：当前用户已有读书记录时的 id */
	readingBookId?: string;
	parseStatus?: 'pending' | 'ready' | 'failed';
	totalWordCount?: number;
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
	chapterIndex?: number;
	chapterHref?: string;
	scrollPercent?: number;
	updatedAt: string;
};

export type EbookChapterMetaDto = {
	index: number;
	href: string;
	title: string;
	level: number;
	wordCount?: number;
};

export type EbookChaptersDto = {
	bookId: string;
	title: string;
	total: number;
	totalWordCount?: number;
	/** spine 线性章（阅读/进度用） */
	chapters: EbookChapterMetaDto[];
	/**
	 * nav 展平目录（展示用，与 Web 一致；缺省时客户端回退 chapters）
	 * index 仍为 spine 下标，可多条共用同一 index
	 */
	toc?: EbookChapterMetaDto[];
};

export type EbookChapterContentDto = {
	bookId: string;
	index: number;
	title: string;
	html: string;
	wordCount?: number;
	totalWordCount?: number;
	prevIndex: number | null;
	nextIndex: number | null;
	total: number;
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
	publicSource?: {
		sourceBookId: string;
		ownerUserId: number;
		ownerUsername: string;
		ownerAvatar: string;
		isStillPublic: boolean;
	};
};

export type EbookThoughtDto = {
	id: string;
	userId: number;
	cfiRange: string;
	quote: string;
	content: string;
	/** 由 userId 在查询时从 user 表实时解析，不写入 ebook_thought */
	username: string;
	/** 由 userId 关联 profile 实时解析 */
	avatar: string;
	createdAt: string;
	updatedAt: string;
	isPublic: boolean;
};

export type EbookThoughtRevisionDto = {
	count: number;
	latestUpdatedAt: string | null;
};

export type EbookThoughtSyncDto = {
	revision: EbookThoughtRevisionDto;
	changes: EbookThoughtDto[];
	/** since 之后对当前用户不可见的想法 id（软删 / 改私密） */
	deletedIds: string[];
};

export type EbookHighlightDto = {
	id: string;
	userId: number;
	cfiRange: string;
	quote: string;
	style: 'highlight' | 'underline' | 'wavy';
	color: string;
	createdAt: string;
	updatedAt: string;
};

type EbookThoughtUserInfo = {
	username: string;
	avatar: string;
};

export type EbookFilePayload =
	| { kind: 'disk'; abs: string; fmt: 'epub' | 'pdf' }
	| { kind: 'cos'; key: string; fmt: 'epub' | 'pdf' };

const unlinkAsync = promisify(unlink);
const readFileAsync = promisify(readFile);

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
	private readonly logger = new Logger(EbookService.name);

	/** ponytail: 大 EPUB 解析可达 60s+，请求侧等待而非立刻 409 */
	private static readonly PARSE_WAIT_MS = 120_000;
	private static readonly MAX_PARSE_ATTEMPTS = 3;

	constructor(
		@InjectRepository(EbookBook)
		private readonly bookRepo: Repository<EbookBook>,
		@InjectRepository(EbookChapter)
		private readonly chapterRepo: Repository<EbookChapter>,
		@InjectRepository(EbookProgress)
		private readonly progRepo: Repository<EbookProgress>,
		@InjectRepository(EbookCategory)
		private readonly categoryRepo: Repository<EbookCategory>,
		@InjectRepository(EbookThought)
		private readonly thoughtRepo: Repository<EbookThought>,
		@InjectRepository(EbookHighlight)
		private readonly highlightRepo: Repository<EbookHighlight>,
		@InjectRepository(User)
		private readonly userRepo: Repository<User>,
		private readonly uploadService: UploadService,
		private readonly userService: UserService,
		private readonly epubChapterParser: EpubChapterParserService,
		@InjectQueue(EPUB_PARSE_QUEUE)
		private readonly epubParseQueue: Queue,
		private readonly epubParseQueueEvents: EpubParseQueueEvents,
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
		if (book.isPublic) dto.isPublic = true;
		if (book.sourceBookId) dto.sourceBookId = book.sourceBookId;
		if (book.parseStatus) dto.parseStatus = book.parseStatus;
		if (book.totalWordCount != null && book.totalWordCount > 0) {
			dto.totalWordCount = book.totalWordCount;
		}
		return dto;
	}

	private async toBookDtoWithOwner(
		book: EbookBook,
		userInfoMap: Map<number, EbookThoughtUserInfo>,
	): Promise<EbookBookDto> {
		const dto = this.toBookDto(book);
		const info = userInfoMap.get(book.userId);
		if (info) {
			dto.owner = {
				userId: book.userId,
				username: info.username,
				avatar: info.avatar,
			};
		}
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
		if (prog.chapterIndex != null) dto.chapterIndex = prog.chapterIndex;
		if (prog.chapterHref) dto.chapterHref = prog.chapterHref;
		if (prog.scrollPercent != null) dto.scrollPercent = prog.scrollPercent;
		return dto;
	}

	async getShelf(
		userId: number,
		query: QueryEbookShelfDto = {},
	): Promise<EbookShelfPageDto> {
		const scope = query.scope ?? 'mine';
		if (scope === 'public') {
			return this.getPublicShelf(userId, query);
		}
		if (query.categoryId && query.uncategorizedOnly) {
			throw new BadRequestException(
				'categoryId 与 uncategorizedOnly 不能同时使用',
			);
		}

		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 20;
		const take = pageSize;
		const skip = (pageNo - 1) * take;

		if (query.categoryId) {
			const cat = await this.categoryRepo.findOne({
				where: { id: query.categoryId, userId },
			});
			if (!cat) {
				throw new NotFoundException('分类不存在');
			}
		}

		const qb = this.bookRepo
			.createQueryBuilder('b')
			.leftJoin(
				EbookProgress,
				'p',
				'p.book_id = b.id AND p.user_id = :userId',
				{ userId },
			)
			.select('b')
			.addSelect(
				'CASE WHEN p.updated_at IS NOT NULL THEN p.updated_at ELSE b.created_at END',
				'shelf_sort',
			)
			.where('b.user_id = :userId', { userId })
			.andWhere('b.source_book_id IS NULL');
		if (query.categoryId) {
			qb.andWhere('b.category_id = :categoryId', {
				categoryId: query.categoryId,
			});
		} else if (query.uncategorizedOnly) {
			qb.andWhere('b.category_id IS NULL');
		}
		qb.orderBy('shelf_sort', 'DESC').skip(skip).take(take);

		const [books, total] = await qb.getManyAndCount();
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

	private async getPublicShelf(
		userId: number,
		query: QueryEbookShelfDto,
	): Promise<EbookShelfPageDto> {
		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 20;
		const take = pageSize;
		const skip = (pageNo - 1) * take;

		const [publicBooks, total] = await this.bookRepo
			.createQueryBuilder('b')
			.where('b.is_public = :isPublic', { isPublic: true })
			.andWhere('b.source_book_id IS NULL')
			.andWhere('b.user_id != :userId', { userId })
			.orderBy('b.public_at', 'DESC')
			.addOrderBy('b.created_at', 'DESC')
			.skip(skip)
			.take(take)
			.getManyAndCount();

		const ownerIds = publicBooks.map((b) => b.userId);
		const userInfoMap = await this.buildUserInfoMap(ownerIds);

		const sourceIds = publicBooks.map((b) => b.id);
		const readingRecords =
			sourceIds.length === 0
				? []
				: await this.bookRepo.find({
						where: { userId, sourceBookId: In(sourceIds) },
					});
		const readingBySource = new Map(
			readingRecords.map((r) => [r.sourceBookId!, r]),
		);
		const readingIds = readingRecords.map((r) => r.id);
		const progresses =
			readingIds.length === 0
				? []
				: await this.progRepo.find({
						where: { userId, bookId: In(readingIds) },
					});
		const progByReadingId = new Map(progresses.map((p) => [p.bookId, p]));

		const progMap: Record<string, EbookProgDto> = {};
		const shelfBooks: EbookBookDto[] = [];
		for (const book of publicBooks) {
			const dto = await this.toBookDtoWithOwner(book, userInfoMap);
			const reading = readingBySource.get(book.id);
			if (reading) {
				dto.readingBookId = reading.id;
				const prog = progByReadingId.get(reading.id);
				if (prog) progMap[book.id] = this.toProgDto(prog);
			}
			shelfBooks.push(dto);
		}

		return {
			books: shelfBooks,
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
		const detail: EbookBookDetailDto = {
			book: this.toBookDto(book),
			prog: prog ? this.toProgDto(prog) : undefined,
		};
		if (book.sourceBookId) {
			const source = await this.bookRepo.findOne({
				where: { id: book.sourceBookId },
			});
			if (source) {
				if (source.parseStatus) detail.book.parseStatus = source.parseStatus;
				if (source.totalWordCount != null && source.totalWordCount > 0) {
					detail.book.totalWordCount = source.totalWordCount;
				}
				const ownerMap = await this.buildUserInfoMap([source.userId]);
				const owner = ownerMap.get(source.userId) ?? {
					username: String(source.userId),
					avatar: '',
				};
				detail.publicSource = {
					sourceBookId: source.id,
					ownerUserId: source.userId,
					ownerUsername: owner.username,
					ownerAvatar: owner.avatar,
					isStillPublic: source.isPublic,
				};
			}
		}
		return detail;
	}

	async setBookVisibility(
		userId: number,
		bookId: string,
		isPublic: boolean,
	): Promise<EbookBookDto> {
		const book = await this.bookRepo.findOne({
			where: { id: bookId, userId },
		});
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}
		if (book.sourceBookId) {
			throw new ForbiddenException('读书记录不能设置公开状态');
		}
		if (book.fmt !== 'epub') {
			throw new BadRequestException('仅支持公开 EPUB 书籍');
		}
		if (isPublic && (!book.filePath || book.srcKind !== 'store')) {
			throw new BadRequestException('请先上传至云端后再公开');
		}
		book.isPublic = isPublic;
		if (isPublic && !book.publicAt) {
			book.publicAt = new Date();
		}
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}

	async openPublicBook(
		userId: number,
		sourceBookId: string,
	): Promise<{ readingBookId: string }> {
		const source = await this.bookRepo.findOne({
			where: { id: sourceBookId, sourceBookId: IsNull(), isPublic: true },
		});
		if (!source) {
			throw new NotFoundException('书籍不存在或已下架');
		}
		if (source.userId === userId) {
			throw new BadRequestException('不能通过公开入口打开自己的书');
		}
		if (source.fmt !== 'epub' || !source.filePath) {
			throw new BadRequestException('仅支持公开 EPUB 书籍');
		}

		const existing = await this.bookRepo.findOne({
			where: { userId, sourceBookId },
		});
		if (existing) {
			return { readingBookId: existing.id };
		}

		const reading = this.bookRepo.create({
			userId,
			sourceBookId,
			fmt: source.fmt,
			title: source.title,
			author: source.author,
			srcKind: 'store',
			filePath: source.filePath,
			size: source.size,
			coverPath: source.coverPath,
			isPublic: false,
		});
		await this.bookRepo.save(reading);
		return { readingBookId: reading.id };
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
			if (fmt === 'epub')
				void this.markEpubParsePending(book.id, { resetAttempts: true });
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
		if (fmt === 'epub')
			void this.markEpubParsePending(book.id, { resetAttempts: true });
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
		if (book.srcKind === 'store' && book.filePath && !book.sourceBookId) {
			await this.tryDeleteStoredEbookFile(book.filePath);
		}
		await this.tryDeleteCoverFile(book.coverPath);
		await this.thoughtRepo.delete({ bookId, userId });
		await this.highlightRepo.delete({ bookId, userId });
		await this.progRepo.delete({ bookId, userId });
		if (!book.sourceBookId) {
			await this.chapterRepo.delete({ bookId });
		}
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
		if (dto.chapterIndex != null) prog.chapterIndex = dto.chapterIndex;
		if (dto.chapterHref != null) prog.chapterHref = dto.chapterHref;
		if (dto.scrollPercent != null) prog.scrollPercent = dto.scrollPercent;
		await this.progRepo.save(prog);
		return this.toProgDto(prog);
	}

	async getFileForDownload(
		userId: number,
		bookId: string,
	): Promise<EbookFilePayload> {
		const book = await this.bookRepo.findOne({ where: { id: bookId, userId } });
		if (!book) {
			throw new NotFoundException('文件不存在');
		}

		let filePath = book.filePath;
		let fmt = book.fmt;
		if (book.sourceBookId) {
			const source = await this.bookRepo.findOne({
				where: { id: book.sourceBookId },
			});
			if (!source?.isPublic) {
				throw new ForbiddenException('该书已取消公开');
			}
			if (!filePath) {
				filePath = source.filePath ?? null;
				fmt = source.fmt ?? fmt;
			}
		}

		if (!filePath || book.srcKind !== 'store') {
			throw new NotFoundException('文件不存在');
		}

		if (!isCosEbookKey(filePath)) {
			throw new NotFoundException('云端文件不存在');
		}

		return { kind: 'cos', key: filePath, fmt };
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
			.andWhere('b.source_book_id IS NULL')
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
		const totalBookCount = await this.bookRepo.count({
			where: { userId, sourceBookId: IsNull() },
		});
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

	private toThoughtDto(
		row: EbookThought,
		user: EbookThoughtUserInfo,
	): EbookThoughtDto {
		return {
			id: row.id,
			userId: row.userId,
			cfiRange: row.cfiRange,
			quote: row.quote,
			content: row.content,
			username: user.username,
			avatar: user.avatar,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			isPublic: row.isPublic,
		};
	}

	private buildThoughtRevision(rows: EbookThought[]): EbookThoughtRevisionDto {
		if (rows.length === 0) {
			return { count: 0, latestUpdatedAt: null };
		}
		let latestMs = rows[0]!.updatedAt.getTime();
		for (let i = 1; i < rows.length; i++) {
			latestMs = Math.max(latestMs, rows[i]!.updatedAt.getTime());
		}
		return {
			count: rows.length,
			latestUpdatedAt: new Date(latestMs).toISOString(),
		};
	}

	/** 想法所属范围（不含可见性 / 软删过滤） */
	private async appendThoughtBookScope(
		qb: SelectQueryBuilder<EbookThought>,
		userId: number,
		book: EbookBook,
	): Promise<void> {
		if (book.sourceBookId) {
			const source = await this.bookRepo.findOne({
				where: { id: book.sourceBookId },
			});
			if (!source) {
				throw new NotFoundException('源书不存在');
			}
			if (!source.isPublic) {
				const hasRecord = await this.bookRepo.findOne({
					where: { userId, sourceBookId: book.sourceBookId },
				});
				if (!hasRecord) {
					throw new NotFoundException('书籍不存在');
				}
				qb.andWhere(
					new Brackets((where) => {
						where
							.where(
								't.book_id = :sourceBookId AND t.user_id = :sourceUserId',
								{
									sourceBookId: source.id,
									sourceUserId: source.userId,
								},
							)
							.orWhere(
								't.book_id = :readingBookId AND t.user_id = :viewerUserId',
								{
									readingBookId: book.id,
									viewerUserId: userId,
								},
							);
					}),
				);
				return;
			}

			// 公开源书读书记录：源书全部想法 + 各读者读书记录上的想法（可见性由 is_public 过滤）
			const readingIds = (
				await this.bookRepo.find({
					where: { sourceBookId: source.id },
					select: ['id'],
				})
			).map((r) => r.id);
			qb.andWhere(
				new Brackets((where) => {
					where.where('t.book_id = :sourceBookId', {
						sourceBookId: source.id,
					});
					if (readingIds.length > 0) {
						where.orWhere('t.book_id IN (:...readingIds)', { readingIds });
					}
				}),
			);
			return;
		}

		if (book.isPublic) {
			const readingIds = (
				await this.bookRepo.find({
					where: { sourceBookId: book.id },
					select: ['id'],
				})
			).map((r) => r.id);
			qb.andWhere(
				new Brackets((where) => {
					where.where('t.book_id = :bookId AND t.user_id = :viewerUserId', {
						bookId: book.id,
						viewerUserId: userId,
					});
					if (readingIds.length > 0) {
						where.orWhere('t.book_id IN (:...readingIds)', { readingIds });
					}
				}),
			);
			return;
		}

		qb.andWhere('t.book_id = :bookId AND t.user_id = :viewerUserId', {
			bookId: book.id,
			viewerUserId: userId,
		});
	}

	private appendThoughtSpineHintsFilter(
		qb: SelectQueryBuilder<EbookThought>,
		spineHints?: string[],
	): void {
		if (!spineHints?.length) return;
		const normalized = [
			...new Set(
				spineHints
					.map((hint) => hint.trim())
					.filter(Boolean)
					.map((hint) => (hint.startsWith('/') ? hint : `/${hint}`)),
			),
		];
		if (normalized.length === 0) return;

		qb.andWhere(
			new Brackets((sub) => {
				for (let index = 0; index < normalized.length; index++) {
					const param = `thoughtSpineHint${index}`;
					sub.orWhere(`t.cfi_range LIKE :${param}`, {
						[param]: `%epubcfi(${normalized[index]}!%`,
					});
				}
			}),
		);
	}

	/** 与 collectThoughtRowsForBook 等价的可见性 + 范围条件（SQL 层，供 sync 增量/aggregate） */
	private async createVisibleThoughtsQueryBuilder(
		userId: number,
		book: EbookBook,
	): Promise<SelectQueryBuilder<EbookThought>> {
		const qb = this.thoughtRepo.createQueryBuilder('t');
		await this.appendThoughtBookScope(qb, userId, book);

		if (book.sourceBookId || book.isPublic) {
			qb.andWhere(
				'(t.user_id = :viewerUserId OR t.is_public = :isPublicTrue)',
				{
					viewerUserId: userId,
					isPublicTrue: true,
				},
			);
		}

		qb.andWhere('t.deleted_at IS NULL');
		return qb;
	}

	private async queryRemovedThoughtIdsSince(
		userId: number,
		book: EbookBook,
		since: Date,
	): Promise<string[]> {
		const ids = new Set<string>();

		const softDeletedQb = this.thoughtRepo.createQueryBuilder('t');
		await this.appendThoughtBookScope(softDeletedQb, userId, book);
		softDeletedQb
			.andWhere('t.deleted_at IS NOT NULL AND t.deleted_at > :since', { since })
			.andWhere('(t.user_id = :viewerUserId OR t.is_public = :isPublicTrue)', {
				viewerUserId: userId,
				isPublicTrue: true,
			});
		const softDeleted = await softDeletedQb
			.select('t.id', 'id')
			.getRawMany<{ id: string }>();
		for (const row of softDeleted) ids.add(row.id);

		if (book.sourceBookId || book.isPublic) {
			const revokedQb = this.thoughtRepo.createQueryBuilder('t');
			await this.appendThoughtBookScope(revokedQb, userId, book);
			revokedQb
				.andWhere('t.deleted_at IS NULL')
				.andWhere('t.updated_at > :since', { since })
				.andWhere('t.user_id != :viewerUserId', { viewerUserId: userId })
				.andWhere('t.is_public = :isPublicFalse', { isPublicFalse: false });
			const revoked = await revokedQb
				.select('t.id', 'id')
				.getRawMany<{ id: string }>();
			for (const row of revoked) ids.add(row.id);
		}

		return [...ids];
	}

	private async queryVisibleThoughtRows(
		userId: number,
		book: EbookBook,
		since?: Date,
		spineHints?: string[],
	): Promise<EbookThought[]> {
		const qb = await this.createVisibleThoughtsQueryBuilder(userId, book);
		if (since) {
			qb.andWhere('t.updated_at > :since', { since });
		}
		this.appendThoughtSpineHintsFilter(qb, spineHints);
		return qb.orderBy('t.created_at', 'DESC').getMany();
	}

	private async queryVisibleThoughtRevision(
		userId: number,
		book: EbookBook,
	): Promise<EbookThoughtRevisionDto> {
		const qb = await this.createVisibleThoughtsQueryBuilder(userId, book);
		const raw = await qb
			.select('COUNT(*)', 'cnt')
			.addSelect('MAX(t.updated_at)', 'latest')
			.getRawOne<{ cnt: string; latest: Date | null }>();
		const count = Number(raw?.cnt ?? 0);
		if (count === 0) {
			return { count: 0, latestUpdatedAt: null };
		}
		const latest = raw?.latest;
		return {
			count,
			latestUpdatedAt: latest ? new Date(latest).toISOString() : null,
		};
	}

	private async collectThoughtRowsForBook(
		userId: number,
		book: EbookBook,
		spineHints?: string[],
	): Promise<EbookThought[]> {
		return this.queryVisibleThoughtRows(userId, book, undefined, spineHints);
	}

	private async mapThoughtRowsToDtos(
		rows: EbookThought[],
	): Promise<EbookThoughtDto[]> {
		const userInfoMap = await this.buildUserInfoMap(
			rows.map((row) => row.userId),
		);
		return Promise.all(
			rows.map((row) => this.toThoughtDtoWithUsername(row, userInfoMap)),
		);
	}

	private async buildUserInfoMap(
		userIds: number[],
	): Promise<Map<number, EbookThoughtUserInfo>> {
		const unique = [...new Set(userIds.filter((id) => id > 0))];
		const map = new Map<number, EbookThoughtUserInfo>();
		if (unique.length === 0) return map;

		const users = await this.userRepo.find({
			where: { id: In(unique) },
			relations: ['profile'],
		});
		for (const user of users) {
			map.set(user.id, {
				username: user.username,
				avatar: user.profile?.avatar ?? '',
			});
		}
		for (const id of unique) {
			if (!map.has(id)) {
				map.set(id, { username: String(id), avatar: '' });
			}
		}
		return map;
	}

	private async toThoughtDtoWithUsername(
		row: EbookThought,
		userInfoMap?: Map<number, EbookThoughtUserInfo>,
	): Promise<EbookThoughtDto> {
		const map = userInfoMap ?? (await this.buildUserInfoMap([row.userId]));
		const info = map.get(row.userId) ?? {
			username: String(row.userId),
			avatar: '',
		};
		return this.toThoughtDto(row, info);
	}

	private async assertBookOwned(
		userId: number,
		bookId: string,
	): Promise<EbookBook> {
		const book = await this.bookRepo.findOne({ where: { id: bookId, userId } });
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}
		return book;
	}

	async listThoughts(
		userId: number,
		bookId: string,
		spineHints?: string[],
	): Promise<EbookThoughtDto[]> {
		const book = await this.assertBookOwned(userId, bookId);
		const rows = await this.collectThoughtRowsForBook(userId, book, spineHints);
		return this.mapThoughtRowsToDtos(rows);
	}

	async getThoughtsRevision(
		userId: number,
		bookId: string,
	): Promise<EbookThoughtRevisionDto> {
		const book = await this.assertBookOwned(userId, bookId);
		if (!book.isPublic && !book.sourceBookId) {
			return { count: 0, latestUpdatedAt: null };
		}
		return this.queryVisibleThoughtRevision(userId, book);
	}

	async listThoughtChanges(
		userId: number,
		bookId: string,
		since: Date,
	): Promise<EbookThoughtDto[]> {
		const { changes } = await this.syncThoughts(userId, bookId, since);
		return changes;
	}

	async syncThoughts(
		userId: number,
		bookId: string,
		since?: Date,
	): Promise<EbookThoughtSyncDto> {
		const book = await this.assertBookOwned(userId, bookId);
		if (!book.isPublic && !book.sourceBookId) {
			return {
				revision: { count: 0, latestUpdatedAt: null },
				changes: [],
				deletedIds: [],
			};
		}

		if (since) {
			const revision = await this.queryVisibleThoughtRevision(userId, book);
			const deletedIds = await this.queryRemovedThoughtIdsSince(
				userId,
				book,
				since,
			);
			const changedRows = await this.queryVisibleThoughtRows(
				userId,
				book,
				since,
			);
			if (changedRows.length === 0 && deletedIds.length === 0) {
				return { revision, changes: [], deletedIds: [] };
			}
			return {
				revision,
				changes:
					changedRows.length > 0
						? await this.mapThoughtRowsToDtos(changedRows)
						: [],
				deletedIds,
			};
		}

		const rows = await this.queryVisibleThoughtRows(userId, book);
		return {
			revision: this.buildThoughtRevision(rows),
			changes: await this.mapThoughtRowsToDtos(rows),
			deletedIds: [],
		};
	}

	async createThought(
		userId: number,
		dto: CreateEbookThoughtDto,
	): Promise<EbookThoughtDto> {
		await this.assertBookOwned(userId, dto.bookId);
		const row = this.thoughtRepo.create({
			userId,
			bookId: dto.bookId,
			cfiRange: dto.cfiRange.trim(),
			quote: dto.quote.trim(),
			content: dto.content.trim(),
			isPublic: dto.isPublic !== false,
		});
		await this.thoughtRepo.save(row);
		return this.toThoughtDtoWithUsername(row);
	}

	async updateThought(
		userId: number,
		thoughtId: string,
		dto: UpdateEbookThoughtDto,
	): Promise<EbookThoughtDto> {
		const row = await this.thoughtRepo.findOne({
			where: { id: thoughtId, userId, deletedAt: IsNull() },
		});
		if (!row) {
			throw new NotFoundException('想法不存在');
		}
		row.content = dto.content.trim();
		if (dto.isPublic !== undefined) {
			row.isPublic = dto.isPublic;
		}
		await this.thoughtRepo.save(row);
		return this.toThoughtDtoWithUsername(row);
	}

	async removeThought(userId: number, thoughtId: string): Promise<void> {
		const row = await this.thoughtRepo.findOne({
			where: { id: thoughtId, userId, deletedAt: IsNull() },
		});
		if (!row) {
			throw new NotFoundException('想法不存在');
		}
		row.deletedAt = new Date();
		await this.thoughtRepo.save(row);
	}

	private toHighlightDto(row: EbookHighlight): EbookHighlightDto {
		return {
			id: row.id,
			userId: row.userId,
			cfiRange: row.cfiRange,
			quote: row.quote,
			style: row.style as EbookHighlightDto['style'],
			color: row.color as EbookHighlightDto['color'],
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	async listHighlights(
		userId: number,
		bookId: string,
	): Promise<EbookHighlightDto[]> {
		await this.assertBookOwned(userId, bookId);
		const rows = await this.highlightRepo.find({
			where: { userId, bookId },
			order: { createdAt: 'DESC' },
		});
		return rows.map((row) => this.toHighlightDto(row));
	}

	async createHighlight(
		userId: number,
		dto: CreateEbookHighlightDto,
	): Promise<EbookHighlightDto> {
		await this.assertBookOwned(userId, dto.bookId);
		const cfiRange = dto.cfiRange.trim();
		const existing = await this.highlightRepo.findOne({
			where: { userId, bookId: dto.bookId, cfiRange },
		});
		if (existing) {
			existing.quote = dto.quote.trim();
			existing.style = dto.style;
			existing.color = dto.color;
			await this.highlightRepo.save(existing);
			return this.toHighlightDto(existing);
		}
		const row = this.highlightRepo.create({
			userId,
			bookId: dto.bookId,
			cfiRange,
			quote: dto.quote.trim(),
			style: dto.style,
			color: dto.color,
		});
		await this.highlightRepo.save(row);
		return this.toHighlightDto(row);
	}

	async updateHighlight(
		userId: number,
		highlightId: string,
		dto: UpdateEbookHighlightDto,
	): Promise<EbookHighlightDto> {
		const row = await this.highlightRepo.findOne({
			where: { id: highlightId, userId },
		});
		if (!row) {
			throw new NotFoundException('划线不存在');
		}
		if (dto.quote !== undefined) row.quote = dto.quote.trim();
		if (dto.style !== undefined) row.style = dto.style;
		if (dto.color !== undefined) row.color = dto.color;
		await this.highlightRepo.save(row);
		return this.toHighlightDto(row);
	}

	async removeHighlight(userId: number, highlightId: string): Promise<void> {
		const row = await this.highlightRepo.findOne({
			where: { id: highlightId, userId },
		});
		if (!row) {
			throw new NotFoundException('划线不存在');
		}
		await this.highlightRepo.delete({ id: highlightId, userId });
	}

	async getChapters(userId: number, bookId: string): Promise<EbookChaptersDto> {
		const { book, contentBook } = await this.resolveContentBook(userId, bookId);
		this.assertEpubSourceAvailable(contentBook);
		await this.ensureEpubParseScheduled(contentBook);
		await this.waitForParse(contentBook.id);
		const freshContent = await this.bookRepo.findOne({
			where: { id: contentBook.id },
		});
		if (!freshContent) {
			throw new NotFoundException('书籍不存在');
		}
		await this.assertEpubChaptersReady(freshContent);

		const rows = await this.chapterRepo.find({
			where: { bookId: freshContent.id },
			order: { chapterIndex: 'ASC' },
		});
		const totalWordCount =
			freshContent.totalWordCount ??
			rows.reduce((sum, row) => sum + row.wordCount, 0);

		const chapters = rows.map((row) => ({
			index: row.chapterIndex,
			href: row.href,
			title: row.title,
			level: row.level,
			wordCount: row.wordCount || undefined,
		}));

		const toc = await this.resolveEbookToc(freshContent, chapters);

		return {
			bookId: book.id,
			title: book.title,
			total: rows.length,
			totalWordCount: totalWordCount || undefined,
			chapters,
			toc: toc?.length ? toc : undefined,
		};
	}

	async getChapter(
		userId: number,
		bookId: string,
		index: number,
	): Promise<EbookChapterContentDto> {
		const { book, contentBook } = await this.resolveContentBook(userId, bookId);
		this.assertEpubSourceAvailable(contentBook);
		await this.ensureEpubParseScheduled(contentBook);
		await this.waitForParse(contentBook.id);
		const freshContent = await this.bookRepo.findOne({
			where: { id: contentBook.id },
		});
		if (!freshContent) {
			throw new NotFoundException('书籍不存在');
		}
		await this.assertEpubChaptersReady(freshContent);

		const row = await this.chapterRepo.findOne({
			where: { bookId: freshContent.id, chapterIndex: index },
		});
		if (!row) {
			throw new NotFoundException('章节不存在');
		}

		const total = await this.chapterRepo.count({
			where: { bookId: freshContent.id },
		});
		const totalWordCount = freshContent.totalWordCount ?? undefined;

		return {
			bookId: book.id,
			index: row.chapterIndex,
			title: row.title,
			html: row.html,
			wordCount: row.wordCount || undefined,
			totalWordCount,
			prevIndex: index > 0 ? index - 1 : null,
			nextIndex: index < total - 1 ? index + 1 : null,
			total,
		};
	}

	private async resolveContentBook(
		userId: number,
		bookId: string,
	): Promise<{ book: EbookBook; contentBook: EbookBook }> {
		const book = await this.assertBookOwned(userId, bookId);
		if (!book.sourceBookId) {
			return { book, contentBook: book };
		}
		const source = await this.bookRepo.findOne({
			where: { id: book.sourceBookId },
		});
		if (!source) {
			throw new NotFoundException('源书不存在');
		}
		return { book, contentBook: source };
	}

	private canParseEpubSource(book: EbookBook): boolean {
		if (book.fmt !== 'epub') return false;
		if (book.filePath && isCosEbookKey(book.filePath)) return true;
		const local = book.localPath?.trim();
		return !!(local && existsSync(local));
	}

	private assertEpubSourceAvailable(book: EbookBook): void {
		if (book.fmt !== 'epub') {
			throw new BadRequestException('仅支持 EPUB 章节');
		}
		if (this.canParseEpubSource(book)) return;
		throw new BadRequestException(
			book.srcKind === 'path'
				? '该书尚未上传云端，请在桌面端上传至云端后再阅读'
				: '云端文件不存在，请重新上传',
		);
	}

	private async resolveEpubBuffer(book: EbookBook): Promise<Buffer> {
		if (book.filePath && isCosEbookKey(book.filePath)) {
			const key = await this.uploadService.resolveCosObjectKey(book.filePath);
			return this.uploadService.getObjectBuffer(key);
		}
		const local = book.localPath?.trim();
		if (local && existsSync(local)) {
			return readFileAsync(local);
		}
		throw new BadRequestException('EPUB 文件不可用');
	}

	private async ensureEpubParseScheduled(
		contentBook: EbookBook,
	): Promise<void> {
		if (!this.canParseEpubSource(contentBook)) return;

		const chapterCount = await this.chapterRepo.count({
			where: { bookId: contentBook.id },
		});
		if (contentBook.parseStatus === 'ready' && chapterCount > 0) return;

		if (contentBook.parseStatus === 'failed') return;
		if (this.isParseAttemptExhausted(contentBook)) {
			await this.markEpubParseFailed(contentBook.id);
			return;
		}

		if (contentBook.parseStatus === 'pending' && chapterCount === 0) {
			await this.startParseTask(contentBook.id);
			return;
		}

		if (await this.isParseJobActive(contentBook.id)) return;
		await this.markEpubParsePending(contentBook.id);
	}

	private epubParseJobId(bookId: string): string {
		return `epub-parse-${bookId}`;
	}

	private async isParseJobActive(bookId: string): Promise<boolean> {
		const job = await this.epubParseQueue.getJob(this.epubParseJobId(bookId));
		if (!job) return false;
		const state = await job.getState();
		return state === 'active' || state === 'waiting' || state === 'delayed';
	}

	/** BullMQ worker 入口：waitThenParse → runEpubParse */
	async processEpubParseJob(bookId: string): Promise<void> {
		await this.waitThenParse(bookId);
	}

	private isParseAttemptExhausted(book: EbookBook): boolean {
		return (book.parseAttempt ?? 0) >= EbookService.MAX_PARSE_ATTEMPTS;
	}

	private async startParseTask(bookId: string): Promise<void> {
		const jobId = this.epubParseJobId(bookId);
		const existing = await this.epubParseQueue.getJob(jobId);
		if (existing) {
			const state = await existing.getState();
			if (state === 'active' || state === 'waiting' || state === 'delayed') {
				return;
			}
			// ponytail: failed/completed 占着 jobId 时 add 会静默失败，先移除再入队
			if (state === 'failed' || state === 'completed') {
				await existing.remove();
			}
		}

		try {
			await this.epubParseQueue.add(
				'parse',
				{ bookId },
				{
					jobId,
					attempts: 1,
					removeOnComplete: true,
					removeOnFail: { count: 50 },
				},
			);
		} catch (err) {
			this.logger.warn(`EPUB 解析入队失败 book=${bookId}`, err);
		}
	}

	private async waitForParse(bookId: string): Promise<void> {
		const book = await this.bookRepo.findOne({
			where: { id: bookId },
			select: ['id', 'parseStatus'],
		});
		if (book?.parseStatus === 'ready') return;

		const jobId = this.epubParseJobId(bookId);
		let job = await this.epubParseQueue.getJob(jobId);
		// ponytail: 仅 pending 且 job 尚未可见时轮询；ready 后 job 已 removeOnComplete，不可空转 1s
		if (!job && book?.parseStatus === 'pending') {
			for (let i = 0; i < 10; i++) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				job = await this.epubParseQueue.getJob(jobId);
				if (job) break;
			}
		}
		if (!job) return;

		const state = await job.getState();
		if (state === 'completed' || state === 'failed') return;

		try {
			const timeout = new Promise<void>((_, reject) =>
				setTimeout(
					() => reject(new Error('EPUB parse wait timeout')),
					EbookService.PARSE_WAIT_MS,
				),
			);
			await Promise.race([
				job.waitUntilFinished(this.epubParseQueueEvents.events),
				timeout,
			]);
		} catch {
			// 超时或失败由 assertEpubChaptersReady 返回 409
		}
	}

	private async assertEpubChaptersReady(contentBook: EbookBook): Promise<void> {
		if (contentBook.parseStatus === 'failed') {
			throw new ConflictException('章节解析失败，请重新上传');
		}
		if (contentBook.parseStatus !== 'ready') {
			throw new ConflictException('章节正在解析中');
		}
		const count = await this.chapterRepo.count({
			where: { bookId: contentBook.id },
		});
		if (count === 0) {
			throw new ConflictException('章节正在解析中');
		}
	}

	async markEpubParsePending(
		bookId: string,
		opts?: { resetAttempts?: boolean },
	): Promise<void> {
		if (await this.isParseJobActive(bookId)) return;

		const book = await this.bookRepo.findOne({ where: { id: bookId } });
		if (!book) return;

		const nextAttempt = opts?.resetAttempts ? 1 : (book.parseAttempt ?? 0) + 1;
		if (nextAttempt > EbookService.MAX_PARSE_ATTEMPTS) {
			await this.markEpubParseFailed(bookId);
			return;
		}

		await this.bookRepo.update(
			{ id: bookId },
			{ parseStatus: 'pending', parseAttempt: nextAttempt },
		);
		await this.chapterRepo.delete({ bookId });
		await this.startParseTask(bookId);
	}

	private async waitThenParse(bookId: string): Promise<void> {
		const book = await this.bookRepo.findOne({ where: { id: bookId } });
		if (!book || !this.canParseEpubSource(book)) {
			await this.markEpubParseFailed(bookId);
			return;
		}

		const local = book.localPath?.trim();
		if (
			(!book.filePath || !isCosEbookKey(book.filePath)) &&
			local &&
			existsSync(local)
		) {
			await this.runEpubParse(bookId);
			return;
		}

		for (let attempt = 0; attempt < 10; attempt++) {
			const latest = await this.bookRepo.findOne({ where: { id: bookId } });
			if (!latest?.filePath) {
				await this.markEpubParseFailed(bookId);
				return;
			}
			try {
				const key = await this.uploadService.resolveCosObjectKey(
					latest.filePath,
				);
				if (await this.uploadService.objectExists(key)) {
					if (key !== latest.filePath) {
						latest.filePath = key;
						await this.bookRepo.save(latest);
					}
					await this.runEpubParse(bookId);
					return;
				}
			} catch (err) {
				this.logger.warn(
					`等待 COS 文件 book=${bookId} attempt=${attempt}`,
					err,
				);
			}
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
		await this.markEpubParseFailed(bookId);
	}

	private async markEpubParseFailed(bookId: string): Promise<void> {
		await this.bookRepo.update({ id: bookId }, { parseStatus: 'failed' });
	}

	private async runEpubParse(bookId: string): Promise<void> {
		const book = await this.bookRepo.findOne({ where: { id: bookId } });
		if (!book || book.fmt !== 'epub' || !this.canParseEpubSource(book)) {
			await this.markEpubParseFailed(bookId);
			return;
		}

		try {
			const buffer = await this.resolveEpubBuffer(book);
			const parsed = await this.epubChapterParser.parseEpubBuffer(
				buffer,
				bookId,
			);
			const chapters = parsed.chapters;

			if (chapters.length === 0) {
				throw new Error('未能解析出章节正文');
			}

			await this.chapterRepo.delete({ bookId });
			await this.chapterRepo.save(
				chapters.map((chapter) =>
					this.chapterRepo.create({
						bookId,
						chapterIndex: chapter.index,
						href: chapter.href,
						title: chapter.title,
						level: chapter.level,
						html: chapter.html,
						wordCount: chapter.wordCount,
					}),
				),
			);

			const totalWordCount = chapters.reduce(
				(sum, chapter) => sum + chapter.wordCount,
				0,
			);
			book.parseStatus = 'ready';
			book.totalWordCount = totalWordCount;
			book.parseAttempt = 0;
			book.tocJson = JSON.stringify(parsed.toc);
			if (book.filePath && isCosEbookKey(book.filePath)) {
				const key = await this.uploadService.resolveCosObjectKey(book.filePath);
				if (key !== book.filePath) book.filePath = key;
			}
			await this.bookRepo.save(book);
			this.logger.log(
				`EPUB 解析完成 book=${bookId} chapters=${chapters.length} toc=${parsed.toc.length}`,
			);
		} catch (err) {
			this.logger.error(`EPUB 解析失败 book=${bookId}`, err);
			await this.markEpubParseFailed(bookId);
		}
	}

	/** 读缓存 toc_json；旧书缺失时从 EPUB 补解析并写回 */
	private async resolveEbookToc(
		contentBook: EbookBook,
		spineChapters: EbookChapterMetaDto[],
	): Promise<EbookChapterMetaDto[] | null> {
		const cached = this.parseStoredTocJson(contentBook.tocJson);
		if (cached?.length) return cached;

		try {
			const buffer = await this.resolveEpubBuffer(contentBook);
			const toc = await this.epubChapterParser.parseTocFromEpubBuffer(buffer);
			if (!toc.length) return null;
			const dto: EbookChapterMetaDto[] = toc.map((item) => ({
				index: item.index,
				href: item.href,
				title: item.title,
				level: item.level,
			}));
			contentBook.tocJson = JSON.stringify(dto);
			await this.bookRepo.save(contentBook);
			return dto;
		} catch (err) {
			this.logger.warn(
				`补解析 TOC 失败 book=${contentBook.id}，回退 spine 目录`,
				err,
			);
			return spineChapters;
		}
	}

	private parseStoredTocJson(
		raw: string | null | undefined,
	): EbookChapterMetaDto[] | null {
		if (!raw?.trim()) return null;
		try {
			const parsed = JSON.parse(raw) as unknown;
			if (!Array.isArray(parsed) || !parsed.length) return null;
			const out: EbookChapterMetaDto[] = [];
			for (const row of parsed) {
				if (!row || typeof row !== 'object') continue;
				const item = row as Record<string, unknown>;
				const index = Number(item.index);
				const title = typeof item.title === 'string' ? item.title : '';
				const href = typeof item.href === 'string' ? item.href : '';
				const level = Number(item.level);
				if (!Number.isFinite(index) || index < 0 || !title) continue;
				out.push({
					index,
					href,
					title,
					level: Number.isFinite(level) ? Math.max(0, level) : 0,
				});
			}
			return out.length ? out : null;
		} catch {
			return null;
		}
	}
}
