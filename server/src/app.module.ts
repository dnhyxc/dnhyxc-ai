import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import * as Joi from 'joi';
import { ConfigEnum } from './enum/config.enum';
import { LogsModule } from './logs/logs.module';
import { PromptModule } from './prompt/prompt.module';
import { User } from './user/user.entity';
import { UserModule } from './user/user.module';

const envFilePath = `.env.${process.env.NODE_ENV || 'development'}`;

// 将 exports 中的模块注册为全局模块，在所有其他模块中都可以使用
@Global()
@Module({
	imports: [
		PromptModule,
		LogsModule,
		ConfigModule.forRoot({
			// 全局注册配置模块，这样就不需要在每个模块的 @Module 中都使用 ConfigModule.forRoot() 注册过后才能使用
			isGlobal: true,
			// 配置加载的 env 文件路径
			envFilePath,
			// 自动合并 .env、.env.development、.env.production 文件
			load: [() => dotenv.config({ path: '.env' })],
			// TODO: Joi 配置未生效，后续完善
			validationSchema: Joi.object({
				// 使用 Joi 验证环境变量中的DB_PORT
				NODE_ENV: Joi.string()
					.valid('development', 'production')
					.default('development'),
				DB_PORT: Joi.number().default(3090),
				DB_HOST: Joi.string().ip(),
				DB_TYPE: Joi.string().valid('mysql', 'postgres'),
				DB_USERNAME: Joi.string().required(),
				DB_PASSWORD: Joi.string().required(),
				DB_DATABASE: Joi.string().required(),
				DB_SYNC: Joi.boolean().default(false),
			}),
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) =>
				({
					type: configService.get(ConfigEnum.DB_TYPE),
					host: configService.get(ConfigEnum.DB_HOST),
					port: configService.get(ConfigEnum.DB_PORT),
					username: configService.get(ConfigEnum.DB_USERNAME),
					password: configService.get(ConfigEnum.DB_PASSWORD),
					database: configService.get(ConfigEnum.DB_DATABASE),
					entities: [User],
					synchronize: configService.get(ConfigEnum.DB_SYNC),
					logging: ['error'],
				}) as TypeOrmModuleOptions,
		}),
		UserModule,
		// TypeOrmModule.forRoot({
		// 	type: 'mysql',
		// 	host: 'localhost',
		// 	port: 3090, // 这里必须在 docker-compose.yml 中的 db - ports 中暴露出来才能正常链接数据库
		// 	username: 'root',
		// 	password: 'example',
		// 	database: 'testdb',
		// 	entities: [],
		// 	// 同步本地的 schema 与数据库 -> 初始化的时候使用
		// 	synchronize: true,
		// 	logging: ['error'],
		// }),
	],
	controllers: [],
	providers: [Logger],
	exports: [Logger],
})
export class AppModule {}
