import { HttpException, HttpStatus, Injectable, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ModelEnum } from 'src/enum/config.enum';

export type MinimaxTtsOptions = {
	model?: string;
	voiceId?: string;
	speed?: number;
	vol?: number;
	pitch?: number;
	outputFormat?: 'mp3' | 'wav' | 'pcm' | 'flac';
	useProCustomized?: boolean;
};

const MINIMAX_TTS_ENDPOINT = 'https://api.minimax.chat/v1/t2a_v3';
const DEFAULT_MINIMAX_MODEL = 'speech-2.4-thinking-pro';
const DEFAULT_MINIMAX_VOICE_ID = 'female-zhongjixiuxian-yufu';

function normalizeText(raw: string, maxBytes = 4096): string {
	const trimmed = raw?.replace(/\r\n/g, '\n').trim() ?? '';
	if (!trimmed) return '';
	let safe = trimmed
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
		.replace(/[{}|\\^[\]`~]/g, ' ');
	const encoder = new TextEncoder();
	const bytes = encoder.encode(safe);
	if (bytes.length <= maxBytes) return safe;
	const decoded = new TextDecoder('utf-8');
	return decoded.decode(bytes.slice(0, maxBytes));
}

@Injectable()
export class MinimaxTtsService {
	constructor(
		private readonly config: ConfigService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	isConfigured(): boolean {
		const apiKey = this.config.get<string>(ModelEnum.MINIMAX_API_KEY);
		const groupId = this.config.get<string>(ModelEnum.MINIMAX_GROUP_ID);
		return Boolean(apiKey?.trim()) && Boolean(groupId?.trim());
	}

	/**
	 * 调用 Minimax t2a_v3 将文本转换为语音（MP3 二进制）。
	 * @param text 要朗读的文本（中英文均可；建议单条 < 2000 字）
	 * @param opts 可选覆盖模型、音色、语速、音量等
	 */
	async synthesize(text: string, opts: MinimaxTtsOptions = {}): Promise<{
		buffer: Buffer;
		contentType: string;
		filename: string;
	}> {
		const apiKey = this.config.get<string>(ModelEnum.MINIMAX_API_KEY)?.trim();
		const groupId = this.config.get<string>(ModelEnum.MINIMAX_GROUP_ID)?.trim();
		if (!apiKey || !groupId) {
			throw new HttpException(
				'未配置 MINIMAX_API_KEY / MINIMAX_GROUP_ID，无法生成语音',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}

		const safeText = normalizeText(text);
		if (!safeText) {
			throw new HttpException('请传入要朗读的文本', HttpStatus.BAD_REQUEST);
		}

		const model =
			opts.model?.trim() ||
			this.config.get<string>(ModelEnum.MINIMAX_TTS_MODEL_NAME)?.trim() ||
			DEFAULT_MINIMAX_MODEL;
		const voiceId =
			opts.voiceId?.trim() ||
			this.config.get<string>(ModelEnum.MINIMAX_TTS_VOICE_ID)?.trim() ||
			DEFAULT_MINIMAX_VOICE_ID;

		const body: Record<string, unknown> = {
			model,
			text: safeText,
			voice_setting: {
				voice_id: voiceId,
				speed: typeof opts.speed === 'number' ? opts.speed : 1.0,
				vol: typeof opts.vol === 'number' ? opts.vol : 1.0,
				pitch: typeof opts.pitch === 'number' ? opts.pitch : 0,
			},
			audio_setting: {
				output_format: opts.outputFormat || 'mp3',
			},
		};
		if (opts.useProCustomized !== undefined) {
			body.use_pro_customized = opts.useProCustomized;
		}

		const url = `${MINIMAX_TTS_ENDPOINT}?GroupId=${encodeURIComponent(groupId)}`;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60_000);

		try {
			const resp = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});

			if (!resp.ok) {
				const errText = await resp.text().catch(() => '');
				throw new HttpException(
					`Minimax TTS 请求失败（${resp.status}）：${errText.slice(0, 300) || resp.statusText}`,
					HttpStatus.BAD_GATEWAY,
				);
			}

			const raw = await resp.text();
			let json: any = null;
			try {
				json = JSON.parse(raw);
			} catch {
				// 不是 JSON，有可能直接返回了音频
				throw new HttpException(
					'Minimax TTS 返回非 JSON 结构',
					HttpStatus.BAD_GATEWAY,
				);
			}

			if (!json || typeof json !== 'object') {
				throw new HttpException('Minimax TTS 返回结构异常', HttpStatus.BAD_GATEWAY);
			}

			// minimax 可能返回 base64 audio / audio_file_url 等，按接口版本不同
			// 优先取 data.audio_base64 / data.audio_file_url / data.audio_bytes 等
			const base64Audio: string | undefined =
				json?.data?.audio_base64 ??
				json?.audio_base64 ??
				json?.data?.audio_bytes ??
				json?.audio_bytes;
			const audioUrl: string | undefined =
				json?.data?.audio_file_url ?? json?.audio_file_url;

			if (!base64Audio && !audioUrl) {
				const errMsg =
					json?.message ??
					json?.status_msg ??
					JSON.stringify(json, null, 0).slice(0, 200);
				throw new HttpException(
					`Minimax TTS 未返回音频数据：${errMsg}`,
					HttpStatus.BAD_GATEWAY,
				);
			}

			const buffer = base64Audio
				? Buffer.from(base64Audio, 'base64')
				: await this.fetchAudioFromUrl(audioUrl!);

			return {
				buffer,
				contentType: `audio/${opts.outputFormat || 'mp3'}`,
				filename: `minimax-${Date.now()}.${opts.outputFormat || 'mp3'}`,
			};
		} catch (err: unknown) {
			if (err instanceof HttpException) throw err;
			const msg = err instanceof Error ? err.message : String(err);
			this.logger.error(`[MinimaxTtsService] synthesize failed: ${msg}`);
			throw new HttpException(
				`Minimax TTS 生成失败：${msg}`,
				HttpStatus.BAD_GATEWAY,
			);
		} finally {
			clearTimeout(timeout);
		}
	}

	private async fetchAudioFromUrl(url: string): Promise<Buffer> {
		const resp = await fetch(url, { method: 'GET' });
		if (!resp.ok) {
			throw new HttpException(
				`Minimax TTS 音频下载失败（${resp.status}）`,
				HttpStatus.BAD_GATEWAY,
			);
		}
		const arrayBuffer = await resp.arrayBuffer();
		return Buffer.from(arrayBuffer);
	}
}
