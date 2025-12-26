import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'winston-daily-rotate-file';
import { ValidationPipe } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AllExceptionFilter } from './filters/all-exception-filter';

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		// 允许跨域
		cors: true,
	});
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
			// 这里会对前端传递过来的没有在 DTO 中定义的字段全部过滤掉，生产要开启
			whitelist: process.env.NODE_ENV !== 'development',
		}),
	);

	// 全局守卫， 全局守卫有个弊端，无法使用 DI，即无法访问 userService，解决的方式是可以在 app.module.ts 中的 providers 中配置全局守卫
	// app.useGlobalGuards(new JwtGuard());

	// 配置 helmet 头部安全
	app.use(helmet());

	// 配置 rateLimit 中间件，限制请求次数
	app.use(
		rateLimit({
			windowMs: 1 * 60 * 1000, // 1 minutes
			max: 300, // limit each IP to 300 requests per windowMs
		}),
	);

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
