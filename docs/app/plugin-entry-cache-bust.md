# 插件 MF entry 缓存破坏（version@updatedAt）

> **文档角色（本轮主文档）**：桌面 / WebView 仍吃旧 `remoteEntry.js`、发新版插件不生效的修复。  
> **延伸阅读**：[mf-plugin-host.md](./mf-plugin-host.md)；[../ops/remotes-no-store-cache.md](../ops/remotes-no-store-cache.md)；[plugin-registry-hostapi.md](./plugin-registry-hostapi.md)。

## 1. 背景与目标

只给 `mf-manifest.json` 加 `?v=` **不够**：Module Federation 解析 snapshot 后会把真正 `import()` 的地址改写成固定名 `remoteEntry.js`（去掉 query）。WKWebView 对固定 ESM URL 强缓存，导致桌面端继续跑旧插件。

目标：用 `version@registryUpdatedAt` 作为 bust；`afterResolve` 在改写后再补 `?v=`；`PluginManager` 用同一 bust 判断是否需重载（不再「已 activated 就直接返回」）。

## 2. 改动范围

| 路径                                              | 说明                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/frontend/src/plugins/core/mf.ts`            | `withBust` / `pluginBust` / `bustRemoteEntryPlugin` / `registerRemote` |
| `apps/frontend/src/plugins/core/PluginManager.ts` | `ensurePlugin` / `loadPlugin` / `runLoad` 比对 `bust`                  |
| `apps/frontend/src/plugins/core/types.ts`         | `LoadedPlugin.bust`                                                    |
| `apps/frontend/src/plugins/core/registry.ts`      | force 拉 registry 时 URL `?t=`                                         |

## 3. 实现思路

1. **统一 bust token**：`pluginBust(meta, registry.updatedAt)` → `version@updatedAt`。
2. **registerRemotes**：entry 先 `withBust`；同时写入 `bustByRemote`。
3. **afterResolve**：MF 改写 entry 后，再对 `remoteInfo.entry` 调用 `withBust`。
4. **ensurePlugin**：force 拉 registry；仅当 `cur.bust === bust` 才跳过加载。

## 4. 关键代码对比与注释

### 4.1 `withBust` / `pluginBust`（`apps/frontend/src/plugins/core/mf.ts`）

**对比范围**：纯新增符号。

**改动后** · `apps/frontend/src/plugins/core/mf.ts`（当前，约 L38–L65）

```typescript
/** 给任意 URL 写入/覆盖 `v=`（manifest 与 remoteEntry 共用） */
export function withBust(url: string, bust: string): string {
	// 去掉首尾空白；空 token 表示不改动 URL
	const token = bust.trim();
	// 无 bust 时原样返回，避免写出 `?v=`
	if (!token) return url;
	try {
		// 标准绝对 URL：用 URLSearchParams 覆盖同名 v
		const u = new URL(url);
		// 写入或覆盖查询参数 v
		u.searchParams.set("v", token);
		// 返回带 bust 的完整 href
		return u.href;
	} catch {
		// 相对路径或非法 URL：手工拼 query，保留 hash
		const hashIdx = url.indexOf("#");
		// 截出 hash（含 #）或空串
		const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
		// 去掉 hash 后的主体
		const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
		// 是否已有 ?
		const qIdx = noHash.indexOf("?");
		// 无 query 的基址
		const base = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
		// 解析已有 query（可能为空）
		const params = new URLSearchParams(qIdx >= 0 ? noHash.slice(qIdx + 1) : "");
		// 写入/覆盖 v
		params.set("v", token);
		// 拼回 base?params#hash
		return `${base}?${params.toString()}${hash}`;
	}
}

// 由插件 version 与 registry.updatedAt 组成 bust 字符串
export function pluginBust(
	// 至少需要 version 字段
	meta: Pick<PluginDescriptor, "version">,
	// 可选：整表更新时间
	registryUpdatedAt?: string,
): string {
	// version 与 updatedAt 去空白后过滤空值，用 @ 连接
	return [meta.version.trim(), registryUpdatedAt?.trim()]
		.filter(Boolean)
		.join("@");
}
```

**变更摘要**：新增 URL bust 工具与 `version@updatedAt` token。

### 4.2 `bustRemoteEntryPlugin` / `registerRemote`（同文件）

**改动后** · `apps/frontend/src/plugins/core/mf.ts`（当前，约 L71–L141）

```typescript
// MF Runtime 插件：在 resolve 之后给改写过的 entry 补 bust
const bustRemoteEntryPlugin: ModuleFederationRuntimePlugin = {
	// 插件名，便于调试
	name: "bust-remote-entry",
	// MF 解析 remote 信息之后调用
	async afterResolve(args) {
		// 当前 remote 的 federation name
		const name = args.remoteInfo?.name;
		// 查 registerRemote 时写入的 bust
		const bust = name ? bustByRemote.get(name) : undefined;
		// 有 bust 且已有 entry 时改写
		if (bust && args.remoteInfo?.entry) {
			// 给可能被剥掉 query 的 remoteEntry.js 再补 ?v=
			args.remoteInfo.entry = withBust(args.remoteInfo.entry, bust);
		}
		// 必须返回 args 供后续流水线使用
		return args;
	},
};

// 注册远程模块；bust 默认回退到 version
export function registerRemote(d: PluginDescriptor, bust?: string) {
	// 确保 React shared 已注册
	ensureShared();
	// 确保 afterResolve 钩子只注册一次
	ensureBustPlugin();
	// 最终 token：显式 bust 或插件 version
	const token = (bust ?? d.version).trim();
	// remote 名：remoteName 优先，否则 id
	const name = remoteNameOf(d);
	// 非空 token 写入 Map，供 afterResolve 读取
	if (token) bustByRemote.set(name, token);
	// 强制重新 register，避免旧 entry 残留
	getMf().registerRemotes(
		[
			{
				// federation remote name
				name,
				// manifest / entry 带 ?v=
				entry: withBust(d.entry, token),
				// ESM remote
				type: "module",
			},
		],
		// force: true 覆盖同名 remote
		{ force: true },
	);
}
```

**变更摘要**：manifest 与改写后的 `remoteEntry.js` 都带同一 `v=`。

### 4.3 `ensurePlugin` bust 短路（`PluginManager.ts`）

**对比范围**：`ensurePlugin` 全函数逻辑焦点。

**改动前** · `apps/frontend/src/plugins/core/PluginManager.ts`（基线）

```typescript
async ensurePlugin(id: string, opts?: { force?: boolean }) {
	// 读内存中的已加载插件
	const cur = this.plugins.get(id);
	// 只要已激活就直接返回（不比对 version / updatedAt）
	if (cur?.status === 'activated') return cur;
	// 失败且未 force 则抛上次错误
	if (cur?.status === 'failed' && !opts?.force) {
		throw new Error(cur.error || `加载 ${id} 失败`);
	}
	// ... 后续拉 registry + loadPlugin
}
```

**改动后** · `apps/frontend/src/plugins/core/PluginManager.ts`（当前，约 L83–L116）

```typescript
async ensurePlugin(id: string, opts?: { force?: boolean }) {
	// 每次 ensure 强制拉最新 registry（配合 ?t= 防缓存）
	const registry = await fetchPluginRegistry({ force: true });
	// 在启用列表中找目标插件
	const meta = registry.plugins.find((p) => p.id === id && p.enabled);
	// 未启用或不存在则抛错
	if (!meta) {
		throw new Error(`registry 中无启用插件 ${id}`);
	}
	// 用 version@updatedAt 生成当前应有的 bust
	const bust = pluginBust(meta, registry.updatedAt);
	// 读内存态
	const cur = this.plugins.get(id);
	// 已激活且 bust 未变且未 force → 复用
	if (cur?.status === 'activated' && cur.bust === bust && !opts?.force) {
		return cur;
	}
	// 失败且 bust 未变且未 force → 仍抛旧错，避免无意义重试
	if (cur?.status === 'failed' && !opts?.force && cur.bust === bust) {
		throw new Error(cur.error || `加载 ${id} 失败`);
	}
	// ... inflight / mountShell / loadPlugin(meta, opts, registry.updatedAt)
}
```

**变更摘要**：activated 短路改为 bust 相等才跳过；registry 变更会强制重载。

## 5. 兼容性与影响

- **必须发新桌面壳**：生产 Host 打在壳里，只发插件不发壳则仍是旧逻辑。
- 发插件时更新 registry 的 **`version` 或 `updatedAt`**（保存 registry 会自动写 `updatedAt`）。
- `hostApiRange` 仍须覆盖当前 Host API（见 [plugin-registry-hostapi.md](./plugin-registry-hostapi.md)）。

## 6. 相关源码路径

| 说明                | 路径                                              |
| ------------------- | ------------------------------------------------- |
| bust / afterResolve | `apps/frontend/src/plugins/core/mf.ts`            |
| 重载判定            | `apps/frontend/src/plugins/core/PluginManager.ts` |
| LoadedPlugin.bust   | `apps/frontend/src/plugins/core/types.ts`         |

---

（若与仓库最新源码不一致，以源码为准）
