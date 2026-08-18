# 08 · 上架偏好与 Registry 实现

> **本章目标**：讲清「谁决定一个插件是否显示/加载」——`enabledStore`（上架偏好）与 `fetchRegistry` / `persistEnabled` / 缓存。这是「动态启停」的落地点。
>
> 对应源码：`packages/federation-kit/src/enabled/enabledOverrides.ts`、`apps/frontend/src/federation/enabled/prefs.ts`、`apps/frontend/src/federation/registry/index.ts`。

---

## 1. 上架的两种来源

| 来源 | 位置 | 语义 |
|------|------|------|
| **registry 全局开关** | `plugins-registry.json` 里每条 `enabled: true/false` | 「这个插件是否上架」的全局声明 |
| **账号偏好** | `enabledStore`（localStorage 或账号服务） | 每个用户可单独上/下架 |

> **优先级**：`enabledStore.get(id)`（账号偏好）**覆盖** registry 的 `enabled`。宿主一切「是否显示/是否加载」的判断最终都走 `isPluginEnabled(id)` → `enabledStore.get(id)`。

---

## 2. `enabledOverrides`：全局单例偏好读取器

`packages/federation-kit/src/enabled/enabledOverrides.ts`（逐行注释）：

```ts
// 上架偏好存取器挂载在 globalThis 上的键名（避免多包双实例）
const ENABLED_KEY = '__dnhyxc_ai_federation_enabled__';

type EnabledBag = {
  getPref: (id: string) => boolean; // 读上架
  isReady: () => boolean;           // 偏好是否已拉取
  listeners: Set<Listener>;         // 订阅者集合
};

// 懒初始化单例：未 configure 前 getPref 返回 false、isReady 返回 false
function store(): EnabledBag {
  const g = globalThis as GlobalBag;
  if (!g[ENABLED_KEY]) {
    g[ENABLED_KEY] = {
      getPref: () => false,
      // 未 configure 前视为未就绪，避免刷新把 false 闪成「已下架」
      isReady: () => false,
      listeners: new Set(),
    };
  }
  return g[ENABLED_KEY]!;
}

// 由 createPluginRuntime / Host adapter 注入偏好读取（返回 boolean）
export function configureEnabledGetter(get: (id: string) => boolean) {
  store().getPref = get;
}

// 注入「偏好是否就绪」判断（异步偏好用；未 ready 前勿把 false 当已下架）
export function configureEnabledReady(get: () => boolean) {
  store().isReady = get;
}

// 对外：是否就绪
export function isEnabledPrefsReady(): boolean {
  return store().isReady();
}

// 通知所有订阅者：偏好变化（上架/下架/登录）时调用
export function notifyPluginEnabled() {
  for (const fn of store().listeners) fn();
}

// 订阅偏好变化；返回取消订阅
export function subscribePluginEnabled(fn: Listener) {
  store().listeners.add(fn);
  return () => {
    store().listeners.delete(fn);
  };
}

// 对外：某插件是否上架（一切「是否显示/加载」判断的最终依据）
export function isPluginEnabled(id: string): boolean {
  return store().getPref(id);
}
```

> **语义**：这是 kit 内置的**全局偏好总线**。`createPluginRuntime` 启动时调用 `configureEnabledGetter(config.enabledStore.get)`，把宿主实现的 store 接进来。hooks（`usePluginEnabled`）与 `PluginManager` 都通过它读写。

---

## 3. 默认实现：localStorage 版

如果不传 `enabledStore`，`createFederation` 会造一个 localStorage 版本：

```ts
// packages/federation-kit/src/createFederation.ts
function createLocalEnabledStore(prefix: string): EnabledStore {
  // localStorage 键：{prefix}.enabled.v1，存 { [id]: true }
  const key = `${prefix}.enabled.v1`;
  const read = (): Record<string, boolean> => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') as Record<string, boolean>;
    } catch {
      return {};
    }
  };
  return {
    // get：读 Map
    get: (id) => read()[id] === true,
    // set：写 Map；关闭时删掉该 key
    set: (id, on) => {
      const next = { ...read(), [id]: on };
      if (!on) delete next[id];
      else next[id] = true;
      localStorage.setItem(key, JSON.stringify(next));
      notifyPluginEnabled(); // 通知订阅者刷新 UI
    },
  };
}
```

> 对小项目够用；但它是**浏览器本地**的，多设备/多账号不同步。接账号服务可以像本仓一样自定义（下节）。

---

## 4. 账号偏好实现：服务端同步版

`apps/frontend/src/federation/enabled/prefs.ts` 是本仓的账号偏好实现，把「上架/下架」落到用户服务端，跨设备同步。先看整体状态与内存缓存：

```ts
// 当前缓存所属的用户 id；为 0 表示未登录/游客态
let cachedUserId = 0;
// 已上架插件 id 集合（内存镜像，读写都走它，避免频繁读 localStorage/服务端）
let cachedIds = new Set<string>();
// 正在拉取中的 Promise：并发调用 ensurePluginEnabledPrefsLoaded 只发一次请求
let loadPromise: Promise<void> | null = null;
// 偏好是否已拉取完成；未拉完前 get 一律 false，但调用方必须配合 isReady 判断，
// 避免「正在加载」被误判为「已下架」导致界面闪跳
let prefsReady = false;

// 对外：偏好是否已就绪（供 usePluginEnabledState / PluginHostPage 等待再渲染）
export function arePluginEnabledPrefsReady(): boolean {
	return prefsReady;
}
```

> **语义**：`cachedIds` 是「最终裁决」的内存镜像。业务上所有 `isPluginEnabled(id)` 都经 `enabledOverrides` 的 `configureEnabledGetter(getPluginEnabledPref)` 转到这里。

接着是数据规整工具：服务端返回的字段不稳定（`enabledIds` 数组 / 偶发整包 / JSON 字符串），统一归一化：

```ts
// 把服务端返回的任意形态（字符串 / 数组 / 带 enabledIds 的对象）归一化成去重后的 id 数组
function normalizeIds(raw: unknown): string[] {
	// 传入的是 JSON 字符串：先解析成原始形态再递归处理
	if (typeof raw === 'string') {
		try {
			return normalizeIds(JSON.parse(raw));
		} catch {
			// 解析失败说明不是合法 JSON，视为空
			return [];
		}
	}
	// 不是数组一律视为空
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of raw) {
		if (typeof item !== 'string') continue; // 只收字符串项
		const id = item.trim().slice(0, 64); // 去空格并截断到 64 字符，防脏数据
		if (!id || seen.has(id)) continue; // 去重
		seen.add(id);
		out.push(id);
	}
	return out;
}

// 覆盖内存缓存：先归一化再写入
function setCache(userId: number, ids: string[]): void {
	cachedUserId = userId;
	cachedIds = new Set(normalizeIds(ids));
}

// 兼容 res.data.enabledIds / 偶发整包 / JSON 字符串，统一取出 id 列表
function idsFromResponse(data: unknown): string[] {
	if (!data || typeof data !== 'object') return [];
	const obj = data as Record<string, unknown>;
	if ('enabledIds' in obj) return normalizeIds(obj.enabledIds); // 常规形态：{ enabledIds: [...] }
	if (Array.isArray(data)) return normalizeIds(data); // 偶发整包就是数组
	return [];
}
```

> **语义**：这三段都是「防御性解析」。真实项目中服务端结构会漂移，归一化让上层永远拿到 `string[]`，一处收口、处处安全。

清缓存与同步读取：

```ts
// 登出/切号时调用：清空缓存并通知所有订阅者刷新（否则旧账号偏好会残留）
export function clearPluginEnabledPrefsCache(): void {
	cachedUserId = 0;
	cachedIds = new Set();
	loadPromise = null;
	prefsReady = false;
	notifyPluginEnabled();
}

// 同步读内存缓存；未加载则视为全关（配合 arePluginEnabledPrefsReady 使用）
export function getPluginEnabledPref(id: string): boolean {
	return cachedIds.has(id);
}
```

> **语义**：`getPluginEnabledPref` 必须**同步**返回——React 渲染、路由判断都不允许阻塞，所以只读内存。代价是「未拉取完成时读不到」，于是配套了 `prefsReady` 信号让外层等待。

核心的拉取逻辑：

```ts
/**
 * 从服务端拉取并写入内存。
 * 幂等设计：
 * - 已登录且已就绪：直接返回，不发请求；
 * - 已有进行中的请求：复用同一个 Promise，不重复发；
 * - 未登录（id <= 0）：清空缓存并标记就绪（游客永远全关）。
 */
export async function ensurePluginEnabledPrefsLoaded(
	userId?: number,
): Promise<void> {
	// 未传则取全局登录态；id <= 0 表示游客
	const id = userId ?? getLoggedInUserId();
	if (id <= 0) {
		// 游客态：清空内存并标记就绪，同时通知刷新（切号后这里触发重新渲染）
		cachedUserId = 0;
		cachedIds = new Set();
		loadPromise = null;
		prefsReady = true;
		notifyPluginEnabled();
		return;
	}
	// 已是当前用户且就绪：直接返回
	if (cachedUserId === id && prefsReady && !loadPromise) return;
	// 有进行中的请求：等它结束即可（合并并发）
	if (loadPromise) {
		await loadPromise;
		return;
	}

	// 发起真正的请求：存入 loadPromise 以便并发合并
	loadPromise = (async () => {
		try {
			// silent: true 表示静默请求，失败不弹错误提示
			const res = await getPluginEnabledPrefs({ silent: true });
			setCache(id, idsFromResponse(res.data));
		} catch {
			// 拉取失败：按「全关」处理，但不抛错，避免启动流程被阻断
			setCache(id, []);
		} finally {
			// 无论如何都标记就绪并释放 Promise 引用，最后通知刷新
			prefsReady = true;
			loadPromise = null;
			notifyPluginEnabled();
		}
	})();

	await loadPromise;
}

// 登录成功后「预拉取」：不阻塞调用方，静默开始加载
export function prefetchPluginEnabledPrefs(userId?: number): void {
	void ensurePluginEnabledPrefsLoaded(userId);
}
```

> **语义**：`loadPromise` 让多个并发调用合并成一次请求；`finally` 里 `notifyPluginEnabled()` 保证「拉取完成」这个时间点也会触发一次全局刷新。失败降级为「全关」而不是抛错，保证登录后应用不会卡死。

单个插件的上架/下架写回：

```ts
/**
 * 更新单个插件上架状态并写回服务端。
 * 未登录时仅改内存（默认关，切号即丢）。
 * 采用「乐观更新」：先改本地，再请求服务端，失败时保留乐观结果。
 */
export async function setPluginEnabledPref(
	id: string,
	enabled: boolean,
): Promise<void> {
	const userId = getLoggedInUserId();
	// 基于当前缓存构造下一个集合
	const next = new Set(cachedIds);
	if (enabled) next.add(id);
	else next.delete(id);
	const enabledIds = [...next];

	// 游客：只写内存，不做网络请求（登录后自然消失）
	if (userId <= 0) {
		setCache(0, enabledIds);
		return;
	}

	// 乐观更新内存（UI 立即反应，不等网络）
	setCache(userId, enabledIds);
	// 写回服务端
	const res = await updatePluginEnabledPrefs({ enabledIds });
	const saved = idsFromResponse(res.data);
	// 响应异常时保留乐观缓存，避免把已开启项冲成全关：
	// saved 为空且本次是「下架」→ 保持乐观结果；否则以服务端返回为准
	setCache(userId, saved.length > 0 || !enabled ? saved : enabledIds);
}
```

> **语义**：这是「乐观更新」——UI 先变、网络异步追认。关键细节：下架时即使服务端没返回 `enabledIds`（可能只回 `{ ok: true }`），也保留本地乐观结果，避免把用户刚关掉的插件又弹回来。

---

## 5. Registry 拉取与落盘

`apps/frontend/src/federation/registry/index.ts` 负责「registry 从哪来、怎么缓存、怎么保存」。先看常量与 URL 解析：

```ts
import {
	isPluginEnabled,
	notifyPluginEnabled,
	type PluginRegistry,
	satisfiesRange,
} from '@dnhyxc-ai/federation-kit';
import { translateSync } from '@/i18n';
import { putUploadRemoteJson } from '@/service';
import { getPlatformFetch } from '@/utils/fetch';
import { resolveUploadedFileUrl } from '@/utils/upload-file-url';
import { setPluginEnabledPref } from '../enabled/prefs';

// 当前 Host API 版本：registry 里每个插件的 hostApiRange 都要能覆盖它
const HOST_API_VERSION =
	import.meta.env.VITE_HOST_API_VERSION?.trim() || '1.0.0';

// 本地缓存 key：dev/prod 分开，避免环境间串数据；v1 前缀便于将来升级格式
const CACHE_KEY = `dnhyxc.plugin.registry.${import.meta.env.PROD ? 'prod' : 'dev'}.v1`;
export const PLUGIN_REGISTRY_CACHE_KEY = CACHE_KEY;
// 远端文件固定名
export const PLUGIN_REGISTRY_FILENAME = 'plugins-registry.json';
// 落盘相对路径；展示/拉取用 resolveUploadedFileUrl（与图片访问方式一致）
export const PLUGIN_REGISTRY_STATIC_PATH = `/remotes/${PLUGIN_REGISTRY_FILENAME}`;

/**
 * 解析 registry 的真实 URL。对齐 resolveUploadedFileUrl：
 * - Web DEV：同源 `/remotes/...`（Vite 代理转发）
 * - Web PROD：同源 `/api/upload/serve?path=...`
 * - Tauri DEV：静态源站 `/remotes/...`
 * - Tauri PROD：`/api/upload/serve?path=...`
 * 也可用环境变量强制覆盖。
 */
function registryUrl(): string {
	const override = (
		import.meta.env.PROD
			? import.meta.env.VITE_PROD_PLUGIN_REGISTRY_URL
			: import.meta.env.VITE_DEV_PLUGIN_REGISTRY_URL
	)?.trim();
	if (override) return override;
	return resolveUploadedFileUrl(PLUGIN_REGISTRY_STATIC_PATH);
}
```

> **语义**：`registryUrl()` 是整个 registry 体系的「唯一事实来源」。它把 Web / Tauri、Dev / Prod 四象限的差异收口到一处，业务代码永远不知道底层 URL 是什么。

缓存读写与缓存击穿：

```ts
// 读本地缓存：数据结构不合法（缺 plugins 或为空）视为无缓存
function readCache(): PluginRegistry | null {
	try {
		const cached = localStorage.getItem(CACHE_KEY);
		if (!cached) return null;
		const data = JSON.parse(cached) as PluginRegistry;
		if (!Array.isArray(data.plugins) || data.plugins.length === 0) return null;
		return data;
	} catch {
		return null;
	}
}

// 写本地缓存；写完通知订阅者（下次渲染即用新数据）
function writeCache(data: PluginRegistry) {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(data));
	} catch {
		/* 写失败（如隐私模式）静默忽略 */
	}
	notifyPluginEnabled();
}

// 强制刷新时给 URL 加时间戳，绕过任何中间层缓存（CDN/浏览器/代理）
function withCacheBust(url: string): string {
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}t=${Date.now()}`;
}
```

> **语义**：缓存是「弱一致」的——启动用缓存秒开，后台再拉新；但**上架/下架操作必须强制刷新**（`force`），避免用户操作后看到旧数据。`withCacheBust` 是强制刷新唯一的可靠手段。

拉取实现：

```ts
// 真正发请求；Tauri 环境用 getPlatformFetch（走 Tauri HTTP 插件），Web 用浏览器 fetch
async function fetchRegistryText(
	url: string,
	force?: boolean,
): Promise<string> {
	const doFetch = /^https?:\/\//i.test(url)
		? await getPlatformFetch()
		: globalThis.fetch.bind(globalThis);
	// force 时加时间戳 + no-cache 头
	const fetchUrl = force ? withCacheBust(url) : url;
	const res = await doFetch(fetchUrl, {
		cache: 'no-store',
		...(force ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
	});
	if (!res.ok) throw new Error(`registry ${res.status}`);
	return res.text();
}

// 解析并校验 JSON 结构；错误信息带上 URL 和片段便于排查
function parseRegistry(text: string, url: string): PluginRegistry {
	let data: PluginRegistry;
	try {
		data = JSON.parse(text) as PluginRegistry;
	} catch {
		throw new Error(
			`registry not JSON (${url}): ${text.slice(0, 80).replace(/\s+/g, ' ')}`,
		);
	}
	if (!Array.isArray(data.plugins)) {
		throw new Error('registry.plugins missing');
	}
	return data;
}

/**
 * 对外主入口：拉取 registry。
 * 失败时回退到缓存；连缓存都没有则返回「空目录」（plugins: []）。
 * 永远不抛错——启动流程不能被 registry 不可用阻断。
 */
export async function fetchPluginRegistry(opts?: {
	force?: boolean;
}): Promise<PluginRegistry> {
	let url: string;
	try {
		url = registryUrl();
	} catch (e) {
		// 连 URL 都解析不出来（如环境变量缺失）：降级
		console.warn('[plugins] registry url missing', e);
		return readCache() ?? { updatedAt: new Date(0).toISOString(), plugins: [] };
	}

	try {
		const text = await fetchRegistryText(url, opts?.force);
		const data = parseRegistry(text, url);
		writeCache(data); // 成功：写缓存
		return data;
	} catch (e) {
		console.warn('[plugins] registry fetch failed, using cache', e);
		return readCache() ?? { updatedAt: new Date(0).toISOString(), plugins: [] };
	}
}

/** 拉取远端原文（供配置编辑页使用）：强制刷新 + 格式化 JSON */
export async function fetchPluginRegistryRawText(): Promise<string> {
	const url = registryUrl();
	const text = await fetchRegistryText(url, true);
	try {
		return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
	} catch {
		return text;
	}
}

// 清空本地缓存（配置页「恢复默认」或登出时调用）
export function clearPluginRegistryCache() {
	try {
		localStorage.removeItem(CACHE_KEY);
	} catch {
		/* ignore */
	}
	notifyPluginEnabled();
}
```

> **语义**：`fetchPluginRegistry` 的「永不抛错」是硬性约定。Registry 是外部资源，宿主启动不应被它阻塞；最坏情况是「空目录」= 一个插件都不显示，也比白屏强。

保存前的校验与保存：

```ts
/**
 * 保存前校验：每个插件的 hostApiRange 必须覆盖当前 Host API 版本。
 * 防止配置页把「插件版本号」误填进 hostApiRange，导致线上插件全部校验失败。
 */
export function assertRegistryHostApiCompatible(data: PluginRegistry): void {
	for (const p of data.plugins) {
		const range = p.hostApiRange?.trim();
		if (!range) {
			throw new Error(
				translateSync('plugins.registry.missingHostApiRange', { id: p.id }),
			);
		}
		// satisfiesRange 是 kit 的 semver 范围判断（^1.0.0 / >=1.2.0 / 精确版本）
		if (!satisfiesRange(HOST_API_VERSION, range)) {
			throw new Error(
				translateSync('plugins.registry.hostApiIncompatible', {
					id: p.id,
					range,
					hostApi: HOST_API_VERSION,
				}),
			);
		}
	}
}

/** 将整份 registry 写回服务端 remotes，并刷新本地缓存（配置编辑页保存按钮） */
export async function savePluginRegistry(
	data: PluginRegistry,
): Promise<PluginRegistry> {
	assertRegistryHostApiCompatible(data);
	const next: PluginRegistry = {
		...data,
		updatedAt: formatRegistryUpdatedAt(), // 保存时更新「更新于」时间
		plugins: data.plugins,
	};
	const payload = `${JSON.stringify(next, null, 2)}\n`;
	// 上传到服务端 /remotes/plugins-registry.json
	await putUploadRemoteJson(PLUGIN_REGISTRY_FILENAME, payload);
	writeCache(next);
	return next;
}
```

> **语义**：`assertRegistryHostApiCompatible` 是「上线前的保险丝」。配置页允许编辑 catalog，但保存时立刻校验 hostApiRange，从源头杜绝「范围写错 → 线上全插件被拒」。

展示层的「用户偏好覆盖」：

```ts
/**
 * 用当前账号偏好覆盖 registry 里的 enabled（仅展示/运行时，不写回服务端）。
 * 作用：让「用户已上架但 catalog 标 false」的插件在列表/界面里正确显示为已启用。
 */
export function overlayUserEnabled(data: PluginRegistry): PluginRegistry {
	return {
		...data,
		plugins: data.plugins.map((p) => ({
			...p,
			// 每个插件的最终上架状态：以账号偏好为准
			enabled: isPluginEnabled(p.id),
		})),
	};
}
```

> **语义**：`catalog.enabled` 是「默认上架」，账号偏好是「用户覆盖」。`overlayUserEnabled` 只在**展示层**用（比如插件中心列表），不会污染 catalog 文件。

---

## 6. 上架/下架：`persistEnabled` 与 `setEnabled` 全链路

把前面三节串起来的，是 `PluginManager.setEnabled` 与配置里的 `persistEnabled`。kit 默认实现（`packages/federation-kit/src/runtime/createPluginRuntime.ts`）：

```ts
// PluginManager.setEnabled：上架/下架的统一入口
async setEnabled(id: string, enabled: boolean) {
	// 默认持久化实现：仅写 enabledStore + 强制拉一次 registry（用最新 catalog 决定后续）
	const persist =
		this.config.persistEnabled ??
		(async (pluginId, on) => {
			await this.config.enabledStore.set?.(pluginId, on);
			notifyPluginEnabled();
			return this.config.fetchRegistry({ force: true });
		});
	// 执行持久化（可被 createFederation 的 persistEnabled 覆盖为服务端账号偏好版）
	const registry = await persist(id, enabled);
	if (!enabled) {
		// 下架：彻底卸载该插件（停生命周期、清路由、清侧栏、释放事件总线）
		await this.unloadPlugin(id);
		return;
	}
	// 上架：找到 catalog 里该插件的新 meta（enabled 已被覆盖）后挂载壳（注入路由+侧栏）
	const meta = registry.plugins.find((p) => p.id === id && p.enabled);
	if (!meta) return;
	this.mountShell(meta);
}
```

本仓把 `persistEnabled` 覆盖为「写账号偏好 + 同步服务端」：

```ts
// apps/frontend/src/federation/registry/index.ts
/**
 * 上架/下架：写入服务端账号偏好（Web/桌面同步），不改 registry catalog。
 * 返回「用户偏好覆盖后」的最新 registry，供调用方刷新界面。
 */
export async function persistPluginEnabled(
	id: string,
	enabled: boolean,
): Promise<PluginRegistry> {
	// 强制拉最新 catalog（跳过缓存）
	const data = await fetchPluginRegistry({ force: true });
	const hit = data.plugins.find((p) => p.id === id);
	if (!hit) {
		// 插件不存在：给出可读错误
		throw new Error(translateSync('plugins.registry.pluginNotFound', { id }));
	}
	// 写账号偏好（乐观更新 + 服务端同步，见第 4 节）
	await setPluginEnabledPref(id, enabled);
	// 通知全局订阅者（hooks / 侧栏 / 插件中心全部刷新）
	notifyPluginEnabled();
	// 返回偏好覆盖后的结果
	return overlayUserEnabled(data);
}
```

接线（`apps/frontend/src/federation/runtime/index.ts` 的 `createFederation` 配置）：

```ts
fetchRegistry: fetchPluginRegistry,   // registry 拉取（带缓存，见第 5 节）
persistEnabled: persistPluginEnabled, // 上架/下架持久化（账号偏好，见本节）
enabledStore: {
	get: getPluginEnabledPref,         // 同步读内存（见第 4 节）
	set: setPluginEnabledPref,         // 乐观更新 + 写服务端
	load: ensurePluginEnabledPrefsLoaded, // 启动时预拉取
	isReady: arePluginEnabledPrefsReady,  // 就绪信号（防闪跳）
},
```

> **完整时序**（用户点击「上架」某插件）：
>
> 1. 界面调用 `pluginManager.setEnabled(id, true)`（或直接 `persistPluginEnabled`）。
> 2. `persistEnabled` → 强制拉最新 catalog → `setPluginEnabledPref` 乐观更新内存并写服务端。
> 3. `notifyPluginEnabled()` 触发所有 `subscribePluginEnabled` 订阅者刷新（侧栏、插件中心、hooks）。
> 4. `setEnabled` 拿到覆盖后的 registry，`mountShell(meta)` 注入该插件的路由与侧栏项——**此时界面立即出现入口**。
> 5. 用户真正点击进入时，`ensurePlugin` 才按需下载远端代码（`FederationPlugin` 按 routePath 渲染）。
>
> **「下架」的对称性**：`unloadPlugin` 会调插件 `deactivate()` 生命周期、`routeInjector.remove(id)` 移除路由、`sidebarInjector.remove(id)` 移除侧栏项——入口和代码都从当前会话中消失，但 catalog 与账号偏好都已持久化，下次启动依旧生效。
