import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { Prompt } from './prompt.entity';

@Injectable()
export class PromptService {
	constructor(
		// 注入数据库模型，便于操作数据库
		@InjectRepository(Prompt)
		private readonly promptRepository: Repository<Prompt>,
	) {}

	create(_createPromptDto: CreatePromptDto) {
		return 'This action adds a new prompt';
	}

	findAll() {
		const res = this.promptRepository.find();
		return res;
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
