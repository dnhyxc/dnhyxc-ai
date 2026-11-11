/** 每日阅读出站：429 分码、同模型退避、模型过载降级。 */

export type LimitKind = 'account' | 'model_overload' | 'quota' | 'other';

const DEFAULT_FALLBACK = 'glm-4-flash';
const COOLDOWN_MS = 15_000;

function bareModel(name: string): string {
	const s = name.trim();
	const slash = s.lastIndexOf('/');
	return (slash >= 0 ? s.slice(slash + 1) : s).toLowerCase();
}

/** 从异常树取出智谱业务码 / HTTP 状态 / LangChain 码。 */
function digLimitFields(
	err: unknown,
	depth = 0,
): {
	status?: number;
	lc?: string;
	code?: string;
	message?: string;
	retryAfterMs?: number;
} {
	if (!err || typeof err !== 'object' || depth > 4) return {};
	const o = err as {
		status?: number;
		lc_error_code?: string;
		code?: string | number;
		message?: string;
		headers?: Record<string, unknown>;
		response?: { headers?: Record<string, unknown>; data?: unknown };
		error?: { code?: string | number; message?: string };
		cause?: unknown;
	};
	const nested = digLimitFields(o.cause, depth + 1);
	const code = o.code ?? o.error?.code ?? nested.code;
	const message = o.message ?? o.error?.message ?? nested.message;
	const status = o.status ?? nested.status;
	const lc = o.lc_error_code ?? nested.lc;
	const headers = o.headers ?? o.response?.headers;
	let retryAfterMs = nested.retryAfterMs;
	if (headers && typeof headers === 'object') {
		const raw =
			headers['retry-after'] ??
			headers['Retry-After'] ??
			(headers as { get?: (k: string) => unknown }).get?.('retry-after');
		const n = Number(raw);
		if (Number.isFinite(n) && n >= 0) retryAfterMs = Math.floor(n * 1000);
	}
	return {
		status,
		lc,
		code: code != null ? String(code) : undefined,
		message: message != null ? String(message) : undefined,
		retryAfterMs,
	};
}

/** 分出 1302 账户限流 / 1305 模型过载 / 额度类，避免一律短睡。 */
export function classifyProviderLimit(err: unknown): LimitKind {
	const { status, lc, code, message } = digLimitFields(err);
	if (code === '1113' || code === '1308' || code === '1310') return 'quota';
	if (code === '1302') return 'account';
	if (code === '1305') return 'model_overload';
	if (status === 429 || lc === 'MODEL_RATE_LIMIT') {
		const msg = message ?? '';
		if (/访问量过大|overloaded|capacity/i.test(msg)) return 'model_overload';
		if (/账户.*速率|rate limit|slow_down/i.test(msg)) return 'account';
		// 分不清时按过载处理，允许后续走 fallback
		return 'model_overload';
	}
	return 'other';
}

/** 是否可退避的限流（额度不算）。 */
export function isRateLimit(err: unknown): boolean {
	const kind = classifyProviderLimit(err);
	return kind === 'account' || kind === 'model_overload';
}

export function readRetryAfterMs(err: unknown): number | undefined {
	return digLimitFields(err).retryAfterMs;
}

/** 仅智谱 GLM 链启用同 Key flash 备用；硅基主路径不降回 flash。 */
export function resolveReadingFallback(
	primaryName: string,
	baseURL: string,
	fallbackName = DEFAULT_FALLBACK,
): string | null {
	if (/siliconflow/i.test(baseURL)) return null;
	const primary = bareModel(primaryName);
	if (!primary.includes('glm')) return null;
	const fb = (fallbackName.trim() || DEFAULT_FALLBACK).trim();
	if (bareModel(fb) === primary) return null;
	return fb;
}

/** 退避等待；停止信号打断，不再发下一跳。 */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		const err = new Error('aborted');
		err.name = 'AbortError';
		return Promise.reject(err);
	}
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			const err = new Error('aborted');
			err.name = 'AbortError';
			reject(err);
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

function isAbort(err: unknown, signal?: AbortSignal): boolean {
	if (signal?.aborted) return true;
	if (!err || typeof err !== 'object') return false;
	if ((err as { name?: string }).name === 'AbortError') return true;
	return /abort/i.test(String((err as { message?: unknown }).message ?? ''));
}

/** 同模型有限次重试：Prefer Retry-After，否则指数 + full jitter。 */
export async function withRateRetry<T>(
	run: () => Promise<T>,
	opts?: {
		signal?: AbortSignal;
		kindHint?: LimitKind;
		maxAttempts?: number;
		onRetry?: (delayMs: number, kind: LimitKind) => void;
	},
): Promise<T> {
	const max =
		opts?.maxAttempts ?? (opts?.kindHint === 'model_overload' ? 4 : 3);
	let lastKind: LimitKind = 'other';
	for (let attempt = 0; attempt < max; attempt += 1) {
		try {
			return await run();
		} catch (err) {
			if (isAbort(err, opts?.signal)) throw err;
			lastKind = classifyProviderLimit(err);
			if (lastKind === 'quota' || lastKind === 'other') throw err;
			if (attempt === max - 1) throw err;
			const retryAfter = readRetryAfterMs(err);
			const base = retryAfter ?? 2000 * 2 ** attempt;
			const delay = Math.max(500, Math.floor(Math.random() * base));
			opts?.onRetry?.(delay, lastKind);
			await wait(delay, opts?.signal);
		}
	}
	throw new Error(`rate limit:${lastKind}`);
}

/** 1305 耗尽后冷却主模型并换备用再打；账户限流不换模型。 */
export async function withModelFallback<T>(input: {
	primaryModel: string;
	fallbackModel: string | null;
	signal?: AbortSignal;
	coolUntil: Map<string, number>;
	runWithModel: (modelName: string) => Promise<T>;
	onRetry?: (delayMs: number, kind: LimitKind) => void;
	onDegraded?: (from: string, to: string) => void;
}): Promise<{ value: T; modelName: string }> {
	const now = Date.now();
	const cooled = (input.coolUntil.get(input.primaryModel) ?? 0) > now;
	const first =
		cooled && input.fallbackModel ? input.fallbackModel : input.primaryModel;
	try {
		const value = await withRateRetry(() => input.runWithModel(first), {
			signal: input.signal,
			kindHint: cooled ? 'model_overload' : undefined,
			onRetry: input.onRetry,
		});
		return { value, modelName: first };
	} catch (err) {
		if (isAbort(err, input.signal)) throw err;
		const kind = classifyProviderLimit(err);
		if (
			kind !== 'model_overload' ||
			!input.fallbackModel ||
			first === input.fallbackModel
		) {
			throw err;
		}
		input.coolUntil.set(input.primaryModel, Date.now() + COOLDOWN_MS);
		input.onDegraded?.(input.primaryModel, input.fallbackModel);
		const value = await withRateRetry(
			() => input.runWithModel(input.fallbackModel!),
			{
				signal: input.signal,
				kindHint: 'model_overload',
				onRetry: input.onRetry,
			},
		);
		return { value, modelName: input.fallbackModel };
	}
}

/** 最小自检：分类与备用解析。改逻辑时先跑这一段。 */
export function assertReadingLlmLimitSelfCheck(): void {
	const overload = {
		status: 429,
		lc_error_code: 'MODEL_RATE_LIMIT',
		error: { code: 1305, message: '该模型当前访问量过大，请您稍后再试' },
	};
	const account = {
		status: 429,
		error: { code: 1302, message: '您的账户已达到速率限制' },
	};
	const quota = { status: 429, code: 1113, message: '欠费' };
	if (classifyProviderLimit(overload) !== 'model_overload') {
		throw new Error('1305 should be model_overload');
	}
	if (classifyProviderLimit(account) !== 'account') {
		throw new Error('1302 should be account');
	}
	if (classifyProviderLimit(quota) !== 'quota') {
		throw new Error('1113 should be quota');
	}
	if (classifyProviderLimit({ cause: overload }) !== 'model_overload') {
		throw new Error('nested cause 1305');
	}
	if (
		resolveReadingFallback(
			'glm-4.7-flash',
			'https://open.bigmodel.cn/api/paas/v4',
		) !== 'glm-4-flash'
	) {
		throw new Error('zhipu flash should fallback');
	}
	if (
		resolveReadingFallback(
			'zai-org/GLM-5.3',
			'https://api.siliconflow.cn/v1',
		) != null
	) {
		throw new Error('siliconflow must not glm-flash fallback');
	}
	if (
		resolveReadingFallback(
			'glm-4-flash',
			'https://open.bigmodel.cn/api/paas/v4',
			'glm-4-flash',
		) != null
	) {
		throw new Error('same-name fallback must be null');
	}
}
