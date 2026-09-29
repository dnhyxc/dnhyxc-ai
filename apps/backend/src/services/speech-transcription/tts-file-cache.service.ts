import {
	access,
	readdir,
	readFile,
	rename,
	stat,
	statfs,
	unlink,
	writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
	Inject,
	Injectable,
	type LoggerService,
	OnModuleInit,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { TtsFileCacheEnum } from '../../enum/tts-file-cache.enum';
import { CACHE_COMMAND_TIMEOUT_MS } from '../../factorys/redis-config.factory';
import { getEnvConfig } from '../../utils';
import {
	ensureUploadDir,
	getUploadsRoot,
	getUploadTtsDir,
} from '../../utils/upload-paths';
import { LogsService } from '../logs/logs.service';
import { TTS_FILE_BYTES_KEY } from './tts-file-cache.keys';

const GC_MIN_INTERVAL_MS = 60_000;
const GC_BATCH = 32;
/** 写盘后至少再留这么多可用空间 */
const DISK_HEADROOM_BYTES = 64 * 1024 * 1024;
/** 配额计数 TTL：与文件缓存同量级（默认 30 天），到期可再扫盘校准 */
const BYTES_KEY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 盘存 MP3；路径索引 + 配额计数走全局 CACHE_MANAGER（与验证码同一条 Redis，不单开连接）。
 * 过期 GC：mtime + 游标分批（Keyv 无 ZSET，不另起 ioredis）。
 * 磁盘不够 / 超预算 → 不落盘；音频仍可内存返回。
 */
@Injectable()
export class TtsFileCacheService implements OnModuleInit {
	private static readonly CTX = TtsFileCacheService.name;
	private ready = false;
	private enabled = false;
	private ttlSec = 2_592_000;
	private ttlMs = 2_592_000_000;
	/** ≤0 表示不限制体积 */
	private maxBytes = 2048 * 1024 * 1024;
	private ttsDir = '';
	private uploadsRoot = '';
	private lastGcAt = 0;
	/** 过期 GC 游标：每轮从上次位置继续，避免总扫目录头 */
	private gcCursor = 0;
	private loggedDisabledSkip = false;
	/** 内存镜像；权威值在 CACHE_MANAGER（TTS_FILE_BYTES_KEY） */
	private usedBytesApprox = 0;

	constructor(
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
		private readonly logsService: LogsService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	onModuleInit(): void {
		this.ensureReady();
	}

	private ensureReady(): void {
		if (this.ready) return;
		this.ready = true;

		const env = getEnvConfig();
		const raw = env[TtsFileCacheEnum.TTS_FILE_CACHE_ENABLED];
		this.enabled = this.parseBool(raw, false);
		if (!this.enabled) {
			this.logger.log(
				`TTS 文件缓存关闭（TTS_FILE_CACHE_ENABLED=${String(raw)}）`,
				TtsFileCacheService.CTX,
			);
			return;
		}

		this.ttlSec = this.parseNum(
			env[TtsFileCacheEnum.TTS_FILE_CACHE_TTL_SEC],
			2_592_000,
		);
		this.ttlMs = this.ttlSec * 1000;
		const maxMb = this.parseNum(
			env[TtsFileCacheEnum.TTS_FILE_CACHE_MAX_MB],
			2048,
		);
		this.maxBytes = maxMb > 0 ? maxMb * 1024 * 1024 : 0;
		this.uploadsRoot = getUploadsRoot();
		this.ttsDir = getUploadTtsDir();
		ensureUploadDir(this.ttsDir);
		this.logger.log(
			`TTS 文件缓存已启用 dir=${this.ttsDir} ttlSec=${this.ttlSec} maxMB=${maxMb}（复用 CACHE_MANAGER Redis）`,
			TtsFileCacheService.CTX,
		);
		void this.seedUsedBytes();
	}

	/**
	 * 启动校准：优先读 CACHE 中的配额；没有则扫盘一次写入 Cache。
	 * 与验证码同一 Redis，不新建连接。
	 */
	private async seedUsedBytes(): Promise<void> {
		try {
			const cached = await this.cacheOp(
				() => this.cache.get<number | string>(TTS_FILE_BYTES_KEY),
				'bytes-get',
			);
			const n =
				typeof cached === 'number'
					? cached
					: typeof cached === 'string'
						? Number(cached)
						: NaN;
			if (Number.isFinite(n) && n >= 0) {
				this.usedBytesApprox = n;
				this.logger.log(
					`TTS 配额已从 Cache 恢复 used≈${n} bytes`,
					TtsFileCacheService.CTX,
				);
				return;
			}

			const names = await readdir(this.ttsDir);
			let total = 0;
			for (const name of names) {
				if (!name.endsWith('.mp3') && !name.endsWith('.json')) continue;
				try {
					total += (await stat(join(this.ttsDir, name))).size;
				} catch {
					// missing
				}
			}
			this.usedBytesApprox = total;
			await this.persistUsedBytes();
			this.logger.log(
				`TTS 配额已扫盘校准 used≈${total} bytes`,
				TtsFileCacheService.CTX,
			);
		} catch (err) {
			this.logger.warn(
				`TTS 配额校准跳过: ${err instanceof Error ? err.message : String(err)}`,
				TtsFileCacheService.CTX,
			);
		}
	}

	private async persistUsedBytes(): Promise<void> {
		await this.cacheOp(
			() =>
				this.cache.set(
					TTS_FILE_BYTES_KEY,
					this.usedBytesApprox,
					BYTES_KEY_TTL_MS,
				),
			'bytes-set',
		);
	}

	isEnabled(): boolean {
		this.ensureReady();
		return this.enabled;
	}

	async get(redisKey: string, relativePath: string): Promise<Buffer | null> {
		this.ensureReady();
		if (!this.enabled) {
			if (!this.loggedDisabledSkip) {
				this.loggedDisabledSkip = true;
				this.logger.log(
					`TTS 文件缓存未启用，跳过读盘（后续同类请求不再重复打印）`,
					TtsFileCacheService.CTX,
				);
			}
			return null;
		}
		try {
			let relative = (
				await this.cacheOp(() => this.cache.get<string>(redisKey), 'get')
			)?.trim();
			if (!relative) relative = relativePath;

			const abs = this.toAbsolute(relative);
			try {
				await access(abs);
			} catch {
				await this.cacheOp(() => this.cache.del(redisKey), 'del');
				this.scheduleGc();
				return null;
			}

			const buf = await readFile(abs);
			void this.indexPath(redisKey, relative);
			this.scheduleGc();
			return buf;
		} catch (err) {
			this.logger.warn(
				`TTS file miss(error) path=${relativePath}: ${err instanceof Error ? err.message : String(err)}，将调用厂商合成`,
				TtsFileCacheService.CTX,
			);
			return null;
		}
	}

	async getJson<T>(_redisKey: string, relativePath: string): Promise<T | null> {
		this.ensureReady();
		if (!this.enabled) return null;
		try {
			const abs = `${this.toAbsolute(relativePath).replace(/\.mp3$/i, '')}.json`;
			const raw = await readFile(abs, 'utf8');
			return JSON.parse(raw) as T;
		} catch {
			return null;
		}
	}

	async set(
		redisKey: string,
		relativePath: string,
		audio: Buffer,
		jsonSide?: unknown,
	): Promise<void> {
		this.ensureReady();
		if (!this.enabled || !audio.byteLength) return;
		const abs = this.toAbsolute(relativePath);
		const tmp = `${abs}.${process.pid}.tmp`;
		try {
			ensureUploadDir(this.ttsDir);
			let oldBytes = 0;
			try {
				oldBytes = (await stat(abs)).size;
			} catch {
				// new file
			}
			const jsonAbs = abs.replace(/\.mp3$/i, '.json');
			try {
				oldBytes += (await stat(jsonAbs)).size;
			} catch {
				// no sidecar
			}
			const sideBytes =
				jsonSide !== undefined
					? Buffer.byteLength(JSON.stringify(jsonSide), 'utf8')
					: 0;
			const newSize = audio.byteLength + sideBytes;
			const net = newSize - oldBytes;

			const skip = await this.shouldSkipStore(newSize, net, relativePath);
			if (skip) return;

			await writeFile(tmp, audio);
			await rename(tmp, abs);
			if (jsonSide !== undefined) {
				await writeFile(jsonAbs, JSON.stringify(jsonSide), 'utf8');
			}
			await this.adjustBytes(net);
			await this.indexPath(redisKey, relativePath);
			this.scheduleGc();
		} catch (err) {
			await unlink(tmp).catch(() => undefined);
			this.logger.warn(
				`TTS 文件缓存 set 失败: ${err instanceof Error ? err.message : String(err)}`,
				TtsFileCacheService.CTX,
			);
		}
	}

	/** 按 mtime 分批清理；游标轮询，不在请求热路径上 */
	async gcExpired(limit = GC_BATCH): Promise<number> {
		this.ensureReady();
		if (!this.enabled) return 0;
		const cutoff = Date.now() - this.ttlMs;
		let names: string[];
		try {
			names = (await readdir(this.ttsDir)).filter((n) => n.endsWith('.mp3'));
		} catch {
			return 0;
		}
		if (names.length === 0) return 0;

		const expired: string[] = [];
		const start = this.gcCursor % names.length;
		let checked = 0;
		while (expired.length < limit && checked < names.length) {
			const name = names[(start + checked) % names.length]!;
			checked += 1;
			const abs = join(this.ttsDir, name);
			try {
				const st = await stat(abs);
				if (st.mtimeMs < cutoff) {
					expired.push(`tts/${name}`);
				}
			} catch {
				// missing
			}
		}
		this.gcCursor = (start + checked) % names.length;

		const n = await this.unlinkPaths(expired);
		if (n > 0) {
			this.logger.log(
				`TTS 文件 GC 删除 ${n} 个过期文件`,
				TtsFileCacheService.CTX,
			);
		}
		return n;
	}

	private async shouldSkipStore(
		newSize: number,
		netBytes: number,
		relativePath: string,
	): Promise<boolean> {
		if (this.maxBytes > 0 && newSize > this.maxBytes) {
			this.recordSkip('over_budget_file', {
				relativePath,
				newSize,
				maxBytes: this.maxBytes,
			});
			return true;
		}
		if (this.maxBytes > 0 && netBytes > 0) {
			const used = this.usedBytesApprox;
			if (used + netBytes > this.maxBytes) {
				this.recordSkip('over_budget_total', {
					relativePath,
					newSize,
					netBytes,
					used,
					maxBytes: this.maxBytes,
				});
				return true;
			}
		}

		const free = await this.diskFreeBytes();
		if (free != null && free < newSize + DISK_HEADROOM_BYTES) {
			this.recordSkip('disk_insufficient', {
				relativePath,
				newSize,
				free,
				need: newSize + DISK_HEADROOM_BYTES,
				headroom: DISK_HEADROOM_BYTES,
			});
			return true;
		}
		return false;
	}

	private recordSkip(
		reason: 'disk_insufficient' | 'over_budget_file' | 'over_budget_total',
		detail: Record<string, unknown>,
	): void {
		const msg = `TTS 跳过落盘 reason=${reason} ${JSON.stringify(detail)}`;
		this.logger.warn(msg, TtsFileCacheService.CTX);
		this.logsService.createSafe({
			path: '/internal/tts-file-cache/skip-store',
			method: 'SYSTEM',
			data: { reason, ...detail },
			responseData: { skipped: true },
			result: 507,
			userId: null,
		});
	}

	private async diskFreeBytes(): Promise<number | null> {
		try {
			const s = await statfs(this.ttsDir);
			return Number(s.bavail) * Number(s.bsize);
		} catch {
			return null;
		}
	}

	private async unlinkPaths(paths: string[]): Promise<number> {
		let deleted = 0;
		let freed = 0;
		for (const relative of paths) {
			const abs = this.toAbsolute(relative);
			const jsonAbs = abs.replace(/\.mp3$/i, '.json');
			for (const p of [abs, jsonAbs]) {
				try {
					freed += (await stat(p)).size;
				} catch {
					// missing
				}
				await unlink(p).catch(() => undefined);
			}
			deleted += 1;
		}
		if (freed > 0) void this.adjustBytes(-freed);
		return deleted;
	}

	private async adjustBytes(delta: number): Promise<void> {
		if (delta === 0) return;
		this.usedBytesApprox = Math.max(0, this.usedBytesApprox + delta);
		await this.persistUsedBytes();
	}

	private scheduleGc(): void {
		const now = Date.now();
		if (now - this.lastGcAt < GC_MIN_INTERVAL_MS) return;
		this.lastGcAt = now;
		void this.gcExpired().catch((err: unknown) => {
			this.logger.warn(
				`TTS 文件 GC 失败: ${err instanceof Error ? err.message : String(err)}`,
				TtsFileCacheService.CTX,
			);
		});
	}

	private async cacheOp<T>(
		run: () => Promise<T>,
		label: string,
	): Promise<T | undefined> {
		try {
			return await new Promise<T>((resolve, reject) => {
				const timer = setTimeout(() => {
					reject(new Error(`CACHE_TIMEOUT:${label}`));
				}, CACHE_COMMAND_TIMEOUT_MS);
				run().then(
					(v) => {
						clearTimeout(timer);
						resolve(v);
					},
					(e) => {
						clearTimeout(timer);
						reject(e);
					},
				);
			});
		} catch (err) {
			this.logger.warn(
				`TTS cache ${label} skip: ${err instanceof Error ? err.message : String(err)}`,
				TtsFileCacheService.CTX,
			);
			return undefined;
		}
	}

	private async indexPath(
		redisKey: string,
		relativePath: string,
	): Promise<void> {
		await this.cacheOp(
			() => this.cache.set(redisKey, relativePath, this.ttlMs),
			'set',
		);
	}

	private toAbsolute(relativePath: string): string {
		const cleaned = relativePath.replace(/^\/+/, '');
		return join(this.uploadsRoot, cleaned);
	}

	private parseBool(v: unknown, fallback: boolean): boolean {
		if (v === true || v === 'true' || v === '1') return true;
		if (v === false || v === 'false' || v === '0') return false;
		return fallback;
	}

	private parseNum(v: unknown, fallback: number): number {
		const n = typeof v === 'number' ? v : Number(v);
		return Number.isFinite(n) ? n : fallback;
	}
}
