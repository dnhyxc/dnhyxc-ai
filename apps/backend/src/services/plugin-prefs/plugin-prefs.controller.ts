import {
	Body,
	Controller,
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
import { UpsertPluginEnabledPrefsDto } from './dto/upsert-plugin-enabled-prefs.dto';
import { PluginPrefsService } from './plugin-prefs.service';

type AuthedRequest = Request & { user?: { userId?: number } };

function requireUserId(req: AuthedRequest): number {
	const userId = req.user?.userId;
	if (userId == null || !Number.isFinite(userId) || userId <= 0) {
		throw new UnauthorizedException('请先登录后再试');
	}
	return userId;
}

@Controller('settings/plugin-enabled')
@UseGuards(JwtGuard)
@UseInterceptors(ResponseInterceptor)
export class PluginPrefsController {
	constructor(private readonly prefsService: PluginPrefsService) {}

	@Get()
	getPrefs(@Req() req: AuthedRequest) {
		return this.prefsService.getView(requireUserId(req));
	}

	@Put()
	update(@Body() dto: UpsertPluginEnabledPrefsDto, @Req() req: AuthedRequest) {
		return this.prefsService.upsert(dto, requireUserId(req));
	}
}
