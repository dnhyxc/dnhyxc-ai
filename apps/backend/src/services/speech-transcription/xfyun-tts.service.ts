import { createHmac } from 'node:crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { DEFAULT_XFYUN_TTS_VCN, XfyunEnum } from '../../enum/config.enum';
import type { XfyunTtsDto } from './dto/xfyun-tts.dto';

// https://console.xfyun.cn/services/tts
const TTS_WS_URL = 'wss://tts-api.xfyun.cn/v2/tts';
/** 讯飞在线合成：base64 前 UTF-8 字节上限 */
const TTS_INPUT_MAX_BYTES = 8000;
const TTS_SPEECH_CACHE_MAX = 128;
const WS_TIMEOUT_MS = 90_000;

// 讯飞 TTS 配置解析后的结构类型，包含发音所需所有参数
type XfyunTtsResolved = {
	// 要合成的文本内容
	text: string;
	// 发音人代号，如 xiaoyan、aisjiuxu 等
	vcn: string;
	// 语速，讯飞在线合成 0–100，50 为默认
	speed: number;
	// 音量，0–100，50 为默认
	volume: number;
	// 音高，0–100，50 为默认
	pitch: number;
};

type XfyunWsMessage = {
	code?: number;
	message?: string;
	data?: {
		audio?: string;
		status?: number;
	};
};

/**
 * 讯飞在线语音合成（WebSocket 流式）：Nest 侧连 wss，对前端暴露 HTTP MP3 流/整段。
 * @see https://www.xfyun.cn/doc/tts/online_tts/API.html
 */
@Injectable()
export class XfyunTtsService {
	private readonly speechCache = new Map<string, Buffer>();

	constructor(private readonly config: ConfigService) {}

	isConfigured(): boolean {
		try {
			this.resolveCredentials();
			return true;
		} catch {
			return false;
		}
	}

	private trimEnv(key: string): string | undefined {
		const raw = this.config.get<string>(key);
		if (raw == null) return undefined;
		const trimmed = String(raw).trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	private resolveCredentials(): {
		appId: string;
		apiKey: string;
		apiSecret: string;
	} {
		const appId = this.trimEnv(XfyunEnum.XFYUN_APP_ID);
		const apiKey = this.trimEnv(XfyunEnum.XFYUN_API_KEY);
		const apiSecret = this.trimEnv(XfyunEnum.XFYUN_API_SECRET);
		if (!appId || !apiKey || !apiSecret) {
			throw new HttpException(
				'未配置 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET，无法进行讯飞语音合成',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
		return { appId, apiKey, apiSecret };
	}

	resolveOptions(dto: XfyunTtsDto): XfyunTtsResolved {
		const text = dto.text.trim();
		if (!text) {
			throw new HttpException('朗读文本为空', HttpStatus.BAD_REQUEST);
		}
		const bytes = new TextEncoder().encode(text);
		if (bytes.length > TTS_INPUT_MAX_BYTES) {
			throw new HttpException(
				`朗读文本超过讯飞单次上限（${TTS_INPUT_MAX_BYTES} 字节）`,
				HttpStatus.BAD_REQUEST,
			);
		}
		return {
			text,
			vcn:
				dto.vcn?.trim() ||
				this.trimEnv(XfyunEnum.XFYUN_TTS_VCN) ||
				DEFAULT_XFYUN_TTS_VCN,
			speed: dto.speed ?? 50,
			volume: dto.volume ?? 50,
			pitch: dto.pitch ?? 50,
		};
	}

	private buildCacheKey(resolved: XfyunTtsResolved, userId?: number): string {
		return [
			userId != null && userId > 0 ? String(userId) : '0',
			resolved.vcn,
			String(resolved.speed),
			String(resolved.volume),
			String(resolved.pitch),
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

	/** RFC1123 + HMAC 鉴权 URL（与官方 demo 一致） */
	private buildAuthWsUrl(apiKey: string, apiSecret: string): string {
		const url = new URL(TTS_WS_URL);
		const date = new Date().toUTCString();
		const signOrigin = [
			`host: ${url.host}`,
			`date: ${date}`,
			`GET ${url.pathname} HTTP/1.1`,
		].join('\n');
		const signature = createHmac('sha256', apiSecret)
			.update(signOrigin)
			.digest('base64');
		const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
		const authorization = Buffer.from(authorizationOrigin).toString('base64');
		url.searchParams.set('host', url.host);
		url.searchParams.set('date', date);
		url.searchParams.set('authorization', authorization);
		return url.toString();
	}

	private buildRequestPayload(
		resolved: XfyunTtsResolved,
		appId: string,
	): string {
		// ponytail: 在线流式版单次合成 — 一帧带 status=2 + text，勿再发空结束帧（会 10163）
		return JSON.stringify({
			common: { app_id: appId },
			business: {
				aue: 'lame',
				sfl: 1,
				auf: 'audio/L16;rate=16000',
				vcn: resolved.vcn,
				speed: resolved.speed,
				volume: resolved.volume,
				pitch: resolved.pitch,
				tte: 'UTF8',
			},
			data: {
				status: 2,
				text: Buffer.from(resolved.text, 'utf8').toString('base64'),
			},
		});
	}

	private parseWsPayload(raw: unknown): XfyunWsMessage {
		if (typeof raw !== 'string') {
			throw new HttpException('讯飞 TTS 返回非文本帧', HttpStatus.BAD_GATEWAY);
		}
		try {
			return JSON.parse(raw) as XfyunWsMessage;
		} catch {
			throw new HttpException('讯飞 TTS 返回非 JSON', HttpStatus.BAD_GATEWAY);
		}
	}

	private assertXfyunOk(msg: XfyunWsMessage, context: string): void {
		if (msg.code == null || msg.code === 0) return;
		const detail = msg.message?.trim() || '讯飞 TTS 错误';
		if (msg.code === 11200) {
			throw new HttpException(
				`${context}（11200）：发音人未授权、在线合成服务未开通或额度已用尽。请到讯飞控制台 → 在线语音合成 → 发音人授权管理添加当前 vcn，或改用已开通发音人（默认 ${DEFAULT_XFYUN_TTS_VCN}）；并确认 XFYUN_APP_ID / API_KEY / API_SECRET 为同一应用。`,
				HttpStatus.BAD_GATEWAY,
			);
		}
		throw new HttpException(
			`${context}（${msg.code}）：${detail}`,
			HttpStatus.BAD_GATEWAY,
		);
	}

	/** ponytail: ws 包（Node 18 无全局 WebSocket；undici@8 需 Node 20+） */
	private synthesizeViaWebSocket(resolved: XfyunTtsResolved): Promise<Buffer> {
		const { appId, apiKey, apiSecret } = this.resolveCredentials();
		const requestPayload = this.buildRequestPayload(resolved, appId);
		const wsUrl = this.buildAuthWsUrl(apiKey, apiSecret);

		return new Promise((resolve, reject) => {
			const parts: Buffer[] = [];
			let settled = false;
			const finish = (err?: Error, buffer?: Buffer) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				try {
					ws.close();
				} catch {
					// ignore
				}
				if (err) reject(err);
				else resolve(buffer ?? Buffer.alloc(0));
			};

			const ws = new WebSocket(wsUrl);
			const timer = setTimeout(() => {
				finish(new HttpException('讯飞 TTS 超时', HttpStatus.GATEWAY_TIMEOUT));
			}, WS_TIMEOUT_MS);

			ws.on('open', () => {
				ws.send(requestPayload);
			});

			ws.on('message', (data) => {
				const raw =
					typeof data === 'string' ? data : Buffer.from(data).toString('utf8');
				const msg = this.parseWsPayload(raw);
				this.assertXfyunOk(msg, '讯飞语音合成');
				const audioB64 = msg.data?.audio?.trim();
				if (audioB64) {
					parts.push(Buffer.from(audioB64, 'base64'));
				}
				if (msg.data?.status === 2) {
					if (parts.length === 0) {
						finish(
							new HttpException(
								'讯飞语音合成未返回音频',
								HttpStatus.BAD_GATEWAY,
							),
						);
						return;
					}
					finish(undefined, Buffer.concat(parts));
				}
			});

			ws.on('error', () => {
				finish(
					new HttpException('讯飞 TTS WebSocket 错误', HttpStatus.BAD_GATEWAY),
				);
			});

			ws.on('close', () => {
				if (!settled && parts.length > 0) {
					finish(undefined, Buffer.concat(parts));
					return;
				}
				if (!settled) {
					finish(
						new HttpException(
							'讯飞 TTS 连接已关闭且无音频',
							HttpStatus.BAD_GATEWAY,
						),
					);
				}
			});
		});
	}

	async synthesizeSpeech(dto: XfyunTtsDto, userId?: number): Promise<Buffer> {
		const resolved = this.resolveOptions(dto);
		const cacheKey = this.buildCacheKey(resolved, userId);
		const cached = this.getFromCache(cacheKey);
		if (cached) return Buffer.from(cached);

		const buffer = await this.synthesizeViaWebSocket(resolved);
		this.setCache(cacheKey, buffer);
		return buffer;
	}

	async *streamSpeech(
		dto: XfyunTtsDto,
		userId?: number,
	): AsyncGenerator<Buffer> {
		const resolved = this.resolveOptions(dto);
		const cacheKey = this.buildCacheKey(resolved, userId);
		const cached = this.getFromCache(cacheKey);
		if (cached?.length) {
			yield cached;
			return;
		}

		const buffer = await this.synthesizeViaWebSocket(resolved);
		if (buffer.length) {
			this.setCache(cacheKey, buffer);
			yield buffer;
		}
	}

	resolveContentType(): string {
		return 'audio/mpeg';
	}
}
