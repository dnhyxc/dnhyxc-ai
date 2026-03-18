import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Post,
	Query,
	Sse,
	UseInterceptors,
} from '@nestjs/common';
import { catchError, concat, map, Observable, of } from 'rxjs';
import { ChatService } from './chat.service';
import { ChatContinueDto } from './dto/chat-continue.dto';
import { ChatRequestDto, CreateSessionDto } from './dto/chat-request.dto';
import { ChatStopDto } from './dto/chat-stop.dto';
import { HistoryDto, MessageDto } from './dto/message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { MessageService } from './message.service';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('chat')
export class ChatController {
	constructor(
		private readonly chatService: ChatService,
		private messageService: MessageService,
	) {}

	@Post('/createSession')
	async createSession(@Body() dto: CreateSessionDto) {
		return this.messageService.createSession(dto);
	}

	@Post('/sse')
	@Sse()
	async chatStream(
		@Body() chatRequestDto: ChatRequestDto,
	): Promise<Observable<any>> {
		const source$ = (await this.chatService.chatStream(chatRequestDto)).pipe(
			map((chunk) => {
				console.log(chunk);
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
	async continueStream(@Body() dto: ChatContinueDto): Promise<Observable<any>> {
		const source$ = (await this.chatService.continueStream(dto)).pipe(
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

	@Post('/zhipu-stream')
	@Sse()
	zhipuChatStream(@Body() chatRequestDto: ChatRequestDto): Observable<any> {
		const source$ = this.chatService.zhipuChatStream(chatRequestDto).pipe(
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
	async chat(@Body() chatRequestDto: ChatRequestDto) {
		const result = await this.chatService.chat(chatRequestDto);
		return result;
	}

	@Delete('session/:sessionId')
	clearSession(@Param('sessionId') sessionId: string) {
		this.chatService.clearSession(sessionId);
		return { success: true, message: 'Session cleared' };
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
	async getSessionList(
		@Query('pageSize', ParseIntPipe)
		@Query('pageNo', ParseIntPipe)
		dto: HistoryDto,
	) {
		return this.messageService.getSessionList(dto);
	}

	@Post('/updateSession')
	async updateSession(dto: UpdateChatDto) {
		return this.messageService.updateSession(dto);
	}
}
