import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
} from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenusService } from './menus.service';

@Controller('menus')
export class MenusController {
	constructor(private readonly menusService: MenusService) {}

	@Post('/createMenu')
	create(@Body() createMenuDto: CreateMenuDto) {
		return this.menusService.create(createMenuDto);
	}

	@Get('/getMenus')
	findAll() {
		return this.menusService.findAll();
	}

	@Get('/getMenuById/:id')
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.menusService.findOne(id);
	}

	@Patch('/updateMenu/:id')
	update(
		@Param('id', ParseIntPipe) id: number,
		@Body() updateMenuDto: UpdateMenuDto,
	) {
		return this.menusService.update(id, updateMenuDto);
	}

	@Delete('/deleteMenuById/:id')
	delete(@Param('id', ParseIntPipe) id: number) {
		return this.menusService.delete(id);
	}
}
