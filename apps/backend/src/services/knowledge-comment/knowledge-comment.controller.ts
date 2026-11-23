import {
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
	UnauthorizedException,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { CreateKnowledgeCommentDto } from './dto/create-knowledge-comment.dto';
import { UpdateKnowledgeCommentDto } from './dto/update-knowledge-comment.dto';
import { KnowledgeCommentService } from './knowledge-comment.service';

type AuthedRequest = Request & { user?: { userId?: number } };

@Controller('knowledge')
@UseInterceptors(ResponseInterceptor)
@UseGuards(JwtGuard)
export class KnowledgeCommentController {
	constructor(private readonly comments: KnowledgeCommentService) {}

	private userId(req: AuthedRequest): number {
		const userId = req.user?.userId;
		if (userId == null) throw new UnauthorizedException('未登录');
		return userId;
	}

	@Get(':id/comments/summary')
	summary(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
		return this.comments.summary(this.userId(req), id);
	}

	@Post(':id/comments/release')
	release(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
		return this.comments.release(this.userId(req), id);
	}

	@Post('comments/:commentId/private')
	makePrivate(
		@Req() req: AuthedRequest,
		@Param('commentId', ParseUUIDPipe) commentId: string,
	) {
		return this.comments.makePrivate(this.userId(req), commentId);
	}

	@Post('comments/:commentId/public')
	makePublic(
		@Req() req: AuthedRequest,
		@Param('commentId', ParseUUIDPipe) commentId: string,
	) {
		return this.comments.makePublic(this.userId(req), commentId);
	}

	@Get(':id/comments/:rootId/replies')
	replies(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Param('rootId', ParseUUIDPipe) rootId: string,
		@Query('cursor') cursor?: string,
	) {
		return this.comments.listReplies(this.userId(req), id, rootId, cursor);
	}

	@Get(':id/comments')
	list(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Query('cursor') cursor?: string,
	) {
		return this.comments.list(this.userId(req), id, cursor);
	}

	@Post(':id/comments')
	create(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: CreateKnowledgeCommentDto,
	) {
		return this.comments.create(this.userId(req), id, dto);
	}

	@Put('comments/:commentId')
	update(
		@Req() req: AuthedRequest,
		@Param('commentId', ParseUUIDPipe) commentId: string,
		@Body() dto: UpdateKnowledgeCommentDto,
	) {
		return this.comments.update(this.userId(req), commentId, dto);
	}

	@Delete('comments/:commentId')
	remove(
		@Req() req: AuthedRequest,
		@Param('commentId', ParseUUIDPipe) commentId: string,
	) {
		return this.comments.remove(this.userId(req), commentId);
	}

	@Post('comments/:commentId/like')
	like(
		@Req() req: AuthedRequest,
		@Param('commentId', ParseUUIDPipe) commentId: string,
	) {
		return this.comments.like(this.userId(req), commentId);
	}

	@Delete('comments/:commentId/like')
	unlike(
		@Req() req: AuthedRequest,
		@Param('commentId', ParseUUIDPipe) commentId: string,
	) {
		return this.comments.unlike(this.userId(req), commentId);
	}
}
