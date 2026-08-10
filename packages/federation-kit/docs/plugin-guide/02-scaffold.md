# 02 · 项目初始化：环境、依赖与目录

> **本章目标**：从零搭一个可独立运行、可被 Host 加载的子项目骨架。包含环境变量、依赖清单、TypeScript 配置、推荐目录结构、开发服务器要求。
>
> 参考实现：`apps/micro` / `apps/remote-plugins`（端口 9008）、`apps/remote-demo`（端口 9007）。

---

## 1. 必备工具与环境变量

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | >= 20.x | 运行时 |
| pnpm | >= 8.x | 包管理器 |
| Git | >= 2.x | 版本控制 |

在项目根目录建 `.env`：

```bash
# 开发环境 Remote 公共 origin（Host registry 的 entry 就是它；remote-plugins 默认 9008）
VITE_REMOTE_PUBLIC_ORIGIN=http://127.0.0.1:9008

# React Refresh Host：指向 Host 的开发服务器（默认 9002），HMR 跨源握手用
VITE_REACT_REFRESH_HOST=http://127.0.0.1:9002
```

> **语义**：`VITE_REMOTE_PUBLIC_ORIGIN` 决定了「你的代码在浏览器里最终从哪个 URL 加载」。Host 的 registry `entry` 必须与它一致，否则 Host 找不到你的资源。

---

## 2. 依赖安装

```bash
# 运行时依赖：React（Vue 子应用改装 vue，见第 9 章）
pnpm add react react-dom @vitejs/plugin-react

# 构建/开发依赖
pnpm add -D @module-federation/vite typescript @types/node @types/react @types/react-dom

# 可选（推荐）：Tailwind CSS v4（样式规范见第 10 章）
pnpm add tailwindcss @tailwindcss/vite
```

> **注意**：`@module-federation/vite` 是 **Host 也在用的同一个插件**（Host 侧 `apps/frontend/vite.config.ts` 同样 import 它）。两边同源，共享逻辑才可靠。

---

## 3. TypeScript 配置

`tsconfig.json`：

```json
{
	"compilerOptions": {
		"target": "ES2020",
		"useDefineForClassFields": true,
		"lib": ["ES2020", "DOM", "DOM.Iterable"],
		"module": "ESNext",
		"skipLibCheck": true,
		"moduleResolution": "bundler",
		"allowImportingTsExtensions": true,
		"resolveJsonModule": true,
		"isolatedModules": true,
		"noEmit": true,
		"jsx": "react-jsx",
		"strict": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noFallthroughCasesInSwitch": true,
		"baseUrl": ".",
		"paths": {
			"@/*": ["src/*"],
			"@ui/*": ["src/components/ui/*"]
		}
	},
	"include": ["src"],
	"references": [{ "path": "./tsconfig.app.json" }]
}
```

> **语义**：`moduleResolution: "bundler"` 是为了兼容 Vite 与 MF 的 ESM 产物；`paths` 里的 `@/*` 与 Vite 的 alias 保持一致（见第 3 章）。`allowImportingTsExtensions` + `noEmit` 是 Vite 工程惯例。

`tsconfig.app.json`（Vite 参考工程拆分出的应用配置）：

```json
{
	"compilerOptions": {
		"composite": true,
		"tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
		"target": "ES2020",
		"useDefineForClassFields": true,
		"lib": ["ES2020", "DOM", "DOM.Iterable"],
		"module": "ESNext",
		"skipLibCheck": true,
		"moduleResolution": "bundler",
		"allowImportingTsExtensions": true,
		"resolveJsonModule": true,
		"isolatedModules": true,
		"noEmit": true,
		"jsx": "react-jsx",
		"strict": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noFallthroughCasesInSwitch": true,
		"baseUrl": ".",
		"paths": {
			"@/*": ["src/*"],
			"@ui/*": ["src/components/ui/*"]
		}
	},
	"include": ["src"]
}
```

---

## 4. 推荐目录结构

```
plugin-demo/
├── src/
│   ├── App.tsx                # 插件主组件（必须 default 导出）
│   ├── main.tsx               # 独立预览入口（Host 不会执行它！）
│   ├── styles.css             # 全局样式（必须被每个 expose 入口 import，见第 10 章）
│   ├── router/                # 独立预览路由（可选）
│   │   ├── index.tsx
│   │   └── routes.tsx
│   ├── layout/                # 独立预览壳 Layout（可选）
│   │   └── index.tsx
│   ├── views/                 # 页面组件（多 expose 时用）
│   │   ├── home/index.tsx
│   │   └── embed/index.tsx    # iframe embed 页（untrusted 模式，见第 8 章）
│   ├── hooks/
│   │   ├── i18n.ts            # useI18n()
│   │   └── useHostLocale.ts   # 跟随 Host 语言（见第 11 章）
│   ├── i18n/                  # 插件自有文案字典
│   │   ├── types.ts
│   │   ├── locales/zh-CN.ts
│   │   ├── locales/en-US.ts
│   │   └── index.ts
│   ├── types/
│   │   └── host.ts            # HostBridgeProps 类型定义（与 kit 对齐）
│   ├── utils/
│   │   ├── mockHost.ts        # 独立预览用假 bridge
│   │   └── iframeHostClient.ts # iframe 通信客户端（untrusted 用）
│   └── components/ui/         # 可选：shadcn 组件
├── vite.config.ts             # Vite + federation 配置（第 3 章）
├── tsconfig.json
├── tsconfig.app.json
├── package.json
└── .env
```

> **关键区分**：`src/main.tsx` 只服务于**独立预览**（`pnpm dev`）。Host 加载你时**只执行 expose 入口模块**，不会执行 `main.tsx`——所以一切「必须生效」的东西（CSS、初始化）都要挂在 expose 入口上（详见第 10 章）。

---

## 5. 开发服务器要求

| 配置 | 必须值 | 原因 |
|------|--------|------|
| `server.host` | `127.0.0.1`（或 `0.0.0.0`） | 让 Host/WebView 能跨源访问 |
| `server.port` | 固定（如 9008），`strictPort: true` | registry entry 里写死，端口不能漂移 |
| `server.cors` | `true` | 允许 Host fetch 你的 manifest |
| `server.headers['Access-Control-Allow-Origin']` | `*` | 同上，浏览器跨源必需 |
| `server.origin` | `http://127.0.0.1:9008` | 保证 dev 产物里的资源路径带正确 origin |

> **为什么端口要固定**：registry 里 `entry` 指向 `http://127.0.0.1:9008/mf-manifest.json`，这是 Host 唯一知道的地址。端口漂移 = Host 找不到你。生产环境同理——域名和端口必须与 registry 完全一致。

---

## 6. package.json 脚本

```json
{
	"scripts": {
		"dev": "vite",
		"build": "tsc && vite build",
		"preview": "vite preview"
	}
}
```

> 建议 `build` 先跑 `tsc` 做类型检查，再接 `vite build`；`preview` 用于验证产物（模拟生产资源路径）。

---

## 检查表

- [ ] `.env` 有 `VITE_REMOTE_PUBLIC_ORIGIN`（与 registry entry 一致）
- [ ] `tsconfig` 用 `bundler` resolution + `@/*` 别名
- [ ] 目录结构包含 `views/embed`（若要做 iframe 模式）
- [ ] 端口固定，`cors: true`，`Access-Control-Allow-Origin: *`
