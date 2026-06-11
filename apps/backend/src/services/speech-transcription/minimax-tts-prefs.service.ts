import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UpsertMinimaxTtsPrefsDto } from './dto/upsert-minimax-tts-prefs.dto';
import { MinimaxTtsUserConfig } from './minimax-tts-user-config.entity';

export type MinimaxTtsPrefsView = {
	enabled: boolean;
	model: string;
	voiceId: string;
	speed: number;
	vol: number;
	pitch: number;
	emotion: string;
	format: string;
	languageBoost: string;
	sampleRate: number;
	bitrate: number;
	channel: 1 | 2;
};

export const DEFAULT_MINIMAX_TTS_PREFS: MinimaxTtsPrefsView = {
	enabled: false,
	model: 'speech-2.8-hd',
	voiceId: 'English_captivating_female1',
	speed: 1,
	vol: 5,
	pitch: 0,
	emotion: '',
	format: 'mp3',
	languageBoost: 'auto',
	sampleRate: 32_000,
	bitrate: 128_000,
	channel: 1,
};

@Injectable()
export class MinimaxTtsPrefsService {
	constructor(
		@InjectRepository(MinimaxTtsUserConfig)
		private readonly repo: Repository<MinimaxTtsUserConfig>,
	) {}

	private assertUserId(userId?: number): number {
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			throw new UnauthorizedException('请先登录后再试');
		}
		return userId;
	}

	private normalizeEmotion(raw?: string): string {
		const e = raw?.trim() ?? '';
		if (!e || e === '__none__' || e === 'whisper') return '';
		return e;
	}

	private rowToView(row: MinimaxTtsUserConfig): MinimaxTtsPrefsView {
		return {
			enabled: Boolean(row.enabled),
			model: row.model?.trim() || DEFAULT_MINIMAX_TTS_PREFS.model,
			voiceId: row.voiceId?.trim() || DEFAULT_MINIMAX_TTS_PREFS.voiceId,
			speed: row.speed ?? DEFAULT_MINIMAX_TTS_PREFS.speed,
			vol: row.vol ?? DEFAULT_MINIMAX_TTS_PREFS.vol,
			pitch: row.pitch ?? DEFAULT_MINIMAX_TTS_PREFS.pitch,
			emotion: this.normalizeEmotion(row.emotion),
			format: row.format?.trim() || DEFAULT_MINIMAX_TTS_PREFS.format,
			languageBoost:
				row.languageBoost?.trim() || DEFAULT_MINIMAX_TTS_PREFS.languageBoost,
			sampleRate: row.sampleRate ?? DEFAULT_MINIMAX_TTS_PREFS.sampleRate,
			bitrate: row.bitrate ?? DEFAULT_MINIMAX_TTS_PREFS.bitrate,
			channel: row.channel === 2 ? 2 : 1,
		};
	}

	async getPublicView(userId?: number): Promise<MinimaxTtsPrefsView> {
		const uid = this.assertUserId(userId);
		const row = await this.repo.findOne({ where: { userId: uid } });
		if (!row) return { ...DEFAULT_MINIMAX_TTS_PREFS };
		return this.rowToView(row);
	}

	async upsert(
		dto: UpsertMinimaxTtsPrefsDto,
		userId?: number,
	): Promise<MinimaxTtsPrefsView> {
		const uid = this.assertUserId(userId);
		const emotion = this.normalizeEmotion(dto.emotion);
		let row = await this.repo.findOne({ where: { userId: uid } });
		if (!row) {
			row = this.repo.create({ userId: uid });
		}
		row.enabled = Boolean(dto.enabled);
		row.model = dto.model;
		row.voiceId = dto.voiceId.trim();
		row.speed = dto.speed;
		row.vol = dto.vol;
		row.pitch = dto.pitch;
		row.emotion = emotion;
		row.format = dto.format;
		row.languageBoost = dto.languageBoost;
		row.sampleRate = dto.sampleRate;
		row.bitrate = dto.bitrate;
		row.channel = dto.channel === 2 ? 2 : 1;
		await this.repo.save(row);
		return this.rowToView(row);
	}

	async clear(userId?: number): Promise<MinimaxTtsPrefsView> {
		const uid = this.assertUserId(userId);
		await this.repo.delete({ userId: uid });
		return { ...DEFAULT_MINIMAX_TTS_PREFS };
	}
}
