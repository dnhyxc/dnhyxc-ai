import { ConfigService } from '@nestjs/config';
import { RedisEnum } from '../enum/config.enum';

/**
 * BullMQ / QueueEvents 共用的 Redis 连接选项。
 * 不显式设置 commandTimeout：BullMQ 依赖 XREAD BLOCK、BZPOPMIN 等阻塞命令，
 * ioredis 的 commandTimeout 会作用于整条命令等待时间，易在阻塞读正常等待时误判为超时并刷屏。
 */
export function createBullRedisConnectionOptions(configService: ConfigService) {
	return {
		host: configService.get<string>(RedisEnum.REDIS_HOST) ?? 'localhost',
		port: configService.get<number>(RedisEnum.REDIS_PORT) ?? 6379,
		username: configService.get<string>(RedisEnum.REDIS_USERNAME),
		password: configService.get<string>(RedisEnum.REDIS_PASSWORD),
		connectTimeout: 5000,
		socket: {
			keepAlive: true,
			keepAliveInitialDelay: 30000,
		},
		retryStrategy: (times: number) => {
			if (times > 5) {
				return null;
			}
			return Math.min(times * 100, 3000) + Math.random() * 500;
		},
		enableOfflineQueue: true,
		enableReadyCheck: true,
		reconnectOnError: (err: Error) => {
			const targetErrors = [
				'READONLY',
				'ECONNRESET',
				'ECONNREFUSED',
				'ETIMEDOUT',
			];
			return targetErrors.some((e) => err.message.includes(e));
		},
	};
}
