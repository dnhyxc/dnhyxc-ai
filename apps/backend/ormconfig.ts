import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigEnum } from './src/enum/config.enum';
import { getEnvConfig } from './src/utils';

const entitiesDir =
	process.env.NODE_ENV === 'test'
		? [`${__dirname}/**/*.entity.ts`]
		: [`${__dirname}/**/*.entity.{ts,js}`];

const config = getEnvConfig();

export const typeOrmConfig = {
	type: config[ConfigEnum.DB_TYPE],
	port: config[ConfigEnum.DB_PORT],
	host: config[ConfigEnum.DB_HOST],
	username: config[ConfigEnum.DB_USERNAME],
	password: config[ConfigEnum.DB_PASSWORD],
	database: config[ConfigEnum.DB_DATABASE],
	entities: entitiesDir, // 通过便利查找所有的 entity.ts 中的实体，设置到数据库中。使用 autoLoadEntities 更加便捷
	synchronize: config[ConfigEnum.DB_SYNC] === 'true', // 首次使用 true，表示自动将实体类同步到数据库
	// 开发环境设置为 true，开启 SQL 语句日志，即所有的 SQL 语句都会打印日志，便于开发调试
	logging: false,
	// logging: process.env.NODE_ENV === 'development',
	// logging: ['error'],
};

// 默认数据库
export const buildConnectionOptions = () => {
	return {
		...typeOrmConfig,
		// logging: process.env.NODE_ENV === 'development',
		// logging: ['error'],
	} as TypeOrmModuleOptions;
};

// 默认数据库
export const connectionOptions: TypeOrmModuleOptions = buildConnectionOptions();

// 这里是为了对接 typeorm 的数据源，方便使用 typeorm 的 cli 命令
export default new DataSource({
	...connectionOptions,
	migrations: ['src/migrations/**'],
	subscribers: [],
} as DataSourceOptions);
