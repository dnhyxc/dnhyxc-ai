import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeQaEnum } from '../../enum/config.enum';

const DEFAULT_TRANSCRIPTION_MODEL = 'FunAudioLLM/SenseVoiceSmall';
/** 硅基文档列出的转写模型（用于无自定义配置时的说明与校验参考） */
const KNOWN_TRANSCRIPTION_MODELS = new Set<string>([
	DEFAULT_TRANSCRIPTION_MODEL,
	'TeleAI/TeleSpeechASR',
]);
/** 允许硅基后续新增 model id，限制为常见路径字符，避免误配置注入 multipart 字段 */
const TRANSCRIPTION_MODEL_ID_RE = /^[A-Za-z0-9./_-]{3,96}$/;

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

	constructor(private readonly config: ConfigService) {}

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

	async transcribe(file: Express.Multer.File): Promise<{ text: string }> {
		const apiKey =
			this.config.get<string>(KnowledgeQaEnum.SILICONFLOW_API_KEY) ||
			this.config.get<string>(KnowledgeQaEnum.DASHSCOPE_API_KEY);
		if (!apiKey?.trim()) {
			throw new HttpException(
				'未配置 SILICONFLOW_API_KEY，无法进行语音识别',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}

		const baseUrl = (
			this.config.get<string>(KnowledgeQaEnum.SILICONFLOW_BASE_URL) ||
			'https://api.siliconflow.cn/v1'
		).replace(/\/$/, '');
		const url = `${baseUrl}/audio/transcriptions`;

		const formData = new FormData();
		const blob = new Blob([new Uint8Array(file.buffer)], {
			type: file.mimetype || 'application/octet-stream',
		});
		formData.append('file', blob, file.originalname || 'audio.webm');
		formData.append('model', this.resolveTranscriptionModel());

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
