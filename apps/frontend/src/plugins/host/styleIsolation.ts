/**
 * Host 侧 CSS 隔离（类 qiankun experimentalStyleIsolation）：
 * Remote 注入的 CSS 用 @scope 包到 [data-mf-style-realm="…"]。
 *
 * 多 expose 共用同一 Remote（如 micro 的 LearningNotes + VideoPlayer）时，
 * CSS 只注入一份：必须按 Remote realm 隔离，不能按 pluginId，否则先打开的插件
 * 「占走」样式，切换后另一插件匹配不到 @scope。
 *
 * Portal：劫持共享 react-dom.createPortal，收进 body 下带同 realm 的 scope 容器。
 */

import ReactDOM from 'react-dom';

type CaptureCtx = {
	pluginId: string;
	/** @scope / mfStyleOwner 键：同一 Remote 多插件共享 */
	realm: string;
	entryOrigin: string;
};

let active: CaptureCtx | null = null;
let patchDepth = 0;
let origAppend: <T extends Node>(node: T) => T;
let origInsert: <T extends Node>(node: T, ref: Node | null) => T;

/** 指针/焦点跨越插件边界时更新；多数移动早退，避免 pointerover 热路径开销 */
let lastTouchedPluginId: string | null = null;
let touchBridgeInstalled = false;

function cssEscapeIdent(id: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return CSS.escape(id);
	}
	return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

/**
 * 同一 MF Remote（同 entry 源）共用一个样式域。
 * 优先 entry origin+目录；显式 remoteName 且异于 id 时作补充键。
 */
export function styleRealmKey(
	entry: string,
	remoteName?: string,
	pluginId?: string,
): string {
	try {
		const u = new URL(entry);
		u.search = '';
		u.hash = '';
		let path = u.pathname.replace(
			/\/(?:mf-manifest\.json|remoteEntry\.js)\/?$/i,
			'',
		);
		if (!path.endsWith('/')) path += '/';
		return `entry:${u.origin}${path}`;
	} catch {
		const named = remoteName?.trim();
		if (named && named !== pluginId) return `remote:${named}`;
		return `plugin:${pluginId || 'unknown'}`;
	}
}

function scopeSelector(realm: string): string {
	return `[data-mf-style-realm="${cssEscapeIdent(realm)}"]`;
}

function alreadyScoped(text: string, sel: string): boolean {
	return text.includes(`@scope (${sel})`) || text.includes(`@scope(${sel})`);
}

/** 去掉最外层 @scope (…) { … }，便于按新 realm 重包 / HMR 后重包 */
function unwrapScope(cssText: string): string {
	const trimmed = cssText.trim();
	const m = trimmed.match(/^@scope\s*\([^)]*\)\s*\{/);
	if (!m || !trimmed.endsWith('}')) return cssText;
	return trimmed.slice(m[0].length, -1).trim();
}

function wrapWithScope(cssText: string, sel: string): string {
	const trimmed = cssText.trim();
	if (!trimmed) return cssText;
	if (alreadyScoped(trimmed, sel)) return cssText;
	const body = unwrapScope(trimmed);
	return `@scope (${sel}) {\n${body}\n}\n`;
}

function entryOriginOf(entry: string): string {
	try {
		return new URL(entry).origin;
	} catch {
		return '';
	}
}

/** Host 源码根（…/apps/frontend），由本模块 URL 推导，避免白名单 remote 目录名 */
let hostViteRootCache: string | null = null;
function hostViteRoot(): string {
	if (hostViteRootCache != null) return hostViteRootCache;
	try {
		const path = decodeURIComponent(
			new URL(import.meta.url).pathname.replace(/\\/g, '/'),
		);
		const marker = '/apps/frontend';
		const idx = path.lastIndexOf(marker);
		if (idx >= 0) {
			hostViteRootCache = path.slice(0, idx + marker.length);
			return hostViteRootCache;
		}
	} catch {
		/* ignore */
	}
	hostViteRootCache = '/apps/frontend';
	return hostViteRootCache;
}

/**
 * 是否为 Host 自身 Vite 注入的 style（dev）。
 * 只排除 Host；其余 app（micro / remote-demo / 未来新目录）在 capture 窗口内一律可认领。
 */
function isHostViteDevStyle(viteId: string): boolean {
	const id = viteId.replace(/\\/g, '/');
	const root = hostViteRoot();
	if (root && id.includes(root)) return true;
	if (/\/apps\/frontend(?:\/|$)/i.test(id)) return true;
	// Host Vite 相对 id（无 monorepo apps/ 段）；Remote 一般是 @fs 绝对路径含 apps/<name>
	if (!/\/apps\//i.test(id) && (/^\/src\//.test(id) || /^\/@id\//.test(id))) {
		return true;
	}
	return false;
}

function isHostCriticalCss(text: string): boolean {
	// sonner 用 __insertCSS 注入全局样式；误 @scope 后 Toaster 失 fixed，会顶开布局
	return text.includes('[data-sonner-toaster]');
}

/** 纠正已被误包进 @scope 的 Host 关键全局样式（如 sonner） */
function repairHostCriticalStyles() {
	for (const node of document.head.querySelectorAll('style')) {
		if (!(node instanceof HTMLStyleElement)) continue;
		const text = node.textContent ?? '';
		if (!isHostCriticalCss(text)) continue;
		node.dataset.mfHostStyle = '1';
		if (!text.includes('@scope')) continue;
		node.textContent = unwrapScope(text);
		delete node.dataset.mfScoped;
		delete node.dataset.mfStyleOwner;
		delete node.dataset.mfStyleOrigin;
	}
}

function looksLikeRemoteStyle(
	el: HTMLStyleElement | HTMLLinkElement,
	ctx: CaptureCtx,
	mode: 'live' | 'reclaim' = 'live',
): boolean {
	if (el.dataset.mfHostStyle === '1') return false;

	const origin = el.dataset.mfStyleOrigin;
	if (origin) return origin === ctx.entryOrigin;

	const owner = el.dataset.mfStyleOwner;
	if (owner === ctx.realm || owner === ctx.pluginId) return true;
	if (
		owner?.startsWith('entry:') ||
		owner?.startsWith('remote:') ||
		owner?.startsWith('plugin:')
	) {
		return false;
	}

	if (el instanceof HTMLLinkElement) {
		if (el.rel !== 'stylesheet' || !el.href) return false;
		try {
			return new URL(el.href).origin === ctx.entryOrigin;
		} catch {
			return false;
		}
	}

	const text = el.textContent ?? '';
	if (isHostCriticalCss(text)) {
		el.dataset.mfHostStyle = '1';
		return false;
	}

	const viteId = el.getAttribute('data-vite-dev-id') || '';
	if (viteId) {
		if (isHostViteDevStyle(viteId)) return false;
		try {
			const host = new URL(ctx.entryOrigin).host;
			if (host && viteId.includes(host)) return true;
		} catch {
			/* ignore */
		}
		return active?.realm === ctx.realm;
	}

	// 生产无 vite id：旧版 owner=pluginId 且仍包着该 plugin 的 @scope → 可升到 realm
	if (owner) {
		if (
			active?.realm === ctx.realm &&
			(text.includes(`[data-mf-plugin="${owner}"]`) ||
				text.includes(`[data-mf-plugin='${owner}']`))
		) {
			return true;
		}
		return false;
	}

	// 无标记的 style：reclaim 绝不碰（避免收走 Host sonner 等）；仅 live 捕获窗口认领新注入
	if (mode === 'reclaim') return false;
	return active?.realm === ctx.realm;
}

function scopeStyleElement(
	el: HTMLStyleElement,
	realm: string,
	entryOrigin?: string,
) {
	const text0 = el.textContent ?? '';
	if (isHostCriticalCss(text0)) {
		el.dataset.mfHostStyle = '1';
		return;
	}
	const sel = scopeSelector(realm);
	const text = el.textContent ?? '';
	if (!text.trim()) {
		const mo = new MutationObserver(() => {
			if ((el.textContent ?? '').trim()) {
				mo.disconnect();
				scopeStyleElement(el, realm, entryOrigin);
			}
		});
		mo.observe(el, {
			childList: true,
			characterData: true,
			subtree: true,
		});
		return;
	}
	if (alreadyScoped(text, sel)) {
		el.dataset.mfScoped = '1';
		el.dataset.mfStyleOwner = realm;
		if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
		return;
	}
	el.textContent = wrapWithScope(text, sel);
	el.dataset.mfScoped = '1';
	el.dataset.mfStyleOwner = realm;
	if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
}

async function scopeLinkElement(
	el: HTMLLinkElement,
	realm: string,
	entryOrigin: string,
) {
	const href = el.href;
	if (!href) return;
	const sel = scopeSelector(realm);
	const existing = Array.from(
		document.head.querySelectorAll('style[data-mf-from-link]'),
	).find((s) => (s as HTMLElement).dataset.mfFromLink === href) as
		| HTMLStyleElement
		| undefined;
	if (existing) {
		scopeStyleElement(existing, realm, entryOrigin);
		el.dataset.mfScoped = '1';
		el.dataset.mfStyleOwner = realm;
		el.dataset.mfStyleOrigin = entryOrigin;
		el.disabled = true;
		return;
	}
	if (el.dataset.mfScoped === '1' && el.dataset.mfStyleOwner === realm) return;
	try {
		const res = await fetch(href, { credentials: 'omit', mode: 'cors' });
		if (!res.ok) return;
		const css = await res.text();
		const style = document.createElement('style');
		style.textContent = wrapWithScope(css, sel);
		style.dataset.mfScoped = '1';
		style.dataset.mfStyleOwner = realm;
		style.dataset.mfStyleOrigin = entryOrigin;
		style.dataset.mfFromLink = href;
		el.insertAdjacentElement('afterend', style);
		el.dataset.mfScoped = '1';
		el.disabled = true;
		el.dataset.mfStyleOwner = realm;
		el.dataset.mfStyleOrigin = entryOrigin;
	} catch {
		/* CORS / 离线 */
	}
}

function processNode(node: Node, ctx: CaptureCtx) {
	if (!(node instanceof HTMLElement)) return;
	if (node instanceof HTMLStyleElement) {
		if (!looksLikeRemoteStyle(node, ctx)) return;
		scopeStyleElement(node, ctx.realm, ctx.entryOrigin);
		return;
	}
	if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
		if (!looksLikeRemoteStyle(node, ctx)) return;
		void scopeLinkElement(node, ctx.realm, ctx.entryOrigin);
	}
}

/** 挂载时把 head 里已注入、同 entry 的样式收回当前 realm（修复切换插件后无样式） */
function reclaimEntryStyles(ctx: CaptureCtx) {
	repairHostCriticalStyles();
	const nodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
	for (const node of nodes) {
		if (
			!(node instanceof HTMLStyleElement || node instanceof HTMLLinkElement)
		) {
			continue;
		}
		if (!looksLikeRemoteStyle(node, ctx, 'reclaim')) continue;
		if (node instanceof HTMLStyleElement) {
			scopeStyleElement(node, ctx.realm, ctx.entryOrigin);
		} else {
			void scopeLinkElement(node, ctx.realm, ctx.entryOrigin);
		}
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
 * 在 loadRemote 前后包一层：捕获本次注入的 CSS 并 @scope 到 realm。
 */
export function beginPluginStyleCapture(
	pluginId: string,
	entry: string,
	remoteName?: string,
): () => void {
	const realm = styleRealmKey(entry, remoteName, pluginId);
	const ctx: CaptureCtx = {
		pluginId,
		realm,
		entryOrigin: entryOriginOf(entry),
	};
	const prev = active;
	active = ctx;
	ensureHeadPatch();
	repairHostCriticalStyles();
	reclaimEntryStyles(ctx);

	const sel = scopeSelector(realm);
	const obs = new MutationObserver((mutations) => {
		if (!active || active.realm !== realm) return;
		for (const m of mutations) {
			for (const n of m.addedNodes) processNode(n, ctx);
			if (m.target instanceof HTMLStyleElement) {
				if (!looksLikeRemoteStyle(m.target, ctx)) continue;
				const text = m.target.textContent ?? '';
				// HMR 可能改写 textContent 丢掉 @scope
				if (text.trim() && !alreadyScoped(text, sel)) {
					delete m.target.dataset.mfScoped;
				}
				scopeStyleElement(m.target, realm, ctx.entryOrigin);
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
		if (active?.realm === realm && active.pluginId === pluginId) {
			active = prev;
		}
		releaseHeadPatch();
	};
}

/* -------------------- Portal → @scope（createPortal 收编） -------------------- */

const portalPlugins = new Set<string>();
/** pluginId → realm，Portal 容器需带 style-realm 才能吃到 CSS */
const portalRealmByPlugin = new Map<string, string>();

function claimIdFromElement(el: Element | null): string | null {
	if (!el) return null;
	const scope = el.closest('[data-mf-portal-scope]');
	if (scope) {
		const id = scope.getAttribute('data-mf-portal-scope');
		if (id && portalPlugins.has(id)) return id;
	}
	const root = el.closest(
		'[data-mf-plugin]:not([data-mf-portal-stamp]):not([data-mf-portal-scope])',
	);
	const id = root?.getAttribute('data-mf-plugin');
	return id && portalPlugins.has(id) ? id : null;
}

function ensureTouchBridge() {
	if (touchBridgeInstalled || typeof document === 'undefined') return;
	touchBridgeInstalled = true;

	document.addEventListener(
		'pointerover',
		(e) => {
			const to = claimIdFromElement(
				e.target instanceof Element ? e.target : null,
			);
			const from = claimIdFromElement(
				e.relatedTarget instanceof Element ? e.relatedTarget : null,
			);
			if (to === from) return;
			lastTouchedPluginId = to;
		},
		true,
	);
	document.addEventListener(
		'focusin',
		(e) => {
			lastTouchedPluginId = claimIdFromElement(
				e.target instanceof Element ? e.target : null,
			);
		},
		true,
	);
}

/** 打开 Host Portal 外壳前的同步认领（不等 attach）；关闭时 clear */
let portalClaimOverride: string | null = null;

function resolveClaimPluginId(): string | null {
	if (
		portalClaimOverride &&
		(portalPlugins.has(portalClaimOverride) ||
			portalRealmByPlugin.has(portalClaimOverride))
	) {
		return portalClaimOverride;
	}
	if (lastTouchedPluginId && portalPlugins.has(lastTouchedPluginId)) {
		return lastTouchedPluginId;
	}
	const ae = document.activeElement;
	if (ae instanceof Element) {
		const id = claimIdFromElement(ae);
		if (id) return id;
	}
	// sticky：scope 里已有弹层时不要把 createPortal 打回 body（否则 Drawer/POP 重挂闪烁）
	for (const id of portalPlugins) {
		const host = document.querySelector(
			`[data-mf-portal-scope="${cssEscapeIdent(id)}"]`,
		);
		if (host && host.childElementCount > 0) return id;
	}
	return null;
}

/**
 * 在 Host 打开会 Portal 的外壳（如 Drawer）之前同步认领，
 * 让首帧 createPortal 就进 scope，避免「先 body 再搬进 scope」整树重挂闪烁。
 */
export function claimPluginPortalTarget(pluginId: string, realm: string): void {
	ensureTouchBridge();
	ensureCreatePortalPatch();
	portalRealmByPlugin.set(pluginId, realm);
	portalClaimOverride = pluginId;
	lastTouchedPluginId = pluginId;
	ensureBodyPortalScope(pluginId);
}

export function clearPluginPortalClaim(pluginId?: string | null): void {
	if (pluginId && portalClaimOverride !== pluginId) return;
	portalClaimOverride = null;
}

function ensureBodyPortalScope(pluginId: string): HTMLElement {
	const sel = `[data-mf-portal-scope="${cssEscapeIdent(pluginId)}"]`;
	let el = document.querySelector(sel) as HTMLElement | null;
	const realm = portalRealmByPlugin.get(pluginId);
	if (el) {
		if (realm && el.getAttribute('data-mf-style-realm') !== realm) {
			el.setAttribute('data-mf-style-realm', realm);
		}
		return el;
	}
	el = document.createElement('div');
	el.setAttribute('data-mf-plugin', pluginId);
	if (realm) el.setAttribute('data-mf-style-realm', realm);
	el.setAttribute('data-mf-portal-scope', pluginId);
	el.dataset.mfPortalStamp = '1';
	el.style.cssText =
		'position:absolute;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147503646;';
	document.body.appendChild(el);
	return el;
}

function removeBodyPortalScope(pluginId: string) {
	document
		.querySelector(`[data-mf-portal-scope="${cssEscapeIdent(pluginId)}"]`)
		?.remove();
}

function isBodyPortalTarget(
	container: Element | DocumentFragment | null | undefined,
): boolean {
	return container === document.body || container === document.documentElement;
}

function retargetPortalContainer(
	container: Element | DocumentFragment,
): Element | DocumentFragment {
	if (!isBodyPortalTarget(container)) return container;
	if (
		container instanceof Element &&
		container.closest('[data-mf-host-portal]')
	) {
		return container;
	}
	const id = resolveClaimPluginId();
	if (!id) return container;
	return ensureBodyPortalScope(id);
}

let createPortalPatched = false;
let origCreatePortal: typeof ReactDOM.createPortal | null = null;

function ensureCreatePortalPatch() {
	if (createPortalPatched) return;
	createPortalPatched = true;
	origCreatePortal = ReactDOM.createPortal.bind(ReactDOM);
	ReactDOM.createPortal = ((children, container, key) => {
		const next =
			portalPlugins.size > 0 || portalClaimOverride
				? retargetPortalContainer(container as Element | DocumentFragment)
				: container;
		return origCreatePortal!(children, next as Element, key);
	}) as typeof ReactDOM.createPortal;
}

function attachPortalScopeBridge(pluginId: string, realm: string): () => void {
	ensureTouchBridge();
	ensureCreatePortalPatch();
	portalPlugins.add(pluginId);
	portalRealmByPlugin.set(pluginId, realm);
	lastTouchedPluginId = pluginId;
	ensureBodyPortalScope(pluginId);
	return () => {
		portalPlugins.delete(pluginId);
		portalRealmByPlugin.delete(pluginId);
		removeBodyPortalScope(pluginId);
		if (lastTouchedPluginId === pluginId) lastTouchedPluginId = null;
	};
}

/**
 * 插件页挂载期间继续隔离（HMR / 延迟 CSS）+ Portal 静默纳入 @scope。
 */
export function attachPluginStyleIsolation(
	pluginId: string,
	entry: string,
	remoteName?: string,
): () => void {
	const realm = styleRealmKey(entry, remoteName, pluginId);
	const endCss = beginPluginStyleCapture(pluginId, entry, remoteName);
	const endPortal = attachPortalScopeBridge(pluginId, realm);
	return () => {
		endPortal();
		endCss();
	};
}
