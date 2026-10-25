import { timingSafeEqual } from 'node:crypto';
import {
	Body,
	Controller,
	Headers,
	Post,
	UnauthorizedException,
} from '@nestjs/common';
import { EnglishDailyReadingService } from './english-daily-reading.service';

function tokenOk(
	got: string | undefined,
	expected: string | undefined,
): boolean {
	if (!expected || !got) return false;
	const a = Buffer.from(got);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

/** 管理后台补生成。不走用户登录，只认内部密钥。 */
@Controller('internal/daily-reading')
export class DailyReadingInternalController {
	constructor(private readonly dailyReading: EnglishDailyReadingService) {}

	@Post('backfill')
	async backfill(
		@Headers('x-internal-token') token: string | undefined,
		@Body() body: { publishDate?: string },
	) {
		if (!tokenOk(token, process.env.DAILY_READING_INTERNAL_TOKEN)) {
			throw new UnauthorizedException();
		}
		return this.dailyReading.backfillDay(body?.publishDate ?? '');
	}
}
