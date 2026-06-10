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
import { JwtGuard } from 'src/guards/jwt.guard';
import { ChatService } from './chat.service';
import { ChatContinueDto } from './dto/chat-continue.dto';
import { ChatRequestDto, CreateSessionDto } from './dto/chat-request.dto';
import { ChatStopDto } from './dto/chat-stop.dto';
import { HistoryDto, MessageDto } from './dto/message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { GlmChatService } from './glm.service';
import { MessageService } from './message.service';

type AuthedRequest = Request & { user?: { userId: number } };

@Controller('chat')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtGuard)
export class ChatController {
	constructor(
		private readonly chatService: ChatService,
		private messageService: MessageService,
		private glmChatService: GlmChatService,
	) {}

	@Post('/createSession')
	async createSession(@Body() dto: CreateSessionDto) {
		return this.messageService.createSession(dto);
	}

	@Post('/sse')
	@Sse()
	async chatStream(
		@Req() req: AuthedRequest,
		@Body() chatRequestDto: ChatRequestDto,
	): Promise<Observable<any>> {
		const userId = req.user?.userId;
		const source$ = (
			await this.chatService.chatStream(chatRequestDto, userId)
		).pipe(
			map((chunk) => {
				return {
					data: {
						content: chunk,
						done: false,
					},
				};
			}),
		);
		const done$ = of({
			data: {
				done: true,
			},
		});
		return concat(source$, done$).pipe(
			catchError((error) => {
				return of({
					data: {
						error: error.message || '处理失败',
						done: true,
					},
				});
			}),
		);
	}

	@Post('/stopSse')
	stopStream(@Body() dto: ChatStopDto) {
		return this.chatService.stopStream(dto.sessionId);
	}

	@Post('/continueSse')
	@Sse()
	async continueStream(
		@Req() req: AuthedRequest,
		@Body() dto: ChatContinueDto,
	): Promise<Observable<any>> {
		const userId = req.user?.userId;
		const source$ = (await this.chatService.continueStream(dto, userId)).pipe(
			map((chunk) => {
				return {
					data: {
						content: chunk,
						done: false,
					},
				};
			}),
		);
		const done$ = of({
			data: {
				done: true,
			},
		});
		return concat(source$, done$).pipe(
			catchError((error) => {
				return of({
					data: {
						error: error.message || '处理失败',
						done: true,
					},
				});
			}),
		);
	}

	@Post('/glm-stream')
	@Sse()
	glmChatStream(@Body() chatRequestDto: ChatRequestDto): Observable<any> {
		const source$ = this.glmChatService.glmChatStream(chatRequestDto).pipe(
			map((chunk) => ({
				data: {
					content: chunk.data,
					type: chunk.type,
					done: false,
				},
			})),
		);
		const done$ = of({
			data: {
				done: true,
			},
		});
		return concat(source$, done$).pipe(
			catchError((error) => {
				return of({
					data: {
						error: error.message || '处理失败',
						done: true,
					},
				});
			}),
		);
	}

	@Post('/message')
	async chat(
		@Req() req: AuthedRequest,
		@Body() chatRequestDto: ChatRequestDto,
	) {
		const userId = req.user?.userId;
		return this.chatService.chat(chatRequestDto, userId);
	}

	@Get('session/:sessionId')
	findOneSession(@Param('sessionId') sessionId: string) {
		return this.messageService.findOneSession(sessionId);
	}

	@Delete('delSession/:id')
	delete(@Param('id') id: string) {
		return this.messageService.deleteSessionById(id);
	}

	@Get('/getSession')
	async findSession(@Query() dto: MessageDto) {
		return this.messageService.findSession(dto);
	}

	@Get('/getHistory')
	async getHistory(@Query() dto: HistoryDto) {
		return this.messageService.getHistory(dto);
	}

	// @UseInterceptors(ResponseInterceptor)
	@Get('/getSessionList')
	async getSessionList(@Query() dto: HistoryDto) {
		return this.messageService.getSessionList(dto);
	}

	@Post('/updateSession')
	async updateSession(@Body() dto: UpdateChatDto) {
		return this.messageService.updateSession(dto);
	}
}
