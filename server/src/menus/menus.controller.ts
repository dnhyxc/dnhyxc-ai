import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
} from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenusService } from './menus.service';

@Controller('menus')
export class MenusController {
	constructor(private readonly menusService: MenusService) {}

	@Post()
	create(@Body() createMenuDto: CreateMenuDto) {
		return this.menusService.create(createMenuDto);
	}

	@Get()
	findAll() {
		return this.menusService.findAll();
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.menusService.findOne(+id);
	}

	@Patch(':id')
	update(@Param('id') id: string, @Body() updateMenuDto: UpdateMenuDto) {
		return this.menusService.update(+id, updateMenuDto);
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.menusService.remove(+id);
	}
}
