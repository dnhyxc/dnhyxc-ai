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
import { diskStorage, memoryStorage } from 'multer';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { decodeChineseFilename } from '../../utils';
import { ensureUploadDir, getUploadImagesDir } from '../../utils/upload-paths';
import { AddEbookPathDto } from './dto/add-ebook-path.dto';
import { QueryEbookShelfDto } from './dto/query-ebook-shelf.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { UpdateEbookTitleDto } from './dto/update-ebook-title.dto';
import { EbookService } from './ebook.service';

type AuthedRequest = Request & { user?: { userId: number } };

const EBOOK_MAX_BYTES = 120 * 1024 * 1024;
const EBOOK_COVER_MAX_BYTES = 2 * 1024 * 1024;
const EBOOK_COVER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ebookMemoryUpload = {
	storage: memoryStorage(),
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

	@Get('book/:id')
	@UseInterceptors(ResponseInterceptor)
	async getBook(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		return this.ebookService.getBook(this.userId(req), id);
	}

	@Post('add-path')
	@UseInterceptors(ResponseInterceptor)
	async addPath(@Req() req: AuthedRequest, @Body() dto: AddEbookPathDto) {
		return this.ebookService.addFromPath(this.userId(req), dto);
	}

	@Post('upload')
	@UseInterceptors(
		FileInterceptor('file', {
			...ebookMemoryUpload,
			fileFilter: ebookFileFilter,
		}),
		ResponseInterceptor,
	)
	async upload(
		@Req() req: AuthedRequest,
		@UploadedFile() file: Express.Multer.File,
		@Body('bookId') bookId?: string,
	) {
		const trimmed = typeof bookId === 'string' ? bookId.trim() : undefined;
		return this.ebookService.addFromUpload(this.userId(req), file, {
			bookId: trimmed || undefined,
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
		const userId = this.userId(req);
		const payload = await this.ebookService.getFileForDownload(userId, id);
		res.setHeader('Content-Type', this.ebookService.getEbookMime(payload.fmt));
		if (payload.kind === 'disk') {
			res.sendFile(payload.abs);
			return;
		}
		res.send(payload.buffer);
	}
}
