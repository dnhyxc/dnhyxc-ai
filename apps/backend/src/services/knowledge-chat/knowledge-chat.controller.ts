import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	Query,
	Sse,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { catchError, concat, map, Observable, of } from 'rxjs';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ChatContinueDto } from './dto/chat-continue.dto';
import { ChatRequestDto, CreateSessionDto } from './dto/chat-request.dto';
import { ChatStopDto } from './dto/chat-stop.dto';
import { HistoryDto, MessageDto } from './dto/message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { KnowledgeChatService } from './knowledge-chat.service';
import { KnowledgeMessageService } from './knowledge-message.service';

@Controller('knowledge-chat')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtGuard)
export class KnowledgeChatController {
	constructor(
		private readonly knowledgeChatService: KnowledgeChatService,
		private readonly messageService: KnowledgeMessageService,
	) {}

	@Post('/createSession')
	async createSession(@Body() dto: CreateSessionDto) {
		return this.messageService.createSession(dto.sessionId);
	}

	@Post('/sse')
	@Sse()
	async chatStream(@Body() dto: ChatRequestDto): Promise<Observable<any>> {
		const source$ = (await this.knowledgeChatService.chatStream(dto)).pipe(
			map((chunk) => ({ data: { content: chunk, done: false } })),
		);
		const done$ = of({ data: { done: true } });
		return concat(source$, done$).pipe(
			catchError((error) =>
				of({ data: { error: error.message || '处理失败', done: true } }),
			),
		);
	}

	@Post('/stopSse')
	stopStream(@Body() dto: ChatStopDto) {
		return this.knowledgeChatService.stopStream(dto.sessionId);
	}

	@Post('/continueSse')
	@Sse()
	async continueStream(@Body() dto: ChatContinueDto): Promise<Observable<any>> {
		const source$ = (await this.knowledgeChatService.continueStream(dto)).pipe(
			map((chunk) => ({ data: { content: chunk, done: false } })),
		);
		const done$ = of({ data: { done: true } });
		return concat(source$, done$).pipe(
			catchError((error) =>
				of({ data: { error: error.message || '处理失败', done: true } }),
			),
		);
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

	@Get('/getSessionList')
	async getSessionList(@Query() dto: HistoryDto) {
		return this.messageService.getSessionList(dto);
	}

	@Post('/updateSession')
	async updateSession(@Body() dto: UpdateChatDto) {
		return this.messageService.updateSession(dto);
	}
}
