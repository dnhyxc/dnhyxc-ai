import {
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
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { QueryLearningNoteDto } from './dto/query-learning-note.dto';
import { SaveLearningNoteDto } from './dto/save-learning-note.dto';
import { UpdateLearningNoteDto } from './dto/update-learning-note.dto';
import { UpdateNoteVisibilityDto } from './dto/update-note-visibility.dto';
import { LearningNotesService } from './learning-notes.service';

type AuthedRequest = Request & { user?: { userId?: number } };

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
