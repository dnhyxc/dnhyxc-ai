import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { sanitizeLogData } from './log-payload.util';
import { Logs } from './logs.entity';

export type CreateOpLogInput = {
	path: string;
	method: string;
	data?: unknown;
	responseData?: unknown;
	result: number;
	userId?: number | null;
};

@Injectable()
export class LogsService {
	private readonly logger = new Logger(LogsService.name);

	constructor(
		@InjectRepository(Logs)
		private readonly logsRepository: Repository<Logs>,
	) {}

	async create(input: CreateOpLogInput) {
		const log = this.logsRepository.create({
			path: input.path.slice(0, 255),
			method: input.method.slice(0, 255),
			data: sanitizeLogData(input.data),
			responseData: sanitizeLogData(input.responseData),
			result: input.result,
			user: input.userId ? ({ id: input.userId } as User) : null,
		});
		return this.logsRepository.save(log);
	}

	/** 不阻塞主请求；写库失败只打 warn */
	createSafe(input: CreateOpLogInput) {
		void this.create(input).catch((err: unknown) => {
			this.logger.warn(
				`操作日志写入失败: ${err instanceof Error ? err.message : String(err)}`,
			);
		});
	}
}
