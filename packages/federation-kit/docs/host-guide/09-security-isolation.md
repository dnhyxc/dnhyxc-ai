# 09 · 安全校验、缓存击穿与样式隔离

> **本章目标**：讲清「插件代码加载前 Host 做了哪些防线」——① `verifyPlugin` 的信任分级与来源/版本/完整性校验；② `version@manifestHash` 缓存击穿，让新发布一定能生效且只多一次 GET；③ CSS/Portal 样式隔离，让 Remote 与 Host 样式互不污染。
>
> 对应源码：`packages/federation-kit/src/runtime/PluginVerifier.ts`、`packages/federation-kit/src/mf/mf.ts`、`packages/federation-kit/src/style-isolation/**`。

---

## 1. 信任分级：trusted / untrusted

| `trust` | 加载方式 | 代码是否进入主进程 | 适用的 Host API |
|---------|----------|--------------------|------------------|
| `trusted` | Module Federation 动态 import | 是（与宿主同 realm，全能力） | `api`、`modules` 全量 |
| `untrusted` | 独立 `<iframe>`（`iframeUrl`） | 否（软隔离，浏览器沙箱） | 仅 `postMessage` RPC |

> **一句话**：`trusted` = 自己的业务伙伴，直接用 MF 拉代码；`untrusted` = 不可信第三方，只给一个 iframe 沙箱，通过 `attachIframeBridge` 的 `postMessage` 协议通信（见第 7 章）。untrusted **不校验 hostApiRange / integrity**，但要求 `iframeUrl` 必须 https。

---

## 2. `verifyPlugin`：加载前的四道关卡

`packages/federation-kit/src/runtime/PluginVerifier.ts`（逐行注释）：

```ts
// 校验环境：由 createPluginRuntime 启动时注入（configureVerifyEnv）
export type VerifyEnv = {
	hostApiVersion: string; // 当前 Host API 版本（如 1.2.0）
	prod: boolean;          // 是否生产（生产禁止 http 本地地址）
	skipIntegrity: boolean; // 是否跳过完整性校验（本仓默认 true，可配）
	translate?: (key: string, params?: Record<string, string>) => string;
};

// 解析语义化版本的前三段：'v1.2.3-beta' → [1,2,3]；非法返回 null
function parseSemver(v: string): [number, number, number] | null {
	const m = v
		.trim()
		.replace(/^v/, '')
		.match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!m) return null;
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** 支持 `^x.y.z` / `>=x.y.z` / 精确版本 */
export function satisfiesRange(version: string, range: string): boolean {
	const ver = parseSemver(version);
	if (!ver) return false;
	const r = range.trim();
	if (r.startsWith('^')) {
		// ^1.2.0：同主版本，次版本不小于 2.0（0.x 语义收紧到完全一致的前两段）
		const base = parseSemver(r.slice(1));
		if (!base) return false;
		if (ver[0] !== base[0]) return false;
		if (ver[0] === 0) {
			return ver[1] === base[1] && ver[2] >= base[2];
		}
		return ver[1] > base[1] || (ver[1] === base[1] && ver[2] >= base[2]);
	}
	if (r.startsWith('>=')) {
		// >=1.2.0：逐段比较
		const base = parseSemver(r.slice(2));
		if (!base) return false;
		return (
			ver[0] > base[0] ||
			(ver[0] === base[0] && ver[1] > base[1]) ||
			(ver[0] === base[0] && ver[1] === base[1] && ver[2] >= base[2])
		);
	}
	// 精确版本：三段完全相等
	const exact = parseSemver(r);
	return (
		!!exact && exact[0] === ver[0] && exact[1] === ver[1] && exact[2] === ver[2]
	);
}
```

> **语义**：`hostApiRange` 是「插件声明的兼容范围」对「Host 真实版本」的匹配。它保证插件用的 Host API 一定存在——比如插件要 `^1.3.0` 才有的 `api.ui.setAppFullscreen`，在 Host 还是 `1.2.x` 时直接拒绝加载，从源头避免「运行时方法不存在」。

URL 来源校验（协议 + 域名）：

```ts
/**
 * entry / iframeUrl 的来源白名单：
 * - https：允许；
 * - 非 prod：http + localhost / 127.0.0.1 允许（本地联调）；
 * - prod：http 一律拒绝。
 */
export function entryUrlAllowed(
	entry: string,
	opts?: { prod?: boolean },
): boolean {
	let url: URL;
	try {
		url = new URL(entry);
	} catch {
		// 解析失败 = 非法 URL
		return false;
	}
	if (url.protocol === 'https:') return true;
	const prod = opts?.prod ?? false;
	if (prod) return false;
	return (
		url.protocol === 'http:' &&
		(url.hostname === 'localhost' || url.hostname === '127.0.0.1')
	);
}
```

> **语义**：这是防「中间人/注入」的第一道闸。生产环境拒绝一切非 https 入口，杜绝插件代码从明文通道进入主进程；开发环境则放开 localhost 方便本地调试。

完整性计算（SHA-384）：

```ts
// 用 Web Crypto 计算 SHA-384，并转成 SRI 风格前缀串（sha384-<base64>）
async function sha384Base64(buf: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-384', buf);
	const bytes = new Uint8Array(digest);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return `sha384-${btoa(bin)}`;
}
```

错误类型与统一错误类：

```ts
// 统一错误：message 可读；code 便于程序判断是哪道关卡失败
export class PluginVerifyError extends Error {
	constructor(
		message: string,
		readonly code:
			| 'TRUST'
			| 'ORIGIN'
			| 'HOST_API'
			| 'INTEGRITY'
			| 'SIGNATURE'
			| 'IFRAME',
	) {
		super(message);
		this.name = 'PluginVerifyError';
	}
}
```

校验主流程：

```ts
// 校验环境默认值：开发态默认跳过完整性，prod 默认 false
const defaultEnv: VerifyEnv = {
	hostApiVersion: '1.0.0',
	prod: false,
	skipIntegrity: true,
};

let verifyEnv: VerifyEnv = { ...defaultEnv };

// 由 createPluginRuntime 启动时调用，注入环境（configureVerifyEnv）
export function configureVerifyEnv(env: Partial<VerifyEnv>) {
	verifyEnv = { ...verifyEnv, ...env };
}

// 加载插件前唯一入口：不过则不加载
export async function verifyPlugin(d: PluginDescriptor): Promise<void> {
	const { hostApiVersion, prod, skipIntegrity, translate } = verifyEnv;
	const t = (key: string, params?: Record<string, string>) =>
		translate?.(key, params) ??
		`${key}${params ? ` ${JSON.stringify(params)}` : ''}`;

	// —— 第一道：untrusted 分支，只允许 iframe ——
	if (d.trust === 'untrusted') {
		const src = d.iframeUrl?.trim();
		if (!src) {
			throw new PluginVerifyError(
				`plugin ${d.id}: untrusted requires iframeUrl`,
				'IFRAME',
			);
		}
		if (!entryUrlAllowed(src, { prod })) {
			throw new PluginVerifyError(
				`plugin ${d.id}: iframeUrl must be https (or localhost http in dev)`,
				'ORIGIN',
			);
		}
		return; // untrusted 不再校验 hostApiRange / integrity
	}

	// —— 第二道：来源 ——
	if (!entryUrlAllowed(d.entry, { prod })) {
		throw new PluginVerifyError(
			`plugin ${d.id}: entry must be https (or localhost http in dev)`,
			'ORIGIN',
		);
	}

	// —— 第三道：Host API 兼容 ——
	if (!satisfiesRange(hostApiVersion, d.hostApiRange)) {
		throw new PluginVerifyError(
			t('plugins.verify.hostApiIncompatible', {
				id: d.id,
				hostApi: hostApiVersion,
				range: d.hostApiRange,
			}),
			'HOST_API',
		);
	}

	// —— 第四道：完整性（可选，skipIntegrity 可关）——
	if (d.integrity && !skipIntegrity) {
		const res = await fetch(d.entry, { cache: 'no-store' });
		if (!res.ok) {
			throw new PluginVerifyError(
				`plugin ${d.id}: fetch entry failed ${res.status}`,
				'INTEGRITY',
			);
		}
		const hash = await sha384Base64(await res.arrayBuffer());
		if (hash !== d.integrity) {
			throw new PluginVerifyError(
				`plugin ${d.id}: integrity mismatch`,
				'INTEGRITY',
			);
		}
	}

	// —— 第五道：签名标记（接入服务端验签后置为 'invalid'）——
	if (d.signature === 'invalid') {
		throw new PluginVerifyError(`plugin ${d.id}: bad signature`, 'SIGNATURE');
	}
}
```

> **语义**：`verifyPlugin` 在**每次** `ensurePlugin`（按需下载前）都会执行，不是只在启动时。校验失败会抛 `PluginVerifyError`，由 `PluginManager` 捕获并走插件错误兜底（`PluginErrorBoundary` / 空态），**不会让宿主崩溃**。
>
> 调用位置：`createPluginRuntime` 的 `ensurePlugin` 里，`verifyPlugin(meta)` 通过后才 `loadRemoteApp`。本仓的 `VITE_PLUGIN_SKIP_INTEGRITY` 默认 `!== 'false'` → `skipIntegrity: true`，即默认跳过完整性（信任静态 CDN + https）；需要强完整性时把环境变量设为 `false` 并给 registry 每条写 `integrity`。

---

## 3. 缓存击穿：`version@manifestHash`

### 3.1 为什么需要击穿

浏览器/WKWebView 对**固定 URL** 的 ESM 会强缓存。插件发布新版本后如果 URL 不变，客户端可能一直加载旧代码。解决思路是给 URL 加 `?v=版本号`，而本仓的版本号是：

```
version@manifestHash
```

- `version`：registry 里的 `version`（发布者主动改）。
- `manifestHash`：Remote 自己 `mf-manifest.json` 的**内容指纹**（FNV-1a 32-bit）。

> **关键决策**：指纹取自 **Remote 自有的 mf-manifest**，而不是 Host registry 的 `updatedAt`。原因：发布者只要更新自己域名上的静态资源，Host 端的 registry 完全不用动，新版本也必然被客户端感知。这实现了「发布不碰 Host」。

### 3.2 核心工具函数

`packages/federation-kit/src/mf/mf.ts`（逐行注释）：

```ts
/** remoteName → bust token；afterResolve 给改写后的 remoteEntry.js 补上 */
const bustByRemote = new Map<string, string>();
/**
 * registry entry（通常 mf-manifest.json）→ 解析出的 remoteEntry.js 绝对地址。
 * resolvePluginBust 拉 manifest 时写入，registerRemote 直接注册 remoteEntry，
 * 避免 MF 运行时再拉一次 manifest。
 */
const remoteEntryByManifest = new Map<string, string>();

// 归一化 entry 键：去掉 query/hash，只留绝对路径（做缓存 Map 的 key）
function entryKey(entry: string): string {
	try {
		const u = new URL(entry);
		u.search = '';
		u.hash = '';
		return u.href;
	} catch {
		return entry;
	}
}

/**
 * 从 manifest 正文 / entry URL 得到 remoteEntry.js 的绝对地址。
 * manifest 的 metaData.remoteEntry.name 是文件名（如 remoteEntry.js），
 * publicPath 是资源根路径；两者拼出绝对 URL。
 */
function resolveRemoteEntryUrl(entry: string, manifestText: string): string {
	try {
		const json = JSON.parse(manifestText) as {
			metaData?: { publicPath?: string; remoteEntry?: { name?: string } };
		};
		const file = json.metaData?.remoteEntry?.name?.trim() || 'remoteEntry.js';
		const publicPath = json.metaData?.publicPath?.trim();
		if (publicPath) return new URL(file, publicPath).href;
	} catch {
		/* 非 JSON 或结构异常：按 entry 路径回退 */
	}
	// 回退：entry 本身是 remoteEntry.js → 直接用；否则把末段换成 remoteEntry.js
	try {
		const u = new URL(entry);
		if (/remoteEntry\.js$/i.test(u.pathname)) {
			u.search = '';
			u.hash = '';
			return u.href;
		}
		u.pathname = u.pathname.replace(/[^/]*$/, 'remoteEntry.js');
		u.search = '';
		u.hash = '';
		return u.href;
	} catch {
		return entry;
	}
}

/** 给任意 URL 写入/覆盖 `v=`（manifest 与 remoteEntry 共用同一个 bust token） */
export function withBust(url: string, bust: string): string {
	const token = bust.trim();
	if (!token) return url;
	try {
		const u = new URL(url);
		u.searchParams.set('v', token);
		return u.href;
	} catch {
		// 非 URL：手工拼接
		const hashIdx = url.indexOf('#');
		const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
		const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
		const qIdx = noHash.indexOf('?');
		const base = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
		const params = new URLSearchParams(qIdx >= 0 ? noHash.slice(qIdx + 1) : '');
		params.set('v', token);
		return `${base}?${params.toString()}${hash}`;
	}
}

/** bust token = version@buildId（buildId 为 manifest 内容指纹） */
export function pluginBust(
	meta: Pick<PluginDescriptor, 'version'>,
	buildId?: string,
): string {
	return [meta.version.trim(), buildId?.trim()].filter(Boolean).join('@');
}

/** FNV-1a 32-bit；仅作 cache bust，非安全哈希 */
function hashText(text: string): string {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(16);
}
```

### 3.3 一次 GET 拿到两样东西

```ts
/**
 * 拉取 Remote 自有的 mf-manifest（仅此一次网络请求）：
 * - 内容指纹 → bust token
 * - 解析 remoteEntry 绝对地址 → 供 registerRemote 直连，MF 不再二次拉 manifest
 */
async function fetchManifestMeta(
	entry: string,
): Promise<{ buildId: string; remoteEntryUrl: string }> {
	const url = withBust(entry, `t${Date.now()}`); // 时间戳防缓存
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) {
		throw new Error(`entry buildId ${res.status}: ${entry}`);
	}
	const text = await res.text();
	const remoteEntryUrl = resolveRemoteEntryUrl(entry, text);
	remoteEntryByManifest.set(entryKey(entry), remoteEntryUrl); // 缓存给 registerRemote 用
	return { buildId: hashText(text), remoteEntryUrl };
}

/** 对外的单点：trusted → version@manifestHash；untrusted → 仅 version（iframe 不走 MF entry） */
export async function resolvePluginBust(
	meta: Pick<PluginDescriptor, 'version' | 'entry' | 'trust'>,
): Promise<string> {
	if (meta.trust === 'untrusted') {
		return pluginBust(meta);
	}
	const { buildId } = await fetchManifestMeta(meta.entry);
	return pluginBust(meta, buildId);
}
```

> **语义**：`ensurePlugin` 调一次 `resolvePluginBust`，就同时得到「要不要重载」的判断依据（bust 是否变化）和「remoteEntry 直连地址」。**进入插件只 GET 一次 `mf-manifest.json`**——指纹和入口都在这一次拿全。

### 3.4 `afterResolve` 兜底：防 WKWebView 强缓存

MF 的 snapshot 插件有时会把 entry 改写回**无 query** 的 `.../remoteEntry.js`，而 WKWebView 对固定名 ESM 会强缓存。需要一个 runtime 插件在改写之后补上 `?v=`：

```ts
// MF runtime 插件：afterResolve 阶段给最终 entry 补 bust
const bustRemoteEntryPlugin: ModuleFederationRuntimePlugin = {
	name: 'bust-remote-entry',
	async afterResolve(args) {
		const name = args.remoteInfo?.name;
		const bust = name ? bustByRemote.get(name) : undefined;
		// args.remoteInfo?.entry 形如 http://127.0.0.1:9008/remoteEntry.js
		if (bust && args.remoteInfo?.entry) {
			// 给它加上 ?v=1.2.0 → http://127.0.0.1:9008/remoteEntry.js?v=1.2.0
			args.remoteInfo.entry = withBust(args.remoteInfo.entry, bust);
		}
		return args;
	},
};

// 只注册一次
function ensureBustPlugin() {
	if (bustPluginReady) return;
	getMf().registerPlugins([bustRemoteEntryPlugin]);
	bustPluginReady = true;
}
```

> **语义**：`afterResolve` 是 MF runtime 的一个生命周期钩子，在 remote 的 entry 最终确定后、真正加载前执行。无论 entry 被谁改写过，最后一棒都由它补上 `?v=`，保证永远走不到「无 query 固定 URL」的强缓存路径。

### 3.5 `registerRemote`：直连 remoteEntry + 注册 bust

```ts
// registerRemote：把 Remote 注册进 MF runtime
export function registerRemote(d: PluginDescriptor, bust?: string) {
	ensureShared();     // 先确保 react/react-dom 单例共享
	ensureBustPlugin(); // 再确保 bust 兜底插件在
	const token = (bust ?? d.version).trim();
	const name = remoteNameOf(d);
	if (token) bustByRemote.set(name, token); // 记录，供 afterResolve 使用
	/* 优先用 resolvePluginBust 已解析的 remoteEntry，跳过 MF 对 mf-manifest 的第二次请求 */
	const remoteEntry =
		remoteEntryByManifest.get(entryKey(d.entry)) ??
		resolveRemoteEntryUrl(d.entry, '');
	getMf().registerRemotes(
		[
			{
				name,
				entry: withBust(remoteEntry, token), // 入口 URL 直接带 v=
				type: 'module',
			},
		],
		{ force: true }, // force：同名 Remote 也重注册（热更新/重载）
	);
}
```

> **语义**：因为 `resolvePluginBust` 已经解析出了 remoteEntry 绝对地址并缓存进 `remoteEntryByManifest`，`registerRemote` 直接用这个地址注册，MF 就不会再为了找 remoteEntry 而请求 manifest——网络成本精确控制在「一次 manifest + 一次 remoteEntry.js」。

### 3.6 完整时序

```
进入插件路由
   │
   ├─ verifyPlugin(meta)              # 四道关卡，不过则报错兜底
   │
   ├─ resolvePluginBust(meta)         # GET mf-manifest.json?v=t
   │     ├─ buildId = hashText(text)  # 内容指纹
   │     └─ remoteEntryUrl 写入缓存
   │
   ├─ bust 与已注册是否相同？
   │     ├─ 是 → 复用已加载模块（不重复下载）
   │     └─ 否 → registerRemote(meta, bust)
   │              └─ loadRemoteApp(meta)   # GET remoteEntry.js?v=1.2.0@abcd
   │
   └─ 加载过程中 afterResolve 兜底补 ?v=  # 防 snapshot 改写后强缓存
```

---

## 4. 样式隔离：realm / capture / portal

### 4.1 分层与目标

| 层 | 目录 | 职责 |
|----|------|------|
| **protocol** | `protocol/` | realm 键、DOM 契约属性、选择器形状、幂等判定 |
| **css** | `css/transpile.ts`、`css/themeStrip.ts` | 选择器加前缀、Host 主题 token 剥离 |
| **sandbox** | `sandbox/capture.ts`、`attach.ts`、`headPatch.ts` | 两阶段 CSS 捕获、head/CSSOM patch |
| **portal** | `portal/claim.ts`、`attachPortal.ts`、`scopeDom.ts` | Portal/Teleport 收编、认领、body 镜像 |

> **一句话模型**：插件 DOM 上打 `data-mf-style-realm` 标记，插件 CSS 的每条规则都加上 `[data-mf-style-realm="entry:..."]` 前缀；插件 Portal 到 body 的浮层也搬进 `[data-mf-portal-scope]` 并继承 realm——于是「插件的样式只命中插件的 DOM」。

### 4.2 protocol：realm 键与契约属性

`packages/federation-kit/src/style-isolation/protocol/index.ts`：

```ts
/** 隔离协议版本标记；升版后强制重写 head 里旧前缀 CSS */
export const MF_ISO_MARK = '/*mf-iso:3*/';
export const MF_ISO_MARK_RE = /\/\*mf-iso(?::\d+)?\*\//g;
/** html/body 布局选择器后缀：只命中插件根，不命中打了 realm 的浮层 */
export const PLUGIN_ROOT_ATTR = '[data-plugin-root]';

// 把选择器里的特殊字符转义，避免 realm 含 : / 时属性选择器非法
export function cssEscapeIdent(id: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return CSS.escape(id);
	}
	// 无 CSS.escape 时手工转义非 [A-Za-z0-9_-] 字符
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
	// 尝试按绝对 URL 规范化 entry
	try {
		const u = new URL(entry);
		u.search = ''; // 去掉 query，避免同入口不同缓存参数拆成多 realm
		u.hash = '';   // 去掉 hash，只保留定位路径
		// 剥掉末尾 manifest/remoteEntry 文件名，得到 Remote 根路径
		let path = u.pathname.replace(
			/\/(?:mf-manifest\.json|remoteEntry\.js)\/?$/i,
			'',
		);
		if (!path.endsWith('/')) path += '/';
		// entry:origin+path 形式：同 Remote 多 expose 共享同一 realm
		return `entry:${u.origin}${path}`;
	} catch {
		// URL 非法时按 remoteName / pluginId 回退
		const named = remoteName?.trim();
		if (named && named !== pluginId) return `remote:${named}`;
		return `plugin:${pluginId || 'unknown'}`;
	}
}

// 生成与 DOM data-mf-style-realm 匹配的属性选择器（引号内转义）
export function scopeSelector(realm: string): string {
	const v = realm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	return `[data-mf-style-realm="${v}"]`;
}

/** 已带当前协议标记 + realm 前缀（transpile 可跳过，避免重复包裹） */
export function alreadyScoped(text: string, sel: string): boolean {
	return (
		text.includes(MF_ISO_MARK) &&
		text.includes('data-mf-style-realm=') &&
		text.includes(sel)
	);
}

/**
 * HMR/回写是否还需要再 wrap。
 * 已有 realm 前缀且无旧 @scope → false（避免与 antd cssinjs 互殴卡死）。
 */
export function styleNeedsRescope(text: string, sel: string): boolean {
	const t = text.trim();
	if (!t) return false;
	if (/@scope\s*\(/.test(t)) return true;
	// 任意版本 mf-iso 且已含本 realm 选择器 → 视为已前缀，勿再写 textContent
	if (text.includes(sel) && /\/\*mf-iso(?::\d+)?\*\//.test(text)) return false;
	if (text.includes(sel)) return false;
	return true;
}
```

> **语义**：`styleRealmKey` 是「一个 Remote 一个样式域」的关键——同 entry 源的多插件（多 expose）共享 realm，样式规则只加一遍前缀，避免重复膨胀。`:root`/`html`/`body` 这类全局选择器被改写：`:root` → realm 选择器，`html`/`body` → `[realm][data-plugin-root]`（只命中插件根元素）。

### 4.3 主题 token 剥离

`packages/federation-kit/src/style-isolation/css/themeStrip.ts`：

```ts
import { PLUGIN_ROOT_ATTR } from '../protocol';

/** :root → realm；html/body → realm + [data-plugin-root] */
export function mapDocRootToken(token: string, sel: string): string {
	if (/^:root$/i.test(token)) return sel;
	if (/^(?:html|body)$/i.test(token)) return `${sel}${PLUGIN_ROOT_ATTR}`;
	return token;
}

/**
 * 默认：本产品 shadcn / brand / theme-* 变量。
 * Host 可通过 configureStyleIsolation({ themePropPattern }) 覆盖。
 */
export const DEFAULT_HOST_THEME_CUSTOM_PROP =
	/^--(?:brand-accent(?:-soft|-light|-dark)?|theme-[a-z0-9-]+|background|foreground|card(?:-foreground)?|popover(?:-foreground)?|primary(?:-foreground)?|secondary(?:-foreground)?|muted(?:-foreground)?|accent(?:-foreground)?|destructive|border|input|ring|radius)$/i;

let themePropPattern: RegExp = DEFAULT_HOST_THEME_CUSTOM_PROP;

export function setHostThemePropPattern(pattern?: RegExp) {
	themePropPattern = pattern ?? DEFAULT_HOST_THEME_CUSTOM_PROP;
}

/** 判断选择器是否全是 :root / :host（决定是否走 token 剥离） */
export function isDocRootOnlySelectors(selectors: string): boolean {
	const parts = selectors
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return parts.length > 0 && parts.every((s) => /^(:root|:host)$/i.test(s));
}

/**
 * 从声明块里剥掉 Host 语义主题变量（如 --background）：
 * 插件把 Host 主题 token 定义在自己的 :root 上，会让 Host 的全局主题被局部覆盖，
 * 所以这些声明要删掉（插件仍可读，但不能改写 Host 的全局值）。
 */
export function stripHostThemeDecls(declBlock: string): string {
	if (declBlock.length < 2 || declBlock[0] !== '{') return declBlock;
	const inner = declBlock.slice(1, -1);
	const pat = getHostThemePropPattern();
	const cleaned = inner.replace(
		/(^|;)\s*(--[\w-]+)\s*:\s*[^;]*/g,
		(full, lead: string, prop: string) => (pat.test(prop) ? lead : full),
	);
	const tidy = cleaned
		.replace(/;\s*;+/g, ';')
		.replace(/^\s*;\s*/, '')
		.replace(/;\s*$/, '')
		.trim();
	return `{${tidy}}`;
}
```

> **语义**：Host 用 CSS 变量驱动主题（亮/暗）。如果插件在自己的 `:root{--background:#fff}` 里定义了同名变量，会**污染 Host 全局主题**。剥离规则只删「Host 语义变量」，插件自己的业务变量（`--card-width` 等）保留。

### 4.4 两阶段 CSS 捕获

**阶段一：加载期**——`PluginManager` 在 `loadRemoteApp` 前后包一层捕获窗口：

`packages/federation-kit/src/style-isolation/sandbox/capture.ts`：

```ts
/**
 * 在 loadRemote 前后包一层：捕获本次注入的 CSS 并按选择器前缀隔离到 realm。
 */
export function beginPluginStyleCapture(
	pluginId: string,
	entry: string,
	remoteName?: string,
	opts?: BeginStyleCaptureOptions,
): () => void {
	const realm = styleRealmKey(entry, remoteName, pluginId);
	const ctx: CaptureCtx = {
		pluginId,
		realm,
		entryOrigin: entryOriginOf(entry),
		claimUnmarked: opts?.claimUnmarked !== false,
	};
	captureStack.push(ctx);           // 压栈：当前「正在捕获」的窗口
	ensureHeadPatch();                 // 劫持 head.appendChild / insertBefore / replaceChild
	repairHostCriticalStyles();        // 修复可能被先前插件打乱的 Host 关键样式
	reclaimEntryStyles(ctx);           // 认领同 entry 已注入但未带 realm 的旧样式

	// MutationObserver 兜底：捕获栈深期间动态加进 head 的 style
	const obs = new MutationObserver((mutations) => {
		if (activeCtx()?.realm !== realm) return;
		for (const m of mutations) {
			for (const n of m.addedNodes) processNode(n, ctx);
		}
	});
	obs.observe(document.head, { childList: true });

	// 返回清理函数：断开观察、出栈、释放 head patch
	return () => {
		obs.disconnect();
		const idx = captureStack.lastIndexOf(ctx);
		if (idx >= 0) captureStack.splice(idx, 1);
		releaseHeadPatch();
	};
}
```

**阶段二：挂载期**——`PluginHostPage` 用 `useLayoutEffect` 调 `attachPluginStyleIsolation`（CSS 捕获 + Portal 桥）：

`packages/federation-kit/src/style-isolation/sandbox/attach.ts`：

```ts
/**
 * 插件页挂载期间继续隔离（HMR / 延迟 CSS）+ Portal/Teleport 静默纳入 realm。
 * claimUnmarked:false — 长窗内不认领无 Remote 正信号的 Host 全局样式。
 */
export function attachPluginStyleIsolation(
	pluginId: string,
	entry: string,
	remoteName?: string,
): () => void {
	const realm = styleRealmKey(entry, remoteName, pluginId);
	const endCss = beginPluginStyleCapture(pluginId, entry, remoteName, {
		claimUnmarked: false,
	});
	const endPortal = attachPortalScopeBridge(pluginId, realm);
	return () => {
		endPortal();
		endCss();
	};
}
```

> **为什么必须 useLayoutEffect**：Vue Remote（Element Plus）在 `onBeforeMount` 就建 `#el-popper-container-*` 并 Teleport 到 body。如果 Portal 桥在子树挂载之后才装，这些容器会「逃逸」出 realm。`useLayoutEffect` 保证在浏览器 paint **之前**、子树挂载**之前**就把桥装好。

### 4.5 Portal 收编与认领

**认领来源**（谁来决定「这个浮层属于哪个插件」）：`portal/claim.ts`

```ts
/**
 * 从元素反查所属插件：
 * 1) 元素在 [data-mf-portal-scope] 内 → 直接用 scope 标记的 pluginId；
 * 2) 元素在 [data-mf-plugin] 根内（未打 portal 标记）→ 用根的 pluginId。
 */
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

/** 安装 pointer/focus 桥：更新 lastTouchedPluginId 供 Portal 认领 */
export function ensureTouchBridge() {
	if (portalState.touchBridgeInstalled || typeof document === 'undefined') {
		return;
	}
	portalState.touchBridgeInstalled = true;

	// pointerover 捕获阶段：移入哪个插件的 DOM 就记为 lastTouchedPluginId
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
			portalState.lastTouchedPluginId = to;
		},
		true,
	);

	// focusin：聚焦到哪个插件的 DOM 就记下来
	document.addEventListener(
		'focusin',
		(e) => {
			portalState.lastTouchedPluginId = claimIdFromElement(
				e.target instanceof Element ? e.target : null,
			);
		},
		true,
	);
}

/** 认领优先级：override → touch → focus → sticky hover */
export function resolveClaimPluginId(): string | null {
	const override = portalState.portalClaimOverride;
	if (
		override &&
		(portalPlugins.has(override) || portalRealmByPlugin.has(override))
	) {
		return override;
	}
	const touched = portalState.lastTouchedPluginId;
	if (touched && portalPlugins.has(touched)) return touched;

	const ae = document.activeElement;
	if (ae instanceof Element) {
		const id = claimIdFromElement(ae);
		if (id) return id;
	}

	// sticky hover：哪个插件的 portal scope 正在被 hover
	for (const id of portalPlugins) {
		const host = document.querySelector(
			`[data-mf-portal-scope="${cssEscapeIdent(id)}"]`,
		);
		if (
			host instanceof HTMLElement &&
			host.childElementCount > 0 &&
			(host.matches(':hover') || host.querySelector(':hover'))
		) {
			return id;
		}
	}
	return null;
}
```

**Drawer 预认领**（Host 打开会 Portal 的外壳之前同步认领，防首帧闪烁）：

```ts
/**
 * Host 打开会 Portal 的外壳（如 Drawer）之前同步认领，
 * 让首帧 createPortal 就进 scope。
 */
export function claimPluginPortalTarget(pluginId: string, realm: string): void {
	ensureTouchBridge();
	ensureCreatePortalPatch();
	ensureBodyPortalPatch();
	portalRealmByPlugin.set(pluginId, realm);
	portalState.portalClaimOverride = pluginId; // override 优先于 touch/focus
	portalState.lastTouchedPluginId = pluginId;
	ensureBodyPortalScope(pluginId);
}

export function clearPluginPortalClaim(pluginId?: string | null): void {
	if (pluginId && portalState.portalClaimOverride !== pluginId) return;
	portalState.portalClaimOverride = null;
	maybeReleaseBodyPortalPatch();
}
```

**挂载期 Portal 桥**（`portal/attachPortal.ts`）：

```ts
/**
 * Element Plus 等会先在 body 建 `#*-popper-container-*`，再 Teleport 进该容器。
 * attach 时把已游离的容器收进当前插件的 portal scope。
 */
function reclaimOrphanPopperContainers(pluginId: string) {
	const scope = ensureBodyPortalScope(pluginId);
	for (const node of Array.from(document.body.children)) {
		if (!(node instanceof HTMLElement)) continue;
		if (!/-popper-container-/i.test(node.id || '')) continue;
		if (node.closest('[data-mf-portal-scope]')) continue;
		scope.appendChild(node);
	}
}

export function attachPortalScopeBridge(
	pluginId: string,
	realm: string,
): () => void {
	ensureTouchBridge();          // pointer/focus 桥
	ensureCreatePortalPatch();    // createPortal 原型劫持（打到 body 的浮层改挂 scope）
	ensureBodyPortalPatch();      // body appendChild 劫持 + remove/replace 镜像
	portalPlugins.add(pluginId);  // 注册插件
	portalRealmByPlugin.set(pluginId, realm); // 插件 → realm 映射
	portalState.lastTouchedPluginId = pluginId;
	ensureBodyPortalScope(pluginId); // 建 [data-mf-portal-scope] 容器
	reclaimOrphanPopperContainers(pluginId); // 收编游离 popper 容器
	return () => {
		portalPlugins.delete(pluginId);
		portalRealmByPlugin.delete(pluginId);
		removeBodyPortalScope(pluginId);
		if (portalState.lastTouchedPluginId === pluginId) {
			portalState.lastTouchedPluginId = null;
		}
		maybeReleaseBodyPortalPatch();
	};
}
```

> **语义**：`attachPortalScopeBridge` 是「静默收编」——插件开发者**完全不用改** antd Modal/Drawer 的 `getContainer`，也不用自己传 portal container。Host 在 body 上建 `[data-mf-portal-scope]`（`fixed;inset:0;pointer-events:none`，子节点 `pointer-events:auto`），劫持 `createPortal` 与 body 挂载，把插件浮层搬进 scope 并打 `data-mf-style-realm`，从而让插件样式规则（带 realm 前缀）能命中浮层。

### 4.6 宿主侧约定

| 约定 | 位置 | 作用 |
|------|------|------|
| App 根 `data-mf-host-portal` | `apps/frontend/src/router/index.tsx` | Host 自身浮层（Toaster 等）**永不**被收编进插件 scope |
| `PluginHostPage` 渲染 `data-mf-plugin={pluginId}` | `PluginHostPage.tsx` | 插件根标记，认领与 realm 挂载点 |
| `data-mf-style-realm={realm}` | `PluginHostPage.tsx` | 插件 DOM 的样式域标记 |
| `claimPluginPortalTarget` 在 Drawer 打开前调用 | `PluginHostSurface.tsx` | 预认领，防首帧闪烁 |
| `clearPluginPortalClaim` 在 Drawer 关闭时调用 | `PluginHostSurface.tsx` | 释放 override，防误收后续 Host portal |

---

## 5. 本章小结

1. **信任分级**：`trusted` 走 MF 动态 import（全能力）；`untrusted` 走 iframe 沙箱（仅 RPC）。
2. **四道关卡**：来源（https/localhost）→ Host API 兼容（semver range）→ 完整性（SHA-384）→ 签名标记，任何一道不过都抛 `PluginVerifyError` 且不影响宿主。
3. **缓存击穿**：`version@manifestHash`，指纹来自 Remote 自有 mf-manifest；一次 GET 拿到指纹 + remoteEntry 地址；`afterResolve` 兜底补 `?v=` 防 WKWebView 强缓存；发布新版本**不需要**改 Host registry。
4. **样式隔离**：realm 键（`entry:origin+path`）+ 选择器前缀 + 两阶段捕获 + Portal 收编；插件开发者零侵入；Host 用自己的 `data-mf-host-portal` 保护浮层。
