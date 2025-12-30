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
	UseGuards,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../enum/roles.enum';
import { JwtGuard } from '../guards/jwt.guard';
import { RoleGuard } from '../guards/role.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
// 添加 JwtGuard 守卫
@Roles(Role.USER)
@UseGuards(JwtGuard, RoleGuard)
export class RolesController {
	constructor(private readonly rolesService: RolesService) {}

	@Post('/createRole')
	create(@Body() createRoleDto: CreateRoleDto) {
		return this.rolesService.create(createRoleDto);
	}

	@Get('/getRoles')
	@Roles(Role.ADMIN) // 这里会把上面全局的@Roles(Role.ADMIN)覆盖掉，以当前的为准
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
