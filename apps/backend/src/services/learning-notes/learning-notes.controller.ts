import {
	BadRequestException,
	Body,
	ClassSerializerInterceptor,
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
import { QueryLearningNoteDto } from './dto/query-learning-note.dto';
import { SaveLearningNoteDto } from './dto/save-learning-note.dto';
import { SettleUploadSessionDto } from './dto/settle-upload-session.dto';
import { UpdateLearningNoteDto } from './dto/update-learning-note.dto';
import { UpdateNoteVisibilityDto } from './dto/update-note-visibility.dto';
import { LearningNotesService } from './learning-notes.service';

type AuthedRequest = Request & { user?: { userId?: number } };

const noteImageUpload = {
	storage: memoryStorage(),
	limits: { fileSize: 1024 * 1024 * 20 },
	fileFilter: (
		_req: Request,
		file: Express.Multer.File,
		cb: (error: Error | null, acceptFile: boolean) => void,
	) => {
		if (file.mimetype?.startsWith('image/')) {
			cb(null, true);
			return;
		}
		cb(new BadRequestException('仅支持图片文件') as unknown as Error, false);
	},
};

@Controller('english-learning/notes')
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
@UseGuards(JwtGuard)
export class LearningNotesController {
	constructor(private readonly notesService: LearningNotesService) {}

	private userId(req: AuthedRequest): number {
		const userId = req.user?.userId;
		if (userId == null) throw new UnauthorizedException('未登录');
		return userId;
	}

	/** 笔记正文图片 → COS notes/ 前缀（与头像隔离，删文可按引用回收） */
	@Post('upload-image')
	@UseInterceptors(FileInterceptor('file', noteImageUpload))
	async uploadImage(
		@Req() req: AuthedRequest,
		@UploadedFile() file: Express.Multer.File,
		@Body('noteId') noteId?: string,
		@Body('uploadSessionId') uploadSessionId?: string,
	) {
		return this.notesService.uploadImage(
			this.userId(req),
			file,
			noteId,
			uploadSessionId,
		);
	}

	/** 放弃上传会话（删 pending + 无引用 COS） */
	@Delete('upload-session/:sessionId')
	async discardUploadSession(
		@Req() req: AuthedRequest,
		@Param('sessionId', ParseUUIDPipe) sessionId: string,
	) {
		return this.notesService.discardUploadSession(this.userId(req), sessionId);
	}

	/** 按当前正文结算会话（上传又删、无需保存笔记时回收孤儿图） */
	@Post('upload-session/:sessionId/settle')
	async settleUploadSession(
		@Req() req: AuthedRequest,
		@Param('sessionId', ParseUUIDPipe) sessionId: string,
		@Body() dto: SettleUploadSessionDto,
	) {
		return this.notesService.settleUploadSession(
			this.userId(req),
			sessionId,
			dto.content ?? '',
		);
	}

	@Post('save')
	async save(@Req() req: AuthedRequest, @Body() dto: SaveLearningNoteDto) {
		return this.notesService.save(this.userId(req), dto);
	}

	/** 本人笔记 + 他人公开笔记 */
	@Get('list')
	async list(@Req() req: AuthedRequest, @Query() query: QueryLearningNoteDto) {
		return this.notesService.findPage(this.userId(req), query);
	}

	/** 导出单篇笔记 DOCX（原始二进制；与列表分页无关） */
	@Get('export-docx/:id')
	async exportDocx(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Res() res: Response,
	): Promise<void> {
		const buf = await this.notesService.exportDocxBuffer(this.userId(req), id);
		res.setHeader(
			'Content-Type',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		);
		res.setHeader(
			'Content-Disposition',
			'attachment; filename="learning-note.docx"',
		);
		res.setHeader('Content-Length', String(buf.length));
		res.end(buf);
	}

	@Get('detail/:id')
	async detail(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		return this.notesService.findOne(this.userId(req), id);
	}

	@Put('update/:id')
	async update(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateLearningNoteDto,
	) {
		return this.notesService.update(this.userId(req), { ...dto, id });
	}

	/** 所有者设置笔记是否公开 */
	@Put('visibility/:id')
	async setVisibility(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateNoteVisibilityDto,
	) {
		return this.notesService.setVisibility(this.userId(req), id, dto);
	}

	@Delete('delete/:id')
	async remove(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.notesService.remove(this.userId(req), id);
		return { id };
	}
}
