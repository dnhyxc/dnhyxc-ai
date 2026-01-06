import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { Prompt } from './prompt.entity';

@Injectable()
export class PromptService {
	constructor(
		// 注入数据库模型，便于操作数据库
		@InjectRepository(Prompt)
		// @InjectRepository(Prompt, config[ConfigEnum.DB_DB1_NAME])
		private readonly promptRepository: Repository<Prompt>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
	) {}

	create(_createPromptDto: CreatePromptDto) {
		const prompt = this.promptRepository.create(_createPromptDto);
		return this.promptRepository.save(prompt);
	}

	async findAll() {
		const res = await this.promptRepository.find();
		const users = await this.userRepository.find();
		return {
			prompt: res,
			users,
		};
	}

	findOne(id: number) {
		return `This action returns a #${id} prompt`;
	}

	update(id: number, _updatePromptDto: UpdatePromptDto) {
		return `This action updates a #${id} prompt`;
	}

	remove(id: number) {
		return `This action removes a #${id} prompt`;
	}
}
