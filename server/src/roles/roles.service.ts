import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from './roles.entity';

@Injectable()
export class RolesService {
	constructor(
		@InjectRepository(Roles)
		private readonly rolesRepository: Repository<Roles>,
	) {}

	async create(createRoleDto: CreateRoleDto) {
		const res = await this.rolesRepository.create(createRoleDto);
		return this.rolesRepository.save(res);
	}

	findAll() {
		return this.rolesRepository.find();
	}

	findOne(id: number) {
		return this.rolesRepository.findOne({ where: { id } });
	}

	async update(id: number, updateRoleDto: UpdateRoleDto) {
		const role = await this.findOne(id);
		if (role) {
			const newRole = this.rolesRepository.merge(role, updateRoleDto);
			return this.rolesRepository.save(newRole);
		} else {
			throw new NotFoundException('角色不存在');
		}
	}

	delete(id: number) {
		// delete 方法不会出发 user.entity.ts 中的 beforeRemove、afterRemove 等钩子
		return this.rolesRepository.delete(id);
	}
}
