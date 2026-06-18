import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { decodeChineseFilename } from '../../utils';
import { normalizeUploadPublicPath } from '../../utils/upload-paths';
import { isCosObjectKey } from '../upload/cos.config';
import { UploadService } from '../upload/upload.service';
import { UserService } from '../user/user.service';
import { AddEbookPathDto } from './dto/add-ebook-path.dto';
import { QueryEbookShelfDto } from './dto/query-ebook-shelf.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { UpdateEbookTitleDto } from './dto/update-ebook-title.dto';
import { EbookBook } from './ebook-book.entity';
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
	| { kind: 'buffer'; buffer: Buffer; fmt: 'epub' | 'pdf' };

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

@Injectable()
export class EbookService {
	constructor(
		@InjectRepository(EbookBook)
		private readonly bookRepo: Repository<EbookBook>,
		@InjectRepository(EbookProgress)
		private readonly progRepo: Repository<EbookProgress>,
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
		const pageNo = query.pageNo ?? 1;
		const pageSize = query.pageSize ?? 20;
		const take = pageSize;
		const skip = (pageNo - 1) * take;

		const [books, total] = await this.bookRepo.findAndCount({
			where: { userId },
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
		const book = this.bookRepo.create({
			userId,
			fmt,
			title,
			srcKind: 'path',
			localPath: path,
		});
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}

	async addFromUpload(
		userId: number,
		file: Express.Multer.File,
		opts?: { bookId?: string },
	): Promise<EbookBookDto> {
		if (!file?.buffer?.length) {
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

		const stored = await this.storeEbookToCos(file);

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

		const title = titleFromPath(originalname).slice(0, 512);
		const book = this.bookRepo.create({
			userId,
			fmt,
			title,
			srcKind: 'store',
			filePath: stored.filePath,
			size: String(stored.size),
		});
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}

	/** 会员：上传至 COS ebooks/ 前缀 */
	private async storeEbookToCos(file: Express.Multer.File) {
		const cosResult = await this.uploadService.uploadObjectToCos(
			file,
			'ebooks',
		);
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

		const buffer = await this.uploadService.getObjectBuffer(book.filePath);
		return { kind: 'buffer', buffer, fmt: book.fmt };
	}

	getEbookMime(fmt: 'epub' | 'pdf'): string {
		return fmt === 'pdf' ? 'application/pdf' : 'application/epub+zip';
	}
}
