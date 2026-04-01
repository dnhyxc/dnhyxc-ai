import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	UseInterceptors,
} from '@nestjs/common';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { SaveKnowledgeDto } from './dto/save-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
@UseInterceptors(ResponseInterceptor)
export class KnowledgeController {
	constructor(private readonly knowledgeService: KnowledgeService) {}

	@Post('save')
	async save(@Body() dto: SaveKnowledgeDto) {
		return this.knowledgeService.saveMarkdown(dto);
	}

	@Get('list')
	async list(@Query() query: QueryKnowledgeDto) {
		return this.knowledgeService.findPage(query);
	}

	@Get('detail/:id')
	async one(@Param('id', ParseUUIDPipe) id: string) {
		return this.knowledgeService.findOneById(id);
	}

	@Put('update/:id')
	async update(@Body() dto: UpdateKnowledgeDto) {
		return this.knowledgeService.update(dto);
	}

	@Delete('delete/:id')
	async remove(@Param('id', ParseUUIDPipe) id: string) {
		await this.knowledgeService.remove(id);
		return { id };
	}
}
