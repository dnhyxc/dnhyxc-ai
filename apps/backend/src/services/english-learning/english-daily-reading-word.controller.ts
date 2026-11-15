import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Put,
	Query,
	Req,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from 'src/guards/jwt.guard';
import {
	type CollectReadingWordInput,
	EnglishDailyReadingWordService,
} from './english-daily-reading-word.service';

type AuthedRequest = Request & { user?: { userId: number } };

@Controller('english-learning/daily-reading-words')
@UseGuards(JwtGuard)
export class EnglishDailyReadingWordController {
	constructor(private readonly words: EnglishDailyReadingWordService) {}

	@Get('status')
	status(@Req() req: AuthedRequest, @Query('readingId') readingId = '') {
		return this.words.keys(this.userId(req), readingId);
	}

	@Get('sources')
	sources(@Req() req: AuthedRequest) {
		return this.words.sources(this.userId(req));
	}

	@Get('words')
	listWords(
		@Req() req: AuthedRequest,
		@Query('readingId') readingId?: string,
		@Query('q') q?: string,
		@Query('cursor') cursor?: string,
	) {
		return this.list(req, readingId, q, cursor);
	}

	@Get()
	list(
		@Req() req: AuthedRequest,
		@Query('readingId') readingId?: string,
		@Query('q') q?: string,
		@Query('cursor') cursor?: string,
	) {
		return this.words.list(this.userId(req), { readingId, q, cursor });
	}

	@Post()
	collect(@Req() req: AuthedRequest, @Body() body: CollectReadingWordInput) {
		return this.words.upsert(this.userId(req), body);
	}

	@Delete()
	uncollect(@Req() req: AuthedRequest, @Body() body: CollectReadingWordInput) {
		return this.words.removeSource(this.userId(req), body);
	}

	@Patch(':id')
	edit(
		@Req() req: AuthedRequest,
		@Param('id') id: string,
		@Body() body: { zh?: unknown },
	) {
		return this.words.editZh(this.userId(req), id, body?.zh);
	}

	@Put(':id')
	editByPut(
		@Req() req: AuthedRequest,
		@Param('id') id: string,
		@Body() body: { zh?: unknown },
	) {
		return this.edit(req, id, body);
	}

	@Delete(':id')
	remove(@Req() req: AuthedRequest, @Param('id') id: string) {
		return this.words.remove(this.userId(req), id);
	}

	private userId(req: AuthedRequest): number {
		const userId = req.user?.userId;
		if (userId == null) throw new UnauthorizedException('未授权');
		return userId;
	}
}
