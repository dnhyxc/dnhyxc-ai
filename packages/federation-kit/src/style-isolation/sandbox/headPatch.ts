/**
 * document.head append/insert 劫持。
 * patch 深度与原生引用挂 globalThis，避免双入口重复劫持。
 */
import { activeCtx } from './context';
import { ensureCssomPatch, releaseCssomPatch } from './cssomPatch';
import { processNode } from './reclaim';

const HEAD_PATCH_KEY = '__dnhyxc_ai_federation_head_patch__';

type HeadPatchBag = {
	depth: number;
	origAppend: (<T extends Node>(node: T) => T) | null;
	origInsert: (<T extends Node>(node: T, ref: Node | null) => T) | null;
};

type GlobalBag = typeof globalThis & {
	[HEAD_PATCH_KEY]?: HeadPatchBag;
};

function store(): HeadPatchBag {
	const g = globalThis as GlobalBag;
	if (!g[HEAD_PATCH_KEY]) {
		g[HEAD_PATCH_KEY] = {
			depth: 0,
			origAppend: null,
			origInsert: null,
		};
	}
	return g[HEAD_PATCH_KEY]!;
}

/** 劫持 head.appendChild/insertBefore，插入后对节点做样式隔离 */
export function ensureHeadPatch() {
	const s = store();
	if (s.depth > 0) {
		s.depth += 1;
		return;
	}
	const head = document.head;
	const nativeAppend = head.appendChild.bind(head) as <T extends Node>(
		node: T,
	) => T;
	const nativeInsert = head.insertBefore.bind(head) as <T extends Node>(
		node: T,
		ref: Node | null,
	) => T;
	s.origAppend = nativeAppend;
	s.origInsert = nativeInsert;

	head.appendChild = function appendScoped<T extends Node>(node: T): T {
		const ret = nativeAppend(node);
		const ctx = activeCtx();
		if (ctx) processNode(node, ctx);
		return ret;
	};

	head.insertBefore = function insertScoped<T extends Node>(
		node: T,
		ref: Node | null,
	): T {
		const ret = nativeInsert(node, ref);
		const ctx = activeCtx();
		if (ctx) processNode(node, ctx);
		return ret;
	};

	s.depth = 1;
	ensureCssomPatch();
}

/** 减少 head patch 引用；到 0 时恢复 append/insert 并释放 CSSOM */
export function releaseHeadPatch() {
	const s = store();
	if (s.depth <= 0) return;
	s.depth -= 1;
	if (s.depth > 0) return;
	if (s.origAppend) {
		document.head.appendChild =
			s.origAppend as typeof document.head.appendChild;
	}
	if (s.origInsert) {
		document.head.insertBefore =
			s.origInsert as typeof document.head.insertBefore;
	}
	s.origAppend = null;
	s.origInsert = null;
	releaseCssomPatch();
}
