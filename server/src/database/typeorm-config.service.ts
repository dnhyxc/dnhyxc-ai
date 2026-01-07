import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import type { Request } from 'express';
import { typeOrmConfig } from '../../ormconfig';
import { ConfigEnum } from '../enum/config.enum';

export class TypeOrmConfigService implements TypeOrmOptionsFactory {
	constructor(
		@Inject(REQUEST) private readonly request: Request,
		private configService: ConfigService,
	) {}
	createTypeOrmOptions(
		_connectionOptions?: string,
	): TypeOrmModuleOptions | Promise<TypeOrmModuleOptions> {
		const { version = '' } = this.request.query;
		const body = this.request.body;

		const envConfig = {
			...typeOrmConfig,
			entities: [`${__dirname}/../**/*.entity{.ts,.js}`],
			// 额外参数
			version: version || body?.version || 'default',
		};

		let config = {
			port: this.configService.get(ConfigEnum.DB_PORT),
			synchronize: this.configService.get(ConfigEnum.DB_SYNC) === 'true',
		};

		if (version === 'v1' || body?.version === 'v1') {
			config = {
				port: this.configService.get(ConfigEnum.DB_DB1_PORT),
				synchronize: this.configService.get(ConfigEnum.DB_DB1_SYNC) === 'true',
			};
		} else {
			config = {
				port: this.configService.get(ConfigEnum.DB_PORT),
				synchronize: this.configService.get(ConfigEnum.DB_SYNC) === 'true',
			};
		}

		return Object.assign(envConfig, config);
	}
}
