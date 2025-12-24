import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { In, Repository } from 'typeorm';
import { Logs } from '../logs/logs.entity';
import { Roles } from '../roles/roles.entity';
import { andWhereCondition } from '../utils/db.helper';
import { GetUserDto } from './dto/get-user.dto';
import { User } from './user.entity';

@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User) private readonly userRepository: Repository<User>,
		@InjectRepository(Roles)
		private readonly rolesRepository: Repository<Roles>,
		@InjectRepository(Logs)
		private readonly logsRepository: Repository<Logs>,
	) {}

	async findAll(query: GetUserDto): Promise<User[]> {
		const { limit, page, username, role, gender } = query;
		const take = limit || 10;
		const skip = ((page || 1) - 1) * take;
		// SQL 语句联合查询写法一
		// SELECT * FROM user u, profile p, role r WHERE u.id = p.user_id AND u.id = r.user_id AND ...
		// SQL 语句联合查询写法二
		// SELECT * FROM user u LEFT JOIN profile p ON u.id = p.user_id LEFT JOIN role r ON u.id = r.user_id WHERE ...
		// 使用 TypeORM 提供的语法进行联合查询
		// return this.userRepository.find({
		// 	// 表示需要返回的数据字段，不加 select 的话，默认返回所有字段
		// 	select: {
		// 		id: true,
		// 		username: true,
		// 		profile: {
		// 			gender: true,
		// 		},
		// 	},
		// 	// 表示需要联合查询的表，写法一
		// 	// relations: ['profile', 'roles'],
		// 	// 联合查询的表，写法二
		// 	relations: {
		// 		profile: true,
		// 		roles: true,
		// 	},
		// 	where: {
		// 		username,
		// 		roles: role
		// 			? {
		// 					id: Number(role),
		// 				}
		// 			: {},
		// 		profile: {
		// 			gender,
		// 		},
		// 	},
		// 	take,
		// 	skip,
		// 	order: {
		// 		id: 'DESC',
		// 	},
		// });

		// 使用 queryBuilder 查询
		const obj = {
			'user.username': username,
			'profile.gender': gender,
			'roles.id': role,
		};

		const _query = this.userRepository
			.createQueryBuilder('user')
			.leftJoinAndSelect('user.profile', 'profile')
			.leftJoinAndSelect('user.roles', 'roles');

		const newQuery = andWhereCondition<User>(_query, obj);

		return newQuery.take(take).skip(skip).getMany(); // getRawMany() 会将数据进行扁平话
	}

	findByUsername(username: string): Promise<User | null> {
		return this.userRepository.findOne({
			where: { username },
			// 同时查询出 roles
			relations: ['roles'],
		});
	}

	findOne(id: number): Promise<User | null> {
		return this.userRepository.findOne({ where: { id } });
	}

	async create(user: Partial<User>): Promise<User> {
		if (!user.roles) {
			// 如果用户没有传 roles，默认给用户设置普通用户的角色权限
			const role = await this.rolesRepository.findOne({ where: { id: 2 } });
			if (role) {
				user.roles = [role];
			}
		}
		if (Array.isArray(user.roles) && typeof user.roles[0] === 'number') {
			// 查询所有的用户角色
			user.roles = await this.rolesRepository.find({
				where: {
					id: In(user.roles),
				},
			});
		}
		const _user = await this.userRepository.create(user);
		// 使用 argon2 对用户密码进行加密
		_user.password = await argon2.hash(_user.password);
		return this.userRepository.save(_user);
	}

	async update(id: number, user: Partial<User>) {
		const _user = await this.findProfile(id);
		if (!_user) return null;
		const newUser = await this.userRepository.merge(_user, user);
		return this.userRepository.save(newUser);
		// 这种直接更新的操作只适合单模型的更新，不适合有联合关系的模型更新
		// return this.userRepository.update(id, user);
	}

	async remove(id: string): Promise<User | null> {
		const user = await this.findOne(Number(id));
		if (user) {
			// remove 方法会触发 user.entity.ts 中的 afterRemove 钩子，delete 方法不会
			return this.userRepository.remove(user);
		} else {
			return null;
		}
	}

	// 查询相关联的 profile
	findProfile(id: number) {
		return this.userRepository.findOne({
			where: { id },
			relations: {
				profile: true,
			},
		});
	}

	// 查询 logs
	async findUserLogs(id: number) {
		const user = await this.findOne(id);
		if (user) {
			return this.logsRepository.find({
				where: { user },
				relations: {
					user: true,
				},
			});
		} else {
			return {
				code: 200,
				success: true,
				message: '用户不存在',
			};
		}
	}

	findLogsByGroup(id: number) {
		// SELECT logs.result, COUNT(logs.result) from logs, user WHERE user.id = logs.userId AND user.id = 2 GROUP BY logs.result;

		// query 方法可以直接使用 SQL 语句查询
		// return this.logsRepository.query(
		// 	`SELECT logs.result, COUNT(logs.result) from logs, user WHERE user.id = logs.userId AND user.id = ${id} GROUP BY logs.result;`,
		// );

		// 使用 createQueryBuilder 方法可以创建查询构建器，使用 SQL 语句查询
		return (
			this.logsRepository
				.createQueryBuilder('logs')
				// .select('logs.result, COUNT(logs.result)')
				.select('logs.result', 'result')
				.addSelect('COUNT(logs.result)', 'count')
				.where('logs.userId = :id', { id })
				.groupBy('logs.result')
				.orderBy('count', 'DESC') // 根据 count 倒叙排列
				.addOrderBy('result', 'DESC') // 同时还根据 result 倒叙排列
				.offset(1) // 分页查询
				.limit(5) // 只查询 5 条数据
				.getRawMany()
		);
	}
}
