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
import { memoryStorage } from 'multer';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { decodeChineseFilename } from '../../utils';
import { AddEbookPathDto } from './dto/add-ebook-path.dto';
import { QueryEbookShelfDto } from './dto/query-ebook-shelf.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { EbookService } from './ebook.service';

type AuthedRequest = Request & { user?: { userId: number } };

const EBOOK_MAX_BYTES = 120 * 1024 * 1024;

const ebookMemoryUpload = {
	storage: memoryStorage(),
	limits: { fileSize: EBOOK_MAX_BYTES },
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
