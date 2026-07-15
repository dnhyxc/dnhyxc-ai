import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EdgeTTS } from 'edge-tts-universal';
import type { EdgeTtsDto } from './dto/edge-tts.dto';
import {
	edgePitchFromPitch,
	edgeRateFromSpeed,
	edgeVolumeFromVol,
} from './edge-tts-prosody';
import { DEFAULT_EDGE_TTS_VOICE } from './edge-tts-voices';

const TTS_INPUT_MAX_BYTES = 8000;
const TTS_SPEECH_CACHE_MAX = 128;
/** Edge WordBoundary 单位：100ns；÷10000 → ms */
const EDGE_TICKS_PER_MS = 10_000;

type EdgeTtsResolved = {
	text: string;
	voice: string;
	rate: string;
	volume: string;
	pitch: string;
};

/** 对外返回的词/字边界（毫秒，便于客户端对齐 currentTime） */
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

/**
 * Microsoft Edge 在线语音合成（edge-tts-universal）：免费、无需 API Key。
 */
@Injectable()
export class EdgeTtsService {
	private readonly speechCache = new Map<string, CachedSpeech>();

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

	private async synthesizeCached(
		dto: EdgeTtsDto,
		userId?: number,
	): Promise<CachedSpeech> {
		const resolved = this.resolveOptions(dto);
		const cacheKey = this.buildCacheKey(resolved, userId);
		const cached = this.getFromCache(cacheKey);
		if (cached) {
			return {
				buffer: Buffer.from(cached.buffer),
				boundaries: cached.boundaries.map((b) => ({ ...b })),
			};
		}

		const entry = await this.synthesize(resolved);
		this.setCache(cacheKey, entry);
		return {
			buffer: Buffer.from(entry.buffer),
			boundaries: entry.boundaries.map((b) => ({ ...b })),
		};
	}

	async synthesizeSpeech(dto: EdgeTtsDto, userId?: number): Promise<Buffer> {
		const { buffer } = await this.synthesizeCached(dto, userId);
		return buffer;
	}

	/** 音频 + WordBoundary 时间戳（听书句/字高亮用） */
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
