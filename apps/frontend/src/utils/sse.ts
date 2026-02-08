import { fetch } from '@tauri-apps/plugin-http';
import { Toast } from '@ui/index';
import { BASE_URL } from '@/constant';
import { getStorage } from '.';

interface StreamCallbacks {
	onData: (chunk: any) => void;
	onThinking?: (chunk: any) => void;
	onStart?: () => void;
	onError?: (error: Error, type?: 'error' | 'info' | 'warning') => void;
	getSessionId?: (sessionId: string) => void;
	onComplete?: () => void;
}

export const streamFetch = async ({
	api = '/ocr/imageOcr',
	options,
	callbacks,
}: {
	options: RequestInit;
	callbacks: StreamCallbacks;
	api?: string;
}): Promise<() => void> => {
	const { onData, onError, onComplete, onStart, onThinking, getSessionId } =
		callbacks;

	const controller = new AbortController();
	options.signal = controller.signal;

	try {
		onStart?.();

		const response = await fetch(BASE_URL + api, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${getStorage('token')}`,
				'Content-Type': 'application/json',
			},
			...options,
		});

		if (!response.ok) {
			console.error('HTTP error! status:', response.statusText);
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Failed to get stream reader');
		}

		const decoder = new TextDecoder('utf-8');
		let buffer = '';
		let sessionId = '';

		// 异步执行读取循环，不阻塞主线程
		(async () => {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						if (buffer.trim()) {
							try {
								const parsed = JSON.parse(buffer.trim());
								onData(parsed);
							} catch (e) {
								Toast({
									type: 'error',
									title: `Failed to parse final buffer:' ${e}`,
								});
							}
						}
						onComplete?.();
						break;
					}

					const chunk = decoder.decode(value, { stream: true });
					buffer += chunk;

					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmedLine = line.trim();
						if (trimmedLine.startsWith('data:')) {
							const dataStr = trimmedLine.slice(5).trim();
							if (dataStr) {
								try {
									const parsed = JSON.parse(dataStr);
									if (!sessionId) {
										sessionId = parsed.sessionId;
										getSessionId?.(sessionId);
									}
									if (parsed?.type === 'thinking') {
										onThinking?.(parsed.content ? parsed.content : '');
									} else {
										onData(parsed.content ? parsed.content : '');
									}
								} catch (e) {
									Toast({
										type: 'error',
										title: `Failed to parse data line:' ${e}, ${dataStr}`,
									});
								}
							}
						}
					}
				}
			} catch (err: any) {
				if (err.name !== 'AbortError') {
					onError?.(
						err === 'Request cancelled' ? '请求已停止' : err,
						err === 'Request cancelled' ? 'info' : 'error',
					);
				}
			}
		})();
	} catch (error: any) {
		// 发起请求时的错误（如网络断开）
		if (error.name !== 'AbortError') {
			onError?.(error);
		}
	}

	// 返回一个取消函数
	return () => controller.abort();
};
