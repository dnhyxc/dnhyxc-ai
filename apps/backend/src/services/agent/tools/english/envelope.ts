/**
 * 英语学习领域工具统一信封与入参解析（M0）。
 * 工具返回给模型的字符串必须是 JSON.stringify(ElEnvelope)。
 */

export type ElCode =
	| 'bad_args'
	| 'ambiguous'
	| 'not_found'
	| 'write_limit'
	| 'el_limit'
	| 'proposal_expired'
	| 'forbidden'
	| 'unavailable'
	| 'already_running'
	| 'present_too_wide'
	| 'stop_tools';

export type ElUiAction = {
	type: 'navigate' | 'confirm_proposal' | 'open_reading';
	href?: string;
	proposalId?: string;
	label: string;
};

export type ElEnvelope<T = unknown> = {
	ok: boolean;
	code?: ElCode;
	message?: string;
	data?: T;
	meta?: {
		truncated?: boolean;
		total?: number;
		limit?: number;
		offset?: number;
	};
	ui?: ElUiAction[];
};

/** 单次 data 序列化上限（字符）；全量 list 可能偏大，超限再按数组裁条 */
export const EL_DATA_MAX_CHARS = 100_000;
/** clampLimit / 抽样类默认条数硬顶 */
export const EL_LIST_MAX = 20;
/** 只用于 truncateElData：交给模型的 JSON 里 items 最多这么多条。拉清单不再用它。 */
export const EL_FULL_LIST_MAX = 2_000;

export function elOk<T>(
	data: T,
	extra?: Partial<Pick<ElEnvelope<T>, 'message' | 'meta' | 'ui'>>,
): ElEnvelope<T> {
	return { ok: true, data, ...extra };
}

export function elFail(
	code: ElCode,
	message: string,
	data?: unknown,
	ui?: ElUiAction[],
): ElEnvelope {
	return {
		ok: false,
		code,
		message,
		...(data !== undefined ? { data } : {}),
		...(ui ? { ui } : {}),
	};
}

/** DynamicTool 入参：必须是 JSON 对象；剥离 userId 防注入 */
export function parseElArgs(raw: string): Record<string, unknown> {
	let v: unknown;
	try {
		v = JSON.parse(raw) as unknown;
	} catch {
		throw new Error('bad_args');
	}
	if (!v || typeof v !== 'object' || Array.isArray(v)) {
		throw new Error('bad_args');
	}
	const obj = { ...(v as Record<string, unknown>) };
	delete obj.userId;
	delete obj.user_id;
	return obj;
}

export function asString(v: unknown): string | undefined {
	return typeof v === 'string' ? v : undefined;
}

export function asOp(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

/**
 * 让 `{...head, items, returned}` 的 JSON 不超过 EL_DATA_MAX_CHARS。
 * 从尾部按 1/4 减 items，避免 stringify 时无声砍条。
 */
export function fitItemsByChars<T>(
	head: Record<string, unknown>,
	items: T[],
): { items: T[]; truncated: boolean } {
	let kept = items;
	const size = (rows: T[]) =>
		JSON.stringify({ ...head, items: rows, returned: rows.length }).length;
	while (kept.length > 0 && size(kept) > EL_DATA_MAX_CHARS) {
		kept = kept.slice(0, kept.length - Math.max(1, Math.ceil(kept.length / 4)));
	}
	return { items: kept, truncated: kept.length < items.length };
}

export function clampLimit(raw: unknown, fallback = 10): number {
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(EL_LIST_MAX, Math.max(1, Math.floor(n)));
}

/** 截断 data：条数优先，再按序列化长度 */
export function truncateElData<T>(
	data: T,
	opts?: { maxItems?: number },
): { data: T; truncated: boolean } {
	const maxItems = opts?.maxItems ?? EL_FULL_LIST_MAX;
	let truncated = false;
	let cur: unknown = data;

	if (Array.isArray(cur) && cur.length > maxItems) {
		cur = cur.slice(0, maxItems);
		truncated = true;
	} else if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
		const o = { ...(cur as Record<string, unknown>) };
		for (const key of ['items', 'candidates', 'rows'] as const) {
			const arr = o[key];
			if (Array.isArray(arr) && arr.length > maxItems) {
				o[key] = arr.slice(0, maxItems);
				truncated = true;
			}
		}
		cur = o;
	}

	let json = JSON.stringify(cur);
	// 超长时按数组裁条，避免硬砍字符串破坏 JSON
	while (json.length > EL_DATA_MAX_CHARS && cur && typeof cur === 'object') {
		truncated = true;
		if (!shrinkLargestArray(cur as Record<string, unknown>)) break;
		json = JSON.stringify(cur);
	}
	if (json.length > EL_DATA_MAX_CHARS) {
		truncated = true;
		cur = {
			truncatedPayload: true,
			hint: '结果过大，请缩小 limit 或按 origin+offset 分页',
		} as T;
	}

	return { data: cur as T, truncated };
}

/** 找到最长数组并砍掉末尾 1/4（至少 1 条），供体积超限时降载 */
function shrinkLargestArray(root: Record<string, unknown>): boolean {
	type Hit = { parent: Record<string, unknown>; key: string; len: number };
	let best: Hit | null = null;
	const visit = (node: unknown) => {
		if (!node || typeof node !== 'object') return;
		if (Array.isArray(node)) return;
		const o = node as Record<string, unknown>;
		for (const [k, v] of Object.entries(o)) {
			if (Array.isArray(v) && v.length > 0) {
				if (!best || v.length > best.len) {
					best = { parent: o, key: k, len: v.length };
				}
			} else if (v && typeof v === 'object' && !Array.isArray(v)) {
				visit(v);
			}
		}
	};
	visit(root);
	if (!best) return false;
	const hit: Hit = best;
	const arr = hit.parent[hit.key] as unknown[];
	const nextLen = Math.max(
		0,
		arr.length - Math.max(1, Math.ceil(arr.length / 4)),
	);
	hit.parent[hit.key] = arr.slice(0, nextLen);
	return true;
}

export function stringifyEnvelope(env: ElEnvelope): string {
	if (env.data !== undefined) {
		const { data, truncated } = truncateElData(env.data);
		const meta = {
			...(env.meta ?? {}),
			...(truncated ? { truncated: true } : {}),
		};
		return JSON.stringify({ ...env, data, meta });
	}
	return JSON.stringify(env);
}
