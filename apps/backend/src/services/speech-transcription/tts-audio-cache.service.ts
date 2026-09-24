import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisEnum } from '../../enum/config.enum';
import { TtsCacheEnum } from '../../enum/tts-cache.enum';

export type TtsCacheMetrics = {
	l1_hit: number;
	l2_hit: number;
	l2_miss: number;
	l2_timeout: number;
	vendor_call: number;
	set_skip_size: number;
	set_skip_quota: number;
	set_ok: number;
	circuit_open: number;
};

type CircuitState = 'closed' | 'open' | 'half';

/**
 * TTS 音频 L2：独立 ioredis 存原始 bytes。
 * 一律 SETEX 固定 TTL；超时/熔断当 miss；禁止 CacheManager。
 */
@Injectable()
export class TtsAudioCacheService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(TtsAudioCacheService.name);
	private redis: Redis | null = null;
	private enabled = false;
	private ttlSec = 604_800;
	private maxValueBytes = 262_144;
	private softQuotaBytes = 512 * 1024 * 1024;
	/** 热路径超时；开发连海外 Redis Cloud 时 RTT 常数百 ms，默认 1500 */
	private getTimeoutMs = 1500;
	private setTimeoutMs = 1500;
	private circuitFails = 8;
	private circuitOpenMs = 30_000;

	private circuit: CircuitState = 'closed';
	private failCount = 0;
	private openUntil = 0;
	private approxBytes = 0;

	readonly metrics: TtsCacheMetrics = {
		l1_hit: 0,
		l2_hit: 0,
		l2_miss: 0,
		l2_timeout: 0,
		vendor_call: 0,
		set_skip_size: 0,
		set_skip_quota: 0,
		set_ok: 0,
		circuit_open: 0,
	};

	constructor(private readonly config: ConfigService) {}

	onModuleInit(): void {
		this.enabled = this.bool(TtsCacheEnum.TTS_CACHE_L2_ENABLED, false);
		if (!this.enabled) {
			this.logger.log('TTS L2 缓存关闭（TTS_CACHE_L2_ENABLED≠true）');
			return;
		}

		this.ttlSec = this.num(TtsCacheEnum.TTS_CACHE_TTL_SEC, 604_800);
		this.maxValueBytes = this.num(
			TtsCacheEnum.TTS_CACHE_MAX_VALUE_BYTES,
			262_144,
		);
		this.softQuotaBytes =
			this.num(TtsCacheEnum.TTS_CACHE_REDIS_SOFT_MB, 512) * 1024 * 1024;
		this.getTimeoutMs = this.num(TtsCacheEnum.TTS_CACHE_GET_TIMEOUT_MS, 1500);
		this.setTimeoutMs = this.num(TtsCacheEnum.TTS_CACHE_SET_TIMEOUT_MS, 1500);
		this.circuitFails = this.num(TtsCacheEnum.TTS_CACHE_CIRCUIT_FAILS, 8);
		this.circuitOpenMs = this.num(
			TtsCacheEnum.TTS_CACHE_CIRCUIT_OPEN_MS,
			30_000,
		);

		try {
			this.redis = this.createClient();
			void this.redis.connect().catch((err: unknown) => {
				this.logger.warn(
					`TTS L2 Redis 连接失败（将降级厂商）: ${err instanceof Error ? err.message : String(err)}`,
				);
			});
			this.logger.log(
				`TTS L2 已启用 ttlSec=${this.ttlSec} maxValue=${this.maxValueBytes} get/setTimeout=${this.getTimeoutMs}ms`,
			);
		} catch (err) {
			this.redis = null;
			this.logger.warn(
				`TTS L2 初始化失败: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	async onModuleDestroy(): Promise<void> {
		if (!this.redis) return;
		try {
			await this.redis.quit();
		} catch {
			this.redis.disconnect();
		}
		this.redis = null;
	}

	isEnabled(): boolean {
		return this.enabled && this.redis != null;
	}

	noteL1Hit(): void {
		this.metrics.l1_hit += 1;
	}

	noteVendorCall(): void {
		this.metrics.vendor_call += 1;
	}

	async get(key: string): Promise<Buffer | null> {
		if (!this.allowIo()) return null;
		try {
			const raw = await this.withTimeout(
				this.redis!.getBuffer(key),
				this.getTimeoutMs,
			);
			if (raw == null || raw.length === 0) {
				this.metrics.l2_miss += 1;
				this.onSuccess();
				return null;
			}
			this.metrics.l2_hit += 1;
			this.onSuccess();
			return raw;
		} catch (err) {
			this.onFailure(err, 'get');
			return null;
		}
	}

	async mget(keys: string[]): Promise<(Buffer | null)[]> {
		if (!keys.length) return [];
		if (!this.allowIo()) return keys.map(() => null);
		try {
			const rows = await this.withTimeout(
				this.redis!.mgetBuffer(...keys),
				this.getTimeoutMs,
			);
			this.onSuccess();
			return rows.map((raw) => {
				if (raw == null || raw.length === 0) {
					this.metrics.l2_miss += 1;
					return null;
				}
				this.metrics.l2_hit += 1;
				return raw;
			});
		} catch (err) {
			this.onFailure(err, 'mget');
			return keys.map(() => null);
		}
	}

	async getString(key: string): Promise<string | null> {
		if (!this.allowIo()) return null;
		try {
			const raw = await this.withTimeout(
				this.redis!.get(key),
				this.getTimeoutMs,
			);
			this.onSuccess();
			return raw;
		} catch (err) {
			this.onFailure(err, 'getString');
			return null;
		}
	}

	/** 写音频；过大/配额失败只打点，一律固定 TTL SETEX */
	async set(key: string, audio: Buffer): Promise<void> {
		if (!this.allowIo()) return;
		if (!audio.byteLength) return;
		if (audio.byteLength > this.maxValueBytes) {
			this.metrics.set_skip_size += 1;
			return;
		}
		if (this.approxBytes + audio.byteLength > this.softQuotaBytes) {
			this.metrics.set_skip_quota += 1;
			return;
		}

		try {
			await this.withTimeout(
				this.redis!.set(key, audio, 'EX', this.ttlSec),
				this.setTimeoutMs,
			);
			this.approxBytes += audio.byteLength;
			this.metrics.set_ok += 1;
			this.onSuccess();
		} catch (err) {
			this.onFailure(err, 'set');
		}
	}

	/** batch 返回前写齐：pipeline SETEX */
	async setMany(entries: Array<{ key: string; audio: Buffer }>): Promise<void> {
		if (!entries.length || !this.allowIo()) return;

		const pipe = this.redis!.pipeline();
		let pending = 0;
		for (const { key, audio } of entries) {
			if (!audio.byteLength) continue;
			if (audio.byteLength > this.maxValueBytes) {
				this.metrics.set_skip_size += 1;
				continue;
			}
			if (this.approxBytes + audio.byteLength > this.softQuotaBytes) {
				this.metrics.set_skip_quota += 1;
				continue;
			}
			pipe.set(key, audio, 'EX', this.ttlSec);
			this.approxBytes += audio.byteLength;
			pending += 1;
		}
		if (!pending) return;
		try {
			await this.withTimeout(pipe.exec(), this.setTimeoutMs);
			this.metrics.set_ok += pending;
			this.onSuccess();
		} catch (err) {
			this.onFailure(err, 'setMany');
		}
	}

	async setString(key: string, value: string): Promise<void> {
		await this.set(key, Buffer.from(value, 'utf8'));
	}

	private createClient(): Redis {
		const url = this.config.get<string>(RedisEnum.REDIS_URL)?.trim();
		// 不用 ioredis commandTimeout：连云 Redis 时 AUTH/握手常 >50ms，会误杀连接并刷 Unhandled error
		const common = {
			lazyConnect: true,
			maxRetriesPerRequest: 1,
			enableReadyCheck: true,
			enableOfflineQueue: false,
			connectTimeout: 10_000,
			retryStrategy: (times: number) =>
				times > 3 ? null : Math.min(times * 200, 1000),
		};
		const redis = url
			? new Redis(url, {
					...common,
					username: this.config.get<string>(RedisEnum.REDIS_USERNAME),
					password: this.config.get<string>(RedisEnum.REDIS_PASSWORD),
				})
			: new Redis({
					...common,
					host: this.config.get<string>(RedisEnum.REDIS_HOST) ?? 'localhost',
					port: this.config.get<number>(RedisEnum.REDIS_PORT) ?? 6379,
					username: this.config.get<string>(RedisEnum.REDIS_USERNAME),
					password: this.config.get<string>(RedisEnum.REDIS_PASSWORD),
				});
		redis.on('error', (err) => {
			this.logger.warn(`TTS L2 Redis: ${err.message}`);
		});
		return redis;
	}

	private allowIo(): boolean {
		if (!this.enabled || !this.redis) return false;
		// 未就绪时跳过，避免离线排队/未处理 error 刷屏
		if (this.redis.status !== 'ready') return false;
		if (this.circuit === 'open') {
			if (Date.now() < this.openUntil) {
				this.metrics.circuit_open += 1;
				return false;
			}
			this.circuit = 'half';
		}
		return true;
	}

	private onSuccess(): void {
		this.failCount = 0;
		if (this.circuit === 'half') this.circuit = 'closed';
	}

	private onFailure(err: unknown, op: string): void {
		const msg = err instanceof Error ? err.message : String(err);
		if (/timeout/i.test(msg)) this.metrics.l2_timeout += 1;
		this.failCount += 1;
		if (this.failCount >= this.circuitFails) {
			this.circuit = 'open';
			this.openUntil = Date.now() + this.circuitOpenMs;
			this.logger.warn(`TTS L2 熔断打开（${op}）: ${msg}`);
		} else if (/timeout/i.test(msg)) {
			// 云 Redis 偶发超时：降级厂商即可，未达熔断阈值时不刷 WARN
			this.logger.debug(
				`TTS L2 ${op} timeout (${this.failCount}/${this.circuitFails})`,
			);
		}
	}

	private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				p,
				new Promise<T>((_, rej) => {
					timer = setTimeout(() => rej(new Error('TTS L2 timeout')), ms);
				}),
			]);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	private bool(key: string, fallback: boolean): boolean {
		const v = this.config.get<string | boolean>(key);
		if (v === true || v === 'true' || v === '1') return true;
		if (v === false || v === 'false' || v === '0') return false;
		return fallback;
	}

	private num(key: string, fallback: number): number {
		const v = this.config.get<string | number>(key);
		const n = typeof v === 'number' ? v : Number(v);
		return Number.isFinite(n) ? n : fallback;
	}
}
