import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
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
import { CreateEbookHighlightDto } from './dto/create-ebook-highlight.dto';
import { CreateEbookThoughtDto } from './dto/create-ebook-thought.dto';
import { QueryEbookByLocalPathDto } from './dto/query-ebook-by-local-path.dto';
import { QueryEbookCategoriesSummaryDto } from './dto/query-ebook-categories-summary.dto';
import { QueryEbookListThoughtsDto } from './dto/query-ebook-list-thoughts.dto';
import { QueryEbookShelfDto } from './dto/query-ebook-shelf.dto';
import { QueryEbookThoughtChangesDto } from './dto/query-ebook-thought-changes.dto';
import { QueryEbookThoughtSyncDto } from './dto/query-ebook-thought-sync.dto';
import { ReorderEbookCategoriesDto } from './dto/reorder-ebook-categories.dto';
import { SaveEbookListenRateDto } from './dto/save-ebook-listen-rate.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { UpdateEbookBookVisibilityDto } from './dto/update-ebook-book-visibility.dto';
import { UpdateEbookCategoryDto } from './dto/update-ebook-category.dto';
import { UpdateEbookHighlightDto } from './dto/update-ebook-highlight.dto';
import { UpdateEbookThoughtDto } from './dto/update-ebook-thought.dto';
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

	@Put('book/:id/visibility')
	@UseInterceptors(ResponseInterceptor)
	async setBookVisibility(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateEbookBookVisibilityDto,
	) {
		return this.ebookService.setBookVisibility(
			this.userId(req),
			id,
			dto.isPublic,
		);
	}

	@Post('public/:sourceBookId/open')
	@UseInterceptors(ResponseInterceptor)
	async openPublicBook(
		@Req() req: AuthedRequest,
		@Param('sourceBookId', ParseUUIDPipe) sourceBookId: string,
	) {
		return this.ebookService.openPublicBook(this.userId(req), sourceBookId);
	}

	@Get('book/:id/chapters')
	@UseInterceptors(ResponseInterceptor)
	async getChapters(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		return this.ebookService.getChapters(this.userId(req), id);
	}

	@Get('book/:id/chapter/:index')
	@UseInterceptors(ResponseInterceptor)
	async getChapter(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Param('index', ParseIntPipe) index: number,
	) {
		return this.ebookService.getChapter(this.userId(req), id, index);
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

	@Get('listen-prefs')
	@UseInterceptors(ResponseInterceptor)
	async getListenPrefs(
		@Req() req: AuthedRequest,
		@Query('bookId') bookId?: string,
	) {
		const id =
			typeof bookId === 'string' && bookId.trim() ? bookId.trim() : undefined;
		return this.ebookService.getListenPrefs(this.userId(req), id);
	}

	@Put('listen-rate')
	@UseInterceptors(ResponseInterceptor)
	async saveListenRate(
		@Req() req: AuthedRequest,
		@Body() dto: SaveEbookListenRateDto,
	) {
		return this.ebookService.saveListenRate(this.userId(req), dto);
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

	@Get('thoughts/:bookId/sync')
	@UseInterceptors(ResponseInterceptor)
	async thoughtSync(
		@Req() req: AuthedRequest,
		@Param('bookId', ParseUUIDPipe) bookId: string,
		@Query() query: QueryEbookThoughtSyncDto,
	) {
		const since =
			typeof query.since === 'string' && query.since.trim()
				? new Date(query.since)
				: undefined;
		return this.ebookService.syncThoughts(this.userId(req), bookId, since);
	}

	@Get('thoughts/:bookId/revision')
	@UseInterceptors(ResponseInterceptor)
	async thoughtsRevision(
		@Req() req: AuthedRequest,
		@Param('bookId', ParseUUIDPipe) bookId: string,
	) {
		return this.ebookService.getThoughtsRevision(this.userId(req), bookId);
	}

	@Get('thoughts/:bookId/changes')
	@UseInterceptors(ResponseInterceptor)
	async thoughtChanges(
		@Req() req: AuthedRequest,
		@Param('bookId', ParseUUIDPipe) bookId: string,
		@Query() query: QueryEbookThoughtChangesDto,
	) {
		return this.ebookService.listThoughtChanges(
			this.userId(req),
			bookId,
			new Date(query.since),
		);
	}

	@Get('thoughts/:bookId')
	@UseInterceptors(ResponseInterceptor)
	async listThoughts(
		@Req() req: AuthedRequest,
		@Param('bookId', ParseUUIDPipe) bookId: string,
		@Query() query: QueryEbookListThoughtsDto,
	) {
		const spineHints = query.spineHints
			?.split(',')
			.map((hint) => hint.trim())
			.filter(Boolean);
		return this.ebookService.listThoughts(
			this.userId(req),
			bookId,
			spineHints?.length ? spineHints : undefined,
		);
	}

	@Post('thoughts')
	@UseInterceptors(ResponseInterceptor)
	async createThought(
		@Req() req: AuthedRequest,
		@Body() dto: CreateEbookThoughtDto,
	) {
		return this.ebookService.createThought(this.userId(req), dto);
	}

	@Put('thoughts/:id')
	@UseInterceptors(ResponseInterceptor)
	async updateThought(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateEbookThoughtDto,
	) {
		return this.ebookService.updateThought(this.userId(req), id, dto);
	}

	@Delete('thoughts/:id')
	@UseInterceptors(ResponseInterceptor)
	async removeThought(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.ebookService.removeThought(this.userId(req), id);
		return { id };
	}

	@Get('highlights/:bookId')
	@UseInterceptors(ResponseInterceptor)
	async listHighlights(
		@Req() req: AuthedRequest,
		@Param('bookId', ParseUUIDPipe) bookId: string,
	) {
		return this.ebookService.listHighlights(this.userId(req), bookId);
	}

	@Post('highlights')
	@UseInterceptors(ResponseInterceptor)
	async createHighlight(
		@Req() req: AuthedRequest,
		@Body() dto: CreateEbookHighlightDto,
	) {
		return this.ebookService.createHighlight(this.userId(req), dto);
	}

	@Put('highlights/:id')
	@UseInterceptors(ResponseInterceptor)
	async updateHighlight(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateEbookHighlightDto,
	) {
		return this.ebookService.updateHighlight(this.userId(req), id, dto);
	}

	@Delete('highlights/:id')
	@UseInterceptors(ResponseInterceptor)
	async removeHighlight(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.ebookService.removeHighlight(this.userId(req), id);
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
