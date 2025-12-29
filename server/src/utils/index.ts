import * as fs from 'node:fs';
import * as dotenv from 'dotenv';

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
