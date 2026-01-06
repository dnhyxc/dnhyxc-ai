import { Inject, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * 应用服务类，负责在应用关闭时优雅地销毁所有 TypeORM 数据库连接。
 * 通过实现 OnApplicationShutdown 接口，NestJS 会在应用关闭时自动调用 onApplicationShutdown 方法。
 */
export class AppService implements OnApplicationShutdown {
	constructor(
		// 使用自定义注入令牌 'TYPEORM_CONNECTIONS' 注入一个 Map，其中键为连接名称，值为对应的 TypeORM DataSource 实例
		@Inject('TYPEORM_CONNECTIONS') private connections: Map<string, DataSource>,
	) {}

	/**
	 * 应用关闭时的生命周期钩子。
	 * 遍历所有已注入的数据库连接，并调用其 destroy 方法以释放资源。
	 */
	onApplicationShutdown() {
		// 如果连接 Map 非空，则逐个销毁
		if (this.connections.size > 0) {
			for (const key of this.connections.keys()) {
				// 使用可选链安全地调用 destroy 方法，防止连接未定义或没有 destroy 方法
				this.connections.get(key)?.destroy?.();
			}
		}
	}
}
