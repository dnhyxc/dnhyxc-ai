/**
 * 插件 / 子应用开发手册（页面数据驱动）。
 * 与 docs/app/mf-plugins/plugin-development-guide.md 及现行 Host 契约对齐。
 * - 正文：标题 + description（视图层渲染）
 * - 代码：交给 ParserMarkdownPreviewPane 高亮
 */

export interface PluginGuideCode {
	lang:
		| 'typescript'
		| 'tsx'
		| 'javascript'
		| 'jsx'
		| 'bash'
		| 'json'
		| 'yaml'
		| 'nginx'
		| 'dotenv'
		| 'css'
		| 'vue'
		| 'markdown';
	/** 纯代码内容（不含 ``` 围栏） */
	code: string;
}

export interface PluginGuideBullet {
	id: string;
	title: string;
	dateLabel: string;
	description?: string;
	code?: PluginGuideCode;
}

export interface PluginGuideSection {
	id: string;
	title: string;
	items: PluginGuideBullet[];
}

const TODAY = '2026-08-08';

function item(
	id: string,
	title: string,
	description: string,
	code?: PluginGuideCode,
): PluginGuideBullet {
	return { id, title, dateLabel: TODAY, description, code };
}

/* ========================= 共用代码片段 ========================= */

const CODE_ENV = String.raw`# 与 Host registry entry 同源（React 示例常用 9008；Vue 示例常用 9009）
VITE_REMOTE_PUBLIC_ORIGIN=http://127.0.0.1:9008

# React 插件：指向 Host 开发服，供 React Refresh
VITE_REACT_REFRESH_HOST=http://127.0.0.1:9002`;

const CODE_REACT_DEPS = String.raw`mkdir my-react-plugin && cd my-react-plugin
pnpm init

pnpm add react react-dom
pnpm add -D vite @vitejs/plugin-react @module-federation/vite \
  typescript @types/node @types/react @types/react-dom \
  tailwindcss @tailwindcss/vite`;

const CODE_VUE_DEPS = String.raw`mkdir my-vue-plugin && cd my-vue-plugin
pnpm init

pnpm add vue vue-router
pnpm add -D vite @vitejs/plugin-vue @module-federation/vite \
  typescript @types/node vue-tsc \
  tailwindcss @tailwindcss/vite

# UI（可选，与样例 micro-vue 对齐）
pnpm add reka-ui class-variance-authority clsx tailwind-merge @vueuse/core @lucide/vue`;

const CODE_VITE_REACT = String.raw`import fs from 'node:fs';
import path from 'node:path';
import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** MF mf_owner id 递增后 .vite/deps 会失效，serve 时清缓存 */
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
const port = 9008;
const devOrigin = 'http://' + host + ':' + port;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const origin = env.VITE_REMOTE_PUBLIC_ORIGIN || devOrigin;
  const reactRefreshHost =
    env.VITE_REACT_REFRESH_HOST || 'http://127.0.0.1:9002';

  return {
    // 必须与 Host registry entry 同源
    base: origin + '/',
    plugins: [
      clearMfViteDepCache(),
      react({ reactRefreshHost }),
      tailwindcss(),
      federation({
        name: 'myReactPlugin', // 与 registry.remoteName 一致
        filename: 'remoteEntry.js',
        manifest: true,
        exposes: {
          // 每个 expose 入口内必须 import '@/styles.css'
          './App': './src/views/app/index.tsx',
        },
        shared: {
          // 勿 shared react-router；仅 react / react-dom
          react: { singleton: true, requiredVersion: '^19.1.0' },
          'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
        },
        hostInitInjectLocation: 'entry',
        dts: false,
        dev: { remoteHmr: true },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@ui': path.resolve(__dirname, 'src/components/ui'),
      },
    },
    optimizeDeps: {
      include: [], // 重依赖（如 @tiptap/*）建议 include，避免 HMR 整页 reload
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
      strictPort: true,
      origin: devOrigin,
      cors: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
    preview: { host, port, strictPort: true, cors: true },
    build: { target: 'esnext', modulePreload: false, minify: false },
  };
});`;

const CODE_VITE_VUE = String.raw`import fs from 'node:fs';
import path from 'node:path';
import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv, type Plugin } from 'vite';

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
const port = 9009;
const devOrigin = 'http://' + host + ':' + port;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const origin = env.VITE_REMOTE_PUBLIC_ORIGIN || devOrigin;

  return {
    base: origin + '/',
    plugins: [
      clearMfViteDepCache(),
      vue(),
      tailwindcss(),
      federation({
        name: 'microVue', // registry.remoteName
        filename: 'remoteEntry.js',
        manifest: true,
        exposes: {
          './StyleIsolationLab': './src/views/style-isolation-lab/index.ts',
        },
        shared: {
          // Vue 只 shared vue；勿在 Remote 自建 React 桥
          vue: { singleton: true, requiredVersion: '^3.5.0' },
        },
        hostInitInjectLocation: 'entry',
        dts: false,
        // 与 Host remoteHmr 配合；Vue 无 reactRefreshHost，靠 shared vue + Host HMR guard
        dev: { remoteHmr: true },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@ui': path.resolve(__dirname, 'src/components/ui'),
      },
      dedupe: ['vue'],
    },
    // 禁止预打包 vue，否则与 Host registerShared(vue) 拆成双实例，嵌入后 HMR 失效
    optimizeDeps: { exclude: ['vue'] },
    server: {
      host,
      port,
      strictPort: true,
      origin: devOrigin,
      cors: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
    preview: { host, port, strictPort: true, cors: true },
    build: { target: 'esnext', modulePreload: false, minify: false },
  };
});`;

const CODE_HOST_BRIDGE_TYPES = String.raw`/** 与 Host apps/frontend/src/plugins/core/types/index.ts 对齐的最小子集（无 api.t） */
export type HostLocale = 'zh-CN' | 'en-US';

export type HostBridgeProps = {
  api: {
    theme: 'light' | 'dark';
    locale: HostLocale;
    navigate?: (to: string) => void;
    event: {
      on: (event: string, handler: (data?: unknown) => void) => void;
      off: (event: string, handler: (data?: unknown) => void) => void;
      emit: (event: string, data?: unknown) => void;
    };
    http?: {
      get: <T = unknown>(url: string) => Promise<T>;
      post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
      put: <T = unknown>(url: string, body?: unknown) => Promise<T>;
      delete: <T = unknown>(url: string) => Promise<T>;
    };
    ui?: {
      showToast: (options: {
        message: string;
        type?: 'success' | 'error' | 'info' | 'warning';
        title?: string;
      }) => void;
      /** 应用级影院全屏（藏侧栏/顶栏）；需 ui:toast */
      setAppFullscreen?: (full: boolean) => Promise<void>;
      downloadBlob?: (options: {
        fileName: string;
        data: ArrayBuffer | Uint8Array;
        mimeType?: string;
      }) => Promise<{ ok: boolean; hostToasted: boolean; message?: string }>;
    };
    modules?: Readonly<Record<string, (...args: unknown[]) => unknown>>;
  };
  plugin: { id: string; version: string; routePath: string };
};`;

const CODE_REACT_EXPOSE = String.raw`// src/views/app/index.tsx —— MF expose 入口（Host 只加载这里，不跑 main.tsx）
import '@/styles.css';
export { default } from './App';
// 可选生命周期：拆到 lifecycle.ts，勿与频繁改动的组件同文件（Fast Refresh）
// export { activate, deactivate } from './lifecycle';`;

const CODE_REACT_APP = String.raw`// src/views/app/App.tsx
import { useHostLocale, useI18n } from '@/hooks';
import type { HostBridgeProps } from '@/types/host';

export default function App({ api, plugin }: HostBridgeProps) {
  const { t } = useI18n();
  useHostLocale(api); // 跟随 Host locale；独立预览无 locale 时无操作

  return (
    <div className="plugin-standalone h-full" data-plugin-root>
      <h1>
        {t('home.title')} · {plugin.id} v{plugin.version}
      </h1>
      <p>
        theme={api.theme} · locale={api.locale}
      </p>
      <button
        type="button"
        onClick={() =>
          api.ui?.showToast({ message: 'Hello from React plugin', type: 'success' })
        }
      >
        {t('common.toast')}
      </button>
    </div>
  );
}`;

const CODE_REACT_MAIN = String.raw`// src/main.tsx —— 仅独立预览；Host 嵌入时不会执行
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './views/app/App';
import { mockApi, mockPlugin } from '@/utils/mockHost';

const api = mockApi({
  ui: { showToast: (o) => console.info('[toast]', o.message) },
});
const plugin = mockPlugin('myReactPlugin', '/my-react-plugin', '1.0.0');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={api} plugin={plugin} />
  </StrictMode>,
);`;

const CODE_VUE_EXPOSE = String.raw`// src/views/style-isolation-lab/index.ts —— MF expose（Vue）
// Host 不装 Vue：须导出 mount(el, bridge)，勿直接 export SFC
import '@/styles.css';
import { createApp, reactive } from 'vue';
import App from './App.vue';
import type { HostBridgeProps } from '@/types/host';

export function mount(el: HTMLElement, bridge: HostBridgeProps) {
  // 同一 bridge 对象会被 Host 热更新 api/locale；用 reactive 包一层即可响应
  const app = createApp(App, { bridge: reactive(bridge) });
  app.mount(el);
  return () => app.unmount();
}

export default { mount };
// framework 由 registry "framework": "vue" 声明即可`;

const CODE_VUE_APP = String.raw`<!-- src/views/style-isolation-lab/App.vue -->
<script setup lang="ts">
import { computed, toRef } from 'vue';
import type { HostBridgeProps } from '@/types/host';

/**
 * Host createVueHostBridge 注入：props.bridge（reactive）
 * 注意：不是 React 那样的 { api, plugin } 顶层展开
 */
const props = defineProps<{ bridge: HostBridgeProps }>();
const bridge = toRef(props, 'bridge');
const theme = computed(() => bridge.value.api.theme);
const pluginId = computed(() => bridge.value.plugin.id);

function hostToast() {
  bridge.value.api.ui?.showToast?.({
    message: 'Hello from Vue plugin',
    type: 'info',
    title: 'micro-vue',
  });
}
</script>

<template>
  <div
    class="box-border flex h-full min-h-0 w-full flex-col gap-4 p-5.5"
    data-plugin-root
    :class="theme === 'dark' ? 'dark' : ''"
  >
    <h1 class="text-xl font-semibold">Vue 子应用 · {{ pluginId }}</h1>
    <button type="button" class="rounded-md border px-3 py-1.5" @click="hostToast">
      Host Toast
    </button>
    <!-- Tooltip / Dialog / Sheet 等可正常 Teleport→body；Host 会收编进 data-mf-portal-scope -->
  </div>
</template>`;

const CODE_VUE_MAIN = String.raw`// src/main.ts —— 仅独立预览
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './styles.css';

createApp(App).use(router).mount('#app');`;

const CODE_STYLES_CSS = String.raw`/* src/styles.css —— 可完整 @import tailwind（含 Preflight）；隔离由 Host @scope 负责 */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

#app,
#root,
[data-plugin-root] {
  height: 100%;
  min-height: 100%;
  width: 100%;
  background-color: var(--background);
  color: var(--foreground);
  font-family: ui-sans-serif, system-ui, sans-serif;
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0.02 264);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0.02 264);
  /* …其余 token 对齐 Host / apps/micro/src/styles.css */
}

.dark {
  --background: oklch(0.145 0.02 264);
  --foreground: oklch(0.985 0.002 247.839);
  /* … */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
}`;

const CODE_REGISTRY_REACT = String.raw`{
  "id": "myReactPlugin",
  "remoteName": "myReactPlugin",
  "expose": "./App",
  "title": {
    "zh-CN": "我的 React 插件",
    "en-US": "My React plugin"
  },
  "description": {
    "zh-CN": "React MF 子应用示例。",
    "en-US": "React Module Federation remote sample."
  },
  "routePath": "/my-react-plugin",
  "entry": "http://127.0.0.1:9008/mf-manifest.json",
  "version": "1.0.0",
  "hostApiRange": "^1.0.0",
  "injectRoute": true,
  "menu": { "order": 100, "icon": "Puzzle" },
  "permissions": ["ui:toast", "nav:subtree"],
  "preload": "route",
  "enabled": true,
  "trust": "first-party"
}`;

const CODE_REGISTRY_VUE = String.raw`{
  "id": "vueStyleIsolationLab",
  "remoteName": "microVue",
  "expose": "./StyleIsolationLab",
  "framework": "vue",
  "title": {
    "zh-CN": "Vue 样式实验室",
    "en-US": "Vue style lab"
  },
  "description": {
    "zh-CN": "Vue3 子应用：验收 Teleport 与 Host 样式隔离。",
    "en-US": "Vue3 remote for Teleport + Host CSS isolation."
  },
  "routePath": "/vue-style-lab",
  "entry": "http://127.0.0.1:9009/mf-manifest.json",
  "version": "1.0.0",
  "hostApiRange": "^1.0.0",
  "injectRoute": true,
  "menu": { "order": 102, "icon": "FlaskConical" },
  "permissions": ["ui:toast", "nav:subtree"],
  "preload": "route",
  "enabled": true,
  "trust": "first-party"
}`;

const CODE_API_USAGE = String.raw`export default function App({ api, plugin }: HostBridgeProps) {
  const onFetch = async () => {
    // ✅ 受限 API 使用前检查存在性（无权限时 Host 不注入该字段）
    if (!api.http) return;
    const data = await api.http.get('/api/plugin-data');
    console.log(data);
  };

  const onNav = () => {
    api.navigate?.(plugin.routePath + '/detail');
  };

  const onToast = () => {
    api.ui?.showToast({ message: 'ok', type: 'success' });
  };

  const onFullscreen = async () => {
    // 需 ui:toast；进出影院态成对调用，卸载时记得退出
    await api.ui?.setAppFullscreen?.(true);
  };

  return null;
}`;

const CODE_LIFECYCLE = String.raw`// lifecycle.ts —— 与组件文件分离
import type { HostBridgeProps } from '@/types/host';

export async function activate(api: HostBridgeProps['api']) {
  api.event.on('book-changed', (data) => {
    console.log('book-changed', data);
  });
  await api.http?.get('/api/init-data');
}

export async function deactivate() {
  // 清理订阅 / 定时器
}

// expose 入口：
// import '@/styles.css';
// export { default } from './App';
// export { activate, deactivate } from './lifecycle';`;

const CODE_USE_HOST_LOCALE = String.raw`// src/hooks/useHostLocale.ts
import { useEffect } from 'react';
import { applyHostLocale, isLocale, type Locale } from '@/i18n';

export function useHostLocale(api?: {
  locale?: Locale;
  event?: {
    on: (event: string, handler: (data?: unknown) => void) => void;
    off: (event: string, handler: (data?: unknown) => void) => void;
  };
}) {
  useEffect(() => {
    if (isLocale(api?.locale)) applyHostLocale(api.locale);
  }, [api?.locale]);

  useEffect(() => {
    const event = api?.event;
    if (!event) return;
    const onLocale = (data?: unknown) => {
      if (isLocale(data)) applyHostLocale(data);
    };
    event.on('locale', onLocale);
    return () => event.off('locale', onLocale);
  }, [api?.event]);
}`;

const CODE_UNTRUSTED = String.raw`{
  "id": "thirdPartyWidget",
  "title": { "zh-CN": "第三方小部件", "en-US": "Third-party widget" },
  "routePath": "/third-party-widget",
  "entry": "https://example.com/unused-for-iframe.json",
  "version": "1.0.0",
  "hostApiRange": "^1.0.0",
  "permissions": ["ui:toast"],
  "enabled": true,
  "trust": "untrusted",
  "iframeUrl": "http://127.0.0.1:9008/embed/my-page"
}`;

const CODE_NGINX = String.raw`server {
  listen 9008;
  server_name _;
  root /path/to/plugin/dist;
  location / {
    try_files $uri $uri/ /index.html;
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
    add_header Cache-Control "no-store";
  }
}`;

const CODE_TREE = String.raw`my-plugin/
├── src/
│   ├── main.tsx / main.ts     # 仅独立预览
│   ├── styles.css             # Tailwind + token（expose 也要 import）
│   ├── types/host.ts          # HostBridgeProps 最小类型
│   ├── views/
│   │   └── app/
│   │       ├── index.tsx      # MF expose：import styles + export default
│   │       └── App.tsx / App.vue
│   ├── hooks/                 # useI18n / useHostLocale（React）
│   ├── i18n/                  # 插件自有字典（无 api.t）
│   ├── utils/mockHost.ts      # 独立预览 mock
│   └── components/ui/         # 可选 shadcn / shadcn-vue
├── vite.config.ts
├── package.json
└── .env`;

/* ========================= 中文 ========================= */

const introZh =
	'阅读对象：为本平台开发 React / Vue Module Federation 子应用（插件）的前端开发者。\n\n' +
	'目标：从零搭好工程、正确导出 expose、配置 Registry，并在 Host 内获得与独立预览一致的样式（含 Tooltip / Dialog / Teleport）。\n\n' +
	'参考实现：\n' +
	'• React：仓库内 apps/micro（端口 9008，federation name 可为 micro / remotePlugins）\n' +
	'• Vue：仓外 micro-vue 样例（端口 9009，name: microVue，registry framework: vue）\n' +
	'• 更细的源码级说明见 Host 仓库 apps/frontend/src/plugins/docs/plugin-development-guide.md\n\n' +
	'更新日期：' +
	TODAY;

const sectionsZh: PluginGuideSection[] = [
	{
		id: 'arch',
		title: '1. 架构与加载模型',
		items: [
			item(
				'arch-roles',
				'1.1 角色分工',
				'• Host（apps/frontend）：拉 Registry、registerRemotes、loadRemote、注入路由/侧栏、挂载 PluginHostPage、运行时 CSS @scope 隔离、Portal/Teleport 收编。\n' +
					'• Remote（子应用）：Vite + @module-federation/vite 暴露模块；业务只关心 default 导出与权限内的 HostBridge API。\n' +
					'• Registry（plugins-registry.json）：声明 id / entry / expose / remoteName / framework / permissions / trust 等；改标题文案只改 registry，不必改 Host 语言包。',
			),
			item(
				'arch-trust',
				'1.2 信任等级与嵌入方式',
				'• first-party / partner：Module Federation 嵌入；Host 用 @scope([data-mf-style-realm]) 隔离 CSS；Portal（React createPortal）与 Vue Teleport（body 挂载）由 Host 收编到 [data-mf-portal-scope]。\n' +
					'• untrusted：iframe + postMessage；样式天然隔离；须配置 iframeUrl（开发可用 localhost http，生产须 https）。\n' +
					'权限由 Host 按 registry.permissions 注入：未声明的能力在 bridge 上为 undefined，调用前必须可选链/判空。',
			),
			item(
				'arch-flow',
				'1.3 加载流程（MF）',
				'1. Host PluginManager.init() 拉取 Registry（可有本地启用覆盖）。\n' +
					'2. injectRoute !== false 时注入顶层路由与侧栏 icon。\n' +
					'3. 进入插件路由 → ensurePlugin → GET 一次 mf-manifest.json 算 bust（version@manifestHash）→ 加载 remoteEntry.js?v=…。\n' +
					'4. loadRemote(expose) 得到原始模块 → normalizePluginModule：\n' +
					'   • React：default 即组件；\n' +
					'   • Vue：registry.framework === "vue" → createVueHostBridge 调用 Remote.mount(el, bridge)。\n' +
					'5. PluginHostPage 渲染带 data-mf-plugin + data-mf-style-realm 的根，并 attachPluginStyleIsolation（CSS 捕获 + Portal 桥）。\n' +
					'6. 可选调用 activate；卸载时 deactivate + 释放隔离。',
			),
			item(
				'arch-tree',
				'1.4 推荐目录结构',
				'一仓可多 expose（如 apps/micro）。每个 expose 对应 views 下独立入口。',
				{ lang: 'markdown', code: CODE_TREE },
			),
		],
	},
	{
		id: 'init',
		title: '2. 环境与项目初始化',
		items: [
			item(
				'init-tools',
				'2.1 工具版本',
				'• Node.js ≥ 20\n• pnpm ≥ 8\n• Host 开发服默认常见端口 9002；Remote 示例 9007（demo）/ 9008（React micro）/ 9009（Vue）——勿与 Host 冲突。\n• MF 插件用 @module-federation/vite（不是旧的 @originjs/vite-plugin-federation）。',
			),
			item(
				'init-env',
				'2.2 环境变量 .env',
				'VITE_REMOTE_PUBLIC_ORIGIN 必须与 registry 的 entry 同源（含协议/主机/端口），并与 vite base 一致。',
				{ lang: 'dotenv', code: CODE_ENV },
			),
			item(
				'init-react-deps',
				'2.3 初始化 React 子应用依赖',
				'与 Host 共用 React 大版本（当前示例 ^19）。shared 仅 singleton react / react-dom。',
				{ lang: 'bash', code: CODE_REACT_DEPS },
			),
			item(
				'init-vue-deps',
				'2.4 初始化 Vue 子应用依赖',
				'Host 不装 Vue：Remote 自带 vue，expose 导出 mount(el, bridge)（或 { mount }）。勿自建 React 桥；vue 不必与 Host shared。',
				{ lang: 'bash', code: CODE_VUE_DEPS },
			),
		],
	},
	{
		id: 'vite-react',
		title: '3. React：Vite + Module Federation',
		items: [
			item(
				'vite-react-full',
				'3.1 完整 vite.config.ts（React）',
				'必选核对：base；federation.name / filename / manifest / exposes；shared.react|react-dom.singleton；hostInitInjectLocation: "entry"；optimizeDeps.exclude React；server.cors + ACAO；build.modulePreload: false。\n勿 shared react-router。',
				{ lang: 'typescript', code: CODE_VITE_REACT },
			),
			item(
				'vite-react-checklist',
				'3.2 React Vite 检查表',
				'• base 与 registry entry 同源\n' +
					'• name ↔ remoteName；expose 路径 ↔ registry.expose\n' +
					'• 每个 exposes 指向的文件内 import styles.css\n' +
					'• 开发：先起 Remote，再在 Host 打开插件路由\n' +
					'• Invalid hook call → 双 React：查 singleton / 清 node_modules/.vite / 勿在插件内再 createRoot',
			),
		],
	},
	{
		id: 'vite-vue',
		title: '4. Vue：Vite + Module Federation',
		items: [
			item(
				'vite-vue-full',
				'4.1 完整 vite.config.ts（Vue）',
				'与 React 差异：plugin-vue；shared 只配 vue；optimizeDeps.exclude vue；无 reactRefreshHost（靠 Host registerShared(vue)+HMR guard）。expose 指向 index.ts（再 export App.vue）。',
				{ lang: 'typescript', code: CODE_VITE_VUE },
			),
			item(
				'vite-vue-rules',
				'4.2 Vue Remote 硬性约定',
				'1. Registry 必须写 "framework": "vue"（Host normalizePluginModule 优先读该字段）。\n' +
					'2. expose default 须为 mount(el, bridge) 或 { mount }（Host 不 createApp）；不必再 export framework。\n' +
					'3. 禁止在 Remote 内自建 React 桥；Vue 的 createApp 只写在 Remote mount 里。\n' +
					'4. 根组件接收 props.bridge（reactive HostBridgeProps），不是顶层展开的 api/plugin。\n' +
					'5. Teleport→body 的弹层：不要手写 container；Host body 原型 patch 会收编进同 realm 的 portal-scope。\n' +
					'6. 同样：每个 expose 入口 import "@/styles.css"。',
			),
		],
	},
	{
		id: 'react-impl',
		title: '5. React 插件实现',
		items: [
			item(
				'react-types',
				'5.1 HostBridgeProps（复制到子项目）',
				'Host 不提供 api.t。插件自维护 i18n，只跟随 api.locale。权限不足时 http / ui / navigate 可能为 undefined。',
				{ lang: 'typescript', code: CODE_HOST_BRIDGE_TYPES },
			),
			item(
				'react-expose',
				'5.2 expose 入口（必须 import styles）',
				'Host 只 loadRemote(expose)，不会执行 main.tsx。漏掉 styles → 独立预览正常、嵌入后 Tooltip/菜单「裸奔」。',
				{ lang: 'tsx', code: CODE_REACT_EXPOSE },
			),
			item(
				'react-app',
				'5.3 根组件 App.tsx',
				'default 导出 React 组件；根节点建议 data-plugin-root + plugin-standalone。Host 还会再包一层 data-mf-plugin / data-mf-style-realm。独立路由页若 Host 已套 PluginPageShell，勿再叠同等外层 padding。',
				{ lang: 'tsx', code: CODE_REACT_APP },
			),
			item(
				'react-main',
				'5.4 独立预览 main.tsx',
				'mockApi 可不传 locale，便于本地切语言。嵌入 Host 时此文件完全不跑。',
				{ lang: 'tsx', code: CODE_REACT_MAIN },
			),
			item(
				'react-api',
				'5.5 调用 Host API（权限安全）',
				'常用：api.ui.showToast / setAppFullscreen / downloadBlob（需 ui:toast）；api.navigate（nav:subtree）；api.http.*（http:plugin-api）；api.modules.*（modules:*）。',
				{ lang: 'tsx', code: CODE_API_USAGE },
			),
			item(
				'react-lifecycle',
				'5.6 生命周期 activate / deactivate',
				'可选。勿与频繁改动的组件同文件导出空钩子（会打断 Fast Refresh / Host import）。有副作用时拆 lifecycle.ts。',
				{ lang: 'typescript', code: CODE_LIFECYCLE },
			),
		],
	},
	{
		id: 'vue-impl',
		title: '6. Vue 插件实现',
		items: [
			item(
				'vue-bridge-model',
				'6.1 Host 如何挂载 Vue',
				'loadRemote → normalizePluginModule（framework: vue）→ createVueHostBridge(mount)：\n' +
					'• React 渲染 div[data-plugin-root][data-mf-framework=vue]，再调用 Remote.mount(el, bridge)\n' +
					'• createApp(VueRoot, { bridge: reactiveProps }).mount(el)\n' +
					'• bridge.api / bridge.plugin 热更新时写入同一 reactive 对象\n' +
					'因此 Vue 根必须 defineProps<{ bridge: HostBridgeProps }>()，用 toRef/computed 读字段。',
			),
			item(
				'vue-types',
				'6.2 类型（与 React 同一套 HostBridgeProps）',
				'可把 5.1 的类型放到 src/types/host.ts 共用。Vue 只是消费方式变为 props.bridge。',
				{ lang: 'typescript', code: CODE_HOST_BRIDGE_TYPES },
			),
			item(
				'vue-expose',
				'6.3 expose 入口 index.ts',
				'务必 import styles；只 re-export App.vue。',
				{ lang: 'typescript', code: CODE_VUE_EXPOSE },
			),
			item(
				'vue-app',
				'6.4 根组件 App.vue 示例',
				'弹层组件（Tooltip/Popover/Dialog/Sheet/ContextMenu/Sonner）可按 shadcn-vue 正常写 Teleport。验收时在 DevTools 看弹层是否落在 [data-mf-portal-scope] 且带同一 data-mf-style-realm。',
				{ lang: 'vue', code: CODE_VUE_APP },
			),
			item(
				'vue-main',
				'6.5 独立预览 main.ts + 路由',
				'独立预览可用 vue-router 挂实验室页，并向 App 传入 mock bridge（形状与 Host 一致）。Host 嵌入时不会走 main。',
				{ lang: 'typescript', code: CODE_VUE_MAIN },
			),
			item(
				'vue-donts',
				'6.6 Vue 常见错误',
				'• 只在 main.ts import styles → Host 内无 utility（箭头在、气泡没了；Context Menu 字体错乱）\n' +
					'• registry 漏 framework: vue → 可能被当成 React 渲染而白屏\n' +
					'• Remote 自建 React 桥 + shared react → 与 Host 方案冲突、体积翻倍\n' +
					'• 在业务里手写 data-mf-style-realm / portal container → 干扰 Host 认领\n' +
					'• 根 props 写成 { api, plugin } 顶层 —— Host 传的是 { bridge }',
			),
		],
	},
	{
		id: 'styles',
		title: '7. 样式、隔离与悬浮层',
		items: [
			item(
				'styles-model',
				'7.1 Host 隔离模型（插件零侵入）',
				'• first-party/partner：Remote 可正常 @import "tailwindcss"（含 Preflight）。Host 把注入 CSS 包进 @scope([data-mf-style-realm="…"])；同 Remote 多 expose 共享 realm。\n' +
					'• 勿再给 Tailwind 强行加 hp- 前缀、勿为「防污染」关掉 Preflight（旧文档已过时）。\n' +
					'• Portal/Drawer/POP：不要为 MF 特传 getPopupContainer；Host 劫持 createPortal + body 原型挂载（覆盖 Vue Teleport）。\n' +
					'• 独立预览正常、仅嵌入后 backdrop-filter 失效 → 查 Host PluginPageShell/Layout 是否在圆角同层 overflow-hidden，不是插件 CSS 写错。',
			),
			item(
				'styles-expose',
				'7.2 【关键】每个 expose 必须 import styles.css',
				'• main.ts / main.tsx 里的 import "./styles.css"：仅独立预览执行；嵌入 Host 时不跑。\n' +
					'• expose 入口里的 import "@/styles.css"：随 Remote 模块注入，嵌入 Host 时必须有。\n' +
					'• 一仓多 expose：每个入口都要写（可重复 import）。\n' +
					'漏写典型症状：独立预览正常；Host 内 Tooltip 只剩文字/箭头、Context Menu 字体错乱。',
			),
			item(
				'styles-file',
				'7.3 styles.css 示例',
				'token / @theme 建议对齐 apps/micro/src/styles.css。嵌入时部分变量可继承 Host :root。',
				{ lang: 'css', code: CODE_STYLES_CSS },
			),
			item(
				'styles-portal',
				'7.4 悬浮层验收清单',
				'打开 Tooltip / Dialog / Context Menu / Sheet / Sonner 后：\n' +
					'1. utility 与背景色仍正常（未被剥光，也不污染 Host）\n' +
					'2. DevTools：弹层在 [data-mf-portal-scope="pluginId"] 内，且 data-mf-style-realm 与插件根一致\n' +
					'3. 插件内 Sonner 不顶开 Host 布局；Host Toast 仍 fixed\n' +
					'4. 勿手写 data-mf-* 业务标记',
			),
		],
	},
	{
		id: 'i18n',
		title: '8. 插件内 i18n 与 Host locale',
		items: [
			item(
				'i18n-rules',
				'8.1 规则',
				'• Host 不注入 api.t。\n' +
					'• 插件自建字典（src/i18n + useI18n）。\n' +
					'• MF：props api.locale + event.on("locale")；用 useHostLocale(api)。\n' +
					'• 独立预览：URL ?lang= / 本地 storage；mock 可不传 locale。\n' +
					'• iframe：init.locale + postMessage type:"locale"。\n' +
					'• storage key 与 Host 隔离（勿占用 Host 的 locale key）。',
			),
			item(
				'i18n-hook',
				'8.2 useHostLocale（React）',
				'Vue 侧可用 watch(() => bridge.api.locale, …) + 监听 bridge.api.event 的 locale 事件，语义相同。',
				{ lang: 'typescript', code: CODE_USE_HOST_LOCALE },
			),
		],
	},
	{
		id: 'perm',
		title: '9. 权限与 Registry 字段',
		items: [
			item(
				'perm-list',
				'9.1 权限列表',
				'• ui:toast — showToast / setAppFullscreen / downloadBlob\n' +
					'• nav:subtree — api.navigate\n' +
					'• http:plugin-api — api.http.*\n' +
					'• modules:chat — 聊天模块\n' +
					'• modules:ebook — 电子书模块\n' +
					'原则：最小权限；用前判空。',
			),
			item(
				'registry-react',
				'9.2 React 插件 Registry 示例',
				'不要写 titleKey / descriptionKey / menu.nameKey。menu 仅 order + icon（侧栏不展示文字）。hostApiRange 须覆盖 Host 的 VITE_HOST_API_VERSION（默认 1.0.0），勿与插件 version 混淆。',
				{ lang: 'json', code: CODE_REGISTRY_REACT },
			),
			item(
				'registry-vue',
				'9.3 Vue 插件 Registry（必须 framework）',
				'framework: "vue" 为上架硬性要求。remoteName 对齐 vite federation.name；expose 对齐 exposes 键。',
				{ lang: 'json', code: CODE_REGISTRY_VUE },
			),
			item(
				'registry-fields',
				'9.4 字段速查',
				'• id — 唯一；侧栏/路由内部键\n' +
					'• remoteName — MF 容器名；多插件共 Remote 时填同一 name\n' +
					'• expose — 如 "./App" / "./StyleIsolationLab"\n' +
					'• framework — "vue" | "react"（可省略，默认按 React；Vue 必填 vue）\n' +
					'• entry — …/mf-manifest.json\n' +
					'• routePath / injectRoute / menu / permissions / preload / trust / iframeUrl\n' +
					'• host — 业务页自动挂载（如 ebook.read drawer/toolbar）\n' +
					'发版：部署新产物即可；Host 用 manifest 指纹 bust，不必为刷缓存改 registry updatedAt。',
			),
			item('registry-untrusted', '9.5 untrusted（iframe）示例', '', {
				lang: 'json',
				code: CODE_UNTRUSTED,
			}),
		],
	},
	{
		id: 'preview-deploy',
		title: '10. 预览、部署与调试',
		items: [
			item(
				'preview',
				'10.1 本地联调顺序',
				'1. pnpm dev 启动 Remote（确认 /mf-manifest.json 可访问）\n' +
					'2. 启动 Host；Registry 指向该 entry 且 enabled\n' +
					'3. 侧栏进入插件路由\n' +
					'4. Network：进入插件应主要看到 1 条 mf-manifest.json + remoteEntry.js?v=\n' +
					'5. 独立预览：React 开 main 路由；Vue 开实验室 path',
			),
			item(
				'deploy',
				'10.2 构建与静态托管',
				'pnpm build → 托管 dist；CORS 放开；建议 Cache-Control: no-store（配合 Host bust）。',
				{ lang: 'nginx', code: CODE_NGINX },
			),
			item(
				'debug',
				'10.3 调试要点',
				'• 双 React / Invalid hook call：shared singleton + 清 .vite + 勿二次 createRoot\n' +
					'• CORS：server.cors + ACAO\n' +
					'• Module ./X does not exist：线上未部署含该 expose 的构建\n' +
					'• 样式进 Host 却污染：查是否绕过 head 注入；Host sonner 应有 data-mf-host-style 保护\n' +
					'• 嵌入无样式：expose 是否 import styles.css\n' +
					'• Vue 白屏：registry framework: vue\n' +
					'• 语言不跟随：useHostLocale / watch bridge.api.locale',
			),
		],
	},
	{
		id: 'checklist',
		title: '11. 验收清单',
		items: [
			item(
				'checklist-all',
				'11.1 上线前核对',
				'【工程】\n' +
					'□ @module-federation/vite；manifest: true；hostInitInjectLocation: entry\n' +
					'□ React：shared 仅 react/react-dom singleton；Vue：shared 仅 vue singleton\n' +
					'□ 每个 expose 入口 import "@/styles.css"\n\n' +
					'【组件】\n' +
					'□ default 导出；React 收 {api,plugin}；Vue 收 props.bridge\n' +
					'□ 根 data-plugin-root；无空 activate 与组件同文件\n' +
					'□ 自有 i18n；无 api.t\n\n' +
					'【Registry】\n' +
					'□ title/description locale map；hostApiRange 正确\n' +
					'□ Vue：framework: "vue"\n' +
					'□ permissions 最小集；trust/iframeUrl 匹配\n\n' +
					'【体验】\n' +
					'□ 独立预览与 Host 嵌入样式一致（含悬浮层）\n' +
					'□ Host Toast 不被插件样式顶开\n' +
					'□ 若用影院全屏：成对 setAppFullscreen，卸载退出',
			),
		],
	},
	{
		id: 'faq',
		title: '12. 常见问题',
		items: [
			item(
				'faq-styles-host',
				'12.1 独立预览正常，嵌进 Host 后 Tooltip / 菜单没样式？',
				'先查 expose 入口是否 import "@/styles.css"。再查弹层是否在 [data-mf-portal-scope] + 同 style-realm。',
			),
			item(
				'faq-vue-blank',
				'12.2 Vue 插件白屏 / 被当成 React？',
				'registry 写 "framework": "vue"；Remote 导出 mount(el, bridge)；不要自建 React 桥；Host 不装 vue。',
			),
			item(
				'faq-pollute',
				'12.3 样式污染了 Host？',
				'first-party 下应由 Host @scope。仍污染则查是否绕过 head 注入、或 untrusted 误配成 MF。不要用旧的「关 Preflight / 加 prefix」当主方案。',
			),
			item(
				'faq-backdrop',
				'12.4 仅嵌入后毛玻璃失效？',
				'查 Host PluginPageShell / Layout：圆角容器同层不要 overflow-hidden（会废掉子树 backdrop-filter）。',
			),
			item(
				'faq-cache',
				'12.5 发版后 Host 仍旧包？',
				'确认已部署新 dist；Host 会读 Remote 自己的 mf-manifest.json 算指纹。不必为刷缓存去改 Host registry updatedAt。桌面壳需含 bust 逻辑的版本。',
			),
		],
	},
];

/* ========================= English ========================= */

const introEn =
	'Audience: frontend developers building React / Vue Module Federation remotes (plugins) for this host.\n\n' +
	'Goal: scaffold the project, export exposes correctly, register in the Host registry, and get Host-embedded styling (including Tooltip / Dialog / Teleport) that matches standalone preview.\n\n' +
	'References:\n' +
	'• React: apps/micro in this monorepo (port 9008)\n' +
	'• Vue: micro-vue sample (port 9009, framework: "vue" in registry)\n' +
	'• Deep dive: apps/frontend/src/plugins/docs/plugin-development-guide.md\n\n' +
	'Updated: ' +
	TODAY;

const sectionsEn: PluginGuideSection[] = [
	{
		id: 'arch',
		title: '1. Architecture & loading',
		items: [
			item(
				'arch-roles',
				'1.1 Roles',
				'• Host (apps/frontend): registry, registerRemotes, loadRemote, routes/sidebar, PluginHostPage, runtime @scope CSS isolation, Portal/Teleport retargeting.\n' +
					'• Remote: Vite + @module-federation/vite exposes; you own default export + HostBridge APIs allowed by permissions.\n' +
					'• Registry (plugins-registry.json): id / entry / expose / remoteName / framework / permissions / trust. Copy changes only need registry edits—not Host i18n keys.',
			),
			item(
				'arch-trust',
				'1.2 Trust levels',
				'• first-party / partner: MF embed; Host scopes CSS with @scope([data-mf-style-realm]); React createPortal + Vue Teleport(to body) are retargeted into [data-mf-portal-scope].\n' +
					'• untrusted: iframe + postMessage; set iframeUrl (https in prod).\n' +
					'Missing permissions ⇒ bridge fields undefined—always optional-chain.',
			),
			item(
				'arch-flow',
				'1.3 MF load flow',
				'1. PluginManager.init() fetches registry.\n' +
					'2. Routes/sidebar injected when injectRoute !== false.\n' +
					'3. ensurePlugin → one GET mf-manifest.json → bust version@manifestHash → remoteEntry.js?v=.\n' +
					'4. loadRemote → normalizePluginModule (React default, or Vue via createVueHostBridge when framework is "vue").\n' +
					'5. PluginHostPage sets data-mf-plugin + data-mf-style-realm and attachPluginStyleIsolation.\n' +
					'6. Optional activate / deactivate.',
			),
			item(
				'arch-tree',
				'1.4 Suggested layout',
				'One repo may expose many modules (see apps/micro).',
				{ lang: 'markdown', code: CODE_TREE },
			),
		],
	},
	{
		id: 'init',
		title: '2. Environment & scaffolding',
		items: [
			item(
				'init-tools',
				'2.1 Tooling',
				'Node ≥ 20, pnpm ≥ 8. Use @module-federation/vite (not legacy @originjs/vite-plugin-federation). Typical ports: Host 9002, React remote 9008, Vue remote 9009.',
			),
			item(
				'init-env',
				'2.2 .env',
				'VITE_REMOTE_PUBLIC_ORIGIN must match registry entry origin and vite base.',
				{ lang: 'dotenv', code: CODE_ENV },
			),
			item(
				'init-react-deps',
				'2.3 React dependencies',
				'Share React major with Host; shared singletons: react + react-dom only.',
				{ lang: 'bash', code: CODE_REACT_DEPS },
			),
			item(
				'init-vue-deps',
				'2.4 Vue dependencies',
				'Host has no Vue. Remote owns vue + exports mount(el, bridge). No homemade React bridge.',
				{ lang: 'bash', code: CODE_VUE_DEPS },
			),
		],
	},
	{
		id: 'vite-react',
		title: '3. React: Vite + Module Federation',
		items: [
			item(
				'vite-react-full',
				'3.1 Full vite.config.ts (React)',
				'Must-haves: base; name/filename/manifest/exposes; react|react-dom singleton; hostInitInjectLocation: "entry"; optimizeDeps.exclude React; CORS; modulePreload: false. Do not share react-router.',
				{ lang: 'typescript', code: CODE_VITE_REACT },
			),
			item(
				'vite-react-checklist',
				'3.2 React Vite checklist',
				'• base ↔ registry entry\n• name ↔ remoteName; expose path ↔ registry.expose\n• Every expose file imports styles.css\n• Start remote before opening the plugin in Host\n• Invalid hook call ⇒ duplicate React',
			),
		],
	},
	{
		id: 'vite-vue',
		title: '4. Vue: Vite + Module Federation',
		items: [
			item(
				'vite-vue-full',
				'4.1 Full vite.config.ts (Vue)',
				'plugin-vue; shared.vue only; expose an index.ts that re-exports App.vue.',
				{ lang: 'typescript', code: CODE_VITE_VUE },
			),
			item(
				'vite-vue-rules',
				'4.2 Hard rules for Vue remotes',
				'1. Registry MUST set "framework": "vue".\n' +
					'2. Export Vue default only—no required export const framework when registry has it.\n' +
					'3. Never build a React bridge inside the remote.\n' +
					'4. Root props: bridge: HostBridgeProps (reactive), not top-level {api, plugin}.\n' +
					'5. Do not custom-target Teleport containers; Host retargets body mounts.\n' +
					'6. Every expose imports "@/styles.css".',
			),
		],
	},
	{
		id: 'react-impl',
		title: '5. Implementing a React plugin',
		items: [
			item(
				'react-types',
				'5.1 HostBridgeProps',
				'No api.t. Maintain your own i18n; follow api.locale. Guard optional APIs.',
				{ lang: 'typescript', code: CODE_HOST_BRIDGE_TYPES },
			),
			item(
				'react-expose',
				'5.2 Expose entry (must import styles)',
				'Host only loads the expose module—not main.tsx. Missing CSS ⇒ overlays look unstyled only when embedded.',
				{ lang: 'tsx', code: CODE_REACT_EXPOSE },
			),
			item(
				'react-app',
				'5.3 App.tsx',
				'Default-export a component; prefer data-plugin-root. Host adds data-mf-plugin / data-mf-style-realm. Avoid double padding if PluginPageShell wraps the route.',
				{ lang: 'tsx', code: CODE_REACT_APP },
			),
			item('react-main', '5.4 Standalone main.tsx', 'For local preview only.', {
				lang: 'tsx',
				code: CODE_REACT_MAIN,
			}),
			item(
				'react-api',
				'5.5 Calling Host APIs safely',
				'ui:toast / nav:subtree / http:plugin-api / modules:* — check before use.',
				{ lang: 'tsx', code: CODE_API_USAGE },
			),
			item(
				'react-lifecycle',
				'5.6 activate / deactivate',
				'Optional. Keep hooks out of hot component files (Fast Refresh).',
				{ lang: 'typescript', code: CODE_LIFECYCLE },
			),
		],
	},
	{
		id: 'vue-impl',
		title: '6. Implementing a Vue plugin',
		items: [
			item(
				'vue-bridge-model',
				'6.1 How Host mounts Vue',
				'normalizePluginModule → createVueHostBridge: React mounts a div, then Remote.mount(el, bridge). Remote createApp + reactive(bridge).',
			),
			item(
				'vue-types',
				'6.2 Types',
				'Same HostBridgeProps as React; consume via props.bridge.',
				{ lang: 'typescript', code: CODE_HOST_BRIDGE_TYPES },
			),
			item(
				'vue-expose',
				'6.3 Expose index.ts',
				'Import styles; re-export App.vue.',
				{ lang: 'typescript', code: CODE_VUE_EXPOSE },
			),
			item(
				'vue-app',
				'6.4 App.vue sample',
				'Use normal Teleport overlays; verify [data-mf-portal-scope] + matching style-realm in DevTools.',
				{ lang: 'vue', code: CODE_VUE_APP },
			),
			item(
				'vue-main',
				'6.5 Standalone main.ts',
				'Host never runs this file when embedded.',
				{ lang: 'typescript', code: CODE_VUE_MAIN },
			),
			item(
				'vue-donts',
				'6.6 Common Vue mistakes',
				'• styles only in main.ts\n• missing registry framework: "vue"\n• homemade React bridge\n• hand-written data-mf-* / portal containers\n• expecting top-level {api, plugin} props',
			),
		],
	},
	{
		id: 'styles',
		title: '7. Styles, isolation & overlays',
		items: [
			item(
				'styles-model',
				'7.1 Host isolation (zero remote invasion)',
				'Full Tailwind + Preflight is OK for first-party/partner. Host wraps injected CSS in @scope([data-mf-style-realm]). Do not rely on legacy "Tailwind prefix / disable Preflight" advice. Do not pass custom portal containers for MF.',
			),
			item(
				'styles-expose',
				'7.2 CRITICAL: import styles in every expose',
				'main.ts(x) CSS runs only in standalone preview. Expose-entry import runs when Host loads the remote. Multi-expose repos: import in each entry.',
			),
			item(
				'styles-file',
				'7.3 styles.css sample',
				'Align tokens with apps/micro/src/styles.css.',
				{ lang: 'css', code: CODE_STYLES_CSS },
			),
			item(
				'styles-portal',
				'7.4 Overlay acceptance',
				'Tooltip/Dialog/ContextMenu/Sheet/Sonner keep utilities; nodes sit under [data-mf-portal-scope]; Host toaster stays fixed; do not invent data-mf-* in business UI.',
			),
		],
	},
	{
		id: 'i18n',
		title: '8. Plugin i18n & Host locale',
		items: [
			item(
				'i18n-rules',
				'8.1 Rules',
				'No api.t. Own dictionaries. MF: api.locale + event "locale". Standalone: ?lang= / local storage. Isolate storage keys from Host.',
			),
			item(
				'i18n-hook',
				'8.2 useHostLocale (React)',
				'Vue: watch bridge.api.locale + event.on("locale").',
				{ lang: 'typescript', code: CODE_USE_HOST_LOCALE },
			),
		],
	},
	{
		id: 'perm',
		title: '9. Permissions & registry fields',
		items: [
			item(
				'perm-list',
				'9.1 Permissions',
				'ui:toast, nav:subtree, http:plugin-api, modules:chat, modules:ebook — least privilege; null-check APIs.',
			),
			item(
				'registry-react',
				'9.2 React registry sample',
				'No titleKey/descriptionKey/menu.nameKey. hostApiRange covers Host VITE_HOST_API_VERSION—not plugin version.',
				{ lang: 'json', code: CODE_REGISTRY_REACT },
			),
			item(
				'registry-vue',
				'9.3 Vue registry (framework required)',
				'Set framework: "vue". Align remoteName/expose with vite config.',
				{ lang: 'json', code: CODE_REGISTRY_VUE },
			),
			item(
				'registry-fields',
				'9.4 Field cheat-sheet',
				'id, remoteName, expose, framework, entry, routePath, injectRoute, menu, permissions, preload, trust, iframeUrl, host (ebook surfaces). Deploy new dist for cache bust—Host fingerprints mf-manifest.json.',
			),
			item('registry-untrusted', '9.5 untrusted iframe sample', '', {
				lang: 'json',
				code: CODE_UNTRUSTED,
			}),
		],
	},
	{
		id: 'preview-deploy',
		title: '10. Preview, deploy & debug',
		items: [
			item(
				'preview',
				'10.1 Local order',
				'Start remote → start Host → open plugin route. Expect one mf-manifest.json + remoteEntry.js?v=.',
			),
			item(
				'deploy',
				'10.2 Build & hosting',
				'pnpm build; enable CORS; prefer no-store with Host bust.',
				{ lang: 'nginx', code: CODE_NGINX },
			),
			item(
				'debug',
				'10.3 Debug tips',
				'Duplicate React; CORS; missing expose on deployed build; CSS not on expose; Vue missing framework; locale not wired.',
			),
		],
	},
	{
		id: 'checklist',
		title: '11. Acceptance checklist',
		items: [
			item(
				'checklist-all',
				'11.1 Before ship',
				'[Build] MF vite plugin; manifest; entry inject; correct shared singletons; styles on every expose.\n' +
					'[Component] default export; React {api,plugin} / Vue props.bridge; data-plugin-root; own i18n.\n' +
					'[Registry] locale maps; hostApiRange; Vue framework; minimal permissions.\n' +
					'[UX] overlays match standalone; Host toaster intact; fullscreen paired if used.',
			),
		],
	},
	{
		id: 'faq',
		title: '12. FAQ',
		items: [
			item(
				'faq-styles-host',
				'12.1 Fine standalone, broken overlays in Host?',
				'Import "@/styles.css" from the expose entry first; then verify portal-scope + style-realm.',
			),
			item(
				'faq-vue-blank',
				'12.2 Vue blank / treated as React?',
				'registry "framework": "vue"; export mount(el, bridge); Host has no vue package.',
			),
			item(
				'faq-pollute',
				'12.3 Styles leak into Host?',
				'Host @scope should contain remote CSS. Check bypass injectors / wrong trust. Do not rely on legacy prefix/Preflight hacks.',
			),
			item(
				'faq-backdrop',
				'12.4 backdrop-filter only broken when embedded?',
				'Host shell overflow on the same node as border-radius—see PluginPageShell / Layout guidance.',
			),
			item(
				'faq-cache',
				'12.5 Host still shows old bundle?',
				'Deploy new dist; Host busts via remote mf-manifest fingerprint—no need to bump registry updatedAt just for cache.',
			),
		],
	},
];

export function getPluginGuideIntro(locale: string): string {
	return locale === 'en-US' ? introEn : introZh;
}

export function getPluginGuideSections(locale: string): PluginGuideSection[] {
	return locale === 'en-US' ? sectionsEn : sectionsZh;
}
