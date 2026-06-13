import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeQaEnum, ModelEnum } from '../../enum/config.enum';

const DEFAULT_TRANSCRIPTION_MODEL = 'FunAudioLLM/SenseVoiceSmall';
const DEFAULT_TTS_MODEL = 'FunAudioLLM/CosyVoice2-0.5B';
/** 硅基预置女声：claire（温柔女声） */
const DEFAULT_TTS_VOICE = 'FunAudioLLM/CosyVoice2-0.5B:claire';
const TTS_INPUT_MAX_CHARS = 4096;
/** 同文朗读缓存上限（CosyVoice2 无 seed，缓存保证重复播放读音一致） */
const TTS_SPEECH_CACHE_MAX = 256;
/** 硅基文档列出的转写模型（用于无自定义配置时的说明与校验参考） */
const KNOWN_TRANSCRIPTION_MODELS = new Set<string>([
	DEFAULT_TRANSCRIPTION_MODEL,
	'TeleAI/TeleSpeechASR',
]);
/** 允许硅基后续新增 model id，限制为常见路径字符，避免误配置注入 multipart 字段 */
const TRANSCRIPTION_MODEL_ID_RE = /^[A-Za-z0-9./_-]{3,96}$/;
/** OpenAI 兼容转写可选字段 language，仅发送合法两字母代码 */
const TRANSCRIPTION_LANGUAGE_RE = /^[a-z]{2}$/;

/**
 * SenseVoice 等常返回 `<|zh|><|NEUTRAL|>` 类富标签，剥离后更利于直接回填输入框。
 */
function normalizeAsrPlainText(raw: string): string {
	let s = raw.trim().replace(/<[^>]+>/g, '');
	s = s
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return s;
}

/**
 * 硅基流动 OpenAI 兼容「语音转文字」：POST /v1/audio/transcriptions
 * 模型默认 FunAudioLLM/SenseVoiceSmall，可用环境变量 SILICONFLOW_TRANSCRIPTION_MODEL 覆盖。
 * 供 Chat、Knowledge 等业务模块注入复用。
 */
@Injectable()
export class SiliconflowTranscriptionService {
	private readonly logger = new Logger(SiliconflowTranscriptionService.name);
	/** 文本 + 模型/音色参数 → MP3，避免 CosyVoice 每次合成发音漂移 */
	private readonly ttsSpeechCache = new Map<string, Buffer>();

	constructor(private readonly config: ConfigService) {}

	private buildTtsSpeechCacheKey(plain: string): string {
		return [
			this.resolveTtsModel(),
			this.resolveTtsVoice(),
			'1',
			'0',
			plain,
		].join('\u0001');
	}

	private getTtsSpeechFromCache(key: string): Buffer | null {
		const hit = this.ttsSpeechCache.get(key);
		if (!hit) return null;
		this.ttsSpeechCache.delete(key);
		this.ttsSpeechCache.set(key, hit);
		return hit;
	}

	private setTtsSpeechCache(key: string, buffer: Buffer): void {
		if (this.ttsSpeechCache.has(key)) {
			this.ttsSpeechCache.delete(key);
		}
		this.ttsSpeechCache.set(key, buffer);
		while (this.ttsSpeechCache.size > TTS_SPEECH_CACHE_MAX) {
			const oldest = this.ttsSpeechCache.keys().next().value;
			if (oldest === undefined) break;
			this.ttsSpeechCache.delete(oldest);
		}
	}

	private resolveTranscriptionModel(): string {
		const configured = this.config
			.get<string>(KnowledgeQaEnum.SILICONFLOW_TRANSCRIPTION_MODEL)
			?.trim();
		if (!configured) return DEFAULT_TRANSCRIPTION_MODEL;
		if (!TRANSCRIPTION_MODEL_ID_RE.test(configured)) {
			this.logger.warn(
				`SILICONFLOW_TRANSCRIPTION_MODEL 格式无效，已回退为 ${DEFAULT_TRANSCRIPTION_MODEL}`,
			);
			return DEFAULT_TRANSCRIPTION_MODEL;
		}
		if (!KNOWN_TRANSCRIPTION_MODELS.has(configured)) {
			this.logger.log(`语音转写使用自定义模型: ${configured}`);
		}
		return configured;
	}

	private resolveTtsModel(): string {
		const configured = this.config
			.get<string>(KnowledgeQaEnum.SILICONFLOW_TTS_MODEL)
			?.trim();
		if (!configured) return DEFAULT_TTS_MODEL;
		if (!TRANSCRIPTION_MODEL_ID_RE.test(configured)) {
			this.logger.warn(
				`SILICONFLOW_TTS_MODEL 格式无效，已回退为 ${DEFAULT_TTS_MODEL}`,
			);
			return DEFAULT_TTS_MODEL;
		}
		return configured;
	}

	private resolveTtsVoice(): string {
		const configured = this.config
			.get<string>(KnowledgeQaEnum.SILICONFLOW_TTS_VOICE)
			?.trim();
		if (!configured) return DEFAULT_TTS_VOICE;
		return configured;
	}

	/**
	 * 硅基流动 OpenAI 兼容 TTS：POST /v1/audio/speech，返回 MP3 二进制。
	 */
	async synthesizeSpeech(text: string): Promise<Buffer> {
		const plain = text.trim().slice(0, TTS_INPUT_MAX_CHARS);
		if (!plain) {
			throw new HttpException('朗读文本为空', HttpStatus.BAD_REQUEST);
		}

		const cacheKey = this.buildTtsSpeechCacheKey(plain);
		const cached = this.getTtsSpeechFromCache(cacheKey);
		if (cached) {
			return Buffer.from(cached);
		}

		const apiKey = this.config.get<string>(ModelEnum.SILICONFLOW_API_KEY);
		if (!apiKey?.trim()) {
			throw new HttpException(
				'未配置 SILICONFLOW_API_KEY，无法进行语音合成',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}

		const baseUrl = (
			this.config.get<string>(ModelEnum.SILICONFLOW_BASE_URL) ||
			'https://api.siliconflow.cn/v1'
		).replace(/\/$/, '');
		const url = `${baseUrl}/audio/speech`;

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey.trim()}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: this.resolveTtsModel(),
				input: plain,
				voice: this.resolveTtsVoice(),
				response_format: 'mp3',
				speed: 1,
				gain: 0,
			}),
		});

		if (!res.ok) {
			const raw = await res.text();
			throw new HttpException(
				`语音合成失败（${res.status}）：${raw.slice(0, 500)}`,
				res.status >= 400 && res.status < 600
					? res.status
					: HttpStatus.BAD_GATEWAY,
			);
		}

		const buffer = Buffer.from(await res.arrayBuffer());
		this.setTtsSpeechCache(cacheKey, buffer);
		return buffer;
	}

	async transcribe(file: Express.Multer.File): Promise<{ text: string }> {
		const apiKey = this.config.get<string>(ModelEnum.SILICONFLOW_API_KEY);
		if (!apiKey?.trim()) {
			throw new HttpException(
				'未配置 SILICONFLOW_API_KEY，无法进行语音识别',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}

		const baseUrl = (
			this.config.get<string>(ModelEnum.SILICONFLOW_BASE_URL) ||
			'https://api.siliconflow.cn/v1'
		).replace(/\/$/, '');
		const url = `${baseUrl}/audio/transcriptions`;

		const formData = new FormData();
		const blob = new Blob([new Uint8Array(file.buffer)], {
			type: file.mimetype || 'application/octet-stream',
		});
		formData.append('file', blob, file.originalname || 'audio.webm');
		formData.append('model', this.resolveTranscriptionModel());

		// 读取环境变量中配置的语音转写语言选项，并去除首尾空格
		const rawLang = this.config
			.get<string>(KnowledgeQaEnum.SILICONFLOW_TRANSCRIPTION_LANGUAGE)
			?.trim();

		// 判断是否显式要求不传递 language 参数（如：off、none、disabled，大小写不敏感）
		const skipLang = rawLang && /^(off|none|disabled)$/i.test(rawLang);

		// 如果未禁用 language 传参，则根据配置拼接 language 字段，未配置则默认 'zh'
		if (!skipLang) {
			// 若环境变量配置的语言合理，取其小写；否则降级为 'zh'
			const lang =
				rawLang && TRANSCRIPTION_LANGUAGE_RE.test(rawLang)
					? rawLang.toLowerCase()
					: 'zh';
			// 仅当 lang 匹配有效正则（极端防御）时，传入 FormData
			if (TRANSCRIPTION_LANGUAGE_RE.test(lang)) {
				formData.append('language', lang);
			}
		}

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey.trim()}`,
			},
			body: formData,
		});

		const raw = await res.text();
		if (!res.ok) {
			throw new HttpException(
				`语音识别失败（${res.status}）：${raw.slice(0, 500)}`,
				res.status >= 400 && res.status < 600
					? res.status
					: HttpStatus.BAD_GATEWAY,
			);
		}

		let json: { text?: string } = {};
		try {
			json = JSON.parse(raw) as { text?: string };
		} catch {
			throw new HttpException('语音识别返回非 JSON', HttpStatus.BAD_GATEWAY);
		}

		const text =
			typeof json.text === 'string'
				? json.text
				: ((json as { data?: { text?: string } }).data?.text ?? '');
		return { text: normalizeAsrPlainText(text) };
	}
}
