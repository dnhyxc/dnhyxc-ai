/**
 * 经典句整集标注预热 SSE 客户端（库 / Pack）
 */
import { BASE_URL } from '@/constants';
import { notifyUnauthorized } from '@/router/authSession';
import {
	ENGLISH_LEARNING_CLASSIC_LIBRARY_ANNOTATE_SENTENCE_WORDS_STREAM,
	ENGLISH_LEARNING_CLASSIC_PACK_ANNOTATE_SENTENCE_WORDS_STREAM,
} from '@/service/api';
import { getPlatformFetch } from '@/utils/fetch';

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

/** Nest MessageEvent / 双层 data / 二次 JSON 字符串 */
function unwrap(raw: unknown): Record<string, unknown> | null {
	let cur: unknown = raw;
	for (let i = 0; i < 3; i += 1) {
		if (typeof cur === 'string') {
			try {
				cur = JSON.parse(cur);
			} catch {
				return null;
			}
			continue;
		}
		if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return null;
		const o = cur as Record<string, unknown>;
		if (typeof o.type === 'string' && o.type.startsWith('annotate.')) {
			return o;
		}
		if (o.data != null) {
			cur = o.data;
			continue;
		}
		return o;
	}
	return null;
}

export type AnnotateSourceProgress = {
	total: number;
	hit: number;
	miss: number;
	annotated: number;
	failed: number;
	remaining: number;
	tokensPrompt: number;
	tokensCompletion: number;
	tokensTotal: number;
};

export type AnnotateSourceStreamResult = {
	total: number;
	hit: number;
	annotated: number;
	failed: number;
	tokensPrompt: number;
	tokensCompletion: number;
	tokensTotal: number;
};

export type AnnotateSourceStreamHandle = {
	abort: () => void;
	done: Promise<AnnotateSourceStreamResult>;
};

function num(v: unknown, fallback = 0): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}

export function streamAnnotateClassicSource(options: {
	source: 'library' | 'pack';
	libraryId?: string;
	streamId?: string;
	taskId?: string;
	onStart?: (p: { total: number; hit: number; miss: number }) => void;
	onProgress?: (p: AnnotateSourceProgress) => void;
}): AnnotateSourceStreamHandle {
	const controller = new AbortController();
	const api =
		options.source === 'library'
			? ENGLISH_LEARNING_CLASSIC_LIBRARY_ANNOTATE_SENTENCE_WORDS_STREAM
			: ENGLISH_LEARNING_CLASSIC_PACK_ANNOTATE_SENTENCE_WORDS_STREAM;
	const taskId = options.taskId?.trim() || undefined;
	const body =
		options.source === 'library'
			? {
					libraryId: options.libraryId!.trim(),
					...(taskId ? { taskId } : {}),
				}
			: {
					streamId: options.streamId!.trim(),
					...(taskId ? { taskId } : {}),
				};

	const done = (async (): Promise<AnnotateSourceStreamResult> => {
		const platformFetch = await getPlatformFetch();
		const response = await platformFetch(BASE_URL + api, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${readToken()}`,
				'Content-Type': 'application/json',
				Accept: 'text/event-stream',
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
		if (!reader) throw new Error('无法读取流式响应');

		const decoder = new TextDecoder('utf-8');
		let buffer = '';
		let last: AnnotateSourceStreamResult = {
			total: 0,
			hit: 0,
			annotated: 0,
			failed: 0,
			tokensPrompt: 0,
			tokensCompletion: 0,
			tokensTotal: 0,
		};
		let completed = false;
		let snapshot = {
			total: 0,
			hit: 0,
			miss: 0,
		};

		const handlePayload = (parsed: Record<string, unknown>) => {
			const type = parsed.type;
			if (type === 'annotate.start') {
				snapshot = {
					total: num(parsed.total),
					hit: num(parsed.hit),
					miss: num(parsed.miss),
				};
				options.onStart?.(snapshot);
				return;
			}
			if (type === 'annotate.progress') {
				if (parsed.heartbeat === true) return;
				const p: AnnotateSourceProgress = {
					total: num(parsed.total, snapshot.total),
					hit: num(parsed.hit, snapshot.hit),
					miss: num(parsed.miss, snapshot.miss),
					annotated: num(parsed.annotated),
					failed: num(parsed.failed),
					remaining: num(parsed.remaining),
					tokensPrompt: num(parsed.tokensPrompt),
					tokensCompletion: num(parsed.tokensCompletion),
					tokensTotal: num(parsed.tokensTotal),
				};
				options.onProgress?.(p);
				return;
			}
			if (type === 'annotate.complete') {
				last = {
					total: num(parsed.total),
					hit: num(parsed.hit),
					annotated: num(parsed.annotated),
					failed: num(parsed.failed),
					tokensPrompt: num(parsed.tokensPrompt),
					tokensCompletion: num(parsed.tokensCompletion),
					tokensTotal: num(parsed.tokensTotal),
				};
				completed = true;
				return;
			}
			if (type === 'annotate.error') {
				const message =
					typeof parsed.message === 'string' && parsed.message.trim()
						? parsed.message.trim()
						: '标注失败';
				throw new Error(message);
			}
		};

		const consumeLine = (line: string) => {
			const trimmed = line.trim();
			if (!trimmed.startsWith('data:')) return;
			const dataStr = trimmed.slice(5).trimStart();
			if (!dataStr) return;
			let raw: unknown;
			try {
				raw = JSON.parse(dataStr);
			} catch {
				return;
			}
			const parsed = unwrap(raw);
			if (parsed) handlePayload(parsed);
		};

		while (true) {
			const { done: streamDone, value } = await reader.read();
			if (streamDone) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			for (const line of lines) consumeLine(line);
		}

		if (buffer.trim()) consumeLine(buffer);

		if (!completed && !controller.signal.aborted) {
			throw new Error('标注流意外结束');
		}
		return last;
	})();

	return {
		abort: () => controller.abort(),
		done,
	};
}
