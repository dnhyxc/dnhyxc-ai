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
	Req,
	UnauthorizedException,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtGuard } from 'src/guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { AssignKnowledgeCategoryDto } from './dto/assign-knowledge-category.dto';
import { CreateKnowledgeCategoryDto } from './dto/create-knowledge-category.dto';
import { DeleteKnowledgeTrashBatchDto } from './dto/delete-knowledge-trash-batch.dto';
import { QueryKnowledgeDto } from './dto/query-knowledge.dto';
import { QueryKnowledgeCategoriesSummaryDto } from './dto/query-knowledge-categories-summary.dto';
import { QueryKnowledgeTrashDto } from './dto/query-knowledge-trash.dto';
import { ReorderKnowledgeCategoriesDto } from './dto/reorder-knowledge-categories.dto';
import { SaveKnowledgeDto } from './dto/save-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { UpdateKnowledgeCategoryDto } from './dto/update-knowledge-category.dto';
import { UpdateKnowledgeVisibilityDto } from './dto/update-knowledge-visibility.dto';
import { KnowledgeService } from './knowledge.service';

type AuthedRequest = Request & { user?: { userId?: number } };

@Controller('knowledge')
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
@UseGuards(JwtGuard)
export class KnowledgeController {
	constructor(private readonly knowledgeService: KnowledgeService) {}

	private userId(req: AuthedRequest): number {
		const userId = req.user?.userId;
		if (userId == null) throw new UnauthorizedException('未登录');
		return userId;
	}

	@Post('save')
	async save(@Body() dto: SaveKnowledgeDto) {
		return this.knowledgeService.saveMarkdown(dto);
	}

	/** 本人条目 + 他人公开条目 */
	@Get('list')
	async list(@Req() req: AuthedRequest, @Query() query: QueryKnowledgeDto) {
		return this.knowledgeService.findPage(this.userId(req), query);
	}

	@Get('detail/:id')
	async one(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
		return this.knowledgeService.findOneById(this.userId(req), id);
	}

	@Put('update/:id')
	async update(@Req() req: AuthedRequest, @Body() dto: UpdateKnowledgeDto) {
		return this.knowledgeService.update(this.userId(req), dto);
	}

	/** 所有者设置知识文档是否公开 */
	@Put('visibility/:id')
	async setVisibility(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateKnowledgeVisibilityDto,
	) {
		return this.knowledgeService.setVisibility(this.userId(req), id, dto);
	}

	@Get('categories/summary')
	async categoriesSummary(
		@Req() req: AuthedRequest,
		@Query() query: QueryKnowledgeCategoriesSummaryDto,
	) {
		return this.knowledgeService.getCategoriesSummary(this.userId(req), query);
	}

	@Post('categories')
	async createCategory(
		@Req() req: AuthedRequest,
		@Body() dto: CreateKnowledgeCategoryDto,
	) {
		return this.knowledgeService.createCategory(this.userId(req), dto);
	}

	@Put('categories/reorder')
	async reorderCategories(
		@Req() req: AuthedRequest,
		@Body() dto: ReorderKnowledgeCategoriesDto,
	) {
		await this.knowledgeService.reorderCategories(this.userId(req), dto);
		return { ok: true };
	}

	@Put('categories/:id')
	async updateCategory(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateKnowledgeCategoryDto,
	) {
		return this.knowledgeService.updateCategory(this.userId(req), id, dto);
	}

	@Delete('categories/:id')
	async removeCategory(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.knowledgeService.removeCategory(this.userId(req), id);
		return { id };
	}

	@Put('item/:id/category')
	async assignItemCategory(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: AssignKnowledgeCategoryDto,
	) {
		return this.knowledgeService.assignItemCategory(
			this.userId(req),
			id,
			dto.categoryId ?? null,
		);
	}

	@Delete('delete/:id')
	async remove(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.knowledgeService.remove(this.userId(req), id);
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
