# 03 · Vite 配置：federation 插件逐项拆解

> **本章目标**：给出子项目 `vite.config.ts` 的完整代码与逐行注释，讲清 `federation()` 里每一项**为什么必须这么写**。这是「你的代码能被 Host 加载」的物理前提。
>
> 对应源码：Host 侧 `apps/frontend/vite.config.ts`（两边都用 `@module-federation/vite`）。

---

## 1. 完整配置

```ts
// vite.config.ts —— 子项目（Remote）侧完整配置
import fs from 'node:fs';
import path from 'node:path';
// 与 Host 同源的 Module Federation Vite 插件：负责生成 remoteEntry.js + mf-manifest.json
import { federation } from '@module-federation/vite';
// Tailwind CSS v4（可选但推荐；样式规范见第 10 章）
import tailwindcss from '@tailwindcss/vite';
// React 官方插件（Vue 子应用改用 @vitejs/plugin-vue）
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * MF 的 mf_owner id 递增后 .vite/deps 预构建缓存会失效，
 * 启动时静默清掉，避免「Failed to resolve virtual:mf」。
 */
function clearMfViteDepCache(): Plugin {
	return {
		name: 'clear-mf-vite-dep-cache',
		enforce: 'pre',
		config(config, { command }) {
			// 只在 dev（serve）时清；build 无需
			if (command !== 'serve') return;
			const root = config.root ? path.resolve(config.root) : process.cwd();
			fs.rmSync(path.join(root, 'node_modules/.vite'), {
				recursive: true,
				force: true,
			});
		},
	};
}

// 开发服务器固定 host/port：registry entry 写的就是它
const host = '127.0.0.1';
const port = 9008;
const devOrigin = `http://${host}:${port}`;

export default defineConfig(({ mode }) => {
	// 读 .env（见第 2 章）
	const env = loadEnv(mode, process.cwd(), '');
	const origin = env.VITE_REMOTE_PUBLIC_ORIGIN || devOrigin;
	const reactRefreshHost = env.VITE_REACT_REFRESH_HOST || 'http://127.0.0.1:9002';

	return {
		// 必须：产物资源统一带 origin 前缀，与 Host registry entry 完全一致。
		// 写成 `${origin}/` 后，dist 里的 import 路径、manifest 里的 remoteEntry 都以此为根。
		base: `${origin}/`,

		plugins: [
			clearMfViteDepCache(),
			// reactRefreshHost：把 React Refresh 握手指向 Host，HMR 跨源才能工作
			react({ reactRefreshHost }),
			tailwindcss(),
			// —— 核心：Module Federation 配置 ——
			federation({
				// 必须：唯一的 federation name（remoteName）。
				// Host 侧 registerRemote 用 `d.remoteName || d.id`，别与其它 Remote 撞名
				name: 'pluginDemo',
				// 必须：固定文件名。Host 解析 manifest 时按 remoteEntry.js 找入口
				filename: 'remoteEntry.js',
				// 必须：生成 mf-manifest.json。Host 靠它：
				//   ① 内容指纹 → cache bust（version@manifestHash）
				//   ② 解析 remoteEntry 绝对地址 → 直连加载
				manifest: true,
				// 必须：暴露给 Host 的模块。键为 expose 名（registry expose 字段默认 ./App），
				// 值为源文件路径。多 expose 时写多条（每个都要 import 样式，见第 10 章）
				exposes: {
					'./App': './src/App.tsx',
					'./IdeasList': './src/views/ideas-list/index.ts',
				},
				// 必须：与 Host 共享同一份 react/react-dom（singleton），
				// 否则出现双 React：hooks 状态错乱、DOM 事件绑定双份
				shared: {
					react: { singleton: true, requiredVersion: '^19.1.0' },
					'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
				},
				// 必须：把 MF 初始化代码注入 entry 而不是再包一层 bootstrap，
				// 避免 clientInjected 前把入口打成无 export 的壳
				hostInitInjectLocation: 'entry',
				// 推荐：关闭类型生成（减少噪音）
				dts: false,
				// 开发环境支持 remote HMR
				dev: { remoteHmr: true },
			}),
		],

		optimizeDeps: {
			// 重依赖（如 @tiptap/*）建议 include 预打包，避免 HMR 中途发现新依赖整页 reload
			include: [
				// 按实际 import 补齐，例如 '@tiptap/core'、'@tiptap/pm/model' …
			],
			// 必须：把 React 系排除出预构建。
			// 否则 .vite/deps 会打包一份 React，且它内部的 externals 把 shared 认成两份，
			// 导致「Invalid hook call」等双实例问题
			exclude: [
				'react',
				'react/jsx-runtime',
				'react/jsx-dev-runtime',
				'react-dom',
				'react-dom/client',
			],
		},

		server: {
			host,
			port,
			strictPort: true, // 端口被占用直接报错，绝不漂移（registry entry 写死）
			origin: devOrigin, // 保证 dev 产物资源路径带正确 origin
			cors: true,        // 允许 Host 跨源 fetch manifest / remoteEntry
			headers: {
				'Access-Control-Allow-Origin': '*', // WebView 也需要
			},
		},

		preview: {
			host,
			port,
			strictPort: true,
			cors: true,
		},

		build: {
			target: 'esnext',      // MF ESM 需要现代目标
			modulePreload: false,  // 避免多出 preload 请求干扰 Host 加载
			minify: false,         // 便于排查；生产可按需改为 true
		},

		resolve: {
			alias: {
				'@': '/src',         // 与 tsconfig paths 一致
				'@ui': '/src/components/ui',
			},
		},
	};
});
```

---

## 2. 配置项检查表

| 配置项 | 是否必须 | 说明 |
|--------|----------|------|
| `base` | ✅ | 必须与 Host registry `entry` 一致 |
| `federation.name` | ✅ | 唯一 federation 名 |
| `federation.filename` | ✅ | 固定 `remoteEntry.js` |
| `federation.manifest` | ✅ | 必须 `true`（Host 靠它算缓存指纹 + 找入口） |
| `federation.exposes` | ✅ | 至少暴露一个模块 |
| `federation.shared.react.singleton` | ✅ | 必须 `true` |
| `federation.hostInitInjectLocation` | ✅ | 必须 `entry` |
| `optimizeDeps.exclude` | ✅ | 必须排除 React 相关 |
| `optimizeDeps.include` | 推荐 | 预打包重依赖，避免 HMR 二次整页 reload |
| `server.cors` | ✅ | 必须 `true` |
| `server.headers['Access-Control-Allow-Origin']` | ✅ | 必须允许跨域 |

---

## 3. 为什么 `base` 和 `entry` 必须一致

Host 加载你的完整链路：

```
registry.entry = "http://127.0.0.1:9008/mf-manifest.json"
   │
   ├─ Host GET mf-manifest.json（指纹 + 解析 remoteEntry）
   ├─ Host GET http://127.0.0.1:9008/remoteEntry.js?v=…
   └─ remoteEntry 里 import 的模块，路径都基于你的 base
```

如果 `base` 写了 `/` 而不是 `http://127.0.0.1:9008/`，产物里的模块路径会是相对 Host origin 的，导致 404。

> **一句话**：`base` = registry `entry` 的目录部分。开发和生产都遵循这条规则。

---

## 4. `manifest: true` 到底生成什么

构建后 `dist/` 里多出一个 `mf-manifest.json`：

```jsonc
// dist/mf-manifest.json（示意）
{
	"metaData": {
		"publicPath": "http://127.0.0.1:9008/",     // 资源根
		"remoteEntry": { "name": "remoteEntry.js" } // 入口文件名
	}
}
```

Host 侧 `resolvePluginBust`（见 host-guide 第 9 章）只 GET **这一次** `mf-manifest.json`，同时得到两样东西：

1. **内容指纹** → `version@manifestHash` 缓存破坏 token（你发新版**无需改 Host registry**）；
2. **remoteEntry 绝对地址** → 直接 `registerRemote`，MF 不会再为找入口多拉一次 manifest。

---

## 5. Host 侧的要求（回看）

Host 的 `apps/frontend/vite.config.ts` 也配置了 `federation({ name: 'host', shared: { react: singleton } })` 且 `optimizeDeps.exclude` 了 react 系。**两边必须都满足**，共享才成立：

| | Host | Remote（你） |
|--|------|--------------|
| federation 插件 | ✅ 有 | ✅ 有 |
| react singleton | ✅ | ✅ |
| optimizeDeps.exclude react* | ✅ | ✅ |
| 版本 | react ^19.1.0 | react ^19.1.0（requiredVersion 与 Host 对齐） |
