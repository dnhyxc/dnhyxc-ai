import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigEnum } from './src/enum/config.enum';
import { getEnvConfig } from './src/utils';

const entitiesDir =
	process.env.NODE_ENV === 'test'
		? [`${__dirname}/**/*.entity.ts`]
		: [`${__dirname}/**/*.entity.{ts,js}`];

const config = getEnvConfig();

const defaultConnectionOptions: TypeOrmModuleOptions = {
	type: config[ConfigEnum.DB_TYPE],
	// port: config[ConfigEnum.DB_PORT],
	username: config[ConfigEnum.DB_USERNAME],
	password: config[ConfigEnum.DB_PASSWORD],
	database: config[ConfigEnum.DB_DATABASE],
	entities: entitiesDir, // 通过便利查找所有的 entity.ts 中的实体，设置到数据库中。使用 autoLoadEntities 更加便捷
	// autoLoadEntities: true, // 自动加载实体 forFeature() 方法注册的每个实体都将自动添加到配置对象的实体中，即自动给数据库添加实体
	synchronize: config[ConfigEnum.DB_SYNC], // 首次使用 true，表示自动将实体类同步到数据库
	// 开发环境设置为 true，开启 SQL 语句日志，即所有的 SQL 语句都会打印日志，便于开发调试
	logging: false,
	// logging: process.env.NODE_ENV === 'development',
	// logging: ['error'],
};

// 默认数据库
export const buildConnectionOptions = () => {
	return {
		...defaultConnectionOptions,
		port: config[ConfigEnum.DB_PORT],
	} as TypeOrmModuleOptions;
};

// 备用数据库
export const buildDB1ConnectionOptions = () => {
	return {
		...defaultConnectionOptions,
		name: config[ConfigEnum.DB_DB1_NAME],
		port: config[ConfigEnum.DB_DB1_PORT],
	} as TypeOrmModuleOptions;
};

// 默认数据库
export const connectionOptions: TypeOrmModuleOptions = buildConnectionOptions();

// 备用数据库
export const db1ConnectionOptions: TypeOrmModuleOptions =
	buildDB1ConnectionOptions();

// 这里是为了对接 typeorm 的数据源，方便使用 typeorm 的 cli 命令
export default new DataSource({
	...connectionOptions,
	migrations: ['src/migrations/**'],
	subscribers: [],
} as DataSourceOptions);
