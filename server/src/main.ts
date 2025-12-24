import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'winston-daily-rotate-file';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AllExceptionFilter } from './filters/all-exception-filter';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {});
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

	// 全局守卫， 全局守卫有个弊端，无法使用 DI，即无法访问 userService，解决的方式是可以在 app.module.ts 中的 providers 中配置全局守卫
	// app.useGlobalGuards(new JwtGuard());

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
