import * as fs from 'node:fs';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigEnum } from './src/enum/config.enum';

const entitiesDir =
	process.env.NODE_ENV === 'test'
		? [`${__dirname}/**/*.entity.ts`]
		: [`${__dirname}/**/*.entity.{ts,js}`];

export const getEnv = (env: string): Record<string, unknown> => {
	if (fs.existsSync(env)) {
		return dotenv.parse(fs.readFileSync(env));
	}
	return {};
};

export const buildConnectionOptions = () => {
	const defaultConfig = getEnv('.env');
	const envConfig = getEnv(`.env.${process.env.NODE_ENV}`);
	const config = {
		...defaultConfig,
		...envConfig,
	};
	return {
		type: config[ConfigEnum.DB_TYPE],
		host: config[ConfigEnum.DB_HOST],
		port: config[ConfigEnum.DB_PORT],
		username: config[ConfigEnum.DB_USERNAME],
		password: config[ConfigEnum.DB_PASSWORD],
		database: config[ConfigEnum.DB_DATABASE],
		entities: entitiesDir,
		synchronize: config[ConfigEnum.DB_SYNC],
		// 开发环境设置为 true，开启 SQL 语句日志，即所有的 SQL 语句都会打印日志，便于开发调试
		logging: false,
		// logging: process.env.NODE_ENV === 'development',
		// logging: ['error'],
	} as TypeOrmModuleOptions;
};

export const connectionOptions: TypeOrmModuleOptions = buildConnectionOptions();

export default new DataSource({
	...connectionOptions,
	migrations: ['src/migrations/**'],
	subscribers: [],
} as DataSourceOptions);
