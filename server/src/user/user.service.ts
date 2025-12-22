import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User) private readonly userRepository: Repository<User>,
	) {}

	async findAll(): Promise<User[]> {
		return this.userRepository.find();
	}

	async findOne(id: number): Promise<User | null> {
		return this.userRepository.findOne({ where: { id } });
	}

	async create(user: User): Promise<User> {
		const _user = await this.userRepository.create(user);
		return this.userRepository.save(_user);
	}

	async update(id: number, user: Partial<User>) {
		return this.userRepository.update(id, user);
	}

	async remove(id: number) {
		return this.userRepository.delete(id);
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
	// async findUserLogs(id: number) {
	// 	const user = await this.findOne(id);
	// 	return this.logsRepository.find({
	// 		where: { user },
	// 		relations: {
	// 			user: true,
	// 		},
	// 	});
	// }

	// findLogsByGroup(id: number) {
	// 	// SELECT logs.result, COUNT(logs.result) from logs, user WHERE user.id = logs.userId AND user.id = 2 GROUP BY logs.result;

	// 	// query 方法可以直接使用 SQL 语句查询
	// 	// return this.logsRepository.query(
	// 	// 	`SELECT logs.result, COUNT(logs.result) from logs, user WHERE user.id = logs.userId AND user.id = ${id} GROUP BY logs.result;`,
	// 	// );

	// 	// 使用 createQueryBuilder 方法可以创建查询构建器，使用 SQL 语句查询
	// 	return (
	// 		this.logsRepository
	// 			.createQueryBuilder('logs')
	// 			// .select('logs.result, COUNT(logs.result)')
	// 			.select('logs.result', 'result')
	// 			.addSelect('COUNT(logs.result)', 'count')
	// 			.where('logs.userId = :id', { id })
	// 			.groupBy('logs.result')
	//      .orderBy('count', 'DESC') // 根据 count 倒叙排列
	//      .addOrderBy('result', 'DESC') // 同时还根据 result 倒叙排列
	//      .offset(1) // 分页查询
	//      .limit(5) // 只查询 5 条数据
	// 			.getRawMany()
	// 	);
	// }
}
