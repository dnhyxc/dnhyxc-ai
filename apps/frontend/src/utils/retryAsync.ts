/** 是否为可重试的瞬时网络错误（Tauri / fetch 常见文案） */
export function isTransientNetworkError(error: unknown): boolean {
	const msg = String(
		error && typeof error === 'object' && 'message' in error
			? (error as { message?: unknown }).message
			: error,
	).toLowerCase();
	return (
		msg.includes('error sending request') ||
		msg.includes('network') ||
		msg.includes('failed to fetch') ||
		msg.includes('fetch failed') ||
		msg.includes('timeout') ||
		msg.includes('timed out') ||
		msg.includes('econnreset') ||
		msg.includes('connection reset') ||
		msg.includes('aborted')
	);
}

export type RetryAsyncOptions = {
	/** 额外重试次数（总尝试 = retries + 1） */
	retries?: number;
	/** 首次重试前等待毫秒 */
	delayMs?: number;
	shouldRetry?: (error: unknown) => boolean;
};

/**
 * 对瞬时网络失败自动重试（指数退避）
 */
export async function retryAsync<T>(
	fn: () => Promise<T>,
	options?: RetryAsyncOptions,
): Promise<T> {
	const retries = options?.retries ?? 2;
	const delayMs = options?.delayMs ?? 400;
	const shouldRetry = options?.shouldRetry ?? isTransientNetworkError;

	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt >= retries || !shouldRetry(error)) {
				throw error;
			}
			await new Promise((resolve) =>
				setTimeout(resolve, delayMs * (attempt + 1)),
			);
		}
	}
	throw lastError;
}
