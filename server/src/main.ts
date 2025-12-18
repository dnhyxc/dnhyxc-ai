import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	// 设置全局前缀为 api
	app.setGlobalPrefix('api');
	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
