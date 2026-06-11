import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinimaxEnum } from '../../enum/config.enum';
import type { MinimaxTtsDto } from './dto/minimax-tts.dto';

const TTS_INPUT_MAX_CHARS = 10_000;
const TTS_SPEECH_CACHE_MAX = 128;

/**
 * MiniMaxTtsResolved
 * 解析后的 TTS 请求参数对象。
 * 该类型汇总了前端传入 DTO 字段、环境变量默认值，以及后端硬编码的最终参数，
 * 用于 MiniMax T2A 语音合成 API 的请求构建（包含完整合成参数，便于准确生成缓存 key）。
 *
 * 字段含义详解：
 * @property text                经过 trim 和最大长度裁剪的朗读文本，直接用于 TTS
 * @property model               MiniMax 语音合成模型，如 'speech-2.8-hd'
 * @property voiceId             MiniMax 语音人声 ID，如 'English_radiant_girl'
 * @property speed               语速，浮点数，1 为标准语速
 * @property vol                 音量，浮点数，1 为标准音量
 * @property pitch               音高，数字，0 为标准音高，正负变化升降调
 * @property emotion             （可选）情感标签，部分模型支持，传递给 MiniMax
 * @property sampleRate          采样率，整数（如 32000），音频质量相关
 * @property bitrate             比特率，整数（如 128000），音频文件体积和码率
 * @property format              返回音频格式，如 'mp3'、'wav'
 * @property channel             声道数，1 单声道 2 双声道
 * @property languageBoost       （可选）提升某语言发音表现，如 'english'
 * @property subtitleEnable      是否输出时间轴字幕，布尔值
 * @property pronunciationTone   （可选）发音字典 tone 针对自定义读音优化，字符串数组
 * @property textNormalization   （可选）输入文本是否自动标准化（如数字转英文读音），布尔
 */
type MinimaxTtsResolved = {
	text: string; // 待朗读文本（已 trim 并截断）
	model: string; // 合成模型 ID
	voiceId: string; // 发声人 ID
	speed: number; // 语速
	vol: number; // 音量
	pitch: number; // 音高
	emotion?: string; // （可选）情感标签
	sampleRate: number; // 采样率（Hz）
	bitrate: number; // 比特率（bps）
	format: string; // 输出音频格式
	channel: number; // 声道数（1/2）
	languageBoost?: string; // （可选）提升特定语言表现
	subtitleEnable: boolean; // 是否输出时间轴字幕
	pronunciationTone?: string[]; // （可选）自定义发音字典 tone
	textNormalization?: boolean; // （可选）自动文本标准化
};

type MinimaxT2aChunk = {
	data?: {
		audio?: string;
		status?: number;
	};
	base_resp?: {
		status_code?: number;
		status_msg?: string;
	};
};

/**
 * MiniMax 同步/流式 T2A（speech-2.8-hd 等）。
 * @see https://platform.minimaxi.com/docs/api-reference/speech-t2a-http
 *
 * 说明：TTS 为低延迟二进制流，直接 HTTP 转发 MiniMax `/v1/t2a_v2`；
 * 不使用 LangChain createAgent（Agent 适用于 LLM 工具编排，不适合点击即播的 TTS 管道）。
 */
@Injectable()
export class MinimaxTtsService {
	// 日志实例，标记当前服务名
	private readonly logger = new Logger(MinimaxTtsService.name);

	// 简单 LRU（最近最少使用）缓存，缓存的 key 为参数组合，value 为 Buffer 音频
	private readonly speechCache = new Map<string, Buffer>();

	/**
	 * @param config 注入的配置服务
	 */
	constructor(private readonly config: ConfigService) {}

	/**
	 * 获取并裁剪环境变量值
	 * @param key 环境变量 Key
	 * @returns 去除首尾空白后的字符串（如无内容返回 undefined）
	 */
	private trimEnv(key: string): string | undefined {
		const raw = this.config.get<string>(key);
		if (raw == null) return undefined;
		const trimmed = String(raw).trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	/**
	 * 解析 MiniMax TTS 调用所需的认证信息
	 * @returns 对象包含 apiKey, groupId, baseUrl
	 */
	private resolveCredentials(): {
		apiKey: string;
		groupId?: string;
		baseUrl: string;
	} {
		const apiKey = this.trimEnv(MinimaxEnum.MINIMAX_API_KEY);
		if (!apiKey) {
			throw new HttpException(
				'未配置 MINIMAX_API_KEY，无法进行 MiniMax 语音合成',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
		const baseUrl =
			this.trimEnv(MinimaxEnum.MINIMAX_TTS_BASE_URL)?.replace(/\/$/, '') ??
			'https://api.minimaxi.com';
		return {
			apiKey,
			groupId: this.trimEnv(MinimaxEnum.MINIMAX_GROUP_ID),
			baseUrl,
		};
	}

	/**
	 * 对外数据传输对象参数标准化、裁剪、填默认
	 * @param dto
	 * @returns MinimaxTtsResolved
	 */
	resolveOptions(dto: MinimaxTtsDto): MinimaxTtsResolved {
		const plain = dto.text.trim().slice(0, TTS_INPUT_MAX_CHARS);
		if (!plain) {
			throw new HttpException('朗读文本为空', HttpStatus.BAD_REQUEST);
		}
		return {
			text: plain,
			model:
				dto.model?.trim() ||
				(this.trimEnv(MinimaxEnum.MINIMAX_TTS_MODEL) ?? 'speech-2.8-hd'),
			voiceId:
				dto.voiceId?.trim() ||
				(this.trimEnv(MinimaxEnum.MINIMAX_TTS_VOICE_ID) ??
					'English_captivating_female1'),
			speed: dto.speed ?? 1,
			vol: dto.vol ?? 1,
			pitch: dto.pitch ?? 0,
			emotion: dto.emotion,
			sampleRate: dto.sampleRate ?? 32_000,
			bitrate: dto.bitrate ?? 128_000,
			format: dto.format?.trim() || 'mp3',
			channel: dto.channel ?? 1,
			languageBoost: dto.languageBoost?.trim(),
			subtitleEnable: dto.subtitleEnable ?? false,
			pronunciationTone: dto.pronunciationTone,
			textNormalization: dto.textNormalization,
		};
	}

	/**
	 * 根据 TTS 参数生成可唯一标识缓存的 key（全拼连接）
	 * @param resolved TTS 参数
	 * @param userId 登录用户 id，避免同设备多账号共用 LRU 条目
	 */
	private buildCacheKey(resolved: MinimaxTtsResolved, userId?: number): string {
		return [
			userId != null && userId > 0 ? String(userId) : '0',
			resolved.model,
			resolved.voiceId,
			String(resolved.speed),
			String(resolved.vol),
			String(resolved.pitch),
			resolved.emotion ?? '',
			String(resolved.sampleRate),
			String(resolved.bitrate),
			resolved.format,
			String(resolved.channel),
			resolved.languageBoost ?? '',
			resolved.text,
		].join('\u0001'); // 使用不可打印分隔符避免歧义
	}

	/**
	 * 从 LRU 缓存获取音频，如果命中则把项移动到 Map 尾部（最近使用）
	 * @param key 缓存 key
	 * @returns 音频 Buffer 或 null
	 */
	private getFromCache(key: string): Buffer | null {
		const hit = this.speechCache.get(key);
		if (!hit) return null;
		// 先删除再 set，起到 LRU 作用
		this.speechCache.delete(key);
		this.speechCache.set(key, hit);
		return hit;
	}

	/**
	 * 设置缓存，并维持 LRU 缓存最大长度
	 * @param key
	 * @param buffer
	 */
	private setCache(key: string, buffer: Buffer): void {
		if (this.speechCache.has(key)) {
			this.speechCache.delete(key);
		}
		this.speechCache.set(key, buffer);
		while (this.speechCache.size > TTS_SPEECH_CACHE_MAX) {
			const oldest = this.speechCache.keys().next().value;
			if (oldest === undefined) break;
			this.speechCache.delete(oldest);
		}
	}

	/**
	 * 构造 MiniMax TTS 请求体
	 * @param resolved 结构化参数
	 * @param stream 是否流式
	 * @returns 请求体对象
	 */
	private buildRequestBody(
		resolved: MinimaxTtsResolved,
		stream: boolean,
	): Record<string, unknown> {
		const voiceSetting: Record<string, unknown> = {
			voice_id: resolved.voiceId, // 发音人
			speed: resolved.speed, // 语速
			vol: resolved.vol, // 音量
			pitch: resolved.pitch, // 音高
		};
		// 可选情感、标准化
		if (resolved.emotion) {
			voiceSetting.emotion = resolved.emotion;
		}
		if (resolved.textNormalization != null) {
			voiceSetting.text_normalization = resolved.textNormalization;
		}

		const body: Record<string, unknown> = {
			model: resolved.model, // 合成模型
			text: resolved.text, // 文本
			stream, // 是否流式
			voice_setting: voiceSetting, // 发音人设置
			audio_setting: {
				// 音频参数
				sample_rate: resolved.sampleRate,
				bitrate: resolved.bitrate,
				format: resolved.format,
				channel: resolved.channel,
			},
			subtitle_enable: resolved.subtitleEnable, // 是否输出时间轴字幕
		};

		// 流式参数（排除聚合流音频）
		if (stream) {
			body.stream_options = { exclude_aggregated_audio: true };
		}
		// 可选语言增强参数
		if (resolved.languageBoost) {
			body.language_boost = resolved.languageBoost;
		}
		// 可选自定义读音（tone）
		if (resolved.pronunciationTone?.length) {
			body.pronunciation_dict = { tone: resolved.pronunciationTone };
		}
		return body;
	}

	/**
	 * 构造 MiniMax 请求所需 header
	 * @param apiKey
	 * @param groupId
	 * @returns header 对象
	 */
	private buildHeaders(
		apiKey: string,
		groupId?: string,
	): Record<string, string> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${apiKey}`, // 认证
			'Content-Type': 'application/json',
		};
		// groupId 有则追加
		if (groupId) {
			headers['Group-Id'] = groupId;
		}
		return headers;
	}

	/**
	 * 检查 MiniMax 返回 chunk 是否正常，否则抛错
	 * @param chunk 返回切片
	 * @param context 上下文说明
	 */
	private assertMiniMaxOk(chunk: MinimaxT2aChunk, context: string): void {
		const code = chunk.base_resp?.status_code;
		if (code == null || code === 0) return; // 0 正常
		const msg = chunk.base_resp?.status_msg?.trim() || 'MiniMax T2A 错误';
		throw new HttpException(
			`${context}（${code}）：${msg}`,
			code === 1004 ? HttpStatus.UNAUTHORIZED : HttpStatus.BAD_GATEWAY,
		);
	}

	/**
	 * 解码 hex 格式的音频片段为 Buffer
	 * @param hex 字符串形式的 16 进制音频
	 * @returns Audio Buffer | null
	 */
	private decodeHexAudio(hex: string | undefined): Buffer | null {
		const cleaned = hex?.trim();
		if (!cleaned) return null;
		if (cleaned.length % 2 !== 0) {
			this.logger.warn('MiniMax T2A 返回非法 hex 音频长度');
			return null;
		}
		return Buffer.from(cleaned, 'hex');
	}

	/**
	 * 解析 miniMax 流式 chunk 文本为对象
	 * @param buffer 流式响应片段字符串
	 * @yields MinimaxT2aChunk
	 */
	private *parseStreamPayloadLines(buffer: string): Generator<MinimaxT2aChunk> {
		for (const rawLine of buffer.split('\n')) {
			const line = rawLine.trim();
			if (!line || line === 'data: [DONE]') continue;
			// 兼容 "data: ...", "[DONE]", 或干脆没有 data: 前缀
			const jsonText = line.startsWith('data:') ? line.slice(5).trim() : line;
			if (!jsonText || jsonText === '[DONE]') continue;
			try {
				const parsed = JSON.parse(jsonText) as
					| MinimaxT2aChunk
					| MinimaxT2aChunk[];
				if (Array.isArray(parsed)) {
					for (const item of parsed) yield item;
				} else {
					yield parsed;
				}
			} catch {
				// 出现非 JSON 不中断，只跳过本块
				this.logger.warn(
					`MiniMax T2A 流式 JSON 解析跳过: ${jsonText.slice(0, 120)}`,
				);
			}
		}
	}

	/**
	 * 按 miniMax 流式响应返回 Async chunk 序列
	 * @param body ReadableStream
	 * @yields MiniMax T2A API 的 chunk
	 */
	private async *iterateMiniMaxStream(
		body: ReadableStream<Uint8Array> | null,
	): AsyncGenerator<MinimaxT2aChunk> {
		if (!body) {
			throw new HttpException('MiniMax T2A 无响应体', HttpStatus.BAD_GATEWAY);
		}
		const reader = body.getReader();
		const decoder = new TextDecoder();
		let pending = '';
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				pending += decoder.decode(value, { stream: true });
				const lastNewline = pending.lastIndexOf('\n');
				if (lastNewline < 0) continue;
				const chunk = pending.slice(0, lastNewline + 1);
				pending = pending.slice(lastNewline + 1);
				yield* this.parseStreamPayloadLines(chunk);
			}
			// 处理末尾没有换行的内容
			if (pending.trim()) {
				yield* this.parseStreamPayloadLines(pending);
			}
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * 实际发起 MiniMax 请求
	 * @param resolved 结构化参数
	 * @param stream 是否流式
	 * @returns fetch Response
	 */
	private async requestMiniMax(
		resolved: MinimaxTtsResolved,
		stream: boolean,
	): Promise<Response> {
		const { apiKey, groupId, baseUrl } = this.resolveCredentials();
		const url = `${baseUrl}/v1/t2a_v2`;
		return fetch(url, {
			method: 'POST',
			headers: this.buildHeaders(apiKey, groupId),
			body: JSON.stringify(this.buildRequestBody(resolved, stream)),
		});
	}

	/**
	 * 以非流式方式合成语音，整体返回 Buffer，具备 LRU 缓存
	 * 命中缓存优先返回缓存，未命中则请求 MiniMax，再缓存结果
	 * @param dto 入口参数
	 * @returns 音频 Buffer
	 */
	async synthesizeSpeech(dto: MinimaxTtsDto, userId?: number): Promise<Buffer> {
		const resolved = this.resolveOptions(dto);
		const cacheKey = this.buildCacheKey(resolved, userId);
		const cached = this.getFromCache(cacheKey);
		if (cached) return Buffer.from(cached);

		const res = await this.requestMiniMax(resolved, false);
		const raw = await res.text();
		if (!res.ok) {
			throw new HttpException(
				`MiniMax 语音合成失败（${res.status}）：${raw.slice(0, 500)}`,
				res.status >= 400 && res.status < 600
					? res.status
					: HttpStatus.BAD_GATEWAY,
			);
		}

		let json: MinimaxT2aChunk | MinimaxT2aChunk[];
		try {
			json = JSON.parse(raw) as MinimaxT2aChunk | MinimaxT2aChunk[];
		} catch {
			throw new HttpException(
				'MiniMax 语音合成返回非 JSON',
				HttpStatus.BAD_GATEWAY,
			);
		}

		// 支持数组和单对象
		const chunks = Array.isArray(json) ? json : [json];
		const parts: Buffer[] = [];
		for (const item of chunks) {
			this.assertMiniMaxOk(item, 'MiniMax 语音合成');
			const audio = this.decodeHexAudio(item.data?.audio);
			if (audio?.length) parts.push(audio);
		}
		if (parts.length === 0) {
			throw new HttpException(
				'MiniMax 语音合成未返回音频',
				HttpStatus.BAD_GATEWAY,
			);
		}
		const buffer = Buffer.concat(parts); // 合并所有音频片段
		this.setCache(cacheKey, buffer);
		return buffer;
	}

	/**
	 * 以流式方式合成语音，将每个 chunk buffer 逐个 yield，适配 HTTP chunked
	 * 命中缓存则只 yield 一次全部音频（保持接口一致性）
	 * @param dto 入口参数
	 */
	async *streamSpeech(
		dto: MinimaxTtsDto,
		userId?: number,
	): AsyncGenerator<Buffer> {
		const resolved = this.resolveOptions(dto);
		const cacheKey = this.buildCacheKey(resolved, userId);
		const cached = this.getFromCache(cacheKey);
		if (cached?.length) {
			yield cached;
			return;
		}

		const res = await this.requestMiniMax(resolved, true);
		if (!res.ok) {
			const raw = await res.text();
			throw new HttpException(
				`MiniMax 流式语音合成失败（${res.status}）：${raw.slice(0, 500)}`,
				res.status >= 400 && res.status < 600
					? res.status
					: HttpStatus.BAD_GATEWAY,
			);
		}

		const parts: Buffer[] = [];
		for await (const item of this.iterateMiniMaxStream(res.body)) {
			this.assertMiniMaxOk(item, 'MiniMax 流式语音合成');
			const audio = this.decodeHexAudio(item.data?.audio);
			if (audio?.length) {
				parts.push(audio);
				yield audio;
			}
		}
		if (parts.length > 0) {
			this.setCache(cacheKey, Buffer.concat(parts));
		}
	}

	/**
	 * 按音频格式返回对应 HTTP Content-Type（MIME）
	 * @param format mp3/wav/flac/opus/pcm/...
	 */
	resolveContentType(format: string): string {
		switch (format) {
			case 'mp3':
				return 'audio/mpeg';
			case 'wav':
			case 'pcmu_wav':
				return 'audio/wav';
			case 'flac':
				return 'audio/flac';
			case 'opus':
				return 'audio/opus';
			case 'pcm':
			case 'pcmu_raw':
				return 'audio/pcm';
			default:
				return 'application/octet-stream';
		}
	}
}
