import {
	Body,
	Controller,
	Delete,
	Get,
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
	update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
		return this.rolesService.update(+id, updateRoleDto);
	}

	@Delete('/deleteRoleById/:id')
	delete(@Param('id') id: string) {
		return this.rolesService.delete(+id);
	}
}
