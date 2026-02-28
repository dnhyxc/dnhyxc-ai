import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	Sse,
	UseInterceptors,
} from '@nestjs/common';
import { catchError, concat, map, Observable, of } from 'rxjs';
import { ChatService } from './chat.service';
import { ChatContinueDto } from './dto/chat-continue.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatStopDto } from './dto/chat-stop.dto';
import { CreateChatDto } from './dto/create-chat.dto';
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

	@Post('/sse')
	@Sse()
	async chatStream(
		@Body() chatRequestDto: ChatRequestDto,
	): Promise<Observable<any>> {
		const source$ = (await this.chatService.chatStream(chatRequestDto)).pipe(
			map((chunk) => {
				const data = JSON.parse(chunk);
				return {
					data: {
						content: data.content,
						sessionId: data.sessionId,
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
		const source$ = (
			await this.chatService.continueStream(
				dto.sessionId,
				dto.parentId,
				dto.userMessage,
				dto.assistantMessage,
				dto.currentChatId,
				dto.isRegenerate,
			)
		).pipe(
			map((chunk) => {
				const data = JSON.parse(chunk);
				return {
					data: {
						content: data.content,
						sessionId: data.sessionId,
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

	@Post()
	create(@Body() createChatDto: CreateChatDto) {
		return this.messageService.create(createChatDto);
	}

	@Get()
	findAll() {
		return this.messageService.findAll();
	}

	@Get('session/:sessionId')
	findOneSession(@Param('sessionId') sessionId: string) {
		return this.messageService.findOneSession(sessionId);
	}

	@Patch(':id')
	update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
		return this.messageService.update(+id, updateChatDto);
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.messageService.remove(+id);
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
}
