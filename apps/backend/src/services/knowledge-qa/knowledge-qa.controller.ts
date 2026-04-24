import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Post,
	Req,
	Sse,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, concat, map, Observable, of } from 'rxjs';
import { JwtGuard } from '../../guards/jwt.guard';
import { AskKnowledgeQaDto } from './dto/ask-knowledge-qa.dto';
import { KnowledgeQaService } from './knowledge-qa.service';

@Controller('knowledge/qa')
@UseInterceptors(ClassSerializerInterceptor)
@UseGuards(JwtGuard)
export class KnowledgeQaController {
	constructor(private readonly qa: KnowledgeQaService) {}

	@Post('ask')
	@Sse()
	async ask(
		@Body() dto: AskKnowledgeQaDto,
		@Req() req: Request & { user?: { userId?: number } },
	): Promise<Observable<any>> {
		const authorId = Number(req.user?.userId ?? 0);
		const source$ = await this.qa.askStream({
			question: dto.question,
			authorId,
			topK: dto.topK,
			includeEvidences: dto.includeEvidences,
		});
		const done$ = of({ type: 'qa.sse.done' });
		return concat(source$, done$).pipe(
			map((evt) => ({ data: evt })),
			catchError((error) =>
				of({
					data: {
						type: 'qa.error',
						message: error?.message || '处理失败',
					},
				}),
			),
		);
	}
}
