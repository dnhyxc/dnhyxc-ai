const SENSITIVE_KEYS = new Set([
	'password',
	'captchaText',
	'verifyCode',
	'access_token',
	'accessToken',
	'token',
	'authorization',
]);

/** text 字段上限，避免单条日志撑爆 */
export const LOG_DATA_MAX = 4000;

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
	return (
		!!value &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		Object.keys(value as object).length > 0
	);
}

/** 汇总 path 参数 / query / body，供操作日志 data 字段写入 */
export function collectRequestData(req: {
	body?: unknown;
	query?: Record<string, unknown>;
	params?: Record<string, unknown>;
}): unknown {
	const hasParams = isNonEmptyObject(req.params);
	const hasQuery = isNonEmptyObject(req.query);
	const body = req.body;
	const hasBody =
		body != null &&
		body !== '' &&
		!(
			typeof body === 'object' &&
			!Array.isArray(body) &&
			!isNonEmptyObject(body)
		);

	if (!hasParams && !hasQuery && !hasBody) return '';
	// 仅有 body 时保持扁平，兼容历史展示
	if (!hasParams && !hasQuery) return body;

	return {
		...(hasParams ? { params: req.params } : {}),
		...(hasQuery ? { query: req.query } : {}),
		...(hasBody ? { body } : {}),
	};
}

export function sanitizeLogData(input: unknown, max = LOG_DATA_MAX): string {
	let raw: string;
	try {
		if (input == null) raw = '';
		else if (typeof input === 'string') raw = input;
		else raw = JSON.stringify(redact(input));
	} catch {
		raw = '[unserializable]';
	}
	return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
}

function redact(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redact);
	if (!value || typeof value !== 'object') return value;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		out[k] = SENSITIVE_KEYS.has(k) ? '[redacted]' : redact(v);
	}
	return out;
}
