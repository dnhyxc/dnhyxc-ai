import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Req,
	Sse,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, concat, map, Observable, of } from 'rxjs';
import { JwtGuard } from 'src/guards/jwt.guard';
import { AgentService } from './agent.service';
import { AgentChatDto } from './dto/agent-chat.dto';
import { AgentStopDto } from './dto/agent-stop.dto';
import { CreateAgentSessionDto } from './dto/create-agent-session.dto';

type AuthedRequest = Request & { user?: { userId: number } };

/**
 * LangChain Agent（ReAct + 工具 + DB 记忆 + 摘要中间件）独立接口
 */
@Controller('agent')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtGuard)
export class AgentController {
	constructor(private readonly agentService: AgentService) {}

	@Post('session')
	async createSession(
		@Req() req: AuthedRequest,
		@Body() dto: CreateAgentSessionDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const data = await this.agentService.createSession(userId, dto);
		return { success: true, data };
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
		const data = await this.agentService.getSessionDetail(userId, sessionId);
		return { success: true, data };
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
		const data = await this.agentService.deleteSession(userId, sessionId);
		return { success: true, data };
	}

	/** LangChain Agent 流式输出（SSE） */
	@Post('sse')
	@Sse()
	chatSse(
		@Req() req: AuthedRequest,
		@Body() dto: AgentChatDto,
	): Observable<{ data: Record<string, unknown> }> {
		const userId = req.user?.userId;
		if (userId == null) {
			return of({
				data: { error: '未登录', done: true },
			});
		}
		const source$ = this.agentService.chatStream(userId, dto).pipe(
			map((chunk) => ({
				data: {
					type: chunk.type,
					content: chunk.type === 'content' ? chunk.data : undefined,
					raw: chunk.type === 'tool' ? chunk.data : undefined,
					done: false,
				},
			})),
		);
		const done$ = of({
			data: { done: true },
		});
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
	async stop(@Req() req: AuthedRequest, @Body() body: AgentStopDto) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		return this.agentService.stopStream(body.sessionId, userId);
	}
}
