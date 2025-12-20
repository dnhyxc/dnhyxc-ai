import {
	Controller,
	Get,
	Inject,
	type LoggerService,
	Post,
	// Logger,
	// HttpException,
	// HttpStatus,
	// NotFoundException,
	// UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PromptService } from './prompt.service';
import { ConfigEnum } from '../enum/config.enum';

@Controller('prompt')
export class PromptController {
	constructor(
		private promptService: PromptService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
		private readonly configService: ConfigService,
	) {
		logger.log('PromptController init');
	}
	@Get()
	getPrompt() {
		// const user = {
		// 	isAdmin: false,
		// };
		// if (!user.isAdmin) {
		// 	// 抛出对应的异常
		// 	// throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
		// 	throw new UnauthorizedException('用户没有权限');
		// }
		const db_host = this.configService.get(ConfigEnum.DB_HOST);
		const db_database = this.configService.get(ConfigEnum.DB_DATABASE);
		const test_db = this.configService.get(ConfigEnum.TEST_DB);

		this.logger.log(`DB_HOST--------${db_host}`);
		this.logger.log(`DB_DATABASE--------${db_database}`);
		this.logger.log(`test_db--------${test_db}`);

		// this.logger.log('getPrompt-log');
		// this.logger.warn('getPrompt-warn');
		// this.logger.error('getPrompt-error');
		// this.logger.debug('getPrompt-debug');
		// this.logger.verbose('getPrompt-verbose');
		return this.promptService.getPrompt();
	}
	@Post()
	addPrompt() {
		const prompt = { name: 'test', prompt: 'test prompt' };
		console.log(prompt, 'prompt');
		return this.promptService.addPrompt(prompt);
	}
}
