/**
 * 插件开发手册内容（章节/条目数据驱动）。
 * - 仅代码块交给 ParserMarkdownPreviewPane 做语法高亮
 * - 其他内容（标题/描述/表格/列表/引用）在视图层自行渲染（之前的结构）
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

const TODAY = '2026-08-01';

// ─────────────────────────────────────────────────────────────────────
// 中/英文正文。注意所有代码的 code 字段使用普通字符串，不含 ``` 与语言标记。
// 模板字符串内部的反引号使用 String.raw 与分段拼接，避免反斜杠被误处理。
// ─────────────────────────────────────────────────────────────────────

/* ---------- 通用代码片段集合（中/英共用，因为代码本身不翻译） ---------- */

const CODE_2_2_BASH = String.raw`# 1. 基于 Vite + React + TypeScript 模板创建项目
pnpm create vite hello-plugin --template react-ts
cd hello-plugin

# 2. 安装核心依赖（与宿主保持同一大版本）
pnpm add react@18 react-dom@18 react-router-dom@6
pnpm add -D typescript@5 vite@5 @vitejs/plugin-react@4
pnpm add -D @originjs/vite-plugin-federation@1.3.6
pnpm add -D @types/react@18 @types/react-dom@18

# 3. （可选）若插件需要使用宿主同款 UI / Tailwind：
pnpm add tailwindcss@3 lucide-react
pnpm add -D postcss autoprefixer`;

const CODE_2_3_DOTENV = String.raw`# 插件本地开发端口（不要与主项目冲突，主项目默认 5173）
VITE_PORT=5174

# 宿主远程入口地址（本地联调时填主项目）
VITE_HOST_REMOTE_URL=http://localhost:5173/assets/remoteEntry.js

# 插件自身对外 remoteEntry 地址（注册到宿主 Registry 用）
VITE_PLUGIN_REMOTE_URL=http://localhost:5174/assets/remoteEntry.js

# 插件在 Registry 中注册的唯一 ID
VITE_PLUGIN_ID=hello-plugin

# 插件依赖共享模式，保持默认即可
VITE_SHARED_STRATEGY=singleton`;

const CODE_3_1_VITE_TS = String.raw`import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

// 避免 dev server 热更新期间出现 React "Invalid hook call"（mf 缓存问题）
// 每次启动前先清掉 node_modules/.vite 缓存
const clearFederationCachePlugin = () => ({
  name: 'clear-federation-cache',
  apply: 'serve' as const,
  configureServer() {
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const cacheDir = path.resolve(__dirname, 'node_modules/.vite');
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        // eslint-disable-next-line no-console
        console.log('[vite] cleared node_modules/.vite cache for Module Federation');
      }
    } catch (e) {
      // ignore
    }
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      clearFederationCachePlugin(),
      react(),
      federation({
        // 插件对外名称，Registry 中 name 必须与之匹配
        name: env.VITE_PLUGIN_ID ?? 'hello-plugin',

        // 宿主访问插件时拉取的远端入口文件，保持默认即可
        filename: 'remoteEntry.js',

        // 导出插件根模块；宿主通过 get('./App') 取此模块
        exposes: {
          './App': './src/App.tsx',
        },

        // 共享依赖：单例模式避免重复加载 React，与宿主共用一份
        shared: {
          react: { singleton: true, requiredVersion: '^18.0.0' },
          'react-dom': { singleton: true, requiredVersion: '^18.0.0' },
          'react-router-dom': { singleton: true, requiredVersion: '^6.0.0' },
          'lucide-react': { singleton: true, requiredVersion: '^0.400.0' },
        },
      }),
    ],

    server: {
      port: Number(env.VITE_PORT ?? 5174),

      // 宿主通过 Module Federation 拉远端模块时会跨端口，必须打开 CORS
      cors: true,

      // 允许外部 IP 访问（局域网内手机/同事联调时需要）
      host: true,

      // 防止预构建把共享依赖打包到插件 bundle，造成双 React 副本
      fs: { allow: ['..'] },
      optimizeDeps: {
        exclude: ['@originjs/vite-plugin-federation'],
      },
    },

    build: {
      modulePreload: false,
      target: 'esnext',
      minify: false,
      cssCodeSplit: false,
    },
  };
});`;

const CODE_4_1_TYPES = String.raw`// src/types.d.ts —— 从宿主 types.ts 中复制的最小子集
// 维护方式：每升级宿主插件契约时，同步覆盖此文件

export type PluginTrust = 'first-party' | 'partner' | 'untrusted';
export type PluginPermission =
  | 'ui:toast'
  | 'nav:subtree'
  | 'http:plugin-api'
  | 'modules:chat'
  | 'modules:ebook';

export interface HostBridgeProps {
  /** 插件在 Registry 中声明的唯一 ID */
  pluginId: string;
  /** 插件自身信任等级 */
  trust: PluginTrust;
  /** 允许插件使用的权限（宿主已过滤） */
  permissions: PluginPermission[];
  /** 宿主当前语言（例如 zh-CN / en-US） */
  locale: string;
  /** 宿主当前主题（light / dark），跟随宿主变化 */
  theme: string;
  /**
   * 关闭当前插件页面，回到上一级。
   * 未声明 nav:subtree 权限仍可通过此方法正常退出本插件。
   */
  close: () => void;
  /** Toast 通知（需 ui:toast 权限，否则为 undefined） */
  toast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  /**
   * 插件内部路由跳转（需 nav:subtree 权限）。
   * @param path 相对插件自己路由前缀的路径，例如 "/settings"
   */
  navigate?: (path: string) => void;
  /**
   * 宿主代理的安全 HTTP 请求（需 http:plugin-api 权限）。
   * 只允许访问 Registry 中 allowList 域名。
   */
  http?: (input: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
  }) => Promise<{ status: number; data: unknown; headers: Record<string, string> }>;
  /** 宿主开放的模块能力（需对应 modules:xxx 权限） */
  modules?: {
    chat?: {
      createConversation: (opts: { title?: string }) => Promise<{ id: string }>;
    };
    ebook?: {
      listBooks: () => Promise<Array<{ id: string; title: string }>>;
    };
  };
}`;

const CODE_4_2_APP_TSX = String.raw`// src/App.tsx
import { Puzzle, RefreshCw, Settings, X } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import type { HostBridgeProps } from './types';

/**
 * 插件根组件：宿主通过 Module Federation 拿到此导出后直接渲染。
 *
 * - 不允许自己再包另一个 ReactDOM.createRoot，会导致共享依赖失效。
 * - 如果需要独立开发时的预览，单独写一个 main.tsx（见 §4.3）。
 */
const App = memo(function App(bridge: HostBridgeProps) {
  const { pluginId, trust, permissions, locale, theme, close, toast, navigate, http } = bridge;

  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // 权限检测的正确姿势（避免运行期 undefined 调用报错）
  const has = useCallback(
    (p: HostBridgeProps['permissions'][number]) => permissions.includes(p),
    [permissions],
  );

  const onSayHello = useCallback(() => {
    if (toast) toast('你好，' + pluginId + '！', 'success');
  }, [toast, pluginId]);

  const onFetchDemo = useCallback(async () => {
    if (!http) {
      toast?.('未授权 http:plugin-api 权限', 'error');
      return;
    }
    setLoading(true);
    try {
      // 此 URL 必须先告诉主项目维护者，加到 Registry 的 allowList
      const res = await http({
        method: 'GET',
        url: 'https://api.example.com/plugin/hello-plugin/status',
      });
      toast?.('HTTP ' + res.status, res.status < 400 ? 'success' : 'error');
    } catch (e) {
      toast?.(String(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [http, toast]);

  // 生命周期钩子：激活
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[' + pluginId + '] activate', { locale, theme, trust });
    return () => {
      // 插件卸载清理（取消订阅、释放大内存、断开 ws 等）
      // eslint-disable-next-line no-console
      console.log('[' + pluginId + '] deactivate');
    };
  }, [pluginId, locale, theme, trust]);

  return (
    <div
      className={[
        'box-border min-h-full w-full p-5 text-[14px]',
        theme === 'dark' ? 'text-slate-100' : 'text-slate-800',
      ].join(' ')}
      style={{ fontFamily: 'inherit' }}
    >
      {/* 顶部栏：左右对齐 —— 左=标题 右=关闭按钮 */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle className="size-5 text-violet-500" />
          <h1 className="text-lg font-semibold">Hello 插件</h1>
          <span className="rounded-md px-2 py-0.5 text-xs bg-violet-500/10 text-violet-500">
            {trust}
          </span>
        </div>
        <button
          type="button"
          onClick={close}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="size-4" /> 关闭
        </button>
      </header>

      {/* 主体：两个示例卡片 */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-black/5 dark:border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Settings className="size-4 text-slate-400" />
            <h2 className="font-medium">计数器示例</h2>
          </div>
          <p className="mb-3 text-slate-500 dark:text-slate-400">
            当前：<strong className="text-violet-500">{count}</strong>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCount((c) => c - 1)}
              className="rounded-md bg-slate-100 px-3 py-1.5 dark:bg-slate-800"
            >
              - 1
            </button>
            <button
              type="button"
              onClick={onSayHello}
              disabled={!has('ui:toast')}
              className="rounded-md bg-violet-500 text-white px-3 py-1.5 disabled:opacity-40"
            >
              Toast 打招呼
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <RefreshCw className={'size-4 text-slate-400 ' + (loading ? 'animate-spin' : '')} />
            <h2 className="font-medium">安全 HTTP 示例</h2>
          </div>
          <p className="mb-3 text-slate-500 dark:text-slate-400">
            宿主代理请求，域名必须在 Registry.allowList 中
          </p>
          <button
            type="button"
            onClick={onFetchDemo}
            disabled={loading || !has('http:plugin-api')}
            className="rounded-md bg-emerald-500 text-white px-3 py-1.5 disabled:opacity-40"
          >
            {loading ? '请求中…' : 'GET /status'}
          </button>
        </div>
      </section>

      {/* 权限与环境信息（仅供开发者调试，生产可移除） */}
      <footer className="mt-10 rounded-lg bg-slate-100/60 dark:bg-slate-800/40 p-3 text-xs text-slate-500 dark:text-slate-400">
        <div>permissions: {permissions.join(', ') || '(empty)'}</div>
        <div>locale: {locale} · theme: {theme} · navigate: {navigate ? 'on' : 'off'}</div>
      </footer>
    </div>
  );
});

export default App;`;

const CODE_4_3_MAIN_TSX = String.raw`// src/main.tsx —— 独立本地开发时的入口（宿主不会用到此文件）
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import type { HostBridgeProps } from './types';

/** 本地开发时用的 mock HostBridge，让你不启动宿主也能看到页面效果 */
const mockBridge: HostBridgeProps = {
  pluginId: 'hello-plugin',
  trust: 'first-party',
  permissions: ['ui:toast', 'nav:subtree', 'http:plugin-api'],
  locale: 'zh-CN',
  theme: 'dark',
  close: () => alert('[mock] close()'),
  toast: (msg, type = 'info') => {
    // eslint-disable-next-line no-console
    console.log('[toast:' + type + ']', msg);
    alert(msg);
  },
  navigate: (p) => alert('[mock] navigate(' + p + ')'),
  http: async (r) => {
    // eslint-disable-next-line no-console
    console.log('[mock] http', r);
    await new Promise((r2) => setTimeout(r2, 500));
    return { status: 200, data: { ok: true }, headers: {} };
  },
  modules: {
    chat: { createConversation: async () => ({ id: 'mock-chat-1' }) },
  },
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App {...mockBridge} />
  </React.StrictMode>,
);`;

const CODE_5_1_I18N_TS = String.raw`// src/i18n.ts
type Dict = Record<string, string>;
const ZH: Dict = {
  'hello.title': 'Hello 插件',
  'hello.desc': '这是一个示例插件',
  'hello.success': '操作成功',
  'error.noPermission': '缺少权限：{perm}',
};
const EN: Dict = {
  'hello.title': 'Hello Plugin',
  'hello.desc': 'This is a sample plugin.',
  'hello.success': 'Operation succeeded',
  'error.noPermission': 'Missing permission: {perm}',
};

let curLocale: 'zh-CN' | 'en-US' = 'zh-CN';
export const setLocale = (l: string) => {
  curLocale = l === 'en-US' ? 'en-US' : 'zh-CN';
};
export const t = (key: string, vars?: Record<string, string | number>) => {
  const dict = curLocale === 'zh-CN' ? ZH : EN;
  let s = dict[key] ?? key;
  if (vars) Object.entries(vars).forEach(([k, v]) => (s = s.replace('{' + k + '}', String(v))));
  return s;
};`;

const CODE_5_2_FOLLOW_LOCALE = String.raw`// 在 App 组件内 useEffect 之前：
import { setLocale, t as i18nT } from './i18n';

setLocale(locale);`;

const CODE_6_1_PERMS_YAML = String.raw`# permissions 可选项：
- ui:toast            # 允许调用宿主 Toast
- nav:subtree         # 允许在插件自己路由前缀下跳转（navigate()）
- http:plugin-api     # 允许通过宿主代理发起 HTTP 请求（必须配 allowList）
- modules:chat        # 允许访问宿主聊天模块
- modules:ebook       # 允许访问宿主电子书模块`;

const CODE_6_2_GOOD_BAD = String.raw`//  ✅ 正确：检测 bridge 方法是否存在（宿主过滤权限后会设为 undefined）
if (bridge.toast) bridge.toast('保存成功', 'success');
if (bridge.navigate) bridge.navigate('/settings');

//  ✅ 更健壮：结合 permissions 数组
const canHttp = bridge.permissions.includes('http:plugin-api');
// <button disabled={!canHttp}>请求</button>

//  ❌ 错误：直接调用（缺少权限时运行时报 TypeError: bridge.http is not a function）
bridge.http({ method: 'GET', url: 'https://evil.com/x' });`;

const CODE_7_1_REGISTRY_JSON = String.raw`{
  "plugins": [
    {
      "id": "hello-plugin",
      "remoteName": "hello-plugin",
      "expose": "./App",
      "title": {
        "zh-CN": "Hello 示例插件",
        "en-US": "Hello Sample Plugin"
      },
      "description": {
        "zh-CN": "展示如何开发并接入一个 Module Federation 插件",
        "en-US": "Shows how to develop and integrate a Module Federation plugin"
      },
      "routePath": "/hello-plugin",
      "entry": "http://127.0.0.1:5174/mf-manifest.json",
      "version": "1.0.0",
      "hostApiRange": "^1.0.0",
      "menu": {
        "order": 100,
        "icon": "Puzzle"
      },
      "permissions": ["ui:toast", "nav:subtree", "http:plugin-api"],
      "preload": "route",
      "enabled": true,
      "trust": "first-party"
    }
  ]
}`;

const CODE_7_3_UNTRUSTED_JSON = String.raw`{
  "plugins": [
    {
      "id": "hello-iframe-plugin",
      "title": {
        "zh-CN": "Hello iframe 插件",
        "en-US": "Hello iframe Plugin"
      },
      "description": {
        "zh-CN": "一个不受信任的 iframe 插件示例",
        "en-US": "An untrusted iframe plugin example"
      },
      "routePath": "/hello-iframe-plugin",
      "entry": "https://cdn.example.com/hello-iframe/latest/mf-manifest.json",
      "version": "1.0.0",
      "hostApiRange": "^1.0.0",
      "permissions": ["ui:toast"],
      "preload": "route",
      "enabled": false,
      "trust": "untrusted"
    }
  ]
}`;

const CODE_8_1_BUILD_BASH = String.raw`# 生产构建
pnpm build

# 产物默认在 dist/，注意必须暴露以下静态资源：
#   dist/mf-manifest.json      ← MF manifest（Registry 中 entry 指向此文件）
#   dist/assets/*.js / *.css   ← 插件代码与样式
ls -R dist/`;

const CODE_8_2_NGINX = String.raw`#user  nobody;
worker_processes  1;

#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;

#pid        logs/nginx.pid;

events {
  worker_connections  1024;
}

http {
  include       mime.types;
  default_type  application/octet-stream;
  sendfile  on;
  keepalive_timeout   65;
  client_max_body_size  100m;

  gzip  on;
  gzip_min_length 1k;
  gzip_buffers 4 16k;
  gzip_http_version 1.0;
  gzip_comp_level 5;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
  gzip_vary on;

  # 按实际宿主来源收紧 CORS（生产建议白名单，不要用 *）
  map $http_origin $mf_cors_origin {
    default "";
    "https://dnhyxc.cn:9002"   $http_origin;
    "http://tauri.localhost"    $http_origin;
    "https://tauri.localhost"   $http_origin;
    "tauri://localhost"         $http_origin;
  }

  # ── 独立插件项目部署（如 hello-plugin，端口 9007） ──
  server {
    listen 9007 ssl;
    server_name  dnhyxc.cn;

    ssl_certificate /usr/local/nginx/certs/dnhyxc.cn_nginx/dnhyxc.cn_bundle.crt;
    ssl_certificate_key /usr/local/nginx/certs/dnhyxc.cn_nginx/dnhyxc.cn.key;

    # 允许 Host 拉 MF 资源
    add_header Access-Control-Allow-Origin $mf_cors_origin always;
    add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Range" always;
    add_header Cross-Origin-Resource-Policy "cross-origin" always;

    location / {
      if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin $mf_cors_origin;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Range";
        add_header Access-Control-Max-Age 86400;
        add_header Content-Length 0;
        return 204;
      }

      root  /usr/local/nginx/remote/dist;
      index   index.html  index.htm;
      try_files   $uri  $uri/ /index.html;
    }

    location /api/ {
      proxy_set_header  Host  $http_host;
      proxy_set_header  X-Real-IP $remote_addr;
      proxy_set_header  REMOTE-HOST $remote_addr;
      proxy_set_header  X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header  X-Forwarded-Proto $scheme;
      proxy_pass  https://172.17.0.1:9112;
    }

    error_page  500 502 503 504 /50x.html;
    location = /50x.html {
      root  html;
    }
  }

  # ── remote-plugins 插件集合部署（端口 9008，可托管多个插件） ──
  server {
    listen 9008 ssl;
    server_name  dnhyxc.cn;

    ssl_certificate /usr/local/nginx/certs/dnhyxc.cn_nginx/dnhyxc.cn_bundle.crt;
    ssl_certificate_key /usr/local/nginx/certs/dnhyxc.cn_nginx/dnhyxc.cn.key;

    # 允许 Host 拉 MF 资源
    add_header Access-Control-Allow-Origin $mf_cors_origin always;
    add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Range" always;
    add_header Cross-Origin-Resource-Policy "cross-origin" always;

    location / {
      if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin $mf_cors_origin;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Range";
        add_header Access-Control-Max-Age 86400;
        add_header Content-Length 0;
        return 204;
      }

      root  /usr/local/nginx/remote-plugins/dist;
      index   index.html  index.htm;
      try_files   $uri  $uri/ /index.html;
    }

    location /api/ {
      proxy_set_header  Host  $http_host;
      proxy_set_header  X-Real-IP $remote_addr;
      proxy_set_header  REMOTE-HOST $remote_addr;
      proxy_set_header  X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header  X-Forwarded-Proto $scheme;
      proxy_pass  https://172.17.0.1:9112;
    }

    error_page  500 502 503 504 /50x.html;
    location = /50x.html {
      root  html;
    }
  }
}`;

const CODE_8_3_HOST_DEBUG = String.raw`// 1. 查看所有已注册插件信息（调试伪代码：根据宿主暴露的 dev API 调整）
window.__PLUGIN_DEV__ = window.__PLUGIN_DEV__ || {};
// const mgr = window.__PLUGIN_DEV__.manager;
// console.table(mgr.registry.list);

// 2. 强制重新加载当前插件
// mgr.reload('hello-plugin');

// 3. 查看当前激活插件的 bridge（仅本地开发，请勿在生产暴露）
// console.log(mgr.activePlugin?.bridge);`;

const CODE_9_HELLO_WORLD = String.raw`// src/App.tsx —— Hello World 完整版
import { Globe, Puzzle, X } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { setLocale as i18nSetLocale, t as i18nT } from './i18n';
import type { HostBridgeProps } from './types';

const App = memo(function App(bridge: HostBridgeProps) {
  const { locale, theme, close, toast, http, permissions } = bridge;
  i18nSetLocale(locale);

  const [ping, setPing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasHttp = permissions.includes('http:plugin-api');

  const onPing = useCallback(async () => {
    if (!http || !toast) {
      toast?.('缺少必要权限', 'error');
      return;
    }
    setBusy(true);
    try {
      const r = await http({
        method: 'GET',
        url: 'https://api.example.com/plugin/hello-plugin/ping',
      });
      if (r.status >= 400) throw new Error('HTTP ' + r.status);
      setPing(new Date().toLocaleTimeString());
      toast(i18nT('hello.success'), 'success');
    } catch (e) {
      toast(i18nT('error.noPermission', { perm: 'http:plugin-api' }), 'error');
    } finally {
      setBusy(false);
    }
  }, [http, toast]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[hello-plugin] mounted with theme', theme);
    return () => {
      // eslint-disable-next-line no-console
      console.log('[hello-plugin] unmounted');
    };
  }, [theme]);

  return (
    <div className={'min-h-full w-full p-6 ' + (theme === 'dark' ? 'text-slate-100' : 'text-slate-800')}>
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle className="size-6 text-violet-500" />
          <h1 className="text-xl font-bold">{i18nT('hello.title')}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Globe className="size-3.5" /> {locale}
          </span>
          <button type="button" onClick={close} className="rounded-md px-2.5 py-1 hover:bg-black/5 dark:hover:bg-white/10">
            <X className="size-4 inline" /> 关闭
          </button>
        </div>
      </header>

      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{i18nT('hello.desc')}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="mb-2 font-medium">Toast 示例</h2>
          <button
            type="button"
            onClick={() => toast && toast(i18nT('hello.desc'), 'info')}
            className="rounded-md bg-violet-500 px-3 py-1.5 text-white"
          >
            弹出一条 Toast
          </button>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-2 font-medium">HTTP 示例</h2>
          <p className="mb-2 text-xs text-slate-400">
            {ping ? '上次成功 ' + ping : '未请求'}
          </p>
          <button
            type="button"
            onClick={onPing}
            disabled={busy || !hasHttp}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-white disabled:opacity-40"
          >
            {busy ? 'Ping…' : 'GET /ping'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default App;`;

const CODE_10_3_TAILWIND_PREFIX = String.raw`// tailwind.config.js：给插件专属 class 加前缀避免样式污染
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  prefix: 'hp-',
  // ... theme 等配置按实际需求写
};`;

/* =======================================================================
 *  中文版
 * ======================================================================= */

const introZh =
	'阅读对象：希望为本平台开发独立插件（子应用）的前端开发者。' +
	'目标：从项目初始化到接入主项目，一步步完成一个可运行的插件。';

const sectionsZh: PluginGuideSection[] = [
	{
		id: 'arch',
		title: '1. 架构概览',
		items: [
			{
				id: 'arch-components',
				title: '1.1 系统组成',
				dateLabel: TODAY,
				description:
					'主项目在插件体系上由三个核心模块组成：\n' +
					'• PluginManager（plugins/core/PluginManager.ts）负责加载、卸载、激活插件，管理生命周期；\n' +
					'• PluginRegistry（plugins/core/registry.ts）抓取并缓存插件元数据，支持用户覆盖启用状态；\n' +
					'• PluginHostPage（views/pluginHost/index.tsx）真实挂载插件的页面，根据信任等级选择嵌入方式。',
			},
			{
				id: 'arch-trust',
				title: '1.2 信任等级与嵌入方式',
				dateLabel: TODAY,
				description:
					'主项目按 trust 字段区分三类插件：\n' +
					'• first-party：Module Federation 直接挂载，共享宿主 React/依赖。权限最高，可调用所有已开放 API。适用于团队内部、完全可信插件。\n' +
					'• partner：Module Federation 挂载，宿主按需注入白名单能力。权限受限，仅允许声明的权限。适用于合作方插件。\n' +
					'• untrusted：iframe 隔离沙盒，通过 postMessage 通信。权限最小，仅允许显式白名单接口。适用于第三方未知来源插件。',
			},
			{
				id: 'arch-flow',
				title: '1.3 加载流程',
				dateLabel: TODAY,
				description:
					'1. 宿主启动后 PluginManager.init() 拉取远端注册表（Registry JSON）。\n' +
					'2. PluginRegistry 合并用户本地启用配置，得到最终启用清单。\n' +
					'3. 用户点击某插件，PluginHostPage 进入插件路由页。\n' +
					'4. mountShell() 先渲染占位骨架屏（避免空白感知）。\n' +
					'5. loadPlugin() 按信任等级加载：\n' +
					'   • first-party / partner：通过 Module Federation container.get(EXPORT_NAME) 动态加载。\n' +
					'   • untrusted：创建 <iframe src="..."> 并注入 postMessage HostBridge。\n' +
					'6. 挂载完成后调用插件导出的 activate() 钩子，正式进入生命周期。',
			},
		],
	},
	{
		id: 'init',
		title: '2. 初始化插件项目',
		items: [
			{
				id: 'init-env',
				title: '2.1 环境要求',
				dateLabel: TODAY,
				description:
					'工具与推荐版本（与宿主保持一致可避免大量兼容问题）：\n' +
					'• Node.js ≥ 18.17（Node 20 LTS 最佳）\n' +
					'• pnpm ≥ 8.10（与主项目包管理器一致）\n' +
					'• Vite 5.x（匹配宿主 vite-plugin-federation 版本）\n' +
					'• React 18.x（必须与宿主同一主版本）\n' +
					'• TypeScript ≥ 5.3（尽量与宿主 TS 版本对齐）',
			},
			{
				id: 'init-create',
				title: '2.2 最简创建命令',
				dateLabel: TODAY,
				description:
					'先用 Vite 官方模板起项目，再补齐 Module Federation 与宿主共享依赖：',
				code: { lang: 'bash', code: CODE_2_2_BASH },
			},
			{
				id: 'init-envfile',
				title: '2.3 环境变量（.env）',
				dateLabel: TODAY,
				description:
					'项目根目录新建 .env，内容如下（实际端口号按你团队实际分配调整）：',
				code: { lang: 'dotenv', code: CODE_2_3_DOTENV },
			},
		],
	},
	{
		id: 'vite',
		title: '3. 配置 Vite 与 Module Federation',
		items: [
			{
				id: 'vite-full-config',
				title: '3.1 完整 vite.config.ts 模板',
				dateLabel: TODAY,
				description:
					'下面这份配置包含：清缓存 workaround、MF 共享依赖（React singleton）、dev CORS 开、优化构建选项。' +
					'注意：如果少了 cors: true，宿主加载时浏览器直接报 CORS；少了 singleton 会出现 Invalid hook call 等诡异错误。',
				code: { lang: 'typescript', code: CODE_3_1_VITE_TS },
			},
		],
	},
	{
		id: 'app',
		title: '4. 实现插件主组件（App.tsx）',
		items: [
			{
				id: 'app-types',
				title: '4.1 HostBridgeProps 类型（复制到 src/types.d.ts）',
				dateLabel: TODAY,
				description:
					'每次宿主插件契约升级时，都需要同步覆盖插件项目里的这个最小子集。' +
					'里面包含了插件能从宿主拿到的所有桥接能力定义。',
				code: { lang: 'typescript', code: CODE_4_1_TYPES },
			},
			{
				id: 'app-root',
				title: '4.2 插件根组件 App.tsx 完整模板',
				dateLabel: TODAY,
				description:
					'宿主通过 Module Federation 拿到此默认导出后直接渲染。禁止你自己再包一层 ReactDOM.createRoot（会导致共享依赖失效）。' +
					'如果需要本地独立预览，使用下一节的 main.tsx。',
				code: { lang: 'tsx', code: CODE_4_2_APP_TSX },
			},
			{
				id: 'app-main',
				title: '4.3 独立预览入口（main.tsx）',
				dateLabel: TODAY,
				description:
					'本地开发时用的入口：注入一个 mock HostBridge，不启动宿主也能看到页面效果。宿主真正加载插件时不会用到此文件。',
				code: { lang: 'tsx', code: CODE_4_3_MAIN_TSX },
			},
		],
	},
	{
		id: 'i18n',
		title: '5. 多语言与主题跟随',
		items: [
			{
				id: 'i18n-dict',
				title: '5.1 在插件内部维护自己的 i18n 字典',
				dateLabel: TODAY,
				description:
					'宿主并不会把自己的翻译表共享给插件。插件需要自己管理词条，参考下面实现一个最小可用的 t() + setLocale()。',
				code: { lang: 'typescript', code: CODE_5_1_I18N_TS },
			},
			{
				id: 'i18n-follow',
				title: '5.2 跟随宿主语言切换',
				dateLabel: TODAY,
				description:
					'宿主在用户切换语言时会以新的 bridge props 整体 re-render 整个插件（不需要事件订阅）。' +
					'所以你只需在 App 组件顶部每次 render 都调用 setLocale(locale) 即可：',
				code: { lang: 'tsx', code: CODE_5_2_FOLLOW_LOCALE },
			},
		],
	},
	{
		id: 'perm',
		title: '6. 权限声明与 API 使用',
		items: [
			{
				id: 'perm-list',
				title: '6.1 权限清单（提交给主项目维护者时一并提供）',
				dateLabel: TODAY,
				description:
					'宿主目前支持的权限如下；你需要对照自己插件实际用到的能力，把对应的权限项告诉主项目维护者写入 Registry.permissions。',
				code: { lang: 'yaml', code: CODE_6_1_PERMS_YAML },
			},
			{
				id: 'perm-good-bad',
				title: '6.2 正确 vs 错误使用示例',
				dateLabel: TODAY,
				description:
					'宿主在把 bridge 交给插件前会先按 Registry.permissions 过滤，未授权的方法会变成 undefined。' +
					'调用前做 feature-detect 是唯一稳健的写法。',
				code: { lang: 'tsx', code: CODE_6_2_GOOD_BAD },
			},
		],
	},
	{
		id: 'registry',
		title: '7. 注册到主项目（给主项目维护者的配置）',
		items: [
			{
				id: 'registry-snippet',
				title: '7.1 给主项目维护者的 Registry 配置片段',
				dateLabel: TODAY,
				description:
					'把下面的 JSON 片段发给主项目维护者，请其追加到插件 Registry 文件中。' +
					'Registry 实际位置可能是 apps/frontend/src/plugins/registry.json，也可能是后端服务拉取的远端 JSON（取决于宿主部署方式）。',
				code: { lang: 'json', code: CODE_7_1_REGISTRY_JSON },
			},
			{
				id: 'registry-fields',
				title: '7.2 Registry 字段说明表',
				dateLabel: TODAY,
				description:
					'字段速查（给你自己和宿主维护者都留一份底）：\n' +
					'• id：全局唯一插件 ID（建议与 remoteName 保持一致），必填。\n' +
					'• remoteName：Module Federation container 名字，必须与 vite.config 中 federation({ name }) 完全相同。当 id 与 MF name 一致时可省略。\n' +
					'• expose：MF exposes 中的导出 key，例如 ./App、./LearningNotes。当 entry 为 mf-manifest.json 时可省略（宿主从 manifest 中自动解析）。\n' +
					'• title：按 locale 配置的显示名称（zh-CN / en-US），必填。\n' +
					'• description：按 locale 配置的一句话描述，必填。\n' +
					'• routePath：插件在宿主中的路由路径（如 /hello-plugin），必填。\n' +
					'• entry：MF manifest 文件地址（如 http://127.0.0.1:5174/mf-manifest.json），必填。\n' +
					'• version：语义化 x.y.z 版本号，必填。\n' +
					'• hostApiRange：宿主 API 兼容版本范围（如 ^1.0.0），必填。\n' +
					'• trust：决定嵌入方式（first-party / partner / untrusted），必填。\n' +
					'• permissions：权限白名单，宿主据此过滤 bridge 方法，必填。\n' +
					'• preload：预加载策略，可选值 route（路由进入时加载）或 none，默认 route。\n' +
					'• enabled：是否默认启用，必填。\n' +
					'• menu：侧栏入口配置，含 order（排序权重）和 icon（图标名），独立页面插件必填。\n' +
					'• injectRoute：是否注入到宿主路由树，默认 false。当插件需要在宿主特定页面内嵌渲染时设为 false 并配 host 字段。\n' +
					'• host：嵌入宿主特定页面的配置，含 surface（宿主页面标识）、slot（嵌入位置如 drawer/toolbar）、icon、order。仅 injectRoute=false 时使用。',
			},
			{
				id: 'registry-untrusted',
				title: '7.3 untrusted（iframe 沙盒）配置示例',
				dateLabel: TODAY,
				description:
					'untrusted 插件在 iframe 内运行，不能通过 MF 共享宿主依赖，需要自行打包 React 等。' +
					'桥接走 postMessage，仅暴露 permissions 中声明的最少量能力。示例如下：',
				code: { lang: 'json', code: CODE_7_3_UNTRUSTED_JSON },
			},
		],
	},
	{
		id: 'deploy',
		title: '8. 部署与调试',
		items: [
			{
				id: 'deploy-build',
				title: '8.1 构建产物',
				dateLabel: TODAY,
				description:
					'执行 pnpm build。至少要对外暴露 dist/assets/remoteEntry.js（MF 入口）以及配套的 *.js/*.css 资源。',
				code: { lang: 'bash', code: CODE_8_1_BUILD_BASH },
			},
			{
				id: 'deploy-nginx',
				title: '8.2 Nginx 示例配置',
				dateLabel: TODAY,
				description:
					'上线推荐 Nginx 托管构建产物。核心要点：全开 CORS、SPA deep link 回退到 index.html、静态 hash 资源长缓存、remoteEntry 短缓存：',
				code: { lang: 'nginx', code: CODE_8_2_NGINX },
			},
			{
				id: 'deploy-host-debug',
				title: '8.3 宿主控制台调试命令',
				dateLabel: TODAY,
				description:
					'插件成功加载后，在宿主页面的浏览器控制台可以通过宿主暴露的 dev API（如果有）快速查看插件列表/重新加载/查看 bridge。示例如下（按宿主实际暴露方式调整）：',
				code: { lang: 'typescript', code: CODE_8_3_HOST_DEBUG },
			},
		],
	},
	{
		id: 'hello',
		title: '9. 完整 Hello World 示例（i18n + Toast + HTTP）',
		items: [
			{
				id: 'hello-full',
				title: '9.1 Hello World 完整 App.tsx',
				dateLabel: TODAY,
				description:
					'把 §5 i18n、§4 基础组件、§6 权限检测、错误处理一次性整合出来的“可直接照抄”模板。' +
					'直接替换你项目里的 App.tsx 即可看到所有效果。',
				code: { lang: 'tsx', code: CODE_9_HELLO_WORLD },
			},
		],
	},
	{
		id: 'troubleshoot',
		title: '10. 常见问题排查（Troubleshooting）',
		items: [
			{
				id: 'ts-invalid-hook',
				title:
					'10.1 Invalid hook call（Hooks 只能在 function component 内部调用）',
				dateLabel: TODAY,
				description:
					'典型原因：插件项目里跑了两份不同的 React 实例。排查步骤：\n' +
					'1. vite.config.ts 的 shared 中 react/react-dom 必须加 singleton: true。\n' +
					'2. 删除插件 node_modules/.vite 缓存后重新 pnpm dev。\n' +
					'3. 在插件和宿主中分别 pnpm ls react，确认 major 版本完全一致。\n' +
					'4. 确认插件被宿主渲染时，App 组件内部没有再写 ReactDOM.createRoot(...).render(<App {...bridge} />)（宿主已经帮你 render 了，再 createRoot 必出双实例问题）。',
			},
			{
				id: 'ts-cors',
				title: '10.2 CORS：Access to script at remoteEntry.js blocked',
				dateLabel: TODAY,
				description:
					'1. 本地：插件 vite.config.ts 的 server.cors 必须是 true。\n' +
					'2. 线上：CDN/Nginx 侧按 §8.2 配置 Access-Control-Allow-Origin。\n' +
					'3. 使用第三方 CDN（jsDelivr / unpkg / Cloudflare Pages）时确认其默认 CORS 策略允许。',
			},
			{
				id: 'ts-style-leak',
				title: '10.3 样式污染（插件 Tailwind 影响宿主全局样式）',
				dateLabel: TODAY,
				description:
					'两条铁律：\n' +
					'① 给你的插件 Tailwind 加一个专属 prefix（例如 hp-），这样 plugin- 类不会跟宿主撞名。\n' +
					'② 永远不要在插件里写 @tailwind base（它会注入 reset 影响宿主），只保留 components + utilities。\n' +
					'参考配置：',
				code: { lang: 'javascript', code: CODE_10_3_TAILWIND_PREFIX },
			},
			{
				id: 'ts-bridge-undefined',
				title: '10.4 bridge 字段 undefined（明明声明了权限却用不了）',
				dateLabel: TODAY,
				description:
					'1. 对照 §7.2 确认 Registry.permissions 确实包含了你以为的权限。\n' +
					'2. 打开宿主日志，看 PluginManager 加载该插件时是否有 permission filtered 之类警告。\n' +
					'3. 若声明的是 http:plugin-api，再检查 allowList.domains 是否包含请求的实际域名（含子域；需要精确匹配或显式写入父域）。',
			},
			{
				id: 'ts-locale-not-change',
				title: '10.5 切换语言后插件文字不变',
				dateLabel: TODAY,
				description:
					'1. 确认 App 组件顶部每次 render 都执行了 setLocale(locale)（见 §5.2）。\n' +
					'2. 不要把 locale 塞进你插件自己的 useState 里，真源始终是 HostBridge 传入的 locale。\n' +
					'3. 宿主会以新 bridge props 整体 re-render 插件，不需要手动订阅事件。',
			},
			{
				id: 'ts-mf-remote',
				title:
					'10.6 Remote 模块找不到 / Shared module is not available for eager consumption',
				dateLabel: TODAY,
				description:
					'1. 启动顺序：先开插件项目，再开宿主（宿主一启动就会尝试去连 remoteEntry）。\n' +
					'2. 确认两个项目使用了完全相同版本的 @originjs/vite-plugin-federation。\n' +
					'3. 确认 vite.config.ts 中 build.modulePreload = false 已关闭（Module Federation 默认需要关）。\n' +
					'4. 如果是第一次起项目且 MF 报错，先在两个项目都 pnpm dev --force 强制重建 deps 缓存。',
			},
		],
	},
];

/* =======================================================================
 *  英文版
 * ======================================================================= */

const introEn =
	'Audience: Front-end developers who want to build independent plugins (sub-apps) for this platform. ' +
	'Goal: From project init to host integration, step by step produce a working plugin.';

const sectionsEn: PluginGuideSection[] = [
	{
		id: 'arch',
		title: '1. Architecture Overview',
		items: [
			{
				id: 'arch-components',
				title: '1.1 System Components',
				dateLabel: TODAY,
				description:
					'The host project implements the plugin system with three core modules:\n' +
					'• PluginManager (plugins/core/PluginManager.ts) — Load / unload / activate plugins; manage lifecycle.\n' +
					'• PluginRegistry (plugins/core/registry.ts) — Fetch & cache plugin metadata; apply user overrides.\n' +
					'• PluginHostPage (views/pluginHost/index.tsx) — The page that actually mounts the plugin; picks the embed mode by trust level.',
			},
			{
				id: 'arch-trust',
				title: '1.2 Trust Levels & Embed Modes',
				dateLabel: TODAY,
				description:
					'The host distinguishes three plugin classes via the `trust` field:\n' +
					'• first-party — Module Federation direct mount; shares host React / dependencies. Highest permissions; every declared host API is available. In-house, fully trusted plugins.\n' +
					'• partner — Module Federation mount; host injects a strict capability whitelist. Restricted to declared permissions only. Partner-vendor plugins.\n' +
					'• untrusted — iframe sandboxed bridge via postMessage. Minimal permissions; only explicitly whitelisted interfaces. Unknown / third-party source plugins.',
			},
			{
				id: 'arch-flow',
				title: '1.3 Loading Flow',
				dateLabel: TODAY,
				description:
					'1. On host startup PluginManager.init() pulls the remote Registry JSON.\n' +
					"2. PluginRegistry merges with the user's local enabled state producing the final active manifest.\n" +
					'3. User clicks a plugin → navigates to the PluginHostPage route.\n' +
					'4. mountShell() renders a skeleton shell first to avoid perceived blank.\n' +
					'5. loadPlugin() then loads the plugin by trust:\n' +
					'   • first-party / partner: dynamic MF via container.get(EXPORT_NAME).\n' +
					'   • untrusted: creates <iframe src="..."> and wires the postMessage HostBridge.\n' +
					"6. After mount, the plugin's exported activate() hook runs and the lifecycle begins.",
			},
		],
	},
	{
		id: 'init',
		title: '2. Init Your Plugin Project',
		items: [
			{
				id: 'init-env',
				title: '2.1 Environment Requirements',
				dateLabel: TODAY,
				description:
					'Recommended tool versions (staying aligned with the host avoids a lot of compatibility pain):\n' +
					'• Node.js ≥ 18.17 (Node 20 LTS preferred)\n' +
					'• pnpm ≥ 8.10 (matches host package manager)\n' +
					'• Vite 5.x (matches the host vite-plugin-federation version)\n' +
					'• React 18.x (must match the host React major)\n' +
					'• TypeScript ≥ 5.3 (keep close to the host TS version)',
			},
			{
				id: 'init-create',
				title: '2.2 Quick Setup Commands',
				dateLabel: TODAY,
				description:
					'Scaffold from the official Vite template, then add Module Federation and host shared dependencies on top:',
				code: { lang: 'bash', code: CODE_2_2_BASH },
			},
			{
				id: 'init-envfile',
				title: '2.3 Environment Variables (.env)',
				dateLabel: TODAY,
				description:
					'Create a .env at the project root with the following content (ports should match what your team actually allocates):',
				code: { lang: 'dotenv', code: CODE_2_3_DOTENV },
			},
		],
	},
	{
		id: 'vite',
		title: '3. Configure Vite + Module Federation',
		items: [
			{
				id: 'vite-full-config',
				title: '3.1 Full vite.config.ts Template',
				dateLabel: TODAY,
				description:
					'This config includes: cache-clear workaround for HMR MF issues, MF shared deps (React singleton), dev CORS turned on, optimized build options.\n' +
					'Critical reminders: Without `cors: true` the browser blocks remoteEntry.js outright. Without `singleton` you will see cryptic errors like "Invalid hook call".',
				code: { lang: 'typescript', code: CODE_3_1_VITE_TS },
			},
		],
	},
	{
		id: 'app',
		title: '4. Implement the Plugin Root (App.tsx)',
		items: [
			{
				id: 'app-types',
				title: '4.1 Copy HostBridgeProps Into src/types.d.ts',
				dateLabel: TODAY,
				description:
					'Refresh this file every time the host plugin contract changes. It contains the minimal subset of the bridge capabilities your plugin can read from the host.',
				code: { lang: 'typescript', code: CODE_4_1_TYPES },
			},
			{
				id: 'app-root',
				title: '4.2 Full Root Component Template (App.tsx)',
				dateLabel: TODAY,
				description:
					'The host MF runtime loads this default export and mounts it directly. You MUST NOT wrap it in another ReactDOM.createRoot (that breaks shared deps). ' +
					'For standalone dev preview use the separate main.tsx in the next section.',
				code: { lang: 'tsx', code: CODE_4_2_APP_TSX },
			},
			{
				id: 'app-main',
				title: '4.3 Standalone Preview Entry (main.tsx)',
				dateLabel: TODAY,
				description:
					'Entry for local dev only. Injects a mock HostBridge so you can see the page without ever starting the host. The host never uses this file.',
				code: { lang: 'tsx', code: CODE_4_3_MAIN_TSX },
			},
		],
	},
	{
		id: 'i18n',
		title: '5. i18n & Theme Follow',
		items: [
			{
				id: 'i18n-dict',
				title: '5.1 Plugin-Owned i18n Dictionary',
				dateLabel: TODAY,
				description:
					'The host does NOT share its translation table with plugins. Every plugin owns its own dictionary. Below is a minimal usable t() + setLocale() implementation.',
				code: { lang: 'typescript', code: CODE_5_1_I18N_TS },
			},
			{
				id: 'i18n-follow',
				title: '5.2 Follow Host Locale Changes',
				dateLabel: TODAY,
				description:
					'When the user switches language the host re-renders the whole plugin with a fresh bridge instance (no explicit event subscription needed). ' +
					'Just call setLocale(locale) at the top of your App() body on every render:',
				code: { lang: 'tsx', code: CODE_5_2_FOLLOW_LOCALE },
			},
		],
	},
	{
		id: 'perm',
		title: '6. Permissions & API Usage',
		items: [
			{
				id: 'perm-list',
				title: '6.1 Full Permission List (send together with your Registry PR)',
				dateLabel: TODAY,
				description:
					'Supported permissions today. Match against what your plugin actually does, and send the exact subset to host maintainers to be written into Registry.permissions.',
				code: { lang: 'yaml', code: CODE_6_1_PERMS_YAML },
			},
			{
				id: 'perm-good-bad',
				title: '6.2 Good vs Bad Usage',
				dateLabel: TODAY,
				description:
					'Before the host hands the bridge to the plugin it filters against Registry.permissions; any missing method becomes undefined. ' +
					'Feature-detecting before each call is the only robust pattern.',
				code: { lang: 'tsx', code: CODE_6_2_GOOD_BAD },
			},
		],
	},
	{
		id: 'registry',
		title: '7. Register With the Host (Send This to Maintainers)',
		items: [
			{
				id: 'registry-snippet',
				title: '7.1 Registry Snippet to Send to Host Maintainers',
				dateLabel: TODAY,
				description:
					'Send the following JSON snippet to the host project maintainers, asking them to append it to the plugin Registry file. ' +
					'The Registry location depends on deployment: either apps/frontend/src/plugins/registry.json or a remote JSON URL served by backend.',
				code: { lang: 'json', code: CODE_7_1_REGISTRY_JSON },
			},
			{
				id: 'registry-fields',
				title: '7.2 Registry Field Reference',
				dateLabel: TODAY,
				description:
					'Quick field reference (keep a copy for both you and the host maintainer):\n' +
					'• id: Globally unique plugin ID (recommend matching remoteName). Required.\n' +
					'• remoteName: Module Federation container name; MUST exactly match federation({ name }) in vite.config. Can be omitted when id equals the MF name.\n' +
					'• expose: MF exposes key, e.g. ./App, ./LearningNotes. Can be omitted when entry is mf-manifest.json (host auto-resolves from manifest).\n' +
					'• title: Display name per locale (zh-CN / en-US). Required.\n' +
					'• description: One-line description per locale. Required.\n' +
					'• routePath: Route path in the host (e.g. /hello-plugin). Required.\n' +
					'• entry: MF manifest URL (e.g. http://127.0.0.1:5174/mf-manifest.json). Required.\n' +
					'• version: SemVer x.y.z. Required.\n' +
					'• hostApiRange: Host API compatibility range (e.g. ^1.0.0). Required.\n' +
					'• trust: Embed mode selector (first-party/partner/untrusted). Required.\n' +
					'• permissions: Permissions whitelist; the host uses it to filter bridge methods. Required.\n' +
					'• preload: Preload strategy; values: route (load on route enter) or none. Defaults to route.\n' +
					'• enabled: Whether the plugin is enabled by default. Required.\n' +
					'• menu: Sidebar entry config with order (sort weight) and icon (icon name). Required for standalone-page plugins.\n' +
					'• injectRoute: Whether to inject into the host route tree; defaults to false. Set false and use the host field when embedding into a specific host page.\n' +
					'• host: Embed-into-host-page config with surface (host page id), slot (drawer/toolbar), icon, order. Only used when injectRoute=false.',
			},
			{
				id: 'registry-untrusted',
				title: '7.3 Untrusted (iframe sandboxed) Example',
				dateLabel: TODAY,
				description:
					'Untrusted plugins run inside an iframe, cannot share host dependencies via MF, and must bundle React (and friends) themselves. ' +
					'Communication goes over postMessage, exposing only the minimum declared in permissions.',
				code: { lang: 'json', code: CODE_7_3_UNTRUSTED_JSON },
			},
		],
	},
	{
		id: 'deploy',
		title: '8. Deploy & Debug',
		items: [
			{
				id: 'deploy-build',
				title: '8.1 Production Build',
				dateLabel: TODAY,
				description:
					'Run pnpm build. At minimum dist/assets/remoteEntry.js (the MF entry) plus its accompanying *.js / *.css assets must be publicly reachable.',
				code: { lang: 'bash', code: CODE_8_1_BUILD_BASH },
			},
			{
				id: 'deploy-nginx',
				title: '8.2 Nginx Example',
				dateLabel: TODAY,
				description:
					'Production recommendation: host the build output on Nginx. Key points: wide-open CORS, SPA deep-link fallback, long-cache on hashed assets, short-cache on remoteEntry.js:',
				code: { lang: 'nginx', code: CODE_8_2_NGINX },
			},
			{
				id: 'deploy-host-debug',
				title: '8.3 Host Console Debugging Snippets',
				dateLabel: TODAY,
				description:
					'After a successful load, inspect the plugin list / reload / inspect the active bridge via whatever dev surface the host exposes. Example (adjust to actual host API):',
				code: { lang: 'typescript', code: CODE_8_3_HOST_DEBUG },
			},
		],
	},
	{
		id: 'hello',
		title: '9. Full Hello World (i18n + Toast + HTTP)',
		items: [
			{
				id: 'hello-full',
				title: '9.1 Full Hello World App.tsx',
				dateLabel: TODAY,
				description:
					'A one-shot integration of §5 i18n, §4 base component, §6 permission-guarding, and error handling — a ready-to-copy template. ' +
					'Drop it straight into your project src/App.tsx and all features are visible.',
				code: { lang: 'tsx', code: CODE_9_HELLO_WORLD },
			},
		],
	},
	{
		id: 'troubleshoot',
		title: '10. Troubleshooting',
		items: [
			{
				id: 'ts-invalid-hook',
				title:
					'10.1 "Invalid hook call. Hooks can only be called inside the body of a function component."',
				dateLabel: TODAY,
				description:
					'Typical root cause: two separate React instances inside your plugin build. How to diagnose:\n' +
					'1. Both react & react-dom MUST have singleton: true inside vite.config.ts shared.\n' +
					'2. Remove node_modules/.vite inside the plugin and restart pnpm dev.\n' +
					'3. Run pnpm ls react in BOTH the plugin AND the host; verify the same React major version.\n' +
					'4. Make sure when mounted by the host you do NOT call ReactDOM.createRoot(...).render(<App {...bridge} />) inside App again. The host already mounts your component; creating a second root guarantees a duplicate instance bug.',
			},
			{
				id: 'ts-cors',
				title:
					'10.2 CORS: "Access to script at remoteEntry.js from origin ... has been blocked"',
				dateLabel: TODAY,
				description:
					'1. Local dev: ensure plugin vite.config.ts server.cors = true.\n' +
					'2. Production: CDN / Nginx side must set Access-Control-Allow-Origin (see §8.2).\n' +
					'3. If using a third-party CDN (jsDelivr / unpkg / CF Pages), confirm its default CORS policy allows it.',
			},
			{
				id: 'ts-style-leak',
				title:
					'10.3 Style Leakage (plugin Tailwind bleeds into host global styles)',
				dateLabel: TODAY,
				description:
					'Two non-negotiable rules:\n' +
					'① Give your plugin Tailwind a unique prefix (e.g. hp-) so classes never collide with the host.\n' +
					'② Never include @tailwind base inside the plugin (it injects resets that break the host); keep only components + utilities.\n' +
					'Reference config:',
				code: { lang: 'javascript', code: CODE_10_3_TAILWIND_PREFIX },
			},
			{
				id: 'ts-bridge-undefined',
				title:
					'10.4 A bridge field is undefined even though I declared the permission',
				dateLabel: TODAY,
				description:
					'1. Cross-check against §7.2 — confirm Registry.permissions actually contains the value you think it does.\n' +
					'2. Open host logs; look for "permission filtered" warnings when PluginManager loads this plugin.\n' +
					'3. If the permission is http:plugin-api, additionally verify allowList.domains covers the exact domain (or parent domain) being requested, including subdomain match semantics.',
			},
			{
				id: 'ts-locale-not-change',
				title: '10.5 User switches language but plugin text stays the same',
				dateLabel: TODAY,
				description:
					'1. Confirm setLocale(locale) runs at the top of App() on every render (see §5.2).\n' +
					'2. Do NOT stash locale into a plugin-local useState; the single source of truth is always locale from HostBridge.\n' +
					'3. Host re-renders the plugin with fresh bridge props automatically; no manual event subscription is needed.',
			},
			{
				id: 'ts-mf-remote',
				title:
					'10.6 "Remote module not found" / "Shared module is not available for eager consumption"',
				dateLabel: TODAY,
				description:
					'1. Start order: start the plugin project FIRST, then start the host (host eagerly tries to connect to remoteEntry on boot).\n' +
					'2. Ensure both projects use the EXACT same version of @originjs/vite-plugin-federation.\n' +
					'3. Confirm build.modulePreload = false is set (Module Federation requires it off).\n' +
					'4. If this is your very first run and MF keeps failing, run pnpm dev --force in BOTH projects to bust stale dep caches.',
			},
		],
	},
];

/* =======================================================================
 *  对外导出 API
 * ======================================================================= */

export function getPluginGuideIntro(locale: string): string {
	return locale === 'en-US' ? introEn : introZh;
}

export function getPluginGuideSections(locale: string): PluginGuideSection[] {
	return locale === 'en-US' ? sectionsEn : sectionsZh;
}
