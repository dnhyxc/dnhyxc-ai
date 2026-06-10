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
import { UpsertLlmConfigDto } from './dto/upsert-llm-config.dto';
import { LlmConfigService } from './llm-config.service';

type AuthedRequest = Request & { user?: { userId?: number } };

function requireUserId(req: AuthedRequest): number {
	const userId = req.user?.userId;
	if (userId == null || !Number.isFinite(userId) || userId <= 0) {
		throw new UnauthorizedException('请先登录后再试');
	}
	return userId;
}

@Controller('settings/llm')
@UseGuards(JwtGuard)
@UseInterceptors(ResponseInterceptor)
export class LlmConfigController {
	constructor(private readonly llmConfigService: LlmConfigService) {}

	@Get()
	getConfig(@Req() req: AuthedRequest) {
		return this.llmConfigService.getPublicView(requireUserId(req));
	}

	@Get('defaults')
	getDefaults() {
		return {
			baseUrl: this.llmConfigService.getDefaultBaseUrlHint(),
		};
	}

	@Put()
	update(@Body() dto: UpsertLlmConfigDto, @Req() req: AuthedRequest) {
		return this.llmConfigService.upsert(dto, requireUserId(req));
	}

	@Delete()
	clear(@Req() req: AuthedRequest) {
		return this.llmConfigService.clear(requireUserId(req));
	}
}
