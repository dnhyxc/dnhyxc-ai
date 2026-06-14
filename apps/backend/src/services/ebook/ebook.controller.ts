import { randomUUID } from 'node:crypto';
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
import { ensureUploadDir, getEbookFilesDir } from '../../utils/upload-paths';
import { AddEbookPathDto } from './dto/add-ebook-path.dto';
import { SaveEbookProgressDto } from './dto/save-ebook-progress.dto';
import { EbookService } from './ebook.service';

type AuthedRequest = Request & { user?: { userId: number } };

const EBOOK_MAX_BYTES = 120 * 1024 * 1024;

function ebookUploadMulterOptions() {
	return {
		storage: diskStorage({
			destination: (_req, _file, cb) => {
				const dir = getEbookFilesDir(__dirname);
				ensureUploadDir(dir);
				cb(null, dir);
			},
			filename: (_req, file, cb) => {
				const originalname = decodeChineseFilename(file.originalname);
				cb(null, `${randomUUID()}_${originalname}`);
			},
		}),
		limits: { fileSize: EBOOK_MAX_BYTES },
		fileFilter: (
			_req: Request,
			file: Express.Multer.File,
			cb: (error: Error | null, accept: boolean) => void,
		) => {
			const lower = file.originalname.toLowerCase();
			if (lower.endsWith('.epub') || lower.endsWith('.pdf')) {
				cb(null, true);
			} else {
				cb(new BadRequestException('仅支持 epub / pdf'), false);
			}
		},
	};
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
	async shelf(@Req() req: AuthedRequest) {
		return this.ebookService.getShelf(this.userId(req));
	}

	@Post('add-path')
	@UseInterceptors(ResponseInterceptor)
	async addPath(@Req() req: AuthedRequest, @Body() dto: AddEbookPathDto) {
		return this.ebookService.addFromPath(this.userId(req), dto);
	}

	@Post('upload')
	@UseInterceptors(
		FileInterceptor('file', ebookUploadMulterOptions()),
		ResponseInterceptor,
	)
	async upload(
		@Req() req: AuthedRequest,
		@UploadedFile() file: Express.Multer.File,
	) {
		return this.ebookService.addFromUpload(this.userId(req), file);
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
		const { abs, fmt } = await this.ebookService.getFileForDownload(userId, id);
		res.setHeader('Content-Type', this.ebookService.getEbookMime(fmt));
		res.sendFile(abs);
	}
}
