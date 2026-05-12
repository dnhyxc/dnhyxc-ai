/**
 * 英语学习「单词包 / 经典句」共用 SSE 客户端：消费 `POST .../stream` 的 `data: JSON` 行协议。
 * 两套事件前缀（`vocab.*` / `classic.*`）仅配置与 `parseItems` 不同，读流与 abort 逻辑一致，便于维护。
 */
import { Toast } from '@ui/index';
import { BASE_URL } from '@/constant';
import { notifyUnauthorized } from '@/router/authSession';
import {
	type EnglishClassicQuoteItem,
	type EnglishVocabularyItem,
	postEnglishLearningStreamCancel,
} from '@/service';
import {
	ENGLISH_LEARNING_CLASSIC_QUOTES_STREAM,
	ENGLISH_LEARNING_VOCABULARY_PACK_STREAM,
} from '@/service/api';
import { getPlatformFetch } from '@/utils/fetch';

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

/** 与 Nest SSE 包装层一致：可能为 `{ data: { type, ... } }` 或扁平 JSON */
function unwrapPackPayload(
	raw: Record<string, unknown>,
	typePrefix: string,
): Record<string, unknown> {
	const inner = raw.data;
	if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
		const o = inner as Record<string, unknown>;
		if (typeof o.type === 'string' && o.type.startsWith(typePrefix)) {
			return o;
		}
	}
	return raw;
}

function parseVocabItems(raw: unknown): EnglishVocabularyItem[] {
	if (!Array.isArray(raw)) return [];
	const out: EnglishVocabularyItem[] = [];
	for (const x of raw) {
		if (!x || typeof x !== 'object') continue;
		const o = x as Record<string, unknown>;
		if (typeof o.word !== 'string' || typeof o.ipa !== 'string') continue;
		out.push({
			word: o.word,
			ipa: o.ipa,
			translationZh:
				typeof o.translationZh === 'string' ? o.translationZh : '—',
			example: typeof o.example === 'string' ? o.example : '—',
		});
	}
	return out;
}

function parseClassicItems(raw: unknown): EnglishClassicQuoteItem[] {
	if (!Array.isArray(raw)) return [];
	const out: EnglishClassicQuoteItem[] = [];
	for (const x of raw) {
		if (!x || typeof x !== 'object') continue;
		const o = x as Record<string, unknown>;
		const english = typeof o.english === 'string' ? o.english.trim() : '';
		const translationZh =
			typeof o.translationZh === 'string' ? o.translationZh.trim() : '';
		if (!english || !translationZh) continue;
		out.push({
			english,
			translationZh,
			source: typeof o.source === 'string' ? o.source.trim() : '—',
			noteZh: typeof o.noteZh === 'string' ? o.noteZh.trim() : '—',
		});
	}
	return out;
}

/** 进度事件公共形状（与后端 `*.progress` 一致） */
export type EnglishPackStreamProgress = {
	/** 与后端 SSE 首帧一致，用于显式 cancel */
	streamId?: string;
	collected: number;
	target: number;
	round: number;
};

export type EnglishVocabStreamProgress = EnglishPackStreamProgress;
export type EnglishClassicStreamProgress = EnglishPackStreamProgress;

export type EnglishPackStreamChunk<TItem> = {
	streamId?: string;
	round: number;
	collected: number;
	target: number;
	items: TItem[];
};

export type EnglishVocabStreamChunk =
	EnglishPackStreamChunk<EnglishVocabularyItem>;
export type EnglishClassicStreamChunk =
	EnglishPackStreamChunk<EnglishClassicQuoteItem>;

/** Agent 工具事件（与后端 `*.agent_tool` 对齐） */
export type EnglishPackAgentToolEvent = {
	phase: 'start' | 'end';
	name: string;
	query?: string;
};

export type EnglishVocabAgentToolEvent = EnglishPackAgentToolEvent;
export type EnglishClassicAgentToolEvent = EnglishPackAgentToolEvent;

export type EnglishPackStreamCallbacks<TItem> = {
	onProgress?: (p: EnglishPackStreamProgress) => void;
	/** Agent 调用联网 / 知识库等工具时回调，用于前端展示 */
	onAgentTool?: (e: EnglishPackAgentToolEvent) => void;
	/** 每轮 LLM 合并后的新条目（与后端入库批次一致），用于实时追加 UI */
	onChunk?: (chunk: EnglishPackStreamChunk<TItem>) => void;
	/** 正常结束：携带条目与请求条数（用于部分成功提示） */
	onDone?: (payload: {
		items: TItem[];
		requested: number;
		streamId?: string;
	}) => void;
	onError?: (message: string) => void;
	/** 用户点击取消触发的中断（非静默替换上一轮请求） */
	onUserAbort?: () => void;
	/** 流结束但未收到 complete（网络异常等） */
	onIncomplete?: () => void;
};

export type EnglishVocabStreamCallbacks =
	EnglishPackStreamCallbacks<EnglishVocabularyItem>;
export type EnglishClassicStreamCallbacks =
	EnglishPackStreamCallbacks<EnglishClassicQuoteItem>;

interface PackSseDefinition<TItem> {
	readonly defaultApi: string;
	/** 事件命名空间前缀，如 `vocab.`、`classic.`（须带点，便于 `startsWith`） */
	readonly typePrefix: string;
	readonly parseFailTitle: string;
	readonly streamErrorFallback: string;
	readonly parseItems: (raw: unknown) => TItem[];
}

async function runEnglishLearningPackSseStream<TItem>(
	def: PackSseDefinition<TItem>,
	options: {
		api?: string;
		body: {
			topic: string;
			/** 省略时由后端按单次上限拉取 */
			count?: number;
		};
		callbacks: EnglishPackStreamCallbacks<TItem>;
	},
): Promise<(fromUser?: boolean) => void> {
	const {
		api = def.defaultApi,
		body,
		callbacks: {
			onProgress,
			onAgentTool,
			onChunk,
			onDone,
			onError,
			onUserAbort,
			onIncomplete,
		},
	} = options;

	const controller = new AbortController();
	let userAbortRequested = false;
	let receivedComplete = false;
	let endedWithError = false;
	let serverStreamId: string | undefined;
	let streamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;

	const tp = def.typePrefix;

	try {
		const platformFetch = await getPlatformFetch();
		const requestBody =
			body.count == null
				? { topic: body.topic }
				: { topic: body.topic, count: body.count };
		const response = await platformFetch(BASE_URL + api, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${readToken()}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
			signal: controller.signal,
		});

		if (!response.ok) {
			if (response.status === 401) {
				notifyUnauthorized();
				throw new Error('请先登录后再试');
			}
			throw new Error(`HTTP ${response.status}`);
		}

		streamReader = response.body?.getReader();
		if (!streamReader) {
			throw new Error('无法读取流式响应');
		}

		const reader = streamReader;
		const decoder = new TextDecoder('utf-8');
		let buffer = '';

		const processLine = (line: string): boolean => {
			const trimmed = line.trim();
			if (!trimmed.startsWith('data:')) return false;
			const dataStr = trimmed.slice(5).trimStart();
			if (!dataStr) return false;

			let raw: Record<string, unknown>;
			try {
				raw = JSON.parse(dataStr) as Record<string, unknown>;
			} catch {
				Toast({ type: 'error', title: def.parseFailTitle });
				return false;
			}

			const parsed = unwrapPackPayload(raw, tp);
			const type = parsed.type;

			if (type === `${tp}progress`) {
				const collected = Number(parsed.collected);
				const target = Number(parsed.target);
				const round = Number(parsed.round);
				const sid =
					typeof parsed.streamId === 'string' ? parsed.streamId : undefined;
				if (sid) serverStreamId = sid;
				if (
					Number.isFinite(collected) &&
					Number.isFinite(target) &&
					Number.isFinite(round)
				) {
					onProgress?.({
						streamId: sid,
						collected,
						target,
						round,
					});
				}
				return false;
			}

			if (type === `${tp}agent_tool`) {
				const phase = parsed.phase === 'end' ? 'end' : 'start';
				const name = typeof parsed.name === 'string' ? parsed.name : '';
				const query =
					typeof parsed.query === 'string' ? parsed.query : undefined;
				onAgentTool?.({ phase, name, query });
				return false;
			}

			if (type === `${tp}chunk`) {
				const collected = Number(parsed.collected);
				const target = Number(parsed.target);
				const round = Number(parsed.round);
				const items = def.parseItems(parsed.items);
				const streamId =
					typeof parsed.streamId === 'string' ? parsed.streamId : undefined;
				if (
					items.length > 0 &&
					Number.isFinite(collected) &&
					Number.isFinite(target) &&
					Number.isFinite(round)
				) {
					onChunk?.({
						streamId,
						round,
						collected,
						target,
						items,
					});
				}
				return false;
			}

			if (type === `${tp}complete`) {
				receivedComplete = true;
				const items = def.parseItems(parsed.items);
				const requested = Number(parsed.requested);
				const streamId =
					typeof parsed.streamId === 'string' ? parsed.streamId : undefined;
				onDone?.({
					items,
					requested: Number.isFinite(requested) ? requested : items.length,
					streamId,
				});
				return true;
			}

			if (type === `${tp}error`) {
				endedWithError = true;
				const message =
					typeof parsed.message === 'string'
						? parsed.message
						: def.streamErrorFallback;
				onError?.(message);
				return true;
			}
			return false;
		};

		void (async () => {
			try {
				readLoop: while (true) {
					const { done, value } = await reader.read();
					if (value) {
						const chunk = decoder.decode(value, { stream: true });
						buffer += chunk;
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						for (const line of lines) {
							if (processLine(line)) break readLoop;
						}
					}

					if (done) {
						const tail = buffer.trim();
						if (tail) {
							for (const line of tail.split('\n')) {
								if (processLine(line)) break;
							}
						}
						buffer = '';
						break;
					}
				}

				if (!receivedComplete && !userAbortRequested && !endedWithError) {
					onIncomplete?.();
				}
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') {
					if (userAbortRequested) {
						onUserAbort?.();
					}
					// 静默替换上一轮请求时也会 Abort，不当作错误
					return;
				}
				const message =
					err instanceof Error ? err.message : String(err ?? '请求中断');
				onError?.(message);
			}
		})();
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : String(err ?? '请求失败');
		onError?.(message);
	}

	return (fromUser?: boolean) => {
		if (fromUser === true) {
			userAbortRequested = true;
		}
		if (serverStreamId) {
			void postEnglishLearningStreamCancel(serverStreamId);
		}
		void streamReader?.cancel().catch(() => {});
		controller.abort();
	};
}

const ENGLISH_LEARNING_VOCAB_SSE_DEF: PackSseDefinition<EnglishVocabularyItem> =
	{
		defaultApi: ENGLISH_LEARNING_VOCABULARY_PACK_STREAM,
		typePrefix: 'vocab.',
		parseFailTitle: '单词包流解析失败',
		streamErrorFallback: '生成单词资料失败',
		parseItems: parseVocabItems,
	};

const ENGLISH_LEARNING_CLASSIC_SSE_DEF: PackSseDefinition<EnglishClassicQuoteItem> =
	{
		defaultApi: ENGLISH_LEARNING_CLASSIC_QUOTES_STREAM,
		typePrefix: 'classic.',
		parseFailTitle: '经典语句流解析失败',
		streamErrorFallback: '生成经典语句失败',
		parseItems: parseClassicItems,
	};

/**
 * 发起单词包 SSE；返回 `abort(fromUser?)`：`fromUser===true` 时视为用户取消，触发 onUserAbort。
 */
export async function streamEnglishVocabularyPack(options: {
	api?: string;
	body: {
		topic: string;
		count?: number;
	};
	callbacks: EnglishVocabStreamCallbacks;
}): Promise<(fromUser?: boolean) => void> {
	return runEnglishLearningPackSseStream(
		ENGLISH_LEARNING_VOCAB_SSE_DEF,
		options,
	);
}

/**
 * 发起经典句 SSE；返回 `abort(fromUser?)` 语义同单词包。
 */
export async function streamEnglishClassicQuotes(options: {
	api?: string;
	body: {
		topic: string;
		count?: number;
	};
	callbacks: EnglishClassicStreamCallbacks;
}): Promise<(fromUser?: boolean) => void> {
	return runEnglishLearningPackSseStream(
		ENGLISH_LEARNING_CLASSIC_SSE_DEF,
		options,
	);
}
