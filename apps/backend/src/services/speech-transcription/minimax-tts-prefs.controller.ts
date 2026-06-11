import {
	Body,
	Controller,
	Delete,
	Get,
	Put,
	Req,
	UnauthorizedException,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from '../../guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { UpsertMinimaxTtsPrefsDto } from './dto/upsert-minimax-tts-prefs.dto';
import { MinimaxTtsPrefsService } from './minimax-tts-prefs.service';

type AuthedRequest = Request & { user?: { userId?: number } };

function requireUserId(req: AuthedRequest): number {
	const userId = req.user?.userId;
	if (userId == null || !Number.isFinite(userId) || userId <= 0) {
		throw new UnauthorizedException('请先登录后再试');
	}
	return userId;
}

@Controller('settings/cloud-tts')
@UseGuards(JwtGuard)
@UseInterceptors(ResponseInterceptor)
export class MinimaxTtsPrefsController {
	constructor(private readonly prefsService: MinimaxTtsPrefsService) {}

	@Get()
	getPrefs(@Req() req: AuthedRequest) {
		return this.prefsService.getPublicView(requireUserId(req));
	}

	@Put()
	update(@Body() dto: UpsertMinimaxTtsPrefsDto, @Req() req: AuthedRequest) {
		return this.prefsService.upsert(dto, requireUserId(req));
	}

	@Delete()
	clear(@Req() req: AuthedRequest) {
		return this.prefsService.clear(requireUserId(req));
	}
}
