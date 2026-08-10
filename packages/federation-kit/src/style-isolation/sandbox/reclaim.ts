/**
 * Remote 样式认领、scope 写回、HMR、reclaim。
 */

import { unwrapScope, wrapWithPrefix } from '../css/transpile';
import {
	alreadyScoped,
	MF_ISO_MARK_RE,
	scopeSelector,
	styleNeedsRescope,
} from '../protocol';
import { activeCtx, type CaptureCtx } from './context';

// 从 entry URL 取 origin，供 link 同域认领与 data-mf-style-origin
export function entryOriginOf(entry: string): string {
	// 尝试解析绝对 URL
	try {
		// 返回 origin（协议+主机+端口）
		return new URL(entry).origin;
		// 相对路径或非法 URL
	} catch {
		// 解析失败返回空串，调用方按无 origin 处理
		return '';
		// 结束 entryOriginOf 的 catch
	}
	// 结束 entryOriginOf
}

/** Host Vite 源码根路径标记；可通过 configureStyleIsolation 覆盖 */
let hostViteRootMarker = '/apps/frontend';
let hostViteRootCache: string | null = null;

export function setHostViteRootMarker(marker?: string) {
	hostViteRootMarker = marker?.trim() || '/apps/frontend';
	hostViteRootCache = null;
}

function hostViteRoot(): string {
	if (hostViteRootCache != null) return hostViteRootCache;
	try {
		const path = decodeURIComponent(
			new URL(import.meta.url).pathname.replace(/\\/g, '/'),
		);
		const marker = hostViteRootMarker;
		const idx = path.lastIndexOf(marker);
		if (idx >= 0) {
			hostViteRootCache = path.slice(0, idx + marker.length);
			return hostViteRootCache;
		}
	} catch {
		/* ignore */
	}
	hostViteRootCache = hostViteRootMarker;
	return hostViteRootCache;
}

/**
 * 是否为 Host 自身 Vite 注入的 style（dev）。
 * 只排除 Host；Remote 须靠 entry host / apps/<remote> 等正信号认领。
 */
function isHostViteDevStyle(viteId: string): boolean {
	const id = viteId.replace(/\\/g, '/');
	const root = hostViteRoot();
	if (root && id.includes(root)) return true;
	const escaped = hostViteRootMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	if (new RegExp(`${escaped}(?:/|$)`, 'i').test(id)) return true;
	// Host Vite 相对 id（无 monorepo apps/ 段）；Remote 一般是 @fs 绝对路径含 apps/<name>
	if (!/\/apps\//i.test(id) && (/^\/src\//.test(id) || /^\/@id\//.test(id))) {
		return true;
	}
	// Host 消费的 workspace 包（如 markdown-kit），不在 apps/<remote> 下
	if (/\/packages\//i.test(id)) return true;
	return false;
}

/** 检测已知会被误伤的 Host 全局 CSS（仅作认领拒绝 / 修复，不是业务名单扩展点） */
function isHostCriticalCss(text: string): boolean {
	// sonner __insertCSS；误隔离后 Toaster 失 fixed
	return text.includes('[data-sonner-toaster]');
}

function isHostMarkedStyleEl(el: HTMLElement): boolean {
	return el.dataset.mfHostStyle === '1';
}

/** 纠正已被误隔离的 Host 样式（sonner + 带 Host vite-id 的误认领） */
export function repairHostCriticalStyles() {
	for (const node of document.head.querySelectorAll(
		'style, link[rel="stylesheet"]',
	)) {
		if (!(node instanceof HTMLElement)) continue;
		const text =
			node instanceof HTMLStyleElement ? (node.textContent ?? '') : '';
		const viteId = node.getAttribute('data-vite-dev-id') || '';
		const critical =
			isHostMarkedStyleEl(node) ||
			(text ? isHostCriticalCss(text) : false) ||
			(viteId ? isHostViteDevStyle(viteId) : false);
		if (!critical) continue;
		node.dataset.mfHostStyle = '1';
		if (node instanceof HTMLStyleElement) {
			let css = node.textContent ?? '';
			if (css.includes('@scope')) css = unwrapScope(css);
			if (css.includes('mf-iso') || css.includes('data-mf-style-realm')) {
				css = css
					.replace(MF_ISO_MARK_RE, '')
					.replace(/\[data-mf-style-realm=(?:"[^"]*"|'[^']*')\]/g, '')
					.replace(/\[data-plugin-root\]/g, '');
			}
			if (css !== (node.textContent ?? '')) node.textContent = css;
		}
		if (node instanceof HTMLLinkElement && node.disabled) {
			node.disabled = false;
		}
		delete node.dataset.mfScoped;
		delete node.dataset.mfStyleOwner;
		delete node.dataset.mfStyleOrigin;
	}
}

// 判断 style/link 是否应归当前捕获 ctx 的 Remote（live 或 reclaim）
export function looksLikeRemoteStyle(
	// 待判定的 style 或 stylesheet link
	el: HTMLStyleElement | HTMLLinkElement,
	// 当前插件捕获上下文
	ctx: CaptureCtx,
	// live=捕获窗口认领；reclaim=挂载时收回，更保守
	mode: 'live' | 'reclaim' = 'live',
	// 返回是否视为该 Remote 的样式；函数体开始
): boolean {
	// 已标 Host 关键样式则永不认领
	if (isHostMarkedStyleEl(el)) return false;

	// 读此前写入的 entry origin
	const origin = el.dataset.mfStyleOrigin;
	// 有 origin 标记时只认与 ctx.entryOrigin 相同的
	if (origin) return origin === ctx.entryOrigin;

	// 读 mfStyleOwner（可能是 realm 或旧版 pluginId）
	const owner = el.dataset.mfStyleOwner;
	// owner 已是本 realm 或本 pluginId 则认领
	if (owner === ctx.realm || owner === ctx.pluginId) return true;
	// owner 已是其它规范键则说明归属别的 Remote
	if (
		// entry: 前缀的其它 realm
		owner?.startsWith('entry:') ||
		// remote: 前缀的其它名
		owner?.startsWith('remote:') ||
		// plugin: 前缀的其它插件
		owner?.startsWith('plugin:')
		// 结束「已是规范 owner 键」条件
	) {
		// 归属其它 Remote，明确不认领
		return false;
		// 结束其它 owner 键分支
	}

	// link 元素：用 href 的 origin 与 entry 比对
	if (el instanceof HTMLLinkElement) {
		// 非 stylesheet 或无 href 则不是可认领样式表
		if (el.rel !== 'stylesheet' || !el.href) return false;
		// 解析 href 的 origin
		try {
			// 同域即视为该 Remote 的 link
			return new URL(el.href).origin === ctx.entryOrigin;
			// href 非法 URL
		} catch {
			// 解析失败则不认领
			return false;
			// 结束 link 分支 try/catch
		}
		// 结束 HTMLLinkElement 分支
	}

	// style 元素：读文本做 Host 关键与 vite id 判定
	const text = el.textContent ?? '';
	if (isHostCriticalCss(text)) {
		el.dataset.mfHostStyle = '1';
		delete el.dataset.mfScoped;
		delete el.dataset.mfStyleOwner;
		delete el.dataset.mfStyleOrigin;
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
		// 其它 apps/<remote> 路径：仅栈顶为本 realm 时认领
		if (/\/apps\//i.test(viteId) && activeCtx()?.realm === ctx.realm) {
			return true;
		}
		// load 短窗：其余非 Host vite 样式（Remote 依赖）可认领
		return Boolean(ctx.claimUnmarked && activeCtx()?.realm === ctx.realm);
	}

	// 生产无 vite id：旧版 owner=pluginId 且仍包着该 plugin 的 @scope → 可升到 realm
	if (owner) {
		if (
			activeCtx()?.realm === ctx.realm &&
			(text.includes(`[data-mf-plugin="${owner}"]`) ||
				text.includes(`[data-mf-plugin='${owner}']`))
		) {
			return true;
		}
		return false;
	}

	// 无标记 style：reclaim 不碰；空节点不认领（sonner 先插空再填全文；CSS-in-JS 走 insertRule）
	if (mode === 'reclaim') return false;
	if (!(el.textContent ?? '').trim()) return false;
	return Boolean(ctx.claimUnmarked && activeCtx()?.realm === ctx.realm);
}

// 空 style 等待 textContent 出现的 MutationObserver，弱键防泄漏
const pendingStyleObservers = new WeakMap<HTMLStyleElement, MutationObserver>();
// 已 scoped 的 style 监听 HMR 改文，弱键防泄漏
const hmrStyleObservers = new WeakMap<HTMLStyleElement, MutationObserver>();

/**
 * 仅对 Vite HMR style（data-vite-dev-id）监听换文重隔离。
 * antd cssinjs 等运行时靠 insertRule patch；对其 textContent 再 wrap 会互殴卡死整页。
 */
function watchScopedStyleHmr(
	// 已打过 mf 隔离标记的 style 元素
	el: HTMLStyleElement,
	// 当前归属的 style realm（与 data-mf-style-owner 对齐）
	realm: string,
	// Remote 入口 origin，重 scope 时原样传回
	entryOrigin: string | undefined,
	// 本 realm 的 [data-mf-style-realm="…"] 选择器，供 styleNeedsRescope 判断
	sel: string,
	// 函数体开始
) {
	// 同一元素已挂 HMR observer 则跳过，防止重复监听
	if (hmrStyleObservers.has(el)) return;
	// 非 Vite 开发态 style（无 data-vite-dev-id）不监听：antd cssinjs 等靠 insertRule，再 wrap text 会互殴卡死
	if (!el.getAttribute('data-vite-dev-id')) return;

	// 子树文本/节点变化时检查是否需要重新隔离
	const mo = new MutationObserver(() => {
		// owner 已不是本 realm：可能被别的插件认领，本观察者不再处理
		if (el.dataset.mfStyleOwner !== realm) return;
		// 读取当前 CSS 文本（null 当空串）
		const text = el.textContent ?? '';
		// 已带本 realm 前缀且无需剥旧 @scope → 不必重写，避免无意义写回
		if (!styleNeedsRescope(text, sel)) return;
		// 先断开，避免 set textContent 同步再进本回调形成死循环
		mo.disconnect();
		// 从弱表摘掉，允许后续再次 watch（scopeStyleElement 末尾会重挂）
		hmrStyleObservers.delete(el);
		// 清掉 scoped 标，让 scopeStyleElement 重新走完整 wrap 路径
		delete el.dataset.mfScoped;
		// 按原 realm/origin 重新隔离（内部会再调用本函数挂新 observer）
		scopeStyleElement(el, realm, entryOrigin);
		// 结束 MutationObserver 回调
	});
	// 登记弱引用，便于去重与元素回收时自动释放
	hmrStyleObservers.set(el, mo);
	// 监听子节点与字符数据（含文本节点替换），覆盖 Vite HMR 改 style 内容的常见路径
	mo.observe(el, { childList: true, characterData: true, subtree: true });
	// 结束 watchScopedStyleHmr
}

// 把单个 style 元素的 CSS 包进 @scope，并打 owner/origin 标记
export function scopeStyleElement(
	// 待隔离的 style
	el: HTMLStyleElement,
	// 目标 realm
	realm: string,
	// 可选 Remote origin
	entryOrigin?: string,
	// 函数体开始
) {
	// 先读文本做 Host 关键检测
	const text0 = el.textContent ?? '';
	if (isHostCriticalCss(text0)) {
		el.dataset.mfHostStyle = '1';
		delete el.dataset.mfScoped;
		delete el.dataset.mfStyleOwner;
		delete el.dataset.mfStyleOrigin;
		return;
	}
	const sel = scopeSelector(realm);
	const text = el.textContent ?? '';
	// 空 style：等文本出现后再用 looksLikeRemoteStyle 判定（勿空窗期打 owner）
	if (!text.trim()) {
		if (pendingStyleObservers.has(el)) return;
		const mo = new MutationObserver(() => {
			if (!(el.textContent ?? '').trim()) return;
			mo.disconnect();
			pendingStyleObservers.delete(el);
			if (el.dataset.mfHostStyle === '1') return;
			const ctx = activeCtx();
			if (
				!ctx ||
				ctx.realm !== realm ||
				!looksLikeRemoteStyle(el, ctx, 'live')
			) {
				return;
			}
			scopeStyleElement(el, realm, entryOrigin);
		});
		pendingStyleObservers.set(el, mo);
		mo.observe(el, {
			childList: true,
			characterData: true,
			subtree: true,
		});
		return;
	}
	// 已隔离到本 realm：旧 @scope 迁移；协议升版（缺当前 mf-iso 标记）时重写一次
	if (
		el.dataset.mfScoped === '1' &&
		el.dataset.mfStyleOwner === realm &&
		!styleNeedsRescope(text, sel)
	) {
		if (!alreadyScoped(text, sel)) {
			// 已有前缀但标记过旧 → 升到当前协议（html/body→plugin-root 等）
			el.textContent = wrapWithPrefix(text, sel, realm);
		}
		if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
		watchScopedStyleHmr(el, realm, entryOrigin, sel);
		return;
	}
	// 正式把 CSS 前缀隔离写回 textContent
	el.textContent = wrapWithPrefix(text, sel, realm);
	// 标记已完成隔离
	el.dataset.mfScoped = '1';
	// owner 设为 realm，供 CSSOM / reclaim 识别
	el.dataset.mfStyleOwner = realm;
	// 写入 entry origin
	if (entryOrigin) el.dataset.mfStyleOrigin = entryOrigin;
	// 挂上 HMR 重隔离监听
	watchScopedStyleHmr(el, realm, entryOrigin, sel);
	// 结束 scopeStyleElement
}

// fetch 外链 CSS，换成带 @scope 的 style，并禁用原 link
async function scopeLinkElement(
	// stylesheet link
	el: HTMLLinkElement,
	// 目标 realm
	realm: string,
	// Remote origin，写入 dataset
	entryOrigin: string,
	// async 函数体开始
) {
	// 读绝对 href
	const href = el.href;
	// 无 href 无法拉取，直接返回
	if (!href) return;
	// 本 realm 的 scope 选择器
	const sel = scopeSelector(realm);
	// 查找是否已有从同 href 注入的 style（避免重复 fetch）
	const existing = Array.from(
		// head 里带 data-mf-from-link 的 style
		document.head.querySelectorAll('style[data-mf-from-link]'),
		// dataset.mfFromLink 等于当前 href 则复用
	).find((s) => (s as HTMLElement).dataset.mfFromLink === href) as
		// 断言为 HTMLStyleElement 或 undefined（联合类型上行）
			| HTMLStyleElement
			// 联合类型下行：undefined
			| undefined;
	// 已有注入 style：对其重新 scope，并禁用本 link
	if (existing) {
		// 确保复用节点归属当前 realm
		scopeStyleElement(existing, realm, entryOrigin);
		// 标记 link 已处理
		el.dataset.mfScoped = '1';
		// owner 与 style 对齐
		el.dataset.mfStyleOwner = realm;
		// origin 对齐
		el.dataset.mfStyleOrigin = entryOrigin;
		// 禁用 link，避免双份样式（裸 CSS + scoped）
		el.disabled = true;
		// 复用路径结束
		return;
		// 结束 existing 分支
	}
	// link 已按本 realm scoped 过则跳过
	if (el.dataset.mfScoped === '1' && el.dataset.mfStyleOwner === realm) return;
	// CORS 拉取 CSS 文本
	try {
		// omit 凭证、cors 模式，避免无关 cookie；跨域失败进 catch
		const res = await fetch(href, { credentials: 'omit', mode: 'cors' });
		// 非 2xx 则放弃隔离，保留原 link
		if (!res.ok) return;
		// 读响应体为 CSS 字符串
		const css = await res.text();
		// 新建 style 承载隔离后的 CSS
		const style = document.createElement('style');
		// 先禁用 link，避免 fetch 窗口内未隔离样式闪烁污染 Host
		// 立刻禁用原 link，缩短未隔离窗口
		el.disabled = true;
		// 写入 wrap 后的 CSS
		style.textContent = wrapWithPrefix(css, sel, realm);
		// 标记新 style 已隔离
		style.dataset.mfScoped = '1';
		// owner=realm
		style.dataset.mfStyleOwner = realm;
		// origin=entryOrigin
		style.dataset.mfStyleOrigin = entryOrigin;
		// 记录来源 href，供下次复用查找
		style.dataset.mfFromLink = href;
		// 插到 link 后面，保持级联大致顺序
		el.insertAdjacentElement('afterend', style);
		// 原 link 打上已处理标记
		el.dataset.mfScoped = '1';
		// owner 同步
		el.dataset.mfStyleOwner = realm;
		// origin 同步
		el.dataset.mfStyleOrigin = entryOrigin;
		// fetch/CORS 失败（降级见块内注释）
	} catch {
		/* CORS / 离线：保持原 link，不阻断功能（隔离降级） */
		// 结束 scopeLinkElement try/catch
	}
	// 结束 scopeLinkElement
}

// 对单次插入 head 的节点：若是 Remote style/link 则隔离
export function processNode(node: Node, ctx: CaptureCtx) {
	// 非 HTMLElement 忽略（文本节点等）
	if (!(node instanceof HTMLElement)) return;
	// style 标签路径
	if (node instanceof HTMLStyleElement) {
		// 不像本 Remote 的样式则跳过
		if (!looksLikeRemoteStyle(node, ctx)) return;
		// 包 @scope 并打标
		scopeStyleElement(node, ctx.realm, ctx.entryOrigin);
		// style 处理完毕，避免再落入 link 分支
		return;
		// 结束 HTMLStyleElement 分支
	}
	// stylesheet link 路径
	if (node instanceof HTMLLinkElement && node.rel === 'stylesheet') {
		// 不像本 Remote 则跳过
		if (!looksLikeRemoteStyle(node, ctx)) return;
		// 异步 fetch+替换；void 表示不阻塞插入路径
		void scopeLinkElement(node, ctx.realm, ctx.entryOrigin);
		// 结束 HTMLLinkElement 分支
	}
	// 结束 processNode
}

/** 挂载时把 head 里已注入、同 entry 的样式收回当前 realm（修复切换插件后无样式） */
// 见上行 JSDoc：挂载时收回 head 里同 entry 的样式到当前 realm
export function reclaimEntryStyles(ctx: CaptureCtx) {
	// 先修 Host 关键样式，避免误 reclaim
	repairHostCriticalStyles();
	// 收集 head 内所有 style 与 stylesheet link
	const nodes = document.head.querySelectorAll('style, link[rel="stylesheet"]');
	// 逐个尝试收回
	for (const node of nodes) {
		// 只处理 style 或 stylesheet link
		if (
			// 类型守卫：必须是 style 或 link
			!(node instanceof HTMLStyleElement || node instanceof HTMLLinkElement)
			// 结束类型守卫条件
		) {
			// continue 下一 node
			continue;
			// 结束非 style/link 分支
		}
		// reclaim 模式：无标记的不碰，只收有归属线索的
		if (!looksLikeRemoteStyle(node, ctx, 'reclaim')) continue;
		// style → 同步 scopeStyleElement
		if (node instanceof HTMLStyleElement) {
			// 隔离 style 文本并打 realm 标
			scopeStyleElement(node, ctx.realm, ctx.entryOrigin);
			// link → 异步 scopeLinkElement
		} else {
			// fire-and-forget 拉取并替换为 scoped style
			void scopeLinkElement(node, ctx.realm, ctx.entryOrigin);
			// 结束 style vs link 分支
		}
		// 结束 for nodes
	}
	// 结束 reclaimEntryStyles
}
