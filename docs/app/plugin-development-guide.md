# 插件开发手册

> **文档角色**：面向插件/子项目开发者的实操手册，包含开发全流程要求和条件。
> **适用读者**：第一方插件开发者、合作方插件开发者、第三方插件开发者。
> **目标**：帮助开发者快速落地插件开发，确保符合系统规范。

---

## 目录

1. [开发环境准备](#1-开发环境准备)
2. [项目初始化](#2-项目初始化)
3. [Vite 配置要求](#3-vite-配置要求)
4. [组件实现规范](#4-组件实现规范)
5. [样式处理规范](#5-样式处理规范)
6. [HostBridge API 使用](#6-hostbridge-api-使用)
7. [权限声明](#7-权限声明)
8. [生命周期钩子](#8-生命周期钩子)
9. [独立预览配置](#9-独立预览配置)
10. [iframe 隔离模式开发](#10-iframe-隔离模式开发)
11. [调试技巧](#11-调试技巧)
12. [发布流程](#12-发布流程)
13. [验收清单](#13-验收清单)
14. [常见问题](#14-常见问题)

---

## 1. 开发环境准备

### 1.1 必备工具

| 工具 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 20.x | 运行时环境 |
| pnpm | >= 8.x | 包管理器 |
| Git | >= 2.x | 版本控制 |

### 1.2 环境变量

在插件项目根目录创建 `.env` 文件：

```bash
# 开发环境 Remote 公共 origin（与 Host registry entry 一致）
VITE_REMOTE_PUBLIC_ORIGIN=http://127.0.0.1:9005

# React Refresh Host：指向 Host 开发服务器
VITE_REACT_REFRESH_HOST=http://127.0.0.1:9002
```

### 1.3 依赖安装

```bash
# 安装核心依赖
pnpm add react react-dom @vitejs/plugin-react

# 安装 Module Federation 插件
pnpm add -D @module-federation/vite

# 安装 Tailwind CSS v4（可选，推荐）
pnpm add tailwindcss @tailwindcss/vite
```

---

## 2. 项目初始化

### 2.1 目录结构

```
plugin-demo/
├── src/
│   ├── App.tsx              # 插件主组件（必须 default 导出）
│   ├── main.tsx             # 独立预览入口
│   ├── styles.css           # 全局样式（必须遵循样式隔离规范）
│   ├── router/              # 独立预览路由（可选）
│   │   ├── index.tsx
│   │   └── routes.tsx
│   ├── layout/              # 预览壳 Layout（可选）
│   │   └── index.tsx
│   ├── views/               # 页面组件（多 expose 时使用）
│   │   └── home/
│   │       └── index.tsx
│   ├── utils/               # 工具函数
│   │   ├── mockHost.ts      # mock HostBridge（独立预览用）
│   │   └── iframeHostClient.ts  # iframe 通信客户端（untrusted 用）
│   └── components/ui/       # UI 组件（可选，shadcn）
├── vite.config.ts           # Vite 配置（必须）
├── tsconfig.json            # TypeScript 配置
├── tsconfig.app.json        # TypeScript 应用配置
├── components.json          # shadcn 配置（可选）
├── package.json
└── .env                     # 环境变量
```

### 2.2 新建插件步骤

**步骤 1**：创建项目目录

```bash
mkdir plugin-demo && cd plugin-demo
pnpm init
```

**步骤 2**：安装依赖

```bash
pnpm add react react-dom @vitejs/plugin-react
pnpm add -D @module-federation/vite tailwindcss @tailwindcss/vite typescript @types/node @types/react @types/react-dom
```

**步骤 3**：初始化 TypeScript

```bash
npx tsc --init
```

**步骤 4**：配置 `tsconfig.json`

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

**步骤 5**：创建 `tsconfig.app.json`

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

## 3. Vite 配置要求

### 3.1 核心配置

**文件路径**：`vite.config.ts`

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// MF mf_owner id 递增后 .vite/deps 会失效，serve 时清缓存
function clearMfViteDepCache(): Plugin {
	return {
		name: 'clear-mf-vite-dep-cache',
		enforce: 'pre',
		config(config, { command }) {
			if (command !== 'serve') return;
			const root = config.root ? path.resolve(config.root) : process.cwd();
			fs.rmSync(path.join(root, 'node_modules/.vite'), {
				recursive: true,
				force: true,
			});
		},
	};
}

const host = '127.0.0.1';
const port = 9005;
const devOrigin = `http://${host}:${port}`;

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const origin = env.VITE_REMOTE_PUBLIC_ORIGIN || devOrigin;
	const reactRefreshHost = env.VITE_REACT_REFRESH_HOST || 'http://127.0.0.1:9002';

	return {
		// 必须：与 Host registry entry 一致
		base: `${origin}/`,
		
		plugins: [
			clearMfViteDepCache(),
			react({ reactRefreshHost }),
			tailwindcss(),
			federation({
				name: 'pluginDemo',           // 必须：唯一的 federation name
				filename: 'remoteEntry.js',   // 必须：固定值
				manifest: true,               // 必须：生成 manifest
				exposes: {                    // 必须：暴露的模块
					'./App': './src/App.tsx',
				},
				shared: {                     // 必须：共享依赖配置
					react: {
						singleton: true,
						requiredVersion: '^19.1.0',
					},
					'react-dom': {
						singleton: true,
						requiredVersion: '^19.1.0',
					},
				},
				hostInitInjectLocation: 'entry',  // 必须：避免 bootstrap 无 export
				dts: false,                       // 推荐：关闭类型生成
				dev: {
					remoteHmr: true,              // 开发环境支持 HMR
				},
			}),
		],
		
		// 必须：排除 React 相关依赖，避免双 React 问题
		optimizeDeps: {
			exclude: [
				'react',
				'react/jsx-runtime',
				'react/jsx-dev-runtime',
				'react-dom',
				'react-dom/client',
			],
		},
		
		// 必须：允许跨域
		server: {
			host,
			port,
			strictPort: true,
			origin: devOrigin,
			cors: true,
			headers: {
				'Access-Control-Allow-Origin': '*',
			},
		},
		
		preview: {
			host,
			port,
			strictPort: true,
			cors: true,
		},
		
		build: {
			target: 'esnext',
			modulePreload: false,
			minify: false,
		},
		
		resolve: {
			alias: {
				'@': '/src',
				'@ui': '/src/components/ui',
			},
		},
	};
});
```

### 3.2 配置项检查表

| 配置项 | 是否必须 | 说明 |
|--------|---------|------|
| `base` | ✅ | 必须与 Host registry entry 一致 |
| `federation.name` | ✅ | 唯一的 federation name |
| `federation.filename` | ✅ | 固定为 `remoteEntry.js` |
| `federation.manifest` | ✅ | 必须为 `true` |
| `federation.exposes` | ✅ | 至少暴露一个模块 |
| `federation.shared.react.singleton` | ✅ | 必须为 `true` |
| `federation.hostInitInjectLocation` | ✅ | 必须为 `entry` |
| `optimizeDeps.exclude` | ✅ | 必须排除 React 相关 |
| `server.cors` | ✅ | 必须为 `true` |
| `server.headers['Access-Control-Allow-Origin']` | ✅ | 必须允许跨域 |

---

## 4. 组件实现规范

### 4.1 主组件要求

**文件路径**：`src/App.tsx`

```typescript
// 必须：定义 HostBridgeProps 类型
type HostBridgeProps = {
	api: {
		t: (key: string, params?: Record<string, unknown>) => string;
		theme: 'light' | 'dark';
		navigate?: (to: string) => void;
		event: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		http?: {
			get: <T = unknown>(url: string) => Promise<T>;
			post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
		};
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
		};
		modules?: Readonly<Record<string, (...args: unknown[]) => unknown>>;
	};
	plugin: { id: string; version: string; routePath: string };
};

// 必须：default 导出 React 组件
export default function App({ api, plugin }: HostBridgeProps) {
	return (
		// 必须：根元素带 data-plugin-root 属性
		<div className="plugin-standalone" data-plugin-root>
			<h1>插件 {plugin.id} v{plugin.version}</h1>
			<p>当前主题：{api.theme}</p>
			<button
				type="button"
				onClick={() => api.ui?.showToast({ message: 'Hello!' })}
			>
				显示 Toast
			</button>
		</div>
	);
}

// 可选：激活钩子
export async function activate(api: HostBridgeProps['api']) {
	console.log('插件激活', api);
}

// 可选：停用钩子
export async function deactivate() {
	console.log('插件停用');
}
```

### 4.2 组件实现检查表

| 要求 | 是否必须 | 说明 |
|------|---------|------|
| `default` 导出 | ✅ | 必须导出 React 组件 |
| `HostBridgeProps` 类型 | ✅ | 必须定义或导入 |
| 根元素 `data-plugin-root` | ❌ | **已废弃**：样式隔离由 Host 侧自动处理，无需手动添加 |
| 根元素 `plugin-standalone` | ❌ | **已废弃**：独立预览使用标准 `:root` + `.dark` 主题变量 |
| `api` 参数使用 | ⚠️ | 按需使用，注意权限检查 |
| `activate` 钩子 | ❌ | 可选生命周期钩子 |
| `deactivate` 钩子 | ❌ | 可选生命周期钩子 |

---

## 5. 样式处理规范

> **重要更新（2026-07-22）**：样式隔离责任已从子项目侧转移到 Host 侧。子项目现在可以像普通 Vite + Tailwind 项目一样开发，**无需任何手动 scoped 配置**。
>
> 详细原理见 [style-isolation-implementation.md](./style-isolation-implementation.md)、[style-isolation-tech-overview.md](./style-isolation-tech-overview.md)。

### 5.1 样式文件配置

**文件路径**：`src/styles.css`

子项目可以直接使用标准 Tailwind CSS 配置，无需任何特殊处理：

```css
/*
 * 常规 Tailwind v4 + shadcn token。
 * 嵌入 Host 时主题变量由主站继承；独立预览 / iframe 用本文件 :root / .dark。
 */
// 直接导入完整 Tailwind（含 Preflight + utilities），Host 侧会自动用 @scope 包裹
@import "tailwindcss";
// 导入动画库
@import "tw-animate-css";

// 自定义深色模式变体（标准写法）
@custom-variant dark (&:where(.dark, .dark *));

// html / body 基础样式：独立预览和 iframe 模式下占满视口
html,
body {
	margin: 0;
	padding: 0;
	height: 100%;
	width: 100%;
}

// #root 容器样式：背景色、文字色、字体
#root {
	height: 100%;
	min-height: 100%;
	width: 100%;
	background-color: var(--background);
	color: var(--foreground);
	font-family: ui-sans-serif, system-ui, sans-serif;
}

// 浅色主题变量（独立预览 / iframe 模式使用；嵌入 Host 时继承主站变量）
:root {
	--radius: 0.625rem;
	--background: oklch(1 0 0);
	--foreground: oklch(0.145 0.02 264);
	--card: oklch(1 0 0);
	--card-foreground: oklch(0.145 0.02 264);
	--popover: oklch(1 0 0);
	--popover-foreground: oklch(0.145 0.02 264);
	--primary: oklch(0.21 0.034 264.665);
	--primary-foreground: oklch(0.985 0.002 247.839);
	--secondary: oklch(0.967 0.003 264.542);
	--secondary-foreground: oklch(0.21 0.034 264.665);
	--muted: oklch(0.967 0.003 264.542);
	--muted-foreground: oklch(0.551 0.027 264.364);
	--accent: oklch(0.967 0.003 264.542);
	--accent-foreground: oklch(0.21 0.034 264.665);
	--destructive: oklch(0.577 0.245 27.325);
	--border: oklch(0.922 0.006 264.531);
	--input: oklch(0.922 0.006 264.531);
	--ring: oklch(0.708 0.022 261.325);
	/* 与组件里 bg-theme / text-textcolor 等类名兼容 */
	--theme-color: var(--primary);
	--theme-background: var(--background);
	--theme-border: var(--border);
	--theme-textcolor: var(--foreground);
	--theme-default: var(--primary-foreground);
	--theme-foreground: var(--foreground);
	--theme-secondary: var(--secondary);
	--theme-muted: var(--muted);
	--theme-card: var(--card);
}

// 深色主题变量（通过 .dark 类名切换）
.dark {
	--background: oklch(0.145 0.02 264);
	--foreground: oklch(0.985 0.002 247.839);
	--card: oklch(0.205 0.03 264);
	--card-foreground: oklch(0.985 0.002 247.839);
	--popover: oklch(0.205 0.03 264);
	--popover-foreground: oklch(0.985 0.002 247.839);
	--primary: oklch(0.922 0.006 264.531);
	--primary-foreground: oklch(0.205 0.03 264);
	--secondary: oklch(0.269 0.03 256);
	--secondary-foreground: oklch(0.985 0.002 247.839);
	--muted: oklch(0.269 0.03 256);
	--muted-foreground: oklch(0.708 0.022 261.325);
	--accent: oklch(0.269 0.03 256);
	--accent-foreground: oklch(0.985 0.002 247.839);
	--destructive: oklch(0.704 0.191 22.216);
	--border: oklch(1 0 0 / 10%);
	--input: oklch(1 0 0 / 15%);
	--ring: oklch(0.556 0.027 264.364);
	--theme-color: var(--primary);
	--theme-background: var(--background);
	--theme-border: var(--border);
	--theme-textcolor: var(--foreground);
	--theme-default: var(--primary-foreground);
	--theme-foreground: var(--foreground);
	--theme-secondary: var(--secondary);
	--theme-muted: var(--muted);
	--theme-card: var(--card);
}

// Tailwind v4 @theme 内联配置：标准 shadcn token
@theme inline {
	--radius-sm: calc(var(--radius) - 4px);
	--radius-md: calc(var(--radius) - 2px);
	--radius-lg: var(--radius);
	--radius-xl: calc(var(--radius) + 4px);
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);
	--color-secondary: var(--secondary);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-accent: var(--accent);
	--color-accent-foreground: var(--accent-foreground);
	--color-destructive: var(--destructive);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-ring: var(--ring);
	--color-theme: var(--theme-color);
	--color-theme-background: var(--theme-background);
	--color-theme-border: var(--theme-border);
	--color-textcolor: var(--theme-textcolor);
	--color-default: var(--theme-default);
	--color-theme-foreground: var(--theme-foreground);
	--color-theme-secondary: var(--theme-secondary);
	--color-theme-muted: var(--theme-muted);
	--color-theme-card: var(--theme-card);
}
```

### 5.2 样式规范检查表

| 要求 | 是否必须 | 说明 |
|------|---------|------|
| 使用标准 `@import "tailwindcss"` | ✅ | 推荐直接使用完整 Tailwind，Host 侧自动隔离 |
| 定义 `:root` 浅色主题变量 | ✅ | 独立预览 / iframe 模式使用 |
| 定义 `.dark` 深色主题变量 | ✅ | 独立预览 / iframe 模式使用 |
| html/body/#root 基础样式 | ✅ | 独立预览模式下占满视口 |
| `@theme inline` 配置 | ✅ | 与 Tailwind CSS 对齐 |
| 手动 scoped utilities | ❌ | **已废弃**：由 Host 侧自动处理 |
| 手动表单控件 reset | ❌ | **已废弃**：Tailwind Preflight 已包含，由 Host 侧自动隔离 |

### 5.3 样式隔离原理（Host 侧自动处理）

子项目**不需要**做任何样式隔离工作。Host 侧通过以下机制自动实现：

| 机制 | 作用 |
|------|------|
| CSS `@scope` 规则 | 将子项目样式限制在 `[data-mf-plugin="id"]` 容器内 |
| `head.appendChild` 劫持 | 同步捕获子项目注入的 style/link 标签 |
| MutationObserver | 兜底捕获 HMR、动态 import 注入的样式 |

**效果**：
- ✅ 子项目的 Tailwind Preflight 不会污染 Host 全局样式
- ✅ 子项目的所有 utilities、组件库样式自动限制在插件容器内
- ✅ 子项目的 `body`、`html` 等全局选择器只在插件容器内生效
- ✅ 子项目自动继承 Host 的 CSS 变量（主题统一）

### 5.4 唯一注意点：跨域外链 CSS

如果子项目使用了 `<link rel="stylesheet" href="...">` 引入跨域 CSS 文件，需要确保：

- CSS 文件服务器配置了 CORS（允许主项目域名访问）
- 否则主项目无法获取 CSS 内容进行 scoped 处理
- 未处理的样式会原样生效（不隔离，但不影响功能）

**Nginx 配置示例**：
```nginx
location /static/css/ {
    add_header Access-Control-Allow-Origin *;
}
```

> 💡 **建议**：尽量将 CSS 打包进 JS 中（Vite 默认行为），变成 style 标签注入，完全没有 CORS 问题。

---

## 6. HostBridge API 使用

### 6.1 API 概览

| API | 权限要求 | 说明 |
|-----|---------|------|
| `api.t(key)` | 无 | 国际化翻译函数 |
| `api.theme` | 无 | 当前主题（light/dark） |
| `api.navigate(to)` | `nav:subtree` | 子路由导航 |
| `api.event.on/off/emit` | 无 | 事件总线 |
| `api.http.get/post` | `http:plugin-api` | HTTP 请求 |
| `api.ui.showToast` | `ui:toast` | 显示 Toast |
| `api.modules.ebook` | `modules:ebook` | 电子书模块 API |
| `api.modules.chat` | `modules:chat` | 聊天模块 API |

### 6.2 API 使用示例

```typescript
export default function App({ api, plugin }: HostBridgeProps) {
	const handleFetch = async () => {
		// 使用 HTTP API（需要 http:plugin-api 权限）
		if (api.http) {
			try {
				const data = await api.http.get('/api/plugin-data');
				console.log('获取数据:', data);
			} catch (e) {
				console.error('请求失败:', e);
			}
		}
	};

	const handleNavigate = () => {
		// 使用导航 API（需要 nav:subtree 权限）
		if (api.navigate) {
			api.navigate(`${plugin.routePath}/detail`);
		}
	};

	const handleToast = () => {
		// 使用 Toast API（需要 ui:toast 权限）
		api.ui?.showToast({
			message: '操作成功！',
			type: 'success',
		});
	};

	return (
		<div className="text-textcolor min-h-full p-4 text-sm">
			<h1>{api.t('plugin.title')}</h1>
			<p>主题：{api.theme}</p>
			<button onClick={handleFetch}>获取数据</button>
			<button onClick={handleNavigate}>导航到详情</button>
			<button onClick={handleToast}>显示 Toast</button>
		</div>
	);
}
```

### 6.3 权限检查

**重要**：使用受限 API 前必须检查是否存在：

```typescript
// ✅ 正确：使用前检查
if (api.http) {
	await api.http.get('/api/data');
}

// ❌ 错误：直接使用，无权限时会报错
await api.http.get('/api/data'); // TypeError: api.http is undefined
```

---

## 7. 权限声明

### 7.1 权限列表

| 权限 | 说明 | 用途 |
|------|------|------|
| `ui:toast` | 允许使用 Toast | 显示通知消息 |
| `nav:subtree` | 允许子路由导航 | 在插件路由范围内跳转 |
| `http:plugin-api` | 允许 HTTP 请求 | 调用后端 API |
| `modules:chat` | 允许聊天模块 | 打开聊天线程 |
| `modules:ebook` | 允许电子书模块 | 获取书籍信息、导航等 |

### 7.2 权限配置示例

在 Registry 中配置权限：

```json
{
	"id": "myPlugin",
	"permissions": ["ui:toast", "http:plugin-api", "modules:ebook"]
}
```

### 7.3 权限最佳实践

| 原则 | 说明 |
|------|------|
| 最小权限 | 只申请必要的权限 |
| 按需申请 | 开发时逐步添加权限 |
| 权限验证 | 使用 API 前检查是否存在 |

---

## 8. 生命周期钩子

### 8.1 钩子说明

| 钩子 | 调用时机 | 参数 | 返回值 |
|------|---------|------|--------|
| `activate` | 模块加载后 | `api: HostBridgeProps['api']` | `Promise<void>` 或 `void` |
| `deactivate` | 模块卸载前 | 无 | `Promise<void>` 或 `void` |

### 8.2 钩子使用示例

```typescript
export default function App({ api }: HostBridgeProps) {
	// 组件内逻辑
	return <div className="text-textcolor min-h-full p-4 text-sm">...</div>;
}

// 激活钩子：初始化资源
export async function activate(api: HostBridgeProps['api']) {
	console.log('插件激活');
	
	// 订阅事件
	api.event.on('book-changed', (data) => {
		console.log('书籍变更:', data);
	});
	
	// 初始化数据
	await api.http?.get('/api/init-data');
}

// 停用钩子：清理资源
export async function deactivate() {
	console.log('插件停用');
	
	// 取消事件订阅
	api.event.off('book-changed');
	
	// 清理定时器、取消请求等
}
```

### 8.3 钩子注意事项

| 注意事项 | 说明 |
|---------|------|
| 异步支持 | 钩子支持 `async/await` |
| 错误处理 | 错误会被 Host 捕获并记录 |
| 资源清理 | `deactivate` 必须清理所有资源 |

---

## 9. 独立预览配置

### 9.1 预览入口

**文件路径**：`src/main.tsx`

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { mockApi, mockPlugin } from '@/utils/mockHost';

// 独立预览时使用 mock HostBridge
const api = mockApi({
	ui: { showToast: (o) => console.info('[toast]', o.message) },
	http: {
		get: async (url) => {
			console.log('[mock-get]', url);
			return { data: 'mock data' };
		},
		post: async (url, body) => {
			console.log('[mock-post]', url, body);
			return { success: true };
		},
	},
});

const plugin = mockPlugin('myPlugin', '/my-plugin', '1.0.0');

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App api={api} plugin={plugin} />
	</StrictMode>,
);
```

### 9.2 Mock Host 工具

**文件路径**：`src/utils/mockHost.ts`

```typescript
export function mockApi(extra?: Record<string, unknown>) {
	return {
		t: (k: string) => k,
		theme: 'light' as const,
		event: {
			on: () => undefined,
			off: () => undefined,
			emit: () => undefined,
		},
		...extra,
	};
}

export function mockPlugin(id: string, routePath: string, version = '1.0.0') {
	return { id, version, routePath };
}
```

### 9.3 package.json 脚本

```json
{
	"scripts": {
		"dev": "vite",
		"build": "tsc && vite build",
		"preview": "vite preview"
	}
}
```

### 9.4 预览访问

```bash
pnpm dev
```

访问 `http://127.0.0.1:9005/` 查看独立预览效果。

---

## 10. iframe 隔离模式开发

### 10.1 适用场景

| 场景 | 是否需要 iframe |
|------|----------------|
| 第三方插件 | ✅ |
| 引入完整 Tailwind Preflight | ✅ |
| 需要操作 `document`/`window` | ✅ |
| 需要独立网络环境 | ✅ |
| 第一方/合作方插件 | ❌（使用 MF 嵌入） |

### 10.2 iframe 客户端

**文件路径**：`src/utils/iframeHostClient.ts`

```typescript
export const MF_IFRAME_CHANNEL = 'dnhyxc-mf-iframe';

type HostBridgeProps = {
	api: {
		t: (key: string, params?: Record<string, unknown>) => string;
		theme: 'light' | 'dark';
		event: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		http?: {
			get: <T = unknown>(url: string) => Promise<T>;
			post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
		};
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
		};
		modules?: Readonly<Record<string, unknown>>;
	};
	plugin: { id: string; version: string; routePath: string };
};

type Pending = {
	resolve: (v: unknown) => void;
	reject: (e: Error) => void;
};

function isRecord(v: unknown): v is Record<string, unknown> {
	return !!v && typeof v === 'object';
}

export function connectIframeHost(pluginId: string): Promise<HostBridgeProps> {
	if (window.parent === window) {
		return Promise.reject(new Error('embed 页须在 Host iframe 内打开'));
	}

	const pending = new Map<string, Pending>();
	let seq = 0;

	const rpc = (method: string, args: unknown[] = []) =>
		new Promise<unknown>((resolve, reject) => {
			const id = `r${++seq}`;
			pending.set(id, { resolve, reject });
			window.parent.postMessage(
				{ channel: MF_IFRAME_CHANNEL, type: 'rpc', id, method, args },
				'*',
			);
		});

	return new Promise((resolve, reject) => {
		let settled = false;
		const timeout = window.setTimeout(() => {
			teardown();
			if (!settled) {
				settled = true;
				reject(new Error('等待 Host init 超时'));
			}
		}, 15_000);

		const teardown = () => {
			window.clearTimeout(timeout);
			window.clearInterval(retry);
			window.removeEventListener('message', onMessage);
		};

		const onMessage = (ev: MessageEvent) => {
			const data = ev.data;
			if (!isRecord(data) || data.channel !== MF_IFRAME_CHANNEL) return;

			if (data.type === 'init') {
				window.clearInterval(retry);
				window.clearTimeout(timeout);
				const theme =
					data.theme === 'dark' || data.theme === 'light' ? data.theme : 'light';
				const plugin =
					isRecord(data.plugin) && typeof data.plugin.id === 'string'
						? {
								id: String(data.plugin.id),
								version: String(data.plugin.version ?? '0'),
								routePath: String(data.plugin.routePath ?? ''),
							}
						: { id: pluginId, version: '0', routePath: '' };

				document.documentElement.dataset.theme = theme;

				const bridge: HostBridgeProps = {
					api: {
						t: (k) => k,
						theme,
						event: { on: () => undefined, off: () => undefined, emit: () => undefined },
						http: {
							get: (url) => rpc('http.get', [url]) as Promise<never>,
							post: (url, body) => rpc('http.post', [url, body]) as Promise<never>,
						},
						ui: { showToast: (options) => void rpc('ui.showToast', [options]) },
						modules: {
							ebook: {
								getBookId: () => null,
								getBookTitle: () => null,
								navigateToCfi: (cfi) => rpc('ebook.navigateToCfi', [cfi]),
								openThought: (thought) => rpc('ebook.openThought', [thought]),
								closeIdeasList: () => rpc('ebook.closeIdeasList'),
							},
						},
					},
					plugin,
				};

				void (async () => {
					try {
						const [bookId, bookTitle] = await Promise.all([
							rpc('ebook.getBookId'),
							rpc('ebook.getBookTitle'),
						]);
						const ebook = bridge.api.modules!.ebook as {
							getBookId: () => string | null;
							getBookTitle: () => string | null;
						};
						ebook.getBookId = () =>
							typeof bookId === 'string' || bookId === null ? bookId : null;
						ebook.getBookTitle = () =>
							typeof bookTitle === 'string' || bookTitle === null ? bookTitle : null;
						if (!settled) {
							settled = true;
							resolve(bridge);
						}
					} catch (e) {
						teardown();
						if (!settled) {
							settled = true;
							reject(e instanceof Error ? e : new Error(String(e)));
						}
					}
				})();
				return;
			}

			if (data.type === 'rpc-result' && typeof data.id === 'string') {
				const p = pending.get(data.id);
				if (!p) return;
				pending.delete(data.id);
				if (data.ok) p.resolve(data.value);
				else p.reject(new Error(String(data.error ?? 'rpc failed')));
			}
		};

		const ping = () =>
			window.parent.postMessage(
				{ channel: MF_IFRAME_CHANNEL, type: 'ready', pluginId },
				'*',
			);

		window.addEventListener('message', onMessage);
		ping();
		const retry = window.setInterval(ping, 400);
	});
}
```

### 10.3 Embed 页面

**文件路径**：`src/views/embed/index.tsx`

```typescript
import { useEffect, useState, type ComponentType } from 'react';
import App from '@/App';
import { connectIframeHost } from '@/utils/iframeHostClient';

type Bridge = {
	api: {
		t: (key: string) => string;
		theme: 'light' | 'dark';
		http?: { get: <T>(url: string) => Promise<T>; post: <T>(url: string, body?: unknown) => Promise<T> };
		ui?: { showToast: (options: { message: string; type?: 'success' | 'error' | 'info' }) => void };
	};
	plugin: { id: string; version: string; routePath: string };
};

function applyBodyTheme(theme: 'light' | 'dark') {
	document.documentElement.classList.toggle('dark', theme === 'dark');
	document.body.classList.toggle('dark', theme === 'dark');
}

function EmbedShell({ pluginId, AppComponent }: { pluginId: string; AppComponent: ComponentType<Bridge> }) {
	const [bridge, setBridge] = useState<Bridge | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void connectIframeHost(pluginId)
			.then((b) => { if (!cancelled) setBridge(b as Bridge); })
			.catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
		return () => { cancelled = true; };
	}, [pluginId]);

	useEffect(() => {
		if (!bridge) return;
		applyBodyTheme(bridge.api.theme);
	}, [bridge]);

	if (error) {
		return <div className="text-destructive h-full p-3 text-sm">{error}</div>;
	}

	if (!bridge) {
		return <div className="text-textcolor/55 h-full p-3 text-sm">连接 Host…</div>;
	}

	return (
		<div className="h-full min-h-0">
			<AppComponent {...bridge} />
		</div>
	);
}

export function EmbedApp() {
	return <EmbedShell pluginId="myPlugin" AppComponent={App} />;
}
```

### 10.4 iframe 路由配置

**文件路径**：`src/router/routes.tsx`

```typescript
import { EmbedApp } from '@/views/embed';
import App from '@/App';
import { mockApi, mockPlugin } from '@/utils/mockHost';

export const routes = [
	{
		path: '/',
		element: (
			<App
				api={mockApi()}
				plugin={mockPlugin('myPlugin', '/my-plugin')}
			/>
		),
	},
	// Host iframeUrl 使用此路径
	{
		path: '/embed/my-plugin',
		element: <EmbedApp />,
	},
];
```

---

## 11. 调试技巧

### 11.1 开发环境调试

| 工具 | 用途 |
|------|------|
| Chrome DevTools | 断点调试、网络请求、Console |
| React DevTools | React 组件树、状态检查 |
| Network 面板 | 查看 `remoteEntry.js` 和模块加载 |
| Console | 查看 `pluginManager.list()` 输出 |

### 11.2 常用调试命令

```javascript
// 在 Host 控制台查看已加载插件
pluginManager.list().map(p => ({ id: p.meta.id, status: p.status }));

// 强制重新加载插件
await pluginManager.ensurePlugin('myPlugin', { force: true });

// 查看插件元数据
pluginManager.get('myPlugin')?.meta;

// 清除 Registry 缓存
localStorage.removeItem('dnhyxc.plugin.registry.dev.v1');
```

### 11.3 常见错误排查

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `Invalid hook call` | 双 React 问题 | 检查 `shared.singleton: true` 和 `optimizeDeps.exclude` |
| `Failed to resolve virtual:mf` | 缓存失效 | 删除 `node_modules/.vite` 或使用 `clearMfViteDepCachePlugin` |
| `Access-Control-Allow-Origin` | CORS 错误 | 检查 `server.cors` 和 Nginx 配置 |
| `missing default export` | 模块导出错误 | 确保组件有 `default` 导出 |
| `HOST_API` 版本不兼容 | API 版本冲突 | 更新 `hostApiRange` 或联系 Host 开发者 |

---

## 12. 发布流程

### 12.1 构建

```bash
# 设置生产环境 origin
VITE_REMOTE_PUBLIC_ORIGIN=https://your-domain.com:9005

# 构建
pnpm build
```

### 12.2 部署

将 `dist` 目录部署到静态服务器（如 Nginx）。

**Nginx 配置示例**：

```nginx
server {
	listen 9005 ssl;
	server_name your-domain.com;
	
	ssl_certificate /path/to/cert.pem;
	ssl_certificate_key /path/to/key.pem;
	
	location / {
		root /path/to/plugin-demo/dist;
		try_files $uri $uri/ /index.html;
		
		# CORS 配置
		add_header Access-Control-Allow-Origin "*";
		add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
		add_header Access-Control-Allow-Headers "Content-Type";
		
		if ($request_method = OPTIONS) {
			return 204;
		}
	}
}
```

### 12.3 Registry 注册

联系 Host 管理员添加 Registry 配置：

```json
{
	"id": "myPlugin",
	"titleKey": "plugin.myPlugin.title",
	"description": "我的插件",
	"routePath": "/my-plugin",
	"entry": "https://your-domain.com:9005/mf-manifest.json",
	"version": "1.0.0",
	"hostApiRange": "^1.0.0",
	"menu": {
		"order": 10,
		"icon": "Puzzle",
		"nameKey": "plugin.myPlugin.name"
	},
	"permissions": ["ui:toast", "http:plugin-api"],
	"enabled": true,
	"trust": "first-party"
}
```

---

## 13. 验收清单

### 13.1 功能验收

| 检查项 | 验收标准 |
|--------|---------|
| Vite 配置 | `shared.singleton: true`、`optimizeDeps.exclude` React |
| 组件导出 | 有 `default` 导出，接收 `HostBridgeProps` |
| 样式隔离 | 由 Host 侧自动处理，子项目无需手动配置，可直接用标准 Tailwind |
| API 使用 | 使用受限 API 前检查权限 |
| 独立预览 | 可通过 `pnpm dev` 独立运行 |
| Host 集成 | 可通过 Registry 加载并正常显示 |
| 路由导航 | 配置正确，可正常访问 |

### 13.2 安全验收

| 检查项 | 验收标准 |
|--------|---------|
| 信任等级 | 根据实际情况选择 `first-party`/`partner`/`untrusted` |
| 权限声明 | 只声明必要的权限 |
| CORS 配置 | 生产环境配置正确 |
| 无全局污染 | 不修改 `html`/`body` 全局样式 |

### 13.3 性能验收

| 检查项 | 验收标准 |
|--------|---------|
| 懒加载 | 首次进入页面时才加载 |
| 缓存策略 | 合理使用浏览器缓存 |
| 资源大小 | 打包产物大小合理 |

---

## 14. 常见问题

### Q1：为什么我的插件无法加载？

**可能原因**：
- `entry` URL 不正确
- CORS 配置错误
- `shared` 依赖版本不匹配
- 缺少 `default` 导出

**排查步骤**：
1. 检查 Console 是否有错误信息
2. 检查 Network 面板是否成功加载 `mf-manifest.json`
3. 检查 `remoteEntry.js` 是否可访问
4. 确认 Registry 配置正确

### Q2：为什么我的样式影响了 Host 页面？

**正常情况下不会。** Host 侧会自动将子项目的所有样式用 `@scope` 包裹，限制在插件容器内。

**如果确实发生了样式污染，可能原因**：
- 使用了跨域外链 CSS 且服务器未配置 CORS（Host 无法 fetch 内容进行 scoped 处理）
- 样式是通过非标准方式注入的（如直接修改 `document.styleSheets`）

**解决方案**：
- 尽量将 CSS 打包进 JS 中（Vite 默认行为），变成 style 标签注入
- 如果必须用外链 CSS，确保服务器配置了 CORS
- 详细原理见 [style-isolation-implementation.md](./style-isolation-implementation.md)

### Q3：如何在插件中使用 shadcn/ui？

**步骤**：
1. 在插件项目中初始化 shadcn：`pnpm dlx shadcn@latest init`
2. 添加组件：`pnpm dlx shadcn@latest add button`
3. 确保样式文件遵循样式隔离规范

### Q4：iframe 模式下如何调试？

**方法**：
1. 在 Chrome DevTools 中选择 iframe 上下文
2. 使用 `window.parent` 检查父窗口
3. 在 Console 中发送 `postMessage` 测试通信

### Q5：如何更新插件版本？

**步骤**：
1. 更新 `package.json` 中的版本号
2. 更新 Registry 中的 `version` 字段
3. 重新构建并部署
4. Host 会自动检测版本变化并重新加载

---

## 附录

### A. Host API 版本

当前 Host API 版本：`1.0.0`

### B. 参考文档

- [style-isolation-implementation.md](./style-isolation-implementation.md)：样式隔离实现手册（逐行注释）
- [style-isolation-tech-overview.md](./style-isolation-tech-overview.md)：样式隔离技术概览
- [mf-implementation-guide.md](./mf-implementation-guide.md)：实现过程文档
- [mf-css-isolation.md](../ideas/mf-css-isolation.md)：CSS 隔离方案思路
- [third-party-mf-plugin-onboarding.md](../ideas/third-party-mf-plugin-onboarding.md)：第三方插件接入指南

### C. 示例项目

参考 `apps/remote-plugins` 和 `apps/remote-demo` 作为开发模板。