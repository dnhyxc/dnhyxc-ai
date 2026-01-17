import * as dotenv from 'dotenv';
import * as Joi from 'joi';

/**
 * 获取环境文件路径
 */
const getEnvFilePath = () => {
	return `.env.${process.env.NODE_ENV || 'development'}`;
};

/**
 * 应用配置
 */
export const appConfig = () => ({
	// 全局注册配置模块
	isGlobal: true,
	// 配置加载的 env 文件路径
	envFilePath: getEnvFilePath(),
	// 自动合并 .env、.env.development、.env.production 文件
	load: [() => dotenv.config({ path: '.env' })],
	validationSchema: Joi.object({
		// 使用 Joi 验证环境变量中的NODE_ENV
		NODE_ENV: Joi.string()
			.valid('development', 'production', 'test')
			.default('development'),
		// 数据库配置验证
		DB_PORT: Joi.number().default(3090),
		DB_HOST: Joi.alternatives().try(Joi.string().ip(), Joi.string().domain()),
		DB_TYPE: Joi.string().valid('mysql', 'postgres'),
		DB_USERNAME: Joi.string().required(),
		DB_PASSWORD: Joi.string().required(),
		DB_DATABASE: Joi.string().required(),
		DB_SYNC: Joi.boolean().default(false),
		// 日志配置
		LOG_LEVEL: Joi.string(),
		LOG_ON: Joi.boolean(),
		// Redis配置验证（可选）
		REDIS_URL: Joi.string().uri(),
		REDIS_PASSWORD: Joi.string(),
		REDIS_USERNAME: Joi.string(),
	}),
});

/**
 * 默认导出配置函数
 */
export default appConfig;
