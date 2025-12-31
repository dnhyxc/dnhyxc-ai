import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
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
	async createRole(@Body() createRoleDto: CreateRoleDto) {
		return this.rolesService.createRole(createRoleDto);
	}

	@Get('/getRoles')
	findAll() {
		return this.rolesService.findAll();
	}

	@Get('/getRoleById/:id')
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.rolesService.findOne(id);
	}

	@Post('/updateRole')
	/**
	 * 如果 guard 中使用 getAllAndOverride，这里会把上面全局的@Roles(Role.ADMIN)覆盖掉，以当前的为准。
	 * 使用 getAllAndMerge 则会与 Controller 上设置的 @Roles 进行合并
	 */
	@Roles(Role.ADMIN)
	async updateRole(@Body() dto: UpdateRoleDto) {
		return await this.rolesService.updateRole(dto.id, dto);
	}

	@Delete('/deleteRoleById/:id')
	async remove(@Param('id', ParseIntPipe) id: number) {
		return await this.rolesService.remove(id);
	}

	// @Post('/manager')
	// async manager(@Body() dto: any) {
	// 	this.rolesService.manager(dto);
	// }
}
