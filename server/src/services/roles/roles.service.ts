import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Menus } from '../menus/menus.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from './roles.entity';

@Injectable()
export class RolesService {
	constructor(
		@InjectRepository(Roles)
		private readonly rolesRepository: Repository<Roles>,
		@InjectRepository(Menus)
		private readonly menusRepository: Repository<Menus>,
	) {}

	async createRole(dto: CreateRoleDto) {
		const { menuIds, name } = dto;
		// 查找所有菜单
		const menus = await this.menusRepository.findBy(
			menuIds?.length ? { id: In(menuIds) } : {},
		);

		// 创建角色并关联菜单
		const role = this.rolesRepository.create({
			name,
			menus,
		});

		return await this.rolesRepository.save(role);

		// const res = await this.rolesRepository.create(dto);
		// return this.rolesRepository.save(res);
	}

	findAll() {
		return this.rolesRepository.find();
	}

	findOne(id: number) {
		return this.rolesRepository.findOne({
			where: { id },
			relations: ['menus'],
		});
	}

	async updateRole(id: number, dto: UpdateRoleDto) {
		const role = await this.findOne(id);
		if (role) {
			if (dto?.menuIds?.length) {
				const menus = await this.menusRepository.findBy({
					id: In(dto.menuIds),
				});
				if (!menus.length) {
					throw new NotFoundException('菜单不存在');
				}
				role.menus = menus;
			}
			const newRole = this.rolesRepository.merge(role, dto);
			return this.rolesRepository.save(newRole);
		} else {
			throw new NotFoundException('角色不存在');
		}
	}

	async remove(id: number) {
		const role = await this.findOne(id);
		if (role) {
			// delete 方法不会出发 user.entity.ts 中的 beforeRemove、afterRemove 等钩子
			return this.rolesRepository.remove(role);
		} else {
			throw new NotFoundException('角色不存在');
		}
	}

	// transaction 事务，同时保证数据的同时性
	// async manager(dto: any) {
	// 	const from = { money: 100000, id: 1 };
	// 	const to = { money: 10000, id: 2 };
	// 	return this.rolesRepository.manager.transaction(async (entityManager) => {
	// 		entityManager.save(Roles, {
	// 			id: from.id,
	// 			money: from.money - dto.money,
	// 		});
	// 		entityManager.save(Roles, {
	// 			id: to.id,
	// 			money: to.money + dto.money,
	// 		});
	// 	});
	// }
}
