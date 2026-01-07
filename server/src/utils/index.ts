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

// 判断是否以指定格式开头
const isDuplicateEntryError = (errorMessage: string) => {
	// 使用正则精确匹配格式
	const pattern = /^Duplicate entry '([^']+)' for/;
	return pattern.test(errorMessage);
};

// 提取值（仅在符合格式时）
export const extractDuplicateValue = (errorMessage: string) => {
	if (!isDuplicateEntryError(errorMessage)) {
		return null; // 或 throw new Error("不是重复条目错误")
	}
	const match = errorMessage.match(/entry '([^']+)' for/);
	return match ? `数据库 ${match[1]} 已存在` : null;
};
