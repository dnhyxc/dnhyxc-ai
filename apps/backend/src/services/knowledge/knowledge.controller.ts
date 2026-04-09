import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { DeleteKnowledgeTrashBatchDto } from './dto/delete-knowledge-trash-batch.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { QueryKnowledgeTrashDto } from './dto/query-knowledge-trash.dto';
import { SaveKnowledgeDto } from './dto/save-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('knowledge')
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
@UseGuards(JwtGuard)
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

	// ---------------- 回收站 ----------------

	@Get('trash/list')
	async trashList(@Query() query: QueryKnowledgeTrashDto) {
		return this.knowledgeService.findTrashPage(query);
	}

	@Get('trash/detail/:id')
	async trashOne(@Param('id', ParseUUIDPipe) id: string) {
		return this.knowledgeService.findTrashOneById(id);
	}

	@Delete('trash/delete/:id')
	async trashRemove(@Param('id', ParseUUIDPipe) id: string) {
		await this.knowledgeService.removeTrash(id);
		return { id };
	}

	@Post('trash/delete-batch')
	async trashRemoveBatch(@Body() dto: DeleteKnowledgeTrashBatchDto) {
		return this.knowledgeService.removeTrashBatch(dto.ids);
	}
}
