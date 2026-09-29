import { createKeyv } from '@keyv/redis';
import { CacheModuleOptions, CacheOptionsFactory } from '@nestjs/cache-manager';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisEnum } from '../enum/config.enum';

/**
 * 仅供词库 getSafe / TTS cacheOp 等「单次 await 旁路」用，不改变 Keyv 连接参数。
 * 验证码等仍走原 Cache 连接语义。
 */
export const CACHE_COMMAND_TIMEOUT_MS = 1500;

@Injectable()
export class RedisConfigFactory implements CacheOptionsFactory {
	constructor(private readonly configService: ConfigService) {}

	async createCacheOptions() {
		const store = createKeyv({
			url: this.configService.get<string>(RedisEnum.REDIS_URL),
			password: this.configService.get<string>(RedisEnum.REDIS_PASSWORD),
			username: this.configService.get<string>(RedisEnum.REDIS_USERNAME),
			socket: {
				connectTimeout: 5000,
				keepAlive: true, // 启用 TCP Keep-Alive
				// 初始发送 Keep-Alive 探测包的延迟（毫秒），建议设为比中间设备超时时间短一点
				keepAliveInitialDelay: 30000, // 30秒
				reconnectStrategy: (times: number) => {
					if (times > 5) {
						return new Error('停止重试');
					}
					return Math.min(times * 100, 3000) + Math.random() * 500;
				},
			},
		});

		// 监听错误事件
		store.on('error', (err) => {
			console.error('Keyv Store Error:', err.message);
		});

		return {
			store,
			// ttl（time-to-live）表示缓存项的存活时间，单位毫秒。这里设置为 120000 毫秒（120 秒），
			// 意味着写入缓存的数据默认在 5 秒后过期并被自动清除，防止脏数据长期残留。
			ttl: 120000,
		} as CacheModuleOptions;
	}
}
