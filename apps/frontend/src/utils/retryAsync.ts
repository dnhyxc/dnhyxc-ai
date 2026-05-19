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

/**
 * 以有限并发执行任务工厂，返回结果顺序与 tasks 一致
 */
export async function runTasksWithConcurrency<T>(
	tasks: Array<() => Promise<T>>,
	concurrency: number,
): Promise<T[]> {
	if (tasks.length === 0) return [];
	const results: T[] = new Array(tasks.length);
	let nextIndex = 0;
	const workerCount = Math.max(1, Math.min(concurrency, tasks.length));

	async function worker() {
		while (true) {
			const index = nextIndex++;
			if (index >= tasks.length) break;
			results[index] = await tasks[index]();
		}
	}

	await Promise.all(Array.from({ length: workerCount }, () => worker()));
	return results;
}
