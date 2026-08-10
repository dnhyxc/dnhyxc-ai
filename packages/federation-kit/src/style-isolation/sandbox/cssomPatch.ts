/**
 * CSSOM insertRule 沙箱（antd cssinjs 等）。
 * 深度与原生 insertRule 挂 globalThis，避免双入口重复劫持。
 *
 * 挂载长窗 claimUnmarked=false 时，无标记 style 不会被 head MO 认领；
 * 此处在 insertRule 时把「当前捕获栈」写回 owner，专收 Remote CSS-in-JS。
 */
import { transpileStyleRule } from '../css/transpile';
import { scopeSelector } from '../protocol';
import { activeCtx } from './context';

const CSSOM_PATCH_KEY = '__dnhyxc_ai_federation_cssom_patch__';

type CssomPatchBag = {
	depth: number;
	origInsertRule: typeof CSSStyleSheet.prototype.insertRule | null;
};

type GlobalBag = typeof globalThis & {
	[CSSOM_PATCH_KEY]?: CssomPatchBag;
};

function store(): CssomPatchBag {
	const g = globalThis as GlobalBag;
	if (!g[CSSOM_PATCH_KEY]) {
		g[CSSOM_PATCH_KEY] = { depth: 0, origInsertRule: null };
	}
	return g[CSSOM_PATCH_KEY]!;
}

/** 从 stylesheet 的 ownerNode 读 mfStyleOwner 作为 realm */
export function sheetOwnerRealm(sheet: CSSStyleSheet): string | null {
	const owner = sheet.ownerNode;
	if (!(owner instanceof HTMLStyleElement)) return null;
	if (owner.dataset.mfHostStyle === '1') return null;
	return owner.dataset.mfStyleOwner || null;
}

function bindActiveRealm(sheet: CSSStyleSheet): string | null {
	const existing = sheetOwnerRealm(sheet);
	if (existing) return existing;
	const ctx = activeCtx();
	const owner = sheet.ownerNode;
	if (!ctx || !(owner instanceof HTMLStyleElement)) return null;
	if (owner.dataset.mfHostStyle === '1') return null;
	owner.dataset.mfStyleOwner = ctx.realm;
	owner.dataset.mfScoped = '1';
	if (ctx.entryOrigin) owner.dataset.mfStyleOrigin = ctx.entryOrigin;
	return ctx.realm;
}

/** 确保 CSSStyleSheet.insertRule 被包一层转译 */
export function ensureCssomPatch() {
	const s = store();
	if (s.depth > 0) {
		s.depth += 1;
		return;
	}
	const nativeInsertRule = CSSStyleSheet.prototype.insertRule;
	s.origInsertRule = nativeInsertRule;
	CSSStyleSheet.prototype.insertRule = function mfInsertRule(
		rule: string,
		index?: number,
	): number {
		const realm = bindActiveRealm(this);
		if (realm) {
			const sel = scopeSelector(realm);
			rule = transpileStyleRule(rule, sel, realm);
		}
		return nativeInsertRule.call(this, rule, index);
	};
	s.depth = 1;
}

/** 减少 CSSOM patch 引用；到 0 时恢复原生 insertRule */
export function releaseCssomPatch() {
	const s = store();
	if (s.depth <= 0) return;
	s.depth -= 1;
	if (s.depth > 0) return;
	if (
		s.origInsertRule &&
		CSSStyleSheet.prototype.insertRule !== s.origInsertRule
	) {
		CSSStyleSheet.prototype.insertRule = s.origInsertRule;
	}
	s.origInsertRule = null;
}
