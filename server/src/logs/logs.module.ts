import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { utilities, WinstonModule } from 'nest-winston';
import { LogEnum } from 'src/enum/config.enum';
import * as winston from 'winston';
// import { ConfigService } from '@nestjs/config';
// import { type ConfigService } from '@nestjs/config';
import { Console } from 'winston/lib/winston/transports';
import DailyRotateFile from 'winston-daily-rotate-file';
// import { LogEnum } from 'src/enum/config.enum';
// import 'winston-daily-rotate-file';

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

				const dailyTransports = new DailyRotateFile({
					level: 'warn',
					// TODO: 生产环境 dirname 指定一个专门存放日志的绝对路径，开发环境这里直接指定项目本地路径
					dirname: 'logs',
					filename: 'application-%DATE%.log',
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

				const dailyInfoTransports = new DailyRotateFile({
					level: configService.get(LogEnum.LOG_LEVEL),
					// TODO: 生产环境 dirname 指定一个专门存放日志的绝对路径，开发环境这里直接指定项目本地路径
					dirname: 'logs',
					filename: 'info-%DATE%.log',
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

				return {
					transports: [
						consoleTransports,
						...(configService.get(LogEnum.LOG_ON)
							? [dailyTransports, dailyInfoTransports]
							: []),
					],
					// transports: [consoleTransports, dailyTransports, dailyInfoTransports]
				};
			},
		}),
	],
})
export class LogsModule {}
