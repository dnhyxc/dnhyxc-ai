import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Query,
	Req,
	Sse,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, concat, map, Observable, of } from 'rxjs';
import { JwtGuard } from '../../guards/jwt.guard';
import { CreateEbookAssistantSessionDto } from './dto/create-ebook-assistant-session.dto';
import { EbookAssistantChatDto } from './dto/ebook-assistant-chat.dto';
import { EbookAssistantSessionsForBookDto } from './dto/ebook-assistant-sessions-for-book.dto';
import { EbookAssistantStopDto } from './dto/ebook-assistant-stop.dto';
import { EbookAssistantService } from './ebook-assistant.service';

type AuthedRequest = Request & { user?: { userId: number } };

@Controller('ebook-assistant')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtGuard)
export class EbookAssistantController {
	constructor(private readonly ebookAssistantService: EbookAssistantService) {}

	@Post('session')
	async createSession(
		@Req() req: AuthedRequest,
		@Body() dto: CreateEbookAssistantSessionDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const data = await this.ebookAssistantService.createSession(userId, dto);
		return { success: true, data };
	}

	@Get('sessions/for-book')
	async listSessionsForBook(
		@Req() req: AuthedRequest,
		@Query() query: EbookAssistantSessionsForBookDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const data = await this.ebookAssistantService.listSessionsByBook(
			userId,
			query.bookId,
			{ pageNo: query.pageNo, pageSize: query.pageSize },
		);
		return {
			success: true,
			data: {
				...data,
				list: data.list.map((row) => ({
					...row,
					createdAt: row.createdAt.toISOString(),
					updatedAt: row.updatedAt.toISOString(),
				})),
			},
		};
	}

	@Get('session/for-book')
	async getSessionForBook(
		@Req() req: AuthedRequest,
		@Query('bookId') bookId?: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		if (!bookId?.trim()) {
			return { success: false, message: 'bookId 不能为空' };
		}
		const detail = await this.ebookAssistantService.getSessionDetailByBook(
			userId,
			bookId.trim(),
		);
		if (!detail) {
			return { success: true, data: null };
		}
		return {
			success: true,
			data: {
				session: detail.session
					? {
							...detail.session,
							createdAt: detail.session.createdAt.toISOString(),
							updatedAt: detail.session.updatedAt.toISOString(),
						}
					: null,
				messages: detail.messages.map((m) => ({
					...m,
					createdAt: m.createdAt.toISOString(),
				})),
			},
		};
	}

	@Get('session/:sessionId')
	async getSessionDetail(
		@Req() req: AuthedRequest,
		@Param('sessionId') sessionId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const detail = await this.ebookAssistantService.getSessionDetail(
			userId,
			sessionId,
		);
		return {
			success: true,
			data: {
				session: detail.session
					? {
							...detail.session,
							createdAt: detail.session.createdAt.toISOString(),
							updatedAt: detail.session.updatedAt.toISOString(),
						}
					: null,
				messages: detail.messages.map((m) => ({
					...m,
					createdAt: m.createdAt.toISOString(),
				})),
			},
		};
	}

	@Delete('session/:sessionId')
	async deleteSession(
		@Req() req: AuthedRequest,
		@Param('sessionId') sessionId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const data = await this.ebookAssistantService.deleteSession(
			userId,
			sessionId,
		);
		return { success: true, data };
	}

	@Post('sse')
	@Sse()
	chatSse(
		@Req() req: AuthedRequest,
		@Body() dto: EbookAssistantChatDto,
	): Observable<{ data: Record<string, unknown> }> {
		const userId = req.user?.userId;
		if (userId == null) {
			return of({ data: { error: '未登录', done: true } });
		}
		const source$ = this.ebookAssistantService.chatStream(userId, dto).pipe(
			map((chunk) => {
				if (chunk.type === 'messageIds') {
					return {
						data: {
							type: 'messageIds',
							userMessageId: chunk.data.userMessageId,
							assistantMessageId: chunk.data.assistantMessageId,
							done: false,
						},
					};
				}
				return {
					data: {
						type: chunk.type,
						content: chunk.type === 'content' ? chunk.data : undefined,
						done: false,
					},
				};
			}),
		);
		const done$ = of({ data: { done: true } });
		return concat(source$, done$).pipe(
			catchError((error: Error) =>
				of({
					data: {
						error: error?.message || '处理失败',
						done: true,
					},
				}),
			),
		);
	}

	@Post('stop')
	async stop(@Req() req: AuthedRequest, @Body() body: EbookAssistantStopDto) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		return this.ebookAssistantService.stopStream(body.sessionId, userId);
	}
}
