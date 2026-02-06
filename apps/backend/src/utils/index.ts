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

// 处理中文文件名编码问题
export const decodeChineseFilename = (filename: string) => {
	// 尝试解码，如果文件名看起来是乱码（包含%或其他编码字符）
	if (filename && /%[0-9A-F]{2}/i.test(filename)) {
		try {
			filename = decodeURIComponent(filename);
		} catch {
			// 解码失败，保持原样
		}
	}
	// 如果文件名看起来是 latin1 编码的中文，尝试转换
	if (filename && /[\x80-\xFF]/.test(filename)) {
		try {
			const buffer = Buffer.from(filename, 'binary');
			filename = buffer.toString('utf8');
		} catch {
			// 转换失败，保持原样
		}
	}
	return filename;
};
