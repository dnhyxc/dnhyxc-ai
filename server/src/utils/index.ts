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

// 从数据库唯一冲突中提取重复值
export const extractDuplicateValue = (errorMessage: string) => {
	// 多种匹配模式
	const patterns = [
		/entry '([^']+)' for/i, // MySQL 格式
		/duplicate key value "([^"]+)"/i, // PostgreSQL 格式
		/key '([^']+)' already exists/i, // SQLite 格式
		/value \(([^)]+)\) already exists/i, // 其他格式
	];

	for (const pattern of patterns) {
		const match = errorMessage.match(pattern);
		if (match?.[1]) {
			return match[1];
		}
	}

	// 备用方法：提取第一个单引号内的内容
	const quotesMatch = errorMessage.match(/'([^']+)'/);
	return quotesMatch ? quotesMatch[1] : null;
};
