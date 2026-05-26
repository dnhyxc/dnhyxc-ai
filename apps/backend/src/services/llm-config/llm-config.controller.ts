import {
	Body,
	Controller,
	Delete,
	Get,
	Put,
	Req,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from '../../guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { UpsertLlmConfigDto } from './dto/upsert-llm-config.dto';
import { LlmConfigService } from './llm-config.service';

@Controller('settings/llm')
@UseGuards(JwtGuard)
@UseInterceptors(ResponseInterceptor)
export class LlmConfigController {
	constructor(private readonly llmConfigService: LlmConfigService) {}

	@Get()
	getConfig() {
		return this.llmConfigService.getPublicView();
	}

	@Get('defaults')
	getDefaults() {
		return {
			baseUrl: this.llmConfigService.getDefaultBaseUrlHint(),
		};
	}

	@Put()
	update(@Body() dto: UpsertLlmConfigDto, @Req() req: Request) {
		const userId =
			typeof (req as Request & { user?: { userId?: number } }).user?.userId ===
			'number'
				? (req as Request & { user: { userId: number } }).user.userId
				: undefined;
		return this.llmConfigService.upsert(dto, userId);
	}

	@Delete()
	clear(@Req() req: Request) {
		const userId =
			typeof (req as Request & { user?: { userId?: number } }).user?.userId ===
			'number'
				? (req as Request & { user: { userId: number } }).user.userId
				: undefined;
		return this.llmConfigService.clear(userId);
	}
}
