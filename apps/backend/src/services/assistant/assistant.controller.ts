import {
	Body,
	ClassSerializerInterceptor,
	Controller,
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
import { JwtGuard } from 'src/guards/jwt.guard';
import { AssistantService } from './assistant.service';
import { AssistantChatDto } from './dto/assistant-chat.dto';
import { AssistantSessionListDto } from './dto/assistant-session-list.dto';
import { AssistantStopDto } from './dto/assistant-stop.dto';
import { CreateAssistantSessionDto } from './dto/create-assistant-session.dto';

type AuthedRequest = Request & { user?: { userId: number } };

@Controller('assistant')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtGuard)
export class AssistantController {
	constructor(private readonly assistantService: AssistantService) {}

	/** 新建空会话，后续多轮传 sessionId */
	@Post('session')
	async createSession(
		@Req() req: AuthedRequest,
		@Body() dto: CreateAssistantSessionDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		return this.assistantService.createSession(userId, dto);
	}

	/** 分页：当前用户的助手会话列表 */
	@Get('sessions')
	async listSessions(
		@Req() req: AuthedRequest,
		@Query() query: AssistantSessionListDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		return this.assistantService.listSessions(userId, query);
	}

	/** 按 sessionId 拉取会话详情及全部消息（时间正序） */
	@Get('session/:sessionId')
	async getSessionDetail(
		@Req() req: AuthedRequest,
		@Param('sessionId') sessionId: string,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		return this.assistantService.getSessionDetail(userId, sessionId);
	}

	/** GLM 流式问答（body 可不带 sessionId，将自动新建会话） */
	@Post('sse')
	@Sse()
	chatSse(
		@Req() req: AuthedRequest,
		@Body() dto: AssistantChatDto,
	): Observable<any> {
		const userId = req.user?.userId;
		if (userId == null) {
			return of({
				data: { error: '未登录', done: true },
			});
		}
		const source$ = this.assistantService.chatStream(userId, dto).pipe(
			map((chunk) => {
				return {
					data: {
						type: chunk.type,
						// 兼容只读 content 的前端：正文仍放在 content
						content: chunk.type === 'content' ? chunk.data : undefined,
						raw: chunk.type !== 'content' ? chunk.data : undefined,
						done: false,
					},
				};
			}),
		);
		const done$ = of({ data: { done: true } });
		return concat(source$, done$).pipe(
			catchError((error) =>
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
	async stop(@Req() req: AuthedRequest, @Body() body: AssistantStopDto) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		return this.assistantService.stopStream(body.sessionId, userId);
	}
}
