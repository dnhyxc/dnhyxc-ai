import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	UseFilters,
	UseGuards,
} from '@nestjs/common';
import { TypeormFilter } from 'src/filters/typeorm.filter';
import { JwtGuard } from '../guards/jwt.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
// 添加 TypeormFilter 异常过滤器
@UseFilters(new TypeormFilter())
// 添加 JwtGuard 守卫
@UseGuards(JwtGuard)
export class RolesController {
	constructor(private readonly rolesService: RolesService) {}

	@Post('/createRole')
	create(@Body() createRoleDto: CreateRoleDto) {
		return this.rolesService.create(createRoleDto);
	}

	@Get('/getRoles')
	findAll() {
		return this.rolesService.findAll();
	}

	@Get('/getRoleById/:id')
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.rolesService.findOne(id);
	}

	@Patch('/updateRole/:id')
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body() updateRoleDto: UpdateRoleDto,
	) {
		const res = await this.rolesService.update(id, updateRoleDto);
		return {
			code: HttpStatus.OK,
			success: true,
			data: res,
			message: '更新成功',
		};
	}

	@Delete('/deleteRoleById/:id')
	async delete(@Param('id', ParseIntPipe) id: number) {
		const res = await this.rolesService.delete(id);
		if (res?.affected) {
			return {
				code: HttpStatus.OK,
				success: true,
				data: id,
				count: res.affected,
			};
		} else {
			return {
				code: HttpStatus.OK,
				success: false,
				message: '当前数据不存在',
			};
		}
	}
}
