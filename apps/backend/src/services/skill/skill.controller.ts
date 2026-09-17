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
import { BindSkillTrySessionDto } from './dto/bind-skill-try-session.dto';
import { CreateSkillTrySessionDto } from './dto/create-skill-try-session.dto';
import { SaveSkillDto } from './dto/save-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { SkillService } from './skill.service';

type AuthedRequest = Request & { user?: { userId?: number } };

@Controller('skill')
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
@UseGuards(JwtGuard)
export class SkillController {
	constructor(private readonly skillService: SkillService) {}

	private userId(req: AuthedRequest): number {
		const userId = req.user?.userId;
		if (userId == null) throw new UnauthorizedException('未登录');
		return userId;
	}

	@Post('save')
	async save(@Req() req: AuthedRequest, @Body() dto: SaveSkillDto) {
		return this.skillService.create(this.userId(req), dto);
	}

	@Get('list')
	async list(@Req() req: AuthedRequest) {
		return this.skillService.listMine(this.userId(req));
	}

	/** 按 kind + skillId 列出侧栏历史（须在 detail/:id 前） */
	@Get('sessions')
	async listTrySessions(
		@Req() req: AuthedRequest,
		@Query('skillId') skillId?: string,
		@Query('kind') kind?: string,
		@Query('pageNo') pageNo?: string,
		@Query('pageSize') pageSize?: string,
	) {
		const pn = Math.max(1, parseInt(pageNo ?? '1', 10) || 1);
		const ps = Math.min(50, Math.max(1, parseInt(pageSize ?? '20', 10) || 20));
		const data = await this.skillService.listTrySessions(this.userId(req), {
			skillId,
			kind: kind === 'generate' ? 'generate' : 'try',
			pageNo: pn,
			pageSize: ps,
		});
		return {
			...data,
			list: data.list.map((row) => ({
				...row,
				createdAt: row.createdAt.toISOString(),
				updatedAt: row.updatedAt.toISOString(),
			})),
		};
	}

	@Post('session')
	async createTrySession(
		@Req() req: AuthedRequest,
		@Body() dto: CreateSkillTrySessionDto,
	) {
		return this.skillService.createTrySession(this.userId(req), dto);
	}

	/** 草稿生成会话绑定到已保存 Skill */
	@Put('session/:id/skill')
	async bindTrySessionSkill(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: BindSkillTrySessionDto,
	) {
		return this.skillService.bindTrySessionSkill(
			this.userId(req),
			id,
			dto.skillId,
		);
	}

	@Get('detail/:id')
	async one(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
		return this.skillService.findOneMine(this.userId(req), id);
	}

	@Put('update/:id')
	async update(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateSkillDto,
	) {
		return this.skillService.update(this.userId(req), { ...dto, id });
	}

	@Delete('delete/:id')
	async remove(
		@Req() req: AuthedRequest,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		await this.skillService.remove(this.userId(req), id);
		return { ok: true };
	}
}
