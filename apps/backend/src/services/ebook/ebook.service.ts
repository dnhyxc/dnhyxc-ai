import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { decodeChineseFilename } from '../../utils';
import { getUploadsRoot } from '../../utils/upload-paths';
import { AddEbookPathDto } from './dto/add-ebook-path.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { EbookBook } from './ebook-book.entity';
import { EbookProgress } from './ebook-progress.entity';

export type EbookBookDto = {
	id: string;
	fmt: 'epub' | 'pdf';
	title: string;
	author?: string;
	src: { kind: 'path'; path: string } | { kind: 'store' };
	size?: number;
	addedAt: string;
};

export type EbookProgDto = {
	bookId: string;
	epubCfi?: string;
	pdfPage?: number;
	percent?: number;
	updatedAt: string;
};

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

@Injectable()
export class EbookService {
	constructor(
		@InjectRepository(EbookBook)
		private readonly bookRepo: Repository<EbookBook>,
		@InjectRepository(EbookProgress)
		private readonly progRepo: Repository<EbookProgress>,
	) {}

	private toBookDto(book: EbookBook): EbookBookDto {
		const src: EbookBookDto['src'] =
			book.srcKind === 'path' && book.localPath
				? { kind: 'path', path: book.localPath }
				: { kind: 'store' };

		const dto: EbookBookDto = {
			id: book.id,
			fmt: book.fmt,
			title: book.title,
			src,
			addedAt: book.createdAt.toISOString(),
		};
		if (book.author) dto.author = book.author;
		if (book.size != null) dto.size = Number(book.size);
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

	async getShelf(userId: number) {
		const books = await this.bookRepo.find({
			where: { userId },
			order: { createdAt: 'DESC' },
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
		};
	}

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
			where: { userId, srcKind: 'path', localPath: path },
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
	): Promise<EbookBookDto> {
		if (!file?.path) {
			throw new BadRequestException('请上传 epub / pdf 文件');
		}
		const fmt = fmtFromName(file.originalname);
		if (!fmt) {
			throw new BadRequestException('仅支持 epub / pdf');
		}
		const originalname = decodeChineseFilename(file.originalname);
		const title = titleFromPath(originalname).slice(0, 512);
		const relPath = `ebooks/${file.filename}`;

		const book = this.bookRepo.create({
			userId,
			fmt,
			title,
			srcKind: 'store',
			filePath: relPath,
			size: String(file.size),
		});
		await this.bookRepo.save(book);
		return this.toBookDto(book);
	}

	async remove(userId: number, bookId: string): Promise<void> {
		const book = await this.bookRepo.findOne({ where: { id: bookId, userId } });
		if (!book) {
			throw new NotFoundException('书籍不存在');
		}
		if (book.srcKind === 'store' && book.filePath) {
			const abs = join(getUploadsRoot(__dirname), book.filePath);
			if (existsSync(abs)) {
				try {
					unlinkSync(abs);
				} catch {
					// 磁盘删除失败不阻塞
				}
			}
		}
		await this.progRepo.delete({ bookId, userId });
		await this.bookRepo.delete({ id: bookId, userId });
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
	): Promise<{ abs: string; fmt: 'epub' | 'pdf' }> {
		const book = await this.bookRepo.findOne({ where: { id: bookId, userId } });
		if (!book || book.srcKind !== 'store' || !book.filePath) {
			throw new NotFoundException('文件不存在');
		}
		const abs = join(getUploadsRoot(__dirname), book.filePath);
		if (!existsSync(abs)) {
			throw new NotFoundException('文件不存在');
		}
		return { abs, fmt: book.fmt };
	}

	getEbookMime(fmt: 'epub' | 'pdf'): string {
		return fmt === 'pdf' ? 'application/pdf' : 'application/epub+zip';
	}
}
