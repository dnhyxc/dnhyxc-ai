/**
 * Host 侧 CSS 隔离（类 qiankun experimentalStyleIsolation）：
 * 在 Remote 注入 style/link 时用 @scope 包到 [data-mf-plugin="id"]，
 * 使子应用可用正常 `@import "tailwindcss"`，无需在 Remote 做 scoped 特殊配置。
 */

type CaptureCtx = {
	pluginId: string;
	entryOrigin: string;
};

let active: CaptureCtx | null = null;
let patchDepth = 0;
let origAppend: <T extends Node>(node: T) => T;
let origInsert: <T extends Node>(node: T, ref: Node | null) => T;

function cssEscapeIdent(id: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return CSS.escape(id);
	}
	return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function scopeSelector(pluginId: string): string {
	return `[data-mf-plugin="${cssEscapeIdent(pluginId)}"]`;
}

function alreadyScoped(text: string, sel: string): boolean {
	return text.includes(`@scope (${sel})`) || text.includes(`@scope(${sel})`);
}

function wrapWithScope(cssText: string, sel: string): string {
	const trimmed = cssText.trim();
	if (!trimmed || alreadyScoped(trimmed, sel)) return cssText;
	return `@scope (${sel}) {\n${trimmed}\n}\n`;
}

function entryOriginOf(entry: string): string {
	try {
		return new URL(entry).origin;
	} catch {
		return '';
	}
}

function looksLikeRemoteStyle(
	el: HTMLStyleElement | HTMLLinkElement,
	ctx: CaptureCtx,
): boolean {
	if (el.dataset.mfStyleOwner) {
		return el.dataset.mfStyleOwner === ctx.pluginId;
	}
	if (el instanceof HTMLLinkElement) {
		if (el.rel !== 'stylesheet' || !el.href) return false;
		try {
			return new URL(el.href).origin === ctx.entryOrigin;
		} catch {
			return false;
		}
	}
	const viteId = el.getAttribute('data-vite-dev-id') || '';
	if (viteId) {
		return /(?:^|[\\/])micro(?:[\\/]|$)|remote-plugins|remote-demo|remote-host/i.test(
			viteId,
		);
	}
	// 生产 MF 注入的 style 常无 vite id：仅在主动 capture 窗口内认领
	return active?.pluginId === ctx.pluginId;
}

function scopeStyleElement(el: HTMLStyleElement, pluginId: string) {
	if (el.dataset.mfScoped === '1') return;
	const sel = scopeSelector(pluginId);
	const text = el.textContent ?? '';
	if (!text.trim()) {
		// Vite 常先 append 空 style 再写 textContent
		const mo = new MutationObserver(() => {
			if ((el.textContent ?? '').trim()) {
				mo.disconnect();
				scopeStyleElement(el, pluginId);
			}
		});
		mo.observe(el, {
			childList: true,
			characterData: true,
			subtree: true,
		});
		return;
	}
	el.textContent = wrapWithScope(text, sel);
	el.dataset.mfScoped = '1';
	el.dataset.mfStyleOwner = pluginId;
}

async function scopeLinkElement(el: HTMLLinkElement, pluginId: string) {
	if (el.dataset.mfScoped === '1') return;
	const href = el.href;
	if (!href) return;
	try {
		const res = await fetch(href, { credentials: 'omit', mode: 'cors' });
		if (!res.ok) return;
		const css = await res.text();
		const style = document.createElement('style');
		style.textContent = wrapWithScope(css, scopeSelector(pluginId));
		style.dataset.mfScoped = '1';
		style.dataset.mfStyleOwner = pluginId;
		style.dataset.mfFromLink = href;
		el.insertAdjacentElement('afterend', style);
		el.dataset.mfScoped = '1';
		el.disabled = true;
		el.dataset.mfStyleOwner = pluginId;
	} catch {
		/* CORS / 离线：无法改写则保持原样（partner 仍建议可 CORS） */
	}
}

function processNode(node: Node, ctx: CaptureCtx) {
	if (!(node instanceof HTMLElement)) return;
	if (node instanceof HTMLStyleElement) {
		if (!looksLikeRemoteStyle(node, ctx)) return;
		scopeStyleElement(node, ctx.pluginId);
		return;
	}
	if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
		if (!looksLikeRemoteStyle(node, ctx)) return;
		void scopeLinkElement(node, ctx.pluginId);
	}
}

function ensureHeadPatch() {
	if (patchDepth > 0) {
		patchDepth += 1;
		return;
	}
	const head = document.head;
	origAppend = head.appendChild.bind(head) as typeof origAppend;
	origInsert = head.insertBefore.bind(head) as typeof origInsert;

	head.appendChild = function appendScoped<T extends Node>(node: T): T {
		const ret = origAppend(node);
		if (active) processNode(node, active);
		return ret;
	};

	head.insertBefore = function insertScoped<T extends Node>(
		node: T,
		ref: Node | null,
	): T {
		const ret = origInsert(node, ref);
		if (active) processNode(node, active);
		return ret;
	};

	patchDepth = 1;
}

function releaseHeadPatch() {
	if (patchDepth <= 0) return;
	patchDepth -= 1;
	if (patchDepth > 0) return;
	document.head.appendChild = origAppend as typeof document.head.appendChild;
	document.head.insertBefore = origInsert as typeof document.head.insertBefore;
}

/**
 * 在 loadRemote 前后包一层：捕获本次注入的 CSS 并 @scope。
 * 可嵌套调用（refcount patch）。
 */
export function beginPluginStyleCapture(
	pluginId: string,
	entry: string,
): () => void {
	const ctx: CaptureCtx = {
		pluginId,
		entryOrigin: entryOriginOf(entry),
	};
	const prev = active;
	active = ctx;
	ensureHeadPatch();

	const obs = new MutationObserver((mutations) => {
		if (!active || active.pluginId !== pluginId) return;
		for (const m of mutations) {
			for (const n of m.addedNodes) processNode(n, ctx);
			// style 先插入再填 textContent
			if (
				m.type === 'childList' &&
				m.target instanceof HTMLStyleElement &&
				looksLikeRemoteStyle(m.target, ctx)
			) {
				scopeStyleElement(m.target, pluginId);
			}
		}
	});
	obs.observe(document.head, {
		childList: true,
		subtree: true,
		characterData: true,
	});

	return () => {
		obs.disconnect();
		if (active?.pluginId === pluginId) active = prev;
		releaseHeadPatch();
	};
}

/**
 * 插件页挂载期间继续隔离（HMR / 延迟注入的 CSS）。
 */
export function attachPluginStyleIsolation(
	pluginId: string,
	entry: string,
): () => void {
	return beginPluginStyleCapture(pluginId, entry);
}
