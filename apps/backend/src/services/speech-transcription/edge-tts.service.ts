import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EdgeTTS } from 'edge-tts-universal';
import type { EdgeTtsDto } from './dto/edge-tts.dto';
import {
	edgePitchFromPitch,
	edgeRateFromSpeed,
	edgeVolumeFromVol,
} from './edge-tts-prosody';
import { DEFAULT_EDGE_TTS_VOICE } from './edge-tts-voices';
import {
	buildTtsEdgeMetaKey,
	buildTtsRedisKey,
	normalizeTtsText,
} from './tts-audio-cache.keys';
import { TtsAudioCacheService } from './tts-audio-cache.service';

const TTS_INPUT_MAX_BYTES = 8000;
const TTS_SPEECH_CACHE_MAX = 128;
const EDGE_TICKS_PER_MS = 10_000;

type EdgeTtsResolved = {
	text: string;
	voice: string;
	rate: string;
	volume: string;
	pitch: string;
};

export type EdgeTtsBoundaryDto = {
	text: string;
	offsetMs: number;
	durationMs: number;
};

export type EdgeTtsTimedResult = {
	audioBase64: string;
	contentType: string;
	boundaries: EdgeTtsBoundaryDto[];
};

type CachedSpeech = {
	buffer: Buffer;
	boundaries: EdgeTtsBoundaryDto[];
};

/** Microsoft Edge TTS：L1 Map + L2 Redis（跨用户共享，指纹不含 userId） */
@Injectable()
export class EdgeTtsService {
	private readonly speechCache = new Map<string, CachedSpeech>();

	constructor(private readonly ttsCache: TtsAudioCacheService) {}

	resolveOptions(dto: EdgeTtsDto): EdgeTtsResolved {
		const text = dto.text.trim();
		if (!text) {
			throw new HttpException('朗读文本为空', HttpStatus.BAD_REQUEST);
		}
		const bytes = new TextEncoder().encode(text);
		if (bytes.length > TTS_INPUT_MAX_BYTES) {
			throw new HttpException(
				`朗读文本超过 Edge TTS 单次上限（${TTS_INPUT_MAX_BYTES} 字节）`,
				HttpStatus.BAD_REQUEST,
			);
		}
		const voice = dto.voice?.trim() || DEFAULT_EDGE_TTS_VOICE;
		const speed = dto.speed ?? 1;
		const vol = dto.vol ?? 5;
		const pitch = dto.pitch ?? 0;
		return {
			text,
			voice,
			rate: edgeRateFromSpeed(speed),
			volume: edgeVolumeFromVol(vol),
			pitch: edgePitchFromPitch(pitch),
		};
	}

	private buildCacheKey(resolved: EdgeTtsResolved, userId?: number): string {
		return [
			userId != null && userId > 0 ? String(userId) : '0',
			resolved.voice,
			resolved.rate,
			resolved.volume,
			resolved.pitch,
			resolved.text,
		].join('\u0001');
	}

	private buildL2Key(resolved: EdgeTtsResolved): string {
		return buildTtsRedisKey({
			provider: 'edge',
			paramParts: [
				resolved.voice,
				resolved.rate,
				resolved.volume,
				resolved.pitch,
			],
			normalizedText: normalizeTtsText(resolved.text),
		});
	}

	private getFromCache(key: string): CachedSpeech | null {
		const hit = this.speechCache.get(key);
		if (!hit) return null;
		this.speechCache.delete(key);
		this.speechCache.set(key, hit);
		return hit;
	}

	private setCache(key: string, entry: CachedSpeech): void {
		if (this.speechCache.has(key)) this.speechCache.delete(key);
		this.speechCache.set(key, entry);
		while (this.speechCache.size > TTS_SPEECH_CACHE_MAX) {
			const oldest = this.speechCache.keys().next().value;
			if (oldest === undefined) break;
			this.speechCache.delete(oldest);
		}
	}

	private toBoundaryDto(
		subtitle: Array<{ offset: number; duration: number; text: string }>,
	): EdgeTtsBoundaryDto[] {
		return subtitle.map((b) => ({
			text: b.text ?? '',
			offsetMs: Math.round((b.offset ?? 0) / EDGE_TICKS_PER_MS),
			durationMs: Math.round((b.duration ?? 0) / EDGE_TICKS_PER_MS),
		}));
	}

	private async synthesize(resolved: EdgeTtsResolved): Promise<CachedSpeech> {
		this.ttsCache.noteVendorCall();
		const tts = new EdgeTTS(resolved.text, resolved.voice, {
			rate: resolved.rate,
			volume: resolved.volume,
			pitch: resolved.pitch,
		});
		try {
			const result = await tts.synthesize();
			const buffer = Buffer.from(await result.audio.arrayBuffer());
			const boundaries = this.toBoundaryDto(result.subtitle ?? []);
			return { buffer, boundaries };
		} catch (err) {
			const detail = err instanceof Error ? err.message : String(err);
			throw new HttpException(
				`Edge 语音合成失败：${detail}`,
				HttpStatus.BAD_GATEWAY,
			);
		}
	}

	private async writeL2(resolved: EdgeTtsResolved, entry: CachedSpeech) {
		const key = this.buildL2Key(resolved);
		await this.ttsCache.setMany([
			{ key, audio: entry.buffer },
			{
				key: buildTtsEdgeMetaKey(key),
				audio: Buffer.from(JSON.stringify(entry.boundaries), 'utf8'),
			},
		]);
	}

	private async readL2(
		resolved: EdgeTtsResolved,
	): Promise<CachedSpeech | null> {
		const key = this.buildL2Key(resolved);
		const metaKey = buildTtsEdgeMetaKey(key);
		// 一次 MGET，避免云 Redis 两次 RTT 叠加超时
		const [buffer, metaBuf] = await this.ttsCache.mget([key, metaKey]);
		if (!buffer?.length) return null;
		let boundaries: EdgeTtsBoundaryDto[] = [];
		if (metaBuf?.length) {
			try {
				boundaries = JSON.parse(
					metaBuf.toString('utf8'),
				) as EdgeTtsBoundaryDto[];
			} catch {
				boundaries = [];
			}
		}
		return { buffer, boundaries };
	}

	private async synthesizeCached(
		dto: EdgeTtsDto,
		userId?: number,
	): Promise<CachedSpeech> {
		const resolved = this.resolveOptions(dto);
		const cacheKey = this.buildCacheKey(resolved, userId);
		const cached = this.getFromCache(cacheKey);
		if (cached) {
			this.ttsCache.noteL1Hit();
			return {
				buffer: Buffer.from(cached.buffer),
				boundaries: cached.boundaries.map((b) => ({ ...b })),
			};
		}

		const fromL2 = await this.readL2(resolved);
		if (fromL2) {
			this.setCache(cacheKey, fromL2);
			return {
				buffer: Buffer.from(fromL2.buffer),
				boundaries: fromL2.boundaries.map((b) => ({ ...b })),
			};
		}

		const entry = await this.synthesize(resolved);
		this.setCache(cacheKey, entry);
		await this.writeL2(resolved, entry);
		return {
			buffer: Buffer.from(entry.buffer),
			boundaries: entry.boundaries.map((b) => ({ ...b })),
		};
	}

	async synthesizeSpeech(dto: EdgeTtsDto, userId?: number): Promise<Buffer> {
		const { buffer } = await this.synthesizeCached(dto, userId);
		return buffer;
	}

	async synthesizeSpeechBatch(
		voice: Omit<EdgeTtsDto, 'text'>,
		texts: string[],
		userId?: number,
	): Promise<Array<{ text: string; buffer?: Buffer; error?: string }>> {
		type Slot = {
			text: string;
			resolved?: EdgeTtsResolved;
			l1Key?: string;
			l2Key?: string;
			buffer?: Buffer;
			error?: string;
		};
		const slots: Slot[] = texts.map((raw) => {
			const text = typeof raw === 'string' ? raw.trim() : '';
			if (!text) return { text: raw ?? '', error: 'EMPTY' };
			try {
				const resolved = this.resolveOptions({ ...voice, text });
				return {
					text,
					resolved,
					l1Key: this.buildCacheKey(resolved, userId),
					l2Key: this.buildL2Key(resolved),
				};
			} catch (err) {
				return {
					text,
					error: err instanceof Error ? err.message : 'TTS_FAILED',
				};
			}
		});

		const needL2: number[] = [];
		for (let i = 0; i < slots.length; i++) {
			const s = slots[i];
			if (s.error || !s.l1Key || !s.resolved) continue;
			const hit = this.getFromCache(s.l1Key);
			if (hit) {
				this.ttsCache.noteL1Hit();
				s.buffer = Buffer.from(hit.buffer);
				continue;
			}
			needL2.push(i);
		}

		if (needL2.length && this.ttsCache.isEnabled()) {
			const pairKeys = needL2.flatMap((i) => {
				const k = slots[i].l2Key!;
				return [k, buildTtsEdgeMetaKey(k)];
			});
			const rows = await this.ttsCache.mget(pairKeys);
			for (let j = 0; j < needL2.length; j++) {
				const buf = rows[j * 2];
				const metaBuf = rows[j * 2 + 1];
				if (!buf?.length) continue;
				const i = needL2[j];
				let boundaries: EdgeTtsBoundaryDto[] = [];
				if (metaBuf?.length) {
					try {
						boundaries = JSON.parse(
							metaBuf.toString('utf8'),
						) as EdgeTtsBoundaryDto[];
					} catch {
						boundaries = [];
					}
				}
				const entry = { buffer: buf, boundaries };
				this.setCache(slots[i].l1Key!, entry);
				slots[i].buffer = Buffer.from(buf);
			}
		}

		const toWrite: Array<{ key: string; audio: Buffer }> = [];
		for (const s of slots) {
			if (s.error || s.buffer || !s.resolved || !s.l1Key) continue;
			try {
				const entry = await this.synthesize(s.resolved);
				this.setCache(s.l1Key, entry);
				s.buffer = Buffer.from(entry.buffer);
				toWrite.push({ key: s.l2Key!, audio: entry.buffer });
				toWrite.push({
					key: buildTtsEdgeMetaKey(s.l2Key!),
					audio: Buffer.from(JSON.stringify(entry.boundaries), 'utf8'),
				});
			} catch (err) {
				s.error = err instanceof Error ? err.message : 'TTS_FAILED';
			}
		}
		if (toWrite.length) await this.ttsCache.setMany(toWrite);

		return slots.map((s) =>
			s.error
				? { text: s.text, error: s.error }
				: { text: s.text, buffer: s.buffer },
		);
	}

	async synthesizeSpeechTimed(
		dto: EdgeTtsDto,
		userId?: number,
	): Promise<EdgeTtsTimedResult> {
		const { buffer, boundaries } = await this.synthesizeCached(dto, userId);
		return {
			audioBase64: buffer.toString('base64'),
			contentType: this.resolveContentType(),
			boundaries,
		};
	}

	async *streamSpeech(
		dto: EdgeTtsDto,
		userId?: number,
	): AsyncGenerator<Buffer> {
		const { buffer } = await this.synthesizeCached(dto, userId);
		if (buffer.length) yield buffer;
	}

	resolveContentType(): string {
		return 'audio/mpeg';
	}
}
