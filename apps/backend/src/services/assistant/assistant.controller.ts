import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Get,
	Param,
	Patch,
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
import { AssistantSessionForKnowledgeDto } from './dto/assistant-session-for-knowledge.dto';
import { AssistantSessionListDto } from './dto/assistant-session-list.dto';
import { AssistantSessionsForKnowledgeDto } from './dto/assistant-sessions-for-knowledge.dto';
import { AssistantStopDto } from './dto/assistant-stop.dto';
import { CreateAssistantSessionDto } from './dto/create-assistant-session.dto';
import { ImportAssistantTranscriptDto } from './dto/import-assistant-transcript.dto';
import { UpdateAssistantSessionKnowledgeDto } from './dto/update-assistant-session-knowledge.dto';

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

	/** 将草稿阶段对话迁入已保存知识条目（须在 `session/:id` 之前注册） */
	@Post('session/import-transcript')
	async importTranscript(
		@Req() req: AuthedRequest,
		@Body() dto: ImportAssistantTranscriptDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const data = await this.assistantService.importTranscript(userId, dto);
		return { success: true, data };
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

	/** 按知识条目标识拉取该文章下全部会话（用于历史记录/切换会话） */
	@Get('sessions/for-knowledge')
	async listSessionsForKnowledge(
		@Req() req: AuthedRequest,
		@Query() query: AssistantSessionsForKnowledgeDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const data = await this.assistantService.listSessionsByKnowledgeArticle(
			userId,
			query.knowledgeArticleId,
			{ pageNo: query.pageNo, pageSize: query.pageSize },
		);
		return { success: true, data };
	}

	/** 按知识条目标识拉取最近绑定的会话及消息（须在 `session/:id` 之前注册） */
	@Get('session/for-knowledge')
	async getSessionForKnowledge(
		@Req() req: AuthedRequest,
		@Query() query: AssistantSessionForKnowledgeDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const detail =
			await this.assistantService.getSessionDetailByKnowledgeArticle(
				userId,
				query.knowledgeArticleId,
			);
		if (!detail) {
			return { success: true, data: null };
		}
		return { success: true, data: detail };
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

	/** 将会话改绑到新的知识条目标识（如草稿保存后 id 变更） */
	@Patch('session/:sessionId/knowledge-article')
	async patchSessionKnowledgeArticle(
		@Req() req: AuthedRequest,
		@Param('sessionId') sessionId: string,
		@Body() body: UpdateAssistantSessionKnowledgeDto,
	) {
		const userId = req.user?.userId;
		if (userId == null) {
			return { success: false, message: '未登录' };
		}
		const data = await this.assistantService.updateSessionKnowledgeArticleId(
			userId,
			sessionId,
			body.knowledgeArticleId,
		);
		return { success: true, data };
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
				// 兼容扩展类型（例如 ephemeral 下发 streamId 的 meta）
				const t = (chunk as any)?.type as string | undefined;
				if (t === 'meta') {
					return {
						data: {
							type: 'meta',
							raw: (chunk as any).data,
							done: false,
						},
					};
				}
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
		if (body.sessionId) {
			return this.assistantService.stopStream(body.sessionId, userId);
		}
		if (body.streamId) {
			return this.assistantService.stopEphemeralStream(body.streamId, userId);
		}
		return { success: false, message: '缺少停止参数' };
	}
}
