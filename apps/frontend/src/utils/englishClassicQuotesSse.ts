/**
 * 英语学习经典语句：消费 `POST /english-learning/classic-quotes/stream` 的 SSE。
 */
import { Toast } from '@ui/index';
import { BASE_URL } from '@/constant';
import { notifyUnauthorized } from '@/router/authSession';
import type { EnglishClassicQuoteItem } from '@/service';
import { ENGLISH_LEARNING_CLASSIC_QUOTES_STREAM } from '@/service/api';
import { getPlatformFetch } from '@/utils/fetch';

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

function unwrapClassicPayload(
	raw: Record<string, unknown>,
): Record<string, unknown> {
	const inner = raw.data;
	if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
		const o = inner as Record<string, unknown>;
		if (typeof o.type === 'string' && o.type.startsWith('classic.')) {
			return o;
		}
	}
	return raw;
}

function parseItems(raw: unknown): EnglishClassicQuoteItem[] {
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

export type EnglishClassicStreamProgress = {
	collected: number;
	target: number;
	round: number;
};

export type EnglishClassicStreamChunk = {
	streamId?: string;
	round: number;
	collected: number;
	target: number;
	items: EnglishClassicQuoteItem[];
};

export type EnglishClassicStreamCallbacks = {
	onProgress?: (p: EnglishClassicStreamProgress) => void;
	onChunk?: (chunk: EnglishClassicStreamChunk) => void;
	onDone?: (payload: {
		items: EnglishClassicQuoteItem[];
		requested: number;
		streamId?: string;
	}) => void;
	onError?: (message: string) => void;
	onUserAbort?: () => void;
	onIncomplete?: () => void;
};

export async function streamEnglishClassicQuotes(options: {
	api?: string;
	body: {
		topic: string;
		count: number;
		level?: 'basic' | 'intermediate' | 'advanced';
	};
	callbacks: EnglishClassicStreamCallbacks;
}): Promise<(fromUser?: boolean) => void> {
	const {
		api = ENGLISH_LEARNING_CLASSIC_QUOTES_STREAM,
		body,
		callbacks,
	} = options;
	const { onProgress, onChunk, onDone, onError, onUserAbort, onIncomplete } =
		callbacks;

	const controller = new AbortController();
	let userAbortRequested = false;
	let receivedComplete = false;
	let endedWithError = false;

	try {
		const platformFetch = await getPlatformFetch();
		const response = await platformFetch(BASE_URL + api, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${readToken()}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		if (!response.ok) {
			if (response.status === 401) {
				notifyUnauthorized();
				throw new Error('请先登录后再试');
			}
			throw new Error(`HTTP ${response.status}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('无法读取流式响应');
		}

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
				Toast({ type: 'error', title: '经典语句流解析失败' });
				return false;
			}

			const parsed = unwrapClassicPayload(raw);
			const type = parsed.type;

			if (type === 'classic.progress') {
				const collected = Number(parsed.collected);
				const target = Number(parsed.target);
				const round = Number(parsed.round);
				if (
					Number.isFinite(collected) &&
					Number.isFinite(target) &&
					Number.isFinite(round)
				) {
					onProgress?.({ collected, target, round });
				}
				return false;
			}

			if (type === 'classic.chunk') {
				const collected = Number(parsed.collected);
				const target = Number(parsed.target);
				const round = Number(parsed.round);
				const items = parseItems(parsed.items);
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

			if (type === 'classic.complete') {
				receivedComplete = true;
				const items = parseItems(parsed.items);
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

			if (type === 'classic.error') {
				endedWithError = true;
				const message =
					typeof parsed.message === 'string'
						? parsed.message
						: '生成经典语句失败';
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
		controller.abort();
	};
}
