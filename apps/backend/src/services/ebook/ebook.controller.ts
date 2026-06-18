import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	Req,
	Res,
	UnauthorizedException,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { diskStorage } from 'multer';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { decodeChineseFilename } from '../../utils';
import {
	ensureUploadDir,
	getEbookFilesDir,
	getUploadImagesDir,
} from '../../utils/upload-paths';
import { AddEbookPathDto } from './dto/add-ebook-path.dto';
import { AssignEbookCategoryDto } from './dto/assign-ebook-category.dto';
import { CreateEbookCategoryDto } from './dto/create-ebook-category.dto';
import { QueryEbookByLocalPathDto } from './dto/query-ebook-by-local-path.dto';
import { QueryEbookCategoriesSummaryDto } from './dto/query-ebook-categories-summary.dto';
import { QueryEbookShelfDto } from './dto/query-ebook-shelf.dto';
import { ReorderEbookCategoriesDto } from './dto/reorder-ebook-categories.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { UpdateEbookCategoryDto } from './dto/update-ebook-category.dto';
import { UpdateEbookTitleDto } from './dto/update-ebook-title.dto';
import { EbookService } from './ebook.service';

type AuthedRequest = Request & { user?: { userId: number } };

const EBOOK_MAX_BYTES = 120 * 1024 * 1024;
const EBOOK_COVER_MAX_BYTES = 2 * 1024 * 1024;
const EBOOK_COVER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ebookFileUpload = {
	storage: diskStorage({
		destination: (_req, _file, cb) => {
			const dir = getEbookFilesDir(__dirname);
			ensureUploadDir(dir);
			cb(null, dir);
		},
		filename: (_req, file, cb) => {
			const originalname = decodeChineseFilename(file.originalname);
			const ext = extname(originalname).toLowerCase();
			const safeExt = ['.epub', '.pdf'].includes(ext) ? ext : '.bin';
			cb(null, `ebook_${randomUUID()}${safeExt}`);
		},
	}),
	limits: { fileSize: EBOOK_MAX_BYTES },
};

const ebookCoverUpload = {
	storage: diskStorage({
		destination: (_req, _file, cb) => {
			const dir = getUploadImagesDir(__dirname);
			ensureUploadDir(dir);
			cb(null, dir);
		},
		filename: (_req, file, cb) => {
			const originalname = decodeChineseFilename(file.originalname);
			const ext = extname(originalname).toLowerCase();
			const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
				? ext === '.jpeg'
					? '.jpg'
					: ext
				: '.jpg';
			cb(null, `ebook-cover_${randomUUID()}${safeExt}`);
		},
	}),
	limits: { fileSize: EBOOK_COVER_MAX_BYTES },
};

function ebookFileFilter(
	_req: Request,
	file: Express.Multer.File,
	cb: (error: Error | null, accept: boolean) => void,
) {
	const originalname = decodeChineseFilename(file.originalname);
	const lower = originalname.toLowerCase();
	if (lower.endsWith('.epub') || lower.endsWith('.pdf')) {
		cb(null, true);
	} else {
		cb(new BadRequestException('仅支持 epub / pdf'), false);
	}
}

function ebookCoverFileFilter(
	_req: Request,
	file: Express.Multer.File,
	cb: (error: Error | null, accept: boolean) => void,
) {
	if (EBOOK_COVER_MIMES.has(file.mimetype)) {
		cb(null, true);
		return;
	}
	cb(new BadRequestException('封面仅支持 JPG / PNG / WebP'), false);
}

@Controller('ebook')
@UseGuards(JwtGuard)
export class EbookController {
	constructor(private readonly ebookService: EbookService) {}

	private userId(req: AuthedRequest): number {
		const userId = req.user?.userId;
		if (userId == null) {
			throw new UnauthorizedException('未授权');
		}
		return userId;
	}

	@Get('shelf')
	@UseInterceptors(ResponseInterceptor)
	async shelf(@Req() req: AuthedRequest, @Query() query: QueryEbookShelfDto) {
		return this.ebookService.getShelf(this.userId(req), query);
	}

	@Get('categories/summary')
	@UseInterceptors(ResponseInterceptor)
	async categoriesSummary(
		@Req() req: AuthedRequest,
		@Query() query: QueryEbookCategoriesSummaryDto,
	) {
		return this.ebookService.getCategoriesSummary(this.userId(req), query);
	}

	@Post('categories')
	@UseInterceptors(ResponseInterceptor)
	async createCategory(
		@Req() req: AuthedRequest,
		@Body() dto: CreateEbookCategoryDto,
	) {
		return this.ebookService.createCategory(this.userId(req), dto);
	}

	@Put('categories/reorder')
	@UseInterceptors(ResponseInterceptor)
	async reorderCategories(
		@Req() req: AuthedRequest,
		@Body() dto: ReorderEbookCategoriesDto,
	) {
		await this.ebookService.reorderCategories(this.userId(req), dto);
		return { ok: true };
	}

	@Put('categories/:id')
	@UseInterceptors(ResponseInterceptor)
	async updateCategory(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateEbookCategoryDto,
	) {
		return this.ebookService.updateCategory(this.userId(req), id, dto);
	}

	@Delete('categories/:id')
	@UseInterceptors(ResponseInterceptor)
	async removeCategory(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.ebookService.removeCategory(this.userId(req), id);
		return { id };
	}

	@Put('book/:id/category')
	@UseInterceptors(ResponseInterceptor)
	async assignBookCategory(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: AssignEbookCategoryDto,
	) {
		return this.ebookService.assignBookCategory(
			this.userId(req),
			id,
			dto.categoryId ?? null,
		);
	}

	@Get('book/:id')
	@UseInterceptors(ResponseInterceptor)
	async getBook(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		return this.ebookService.getBook(this.userId(req), id);
	}

	@Get('by-local-path')
	@UseInterceptors(ResponseInterceptor)
	async byLocalPath(
		@Req() req: AuthedRequest,
		@Query() query: QueryEbookByLocalPathDto,
	) {
		const book = await this.ebookService.findBookByLocalPath(
			this.userId(req),
			query.path,
		);
		return { book };
	}

	@Post('add-path')
	@UseInterceptors(ResponseInterceptor)
	async addPath(@Req() req: AuthedRequest, @Body() dto: AddEbookPathDto) {
		return this.ebookService.addFromPath(this.userId(req), dto);
	}

	@Post('upload')
	@UseInterceptors(
		FileInterceptor('file', {
			...ebookFileUpload,
			fileFilter: ebookFileFilter,
		}),
		ResponseInterceptor,
	)
	async upload(
		@Req() req: AuthedRequest,
		@UploadedFile() file: Express.Multer.File,
		@Body('bookId') bookId?: string,
		@Body('categoryId') categoryId?: string,
	) {
		const trimmed = typeof bookId === 'string' ? bookId.trim() : undefined;
		const catTrimmed =
			typeof categoryId === 'string' ? categoryId.trim() : undefined;
		return this.ebookService.addFromUpload(this.userId(req), file, {
			bookId: trimmed || undefined,
			categoryId: catTrimmed || undefined,
		});
	}

	@Put('progress')
	@UseInterceptors(ResponseInterceptor)
	async progress(@Req() req: AuthedRequest, @Body() dto: SaveEbookProgressDto) {
		return this.ebookService.saveProgress(this.userId(req), dto);
	}

	@Put('title')
	@UseInterceptors(ResponseInterceptor)
	async title(@Req() req: AuthedRequest, @Body() dto: UpdateEbookTitleDto) {
		return this.ebookService.updateTitle(this.userId(req), dto);
	}

	@Put('cover/:id')
	@UseInterceptors(
		FileInterceptor('file', {
			...ebookCoverUpload,
			fileFilter: ebookCoverFileFilter,
		}),
		ResponseInterceptor,
	)
	async cover(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@UploadedFile() file: Express.Multer.File,
	) {
		return this.ebookService.saveCover(this.userId(req), id, file);
	}

	@Delete('delete/:id')
	@UseInterceptors(ResponseInterceptor)
	async remove(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.ebookService.remove(this.userId(req), id);
		return { id };
	}

	@Get('file/:id')
	async file(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Res() res: Response,
	) {
		await this.ebookService.pipeFileToResponse(this.userId(req), id, res);
	}
}
