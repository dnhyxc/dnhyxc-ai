import { BASE_URL } from '@/constants';
import { notifyUnauthorized } from '@/router/authSession';
import { getPlatformFetch } from '@/utils/fetch';

export type ReadingFrame = {
	type: string;
	text?: string;
	message?: string;
	reset?: boolean;
	seq?: number;
	tokens?: number;
};

const TERMINAL = new Set([
	'reading.complete',
	'reading.error',
	'reading.stopped',
	'reading.paused',
]);

function readToken(): string {
	if (typeof window === 'undefined') return '';
	return localStorage.getItem('token') || '';
}

function asFrame(raw: Record<string, unknown>): ReadingFrame {
	return {
		type: typeof raw.type === 'string' ? raw.type : '',
		text: typeof raw.text === 'string' ? raw.text : undefined,
		message: typeof raw.message === 'string' ? raw.message : undefined,
		reset: raw.reset === true,
		seq: typeof raw.seq === 'number' ? raw.seq : undefined,
		tokens: typeof raw.tokens === 'number' ? raw.tokens : undefined,
	};
}

/** 读一条每日阅读 SSE。返回的 abort(true) 表示用户停止，不触发 onIncomplete。 */
export async function openDailyReadingStream(options: {
	path: string;
	body: Record<string, unknown>;
	onFrame: (frame: ReadingFrame) => void;
	onIncomplete: () => void;
}): Promise<(fromUser?: boolean) => void> {
	const controller = new AbortController();
	let userAbort = false;
	let terminal = false;
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

	const failOpen = (status: number) => {
		if (status === 401) {
			notifyUnauthorized();
			options.onFrame({ type: 'reading.error', message: '请先登录后再试' });
			return;
		}
		if (status >= 400 && status < 500) {
			options.onFrame({
				type: 'reading.error',
				message: `HTTP ${status}`,
			});
			return;
		}
		options.onIncomplete();
	};

	try {
		const platformFetch = await getPlatformFetch();
		const response = await platformFetch(BASE_URL + options.path, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${readToken()}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(options.body),
			signal: controller.signal,
		});
		if (!response.ok) {
			failOpen(response.status);
		} else {
			reader = response.body?.getReader();
			if (!reader) {
				options.onIncomplete();
			} else {
				const current = reader;
				void (async () => {
					const decoder = new TextDecoder('utf-8');
					let buffer = '';
					let eventId = '';
					const take = (line: string): boolean => {
						const trimmed = line.trim();
						if (trimmed.startsWith('id:')) {
							eventId = trimmed.slice(3).trim();
							return false;
						}
						if (!trimmed.startsWith('data:')) return false;
						const dataStr = trimmed.slice(5).trimStart();
						if (!dataStr) return false;
						try {
							const frame = asFrame(
								JSON.parse(dataStr) as Record<string, unknown>,
							);
							const fromId = Number(eventId);
							eventId = '';
							if (frame.seq == null && Number.isFinite(fromId) && fromId > 0) {
								frame.seq = fromId;
							}
							if (!frame.type || frame.type === 'reading.keepalive')
								return false;
							options.onFrame(frame);
							if (TERMINAL.has(frame.type)) {
								terminal = true;
								return true;
							}
						} catch {
							return false;
						}
						return false;
					};
					try {
						readLoop: while (true) {
							const { done, value } = await current.read();
							if (value) {
								buffer += decoder.decode(value, { stream: true });
								const lines = buffer.split('\n');
								buffer = lines.pop() || '';
								for (const line of lines) {
									if (take(line)) break readLoop;
								}
							}
							if (done) {
								const tail = buffer.trim();
								if (tail) {
									for (const line of tail.split('\n')) {
										if (take(line)) break;
									}
								}
								break;
							}
						}
						if (!terminal && !userAbort) options.onIncomplete();
					} catch (err: unknown) {
						const aborted =
							err instanceof DOMException && err.name === 'AbortError';
						if (aborted && userAbort) return;
						if (!userAbort && !terminal) options.onIncomplete();
					}
				})();
			}
		}
	} catch (err: unknown) {
		if (!(err instanceof DOMException && err.name === 'AbortError')) {
			if (!userAbort) options.onIncomplete();
		}
	}

	return (fromUser?: boolean) => {
		if (fromUser) userAbort = true;
		void reader?.cancel().catch(() => {});
		controller.abort();
	};
}
