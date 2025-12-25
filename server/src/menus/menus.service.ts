import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { Menus } from './menus.entity';

@Injectable()
export class MenusService {
	constructor(
		@InjectRepository(Menus)
		private readonly menusRepository: Repository<Menus>,
	) {}

	create(createMenuDto: CreateMenuDto) {
		const menu = this.menusRepository.create(createMenuDto);
		return this.menusRepository.save(menu);
	}

	findAll() {
		return this.menusRepository.find();
	}

	findOne(id: number) {
		return this.menusRepository.findOne({ where: { id } });
	}

	async update(id: number, updateMenuDto: UpdateMenuDto) {
		const menu = await this.findOne(id);
		if (menu) {
			const newMenu = await this.menusRepository.merge(menu, updateMenuDto);
			return this.menusRepository.save(newMenu);
		} else {
			throw new NotFoundException('菜单不存在');
		}
	}

	delete(id: number) {
		return this.menusRepository.delete(id);
	}
}
