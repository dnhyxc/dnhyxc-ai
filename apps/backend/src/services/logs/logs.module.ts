import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { utilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { Console } from 'winston/lib/winston/transports';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LogEnum } from '../../enum/config.enum';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

const createDailyRotateTransport = (
	level: string,
	fileName: string,
): DailyRotateFile => {
	return new DailyRotateFile({
		level,
		// TODO: 生产环境 dirname 指定一个专门存放日志的绝对路径，开发环境这里直接指定项目本地路径
		dirname: 'logs',
		filename: `${fileName}-%DATE%.log`,
		datePattern: 'YYYY-MM-DD-HH',
		zippedArchive: true,
		maxSize: '20m',
		maxFiles: '14d',
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.simple(),
			// utilities.format.nestLike(),
		),
	});
};

@Module({
	imports: [
		WinstonModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const consoleTransports = new Console({
					level: 'info',
					format: winston.format.combine(
						winston.format.timestamp(),
						utilities.format.nestLike(),
					),
				});

				return {
					transports: [
						consoleTransports,
						...(configService.get(LogEnum.LOG_ON)
							? [
									createDailyRotateTransport('info', 'application'),
									createDailyRotateTransport('warn', 'error'),
								]
							: []),
					],
				};
			},
		}),
	],
	controllers: [LogsController],
	providers: [LogsService],
})
export class LogsModule {}
