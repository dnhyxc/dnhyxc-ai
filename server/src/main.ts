import { HttpAdapterHost, NestFactory } from '@nestjs/core';
// import { NestFactory } from '@nestjs/core';
// import { createLogger, format } from 'winston';
// import * as winston from 'winston';
// import { WinstonModule, utilities } from 'nest-winston';
import { AppModule } from './app.module';
import 'winston-daily-rotate-file';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
// import { HttpExceptionFilter } from './filters/http-exception.filter';
import { AllExceptionFilter } from './filters/all-exception-filter';

// const { prettyPrint, label, timestamp, combine } = format;

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {});
	// const app = await NestFactory.create(AppModule, {
	// 	logger,
	// });
	// 设置全局前缀为 api
	app.setGlobalPrefix('api');
	const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
	app.useLogger(logger);
	const httpAdapter = app.get(HttpAdapterHost);
	// 全局的错误处理中间件，注意：全局的 Filter 只能有一个
	app.useGlobalFilters(new AllExceptionFilter(logger, httpAdapter));

	// 配置全局拦截器
	app.useGlobalPipes(
		new ValidationPipe({
			// 自动删除在类上不存在的字段，保证数据库插入数据的安全性
			// whitelist: true,
		}),
	);

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
