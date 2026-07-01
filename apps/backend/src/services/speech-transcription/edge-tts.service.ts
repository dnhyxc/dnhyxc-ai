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

type EdgeTtsResolved = {
	text: string;
	voice: string;
	rate: string;
	volume: string;
	pitch: string;
};

/**
 * Microsoft Edge 在线语音合成（edge-tts-universal）：免费、无需 API Key。
 */
@Injectable()
export class EdgeTtsService {
	private readonly speechCache = new Map<string, Buffer>();

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

	private getFromCache(key: string): Buffer | null {
		const hit = this.speechCache.get(key);
		if (!hit) return null;
		this.speechCache.delete(key);
		this.speechCache.set(key, hit);
		return hit;
	}

	private setCache(key: string, buffer: Buffer): void {
		if (this.speechCache.has(key)) this.speechCache.delete(key);
		this.speechCache.set(key, buffer);
		while (this.speechCache.size > TTS_SPEECH_CACHE_MAX) {
			const oldest = this.speechCache.keys().next().value;
			if (oldest === undefined) break;
			this.speechCache.delete(oldest);
		}
	}

	private async synthesize(resolved: EdgeTtsResolved): Promise<Buffer> {
		const tts = new EdgeTTS(resolved.text, resolved.voice, {
			rate: resolved.rate,
			volume: resolved.volume,
			pitch: resolved.pitch,
		});
		try {
			const result = await tts.synthesize();
			return Buffer.from(await result.audio.arrayBuffer());
		} catch (err) {
			const detail = err instanceof Error ? err.message : String(err);
			throw new HttpException(
				`Edge 语音合成失败：${detail}`,
				HttpStatus.BAD_GATEWAY,
			);
		}
	}

	async synthesizeSpeech(dto: EdgeTtsDto, userId?: number): Promise<Buffer> {
		const resolved = this.resolveOptions(dto);
		const cacheKey = this.buildCacheKey(resolved, userId);
		const cached = this.getFromCache(cacheKey);
		if (cached) return Buffer.from(cached);

		const buffer = await this.synthesize(resolved);
		this.setCache(cacheKey, buffer);
		return buffer;
	}

	async *streamSpeech(
		dto: EdgeTtsDto,
		userId?: number,
	): AsyncGenerator<Buffer> {
		const resolved = this.resolveOptions(dto);
		const cacheKey = this.buildCacheKey(resolved, userId);
		const cached = this.getFromCache(cacheKey);
		if (cached?.length) {
			yield cached;
			return;
		}

		const buffer = await this.synthesize(resolved);
		if (buffer.length) {
			this.setCache(cacheKey, buffer);
			yield buffer;
		}
	}

	resolveContentType(): string {
		return 'audio/mpeg';
	}
}
