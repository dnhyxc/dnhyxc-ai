import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UpsertMinimaxTtsPrefsDto } from './dto/upsert-minimax-tts-prefs.dto';
import { DEFAULT_EDGE_TTS_VOICE } from './edge-tts-voices';
import { DEFAULT_MINIMAX_TTS_MODEL } from './minimax-tts-models';
import { MinimaxTtsUserConfig } from './minimax-tts-user-config.entity';

export type MinimaxTtsPrefsView = {
	enabled: boolean;
	playbackSource: 'local' | 'cloud' | 'xfyun' | 'edge';
	model: string;
	voiceId: string;
	xfyunVoiceId: string;
	edgeVoiceId: string;
	minimaxSpeed: number;
	minimaxVol: number;
	minimaxPitch: number;
	xfyunSpeed: number;
	xfyunVolume: number;
	xfyunPitch: number;
	edgeSpeed: number;
	edgeVol: number;
	edgePitch: number;
	emotion: string;
	format: string;
	languageBoost: string;
	sampleRate: number;
	bitrate: number;
	channel: 1 | 2;
	/** 讯飞 APPID；空串表示使用服务端环境变量 */
	xfyunAppId: string;
	xfyunApiKey: string;
	xfyunApiSecret: string;
	minimaxApiKey: string;
};

export const DEFAULT_MINIMAX_TTS_PREFS: MinimaxTtsPrefsView = {
	enabled: false,
	playbackSource: 'local',
	model: DEFAULT_MINIMAX_TTS_MODEL,
	voiceId: 'English_captivating_female1',
	xfyunVoiceId: 'x4_yezi',
	edgeVoiceId: DEFAULT_EDGE_TTS_VOICE,
	minimaxSpeed: 1,
	minimaxVol: 5,
	minimaxPitch: 0,
	xfyunSpeed: 50,
	xfyunVolume: 50,
	xfyunPitch: 50,
	edgeSpeed: 1,
	edgeVol: 5,
	edgePitch: 0,
	emotion: '',
	format: 'mp3',
	languageBoost: 'auto',
	sampleRate: 32_000,
	bitrate: 128_000,
	channel: 1,
	xfyunAppId: '',
	xfyunApiKey: '',
	xfyunApiSecret: '',
	minimaxApiKey: '',
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

	private normalizePlaybackSource(
		raw?: string,
	): 'local' | 'cloud' | 'xfyun' | 'edge' {
		if (raw === 'local') return 'local';
		if (raw === 'xfyun') return 'xfyun';
		if (raw === 'edge') return 'edge';
		return 'cloud';
	}

	private trimCredential(raw?: string | null): string {
		return raw?.trim() ?? '';
	}

	private defaultXfyunVoiceId(raw?: string | null): string {
		const v = raw?.trim() ?? '';
		return v || DEFAULT_MINIMAX_TTS_PREFS.xfyunVoiceId;
	}

	private defaultEdgeVoiceId(raw?: string | null): string {
		const v = raw?.trim() ?? '';
		return v || DEFAULT_MINIMAX_TTS_PREFS.edgeVoiceId;
	}

	private rowToView(row: MinimaxTtsUserConfig): MinimaxTtsPrefsView {
		const voiceId = row.voiceId?.trim() || DEFAULT_MINIMAX_TTS_PREFS.voiceId;
		const xfyunVoiceId = this.defaultXfyunVoiceId(row.xfyunVoiceId);
		const edgeVoiceId = this.defaultEdgeVoiceId(row.edgeVoiceId);
		return {
			enabled: Boolean(row.enabled),
			playbackSource: this.normalizePlaybackSource(row.playbackSource),
			model: row.model?.trim() || DEFAULT_MINIMAX_TTS_PREFS.model,
			voiceId,
			xfyunVoiceId,
			edgeVoiceId,
			minimaxSpeed: row.minimaxSpeed ?? DEFAULT_MINIMAX_TTS_PREFS.minimaxSpeed,
			minimaxVol: row.minimaxVol ?? DEFAULT_MINIMAX_TTS_PREFS.minimaxVol,
			minimaxPitch: row.minimaxPitch ?? DEFAULT_MINIMAX_TTS_PREFS.minimaxPitch,
			xfyunSpeed: row.xfyunSpeed ?? DEFAULT_MINIMAX_TTS_PREFS.xfyunSpeed,
			xfyunVolume: row.xfyunVolume ?? DEFAULT_MINIMAX_TTS_PREFS.xfyunVolume,
			xfyunPitch: row.xfyunPitch ?? DEFAULT_MINIMAX_TTS_PREFS.xfyunPitch,
			edgeSpeed: row.edgeSpeed ?? DEFAULT_MINIMAX_TTS_PREFS.edgeSpeed,
			edgeVol: row.edgeVol ?? DEFAULT_MINIMAX_TTS_PREFS.edgeVol,
			edgePitch: row.edgePitch ?? DEFAULT_MINIMAX_TTS_PREFS.edgePitch,
			emotion: this.normalizeEmotion(row.emotion),
			format: row.format?.trim() || DEFAULT_MINIMAX_TTS_PREFS.format,
			languageBoost:
				row.languageBoost?.trim() || DEFAULT_MINIMAX_TTS_PREFS.languageBoost,
			sampleRate: row.sampleRate ?? DEFAULT_MINIMAX_TTS_PREFS.sampleRate,
			bitrate: row.bitrate ?? DEFAULT_MINIMAX_TTS_PREFS.bitrate,
			channel: row.channel === 2 ? 2 : 1,
			xfyunAppId: this.trimCredential(row.xfyunAppId),
			xfyunApiKey: this.trimCredential(row.xfyunApiKey),
			xfyunApiSecret: this.trimCredential(row.xfyunApiSecret),
			minimaxApiKey: this.trimCredential(row.minimaxApiKey),
		};
	}

	/** 用户填写时返回自定义 MiniMax API Key，否则 null（TTS 走环境变量） */
	async getMinimaxApiKey(userId?: number): Promise<string | null> {
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			return null;
		}
		const row = await this.repo.findOne({ where: { userId } });
		if (!row) return null;
		const apiKey = this.trimCredential(row.minimaxApiKey);
		return apiKey || null;
	}

	/** 用户三项均填写时返回自定义讯飞凭证，否则 null（TTS 走环境变量） */
	async getXfyunCredentials(
		userId?: number,
	): Promise<{ appId: string; apiKey: string; apiSecret: string } | null> {
		if (userId == null || !Number.isFinite(userId) || userId <= 0) {
			return null;
		}
		const row = await this.repo.findOne({ where: { userId } });
		if (!row) return null;
		const appId = this.trimCredential(row.xfyunAppId);
		const apiKey = this.trimCredential(row.xfyunApiKey);
		const apiSecret = this.trimCredential(row.xfyunApiSecret);
		if (!appId || !apiKey || !apiSecret) return null;
		return { appId, apiKey, apiSecret };
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
		row.playbackSource = this.normalizePlaybackSource(dto.playbackSource);
		row.model = dto.model;
		row.voiceId = dto.voiceId.trim();
		row.xfyunVoiceId = this.defaultXfyunVoiceId(dto.xfyunVoiceId);
		row.edgeVoiceId = this.defaultEdgeVoiceId(dto.edgeVoiceId);
		row.minimaxSpeed = dto.minimaxSpeed;
		row.minimaxVol = dto.minimaxVol;
		row.minimaxPitch = dto.minimaxPitch;
		row.xfyunSpeed = dto.xfyunSpeed;
		row.xfyunVolume = dto.xfyunVolume;
		row.xfyunPitch = dto.xfyunPitch;
		row.edgeSpeed = dto.edgeSpeed;
		row.edgeVol = dto.edgeVol;
		row.edgePitch = dto.edgePitch;
		row.emotion = emotion;
		row.format = dto.format;
		row.languageBoost = dto.languageBoost;
		row.sampleRate = dto.sampleRate;
		row.bitrate = dto.bitrate;
		row.channel = dto.channel === 2 ? 2 : 1;
		row.xfyunAppId = dto.xfyunAppId?.trim() ?? '';
		row.xfyunApiKey = dto.xfyunApiKey?.trim() ?? '';
		row.xfyunApiSecret = dto.xfyunApiSecret?.trim() ?? '';
		row.minimaxApiKey = dto.minimaxApiKey?.trim() ?? '';
		await this.repo.save(row);
		return this.rowToView(row);
	}

	async clear(userId?: number): Promise<MinimaxTtsPrefsView> {
		const uid = this.assertUserId(userId);
		await this.repo.delete({ userId: uid });
		return { ...DEFAULT_MINIMAX_TTS_PREFS };
	}
}
