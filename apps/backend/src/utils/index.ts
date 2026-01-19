import * as fs from 'node:fs';
import * as dotenv from 'dotenv';

export * from './bcrypt';
export * from './common';
export * from './db.helper';

export const getEnv = (env: string): Record<string, unknown> => {
	if (fs.existsSync(env)) {
		return dotenv.parse(fs.readFileSync(env));
	}
	return {};
};

export const getEnvConfig = (): Record<string, any> => {
	const defaultConfig = getEnv('.env');
	const envConfig = getEnv(`.env.${process.env.NODE_ENV}`);
	const config = {
		...defaultConfig,
		...envConfig,
	};
	return config;
};

// 提取值（仅在符合格式时）
export const extractDuplicateValue = (errorMessage: string) => {
	const match = errorMessage.match(/Duplicate entry '([^']+)' for key/);
	return match ? `${match[1]} 重复` : null;
};
