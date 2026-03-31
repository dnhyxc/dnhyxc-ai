import { Body, Controller, Post, UseInterceptors } from '@nestjs/common';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { SaveKnowledgeDto } from './dto/save-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
@UseInterceptors(ResponseInterceptor)
export class KnowledgeController {
	constructor(private readonly knowledgeService: KnowledgeService) {}

	@Post('save')
	async save(@Body() dto: SaveKnowledgeDto) {
		return this.knowledgeService.saveMarkdown(dto.title, dto.content);
	}
}
