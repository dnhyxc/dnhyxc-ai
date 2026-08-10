# 11 · 插件内 i18n：自有字典 + 跟随 Host locale

> **本章目标**：讲清插件的多语言**必须自维护**（Host 不注入 `api.t`），并给出 `src/i18n/` 目录结构、`useI18n()` 字典查询、`useHostLocale(api)` 跟随 Host 切换，以及「独立预览 / MF 嵌入 / iframe」三种模式各自的 locale 来源。照抄即可用。
>
> 对应源码：`packages/federation-kit/src/types/localeText.ts`（`HostLocale` / `PluginLocaleMap` / `pickPluginLocaleText`，Host 渲染你的标题时用）；参考实现：本仓外 `apps/remote-plugins/src/hooks/useHostLocale.ts`。

---

## 1. 铁律：Host 不注入 `api.t`

| 命题 | 说明 |
|------|------|
| **Host 没有 `api.t`** | `HostBridgeProps.api` 里只有 `theme` / `locale` / `event` / `navigate?` / `http?` / `ui?` / `modules?`。**没有翻译函数**。 |
| **插件自备字典** | 你项目里出现的所有 UI 文案，都由你自己的 `src/i18n/` 字典输出。 |
| **只跟随 `api.locale`** | 你在意的是「Host 现在是什么语言」，据此切到自己的字典对应语言。 |
| **registry 文案是另一套** | Host 侧栏 / 插件中心显示的 `title` / `description` 是 Host 用 `pickPluginLocaleText` 从 registry 的 locale map 取的（见第 13 章）。那是「别人给你展示的名字」，不是你 UI 里的文案。 |

> **为什么这样设计**：Host 与插件生命周期解耦。Host 升级语言包、插件升版本都互不影响；插件可以有自己的语言集合（比如只有 `zh-CN`，或额外支持 `ja-JP`）。Host 只给一个「当前语言快照 + 变更事件」。

---

## 2. 推荐目录结构

```text
src/
├── i18n/
│   ├── types.ts            # Locale 类型定义（与 Host 对齐）
│   ├── locales/
│   │   ├── zh-CN.ts        # 中文文案字典
│   │   └── en-US.ts        # 英文文案字典
│   └── index.ts            # getActiveLocale / translateSync / applyHostLocale / useI18n
├── hooks/
│   ├── i18n.ts             # useI18n() 组件内取 t
│   └── useHostLocale.ts    # 跟随 Host 语言切换的 hook
```

---

## 3. `types.ts`：语言类型（对齐 Host）

```ts
// src/i18n/types.ts —— 语言类型只取 Host 声明的两种；后续要扩展先改这里
// 与 packages/federation-kit/src/types/localeText.ts 的 HostLocale 对齐
export type Locale = 'zh-CN' | 'en-US';

// 类型守卫：运行时确认一个值是不是合法语言
// 独立预览时 URL 参数 / localStorage 可能是脏值，用它兜底
export function isLocale(v: unknown): v is Locale {
	return v === 'zh-CN' || v === 'en-US';
}
```

> **意图**：`Locale` 是一个**联合类型**，让 `t()` 的 key 输入有类型提示；`isLocale` 用来过滤从不可信来源（URL / localStorage / 外部事件）进来的值。

---

## 4. 文案字典：`locales/zh-CN.ts` 与 `locales/en-US.ts`

```ts
// src/i18n/locales/zh-CN.ts —— 中文文案
// 扁平 key，和 en-US 保持同构；组件里 t('home.title') 即可取
export const zhCN = {
	home: {
		title: '示例插件',
		desc: '这是插件自己的文案，不依赖 Host 语言包。',
	},
	common: {
		toast: '你好！',
		fetch: '获取数据',
		detail: '查看详情',
		thread: '打开聊天',
		connecting: '正在连接主站…',
	},
} as const;
```

```ts
// src/i18n/locales/en-US.ts —— 英文文案（结构与 zh-CN 完全一致）
export const enUS = {
	home: {
		title: 'Demo plugin',
		desc: 'Plugin-owned copy, independent from the Host language pack.',
	},
	common: {
		toast: 'Hello!',
		fetch: 'Fetch',
		detail: 'Detail',
		thread: 'Open chat',
		connecting: 'Connecting to host…',
	},
} as const;
```

> **意图**：两套字典是**对象常量**，key 路径一一对应。`as const` 让 `t('home.title')` 的 key 输入在 TS 里可被校验（见 §5 的 `Key` 类型）。文案集中在一处，方便翻译协作与复用。

---

## 5. 核心运行时：`i18n/index.ts`

这是插件的 i18n 心脏，职责拆成三块：**当前语言状态**、**同步取词**、**应用语言**。

```ts
// src/i18n/index.ts —— 插件 i18n 运行时
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';
import { isLocale, type Locale } from './types';

// 文案表：语言 -> 字典对象
const messages = { 'zh-CN': zhCN, 'en-US': enUS } as const;

// 由字典推导出的 key 类型：'home.title' | 'home.desc' | 'common.toast' | …
// 这样写错 key 在编译期就报错，而不是运行时空字符串
export type TranslationKey = {
	// 把 zhCN 的嵌套对象拍平成点分 key 的联合类型
	[K in keyof typeof zhCN]: {
		[P in keyof (typeof zhCN)[K]]: `${K & string}.${P & string}`;
	}[keyof (typeof zhCN)[K]];
}[keyof typeof zhCN];

// —— 存储 key 必须与 Host 隔离 ——
// 前缀用 remote_plugins_，避免和 Host 自己的语言 localStorage 冲突
const STORAGE_KEY = 'remote_plugins_locale_bootstrap';

// —— 语言状态（模块级单例）——
// 初始值先读持久化存储；没有就退回 zh-CN
let activeLocale: Locale =
	(readStoredLocale() as Locale | null) ?? 'zh-CN';

// 读取持久化的语言（独立预览时用；嵌 Host 后会被 api.locale 覆盖）
function readStoredLocale(): string | null {
	try {
		// 仅读自己命名空间的 key，绝不去碰 Host 的语言 key
		return window.localStorage.getItem(STORAGE_KEY);
	} catch {
		// SSR / 隐私模式等 localStorage 不可用时静默降级
		return null;
	}
}

// 写入持久化语言
function writeStoredLocale(locale: Locale): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, locale);
	} catch {
		/* 忽略写入失败：不影响本次渲染 */
	}
}

// 读取当前语言（含持久化回退）
export function getActiveLocale(): Locale {
	return activeLocale;
}

// 同步翻译：key 若不存在回退到 key 本身，避免页面出现大段 undefined
export function translateSync(key: TranslationKey): string {
	// 先取当前语言字典，再逐层取值
	const dict = messages[activeLocale] ?? zhCN;
	const value = key.split('.').reduce<unknown>((acc, part) => {
		if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
		return undefined;
	}, dict);
	// 找不到 key 时返回 key，方便一眼定位缺失文案
	return typeof value === 'string' ? value : key;
}

// 应用语言：更新状态、持久化、触发订阅者重渲染
export function applyHostLocale(locale: Locale): void {
	if (locale === activeLocale) return; // 相同则跳过，避免无意义重渲染
	activeLocale = locale;
	writeStoredLocale(locale);
	notifyLocaleChange();
}

// —— 语言变更订阅（useI18n 内部用）——
type Listener = (locale: Locale) => void;
const listeners = new Set<Listener>();

function notifyLocaleChange(): void {
	// 复制一份再遍历，防止订阅者在回调里改集合导致遍历异常
	listeners.forEach((l) => l(activeLocale));
}

export function subscribeLocale(listener: Listener): () => void {
	listeners.add(listener);
	// 返回退订函数，配合 React effect 的清理
	return () => listeners.delete(listener);
}
```

> **意图拆解**：
> - `STORAGE_KEY` 用 `remote_plugins_` 前缀——这是**与 Host 隔离**的关键，绝不复用 Host 自己的语言 key（否则独立预览写的语言会污染主站、反之亦然）。
> - `applyHostLocale` 是**唯一入口**：MF 模式 `useHostLocale` 调它，iframe 模式 `init` / `locale` 消息也调它，独立预览 URL/localStorage 也调它。统一入口保证状态只有一个来源。
> - 订阅机制让组件**不依赖 React Context** 也能响应语言切换——iframe 里没有 React 的 Provider 也能用同一套字典逻辑。

---

## 6. `useI18n` 与 `useHostLocale`

### 6.1 `src/hooks/i18n.ts`：组件内取词

```ts
// src/hooks/i18n.ts —— React 组件内用的取词 hook
import { useSyncExternalStore } from 'react';
import { getActiveLocale, subscribeLocale, translateSync, type TranslationKey } from '@/i18n';

export function useI18n() {
	// useSyncExternalStore：语言一变，订阅回调触发 re-render
	const locale = useSyncExternalStore(subscribeLocale, getActiveLocale);

	// 返回一个稳定的 t 函数；组件里 const { t } = useI18n() 即可
	const t = (key: TranslationKey): string => translateSync(key);

	return { locale, t };
}
```

> **意图**：用 `useSyncExternalStore`（React 18+）订阅语言变更，而不是自己写 `useState + useEffect`。好处是**并发渲染安全**（无撕裂）、且组件从订阅到渲染零额外开销。`t` 是纯函数，能放心放进依赖数组。

### 6.2 `src/hooks/useHostLocale.ts`：跟随 Host 语言

```ts
// src/hooks/useHostLocale.ts —— 插件模式跟随 Host；独立预览无 locale 时静默
import { useEffect } from 'react';
import { applyHostLocale } from '@/i18n';
import { isLocale, type Locale } from '@/i18n/types';

// 参数类型：只声明你真正用到的 api 字段，方便独立预览 mock
type LocaleApi = {
	locale?: Locale;
	event?: {
		on: (event: string, handler: (data?: unknown) => void) => void;
		off: (event: string, handler: (data?: unknown) => void) => void;
	};
};

export function useHostLocale(api?: LocaleApi) {
	// ① 快照：api.locale 变化时立即应用
	//    独立预览时 mockApi 不传 locale，isLocale 兜底为 false，这里静默跳过
	useEffect(() => {
		if (isLocale(api?.locale)) applyHostLocale(api.locale);
	}, [api?.locale]);

	// ② 事件：订阅 Host 的 'locale' 事件，覆盖顶栏运行时切换语言
	useEffect(() => {
		const event = api?.event;
		if (!event) return; // 独立预览没有 event 能力，直接跳过

		// 事件回调里收到的 data 就是新语言值
		const onLocale = (data?: unknown) => {
			if (isLocale(data)) applyHostLocale(data);
		};

		// 订阅并返回退订（effect 清理时自动 off，避免内存泄漏）
		event.on('locale', onLocale);
		return () => event.off('locale', onLocale);
	}, [api?.event]);
}
```

> **意图**：
> - **两个 effect 各司其职**：快照覆盖「挂载时 Host 已是某语言」，事件覆盖「运行中切换语言」。两者互不冲突，`applyHostLocale` 内部对相同值直接返回。
> - **判空 + isLocale 兜底**：保证独立预览（无 locale / 无 event）不报错、不误切。
> - iframe 模式不用这个 hook（`event` 是 no-op），改用第 8 章 `connectIframeHost` 里的 `init.locale` + `locale` 消息（§9 汇总）。

---

## 7. 在组件里使用

```tsx
// src/App.tsx —— 完整的 i18n 使用示例
import { useHostLocale, useI18n } from '@/hooks';
import type { HostBridgeProps } from '@/types/host';

export default function App({ api, plugin }: HostBridgeProps) {
	// 取词与跟随语言各一行
	const { t } = useI18n();
	useHostLocale(api);

	return (
		<div className="plugin-standalone" data-plugin-root>
			{/* 用 t() 取文案；key 是类型安全的 */}
			<h1>{t('home.title')} · {plugin.id} v{plugin.version}</h1>
			{/* 想显示当前语言时读 t() 返回的 locale，或直接 api.locale */}
			<p>{t('home.desc')}（locale={api.locale}）</p>
			<button
				type="button"
				// toast 也走字典，保证全量文案多语言
				onClick={() => api.ui?.showToast({ message: t('common.toast') })}
			>
				{t('common.toast')}
			</button>
		</div>
	);
}
```

> **要点**：组件里**所有**对用户可见的字符串都走 `t()`。漏掉一处 = 那个语言下出现中文或英文混排。验收时双语各过一遍（第 13 章）。

---

## 8. 独立预览时的 locale（URL + localStorage）

独立预览（`pnpm dev`）时没有 Host，所以语言来源有两个：

```ts
// src/main.tsx —— 独立预览入口（i18n 相关片段）
import './styles.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyHostLocale } from '@/i18n';
import { isLocale } from '@/i18n/types';
import { mockApi, mockPlugin } from '@/utils/mockHost';

// ① 先看 URL 参数：?lang=en-US 直接生效（便于快速预览某个语言）
const urlLang = new URLSearchParams(window.location.search).get('lang');
if (isLocale(urlLang)) applyHostLocale(urlLang);

// ② mockApi 故意不传 locale —— 让 useHostLocale 在快照分支静默跳过
//    独立预览的语言完全由自己管（URL / localStorage），不混入插件模式的逻辑
const api = mockApi({
	ui: { showToast: (o) => console.info('[toast]', o.message) },
});

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App api={api} plugin={mockPlugin('myPlugin', '/my-plugin', '1.0.0')} />
	</StrictMode>,
);
```

> **意图**：`mockApi` **不传** `locale` 是刻意为之——它要模拟「插件模式之外」的初始态，把语言切换完全交给本地逻辑（URL 参数或手动调 `applyHostLocale`），这样两种场景（预览 vs 嵌入）不会互相串。切语言下拉可调用 `applyHostLocale('en-US')` 模拟 Host 切换效果。

---

## 9. 三种模式的 locale 来源总表

| 模式 | locale 来源 | `useHostLocale` 是否生效 | 备注 |
|------|-------------|--------------------------|------|
| **独立预览** | URL `?lang=` → `localStorage`（`remote_plugins_locale_bootstrap`）；mockApi **不传** locale | 快照分支静默跳过；事件分支无 `event` 也跳过 | 语言完全自己管 |
| **MF 嵌入**（方式一 / 二） | props `api.locale`（快照）+ `event('locale')`（热更新） | ✅ 两个 effect 都生效 | 首选方案 |
| **iframe 隔离**（方式三） | `init` 消息带 `locale`（快照）+ `type:'locale'` 消息（热更新），**没有 `event`** | ❌ `event` 是 no-op，改用 `connectIframeHost` 内部回调 | 见第 8 章协议表 |

**iframe 模式的对齐写法**（在 `connectIframeHost` 收到消息处调用）：

```ts
// src/utils/iframeHostClient.ts —— locale 相关片段（完整见第 8 章）
import { applyHostLocale } from '@/i18n';
import { isLocale } from '@/i18n/types';

// 握手成功后 Host 会发 init 消息，内含当前 locale
case 'init':
	// init.data.locale 就是 Host 当前语言；应用它
	if (isLocale(msg.data?.locale)) applyHostLocale(msg.data.locale);
	break;

// 运行时语言切换，Host 发 type:'locale' 消息
case 'locale':
	// data 是新语言值，与 MF 模式 event('locale') 收到的数据一致
	if (isLocale(msg.data)) applyHostLocale(msg.data);
	break;
```

> **一致性**：三种模式最终都收敛到 `applyHostLocale`，所以你的组件**不用关心**自己跑在哪种模式——`useI18n().t` 永远是对的。这正是把 i18n 运行时独立成模块（而非写死在 React Context）的意义。

---

## 10. 检查表

| 检查项 | 要求 |
|--------|------|
| 无 `api.t` 依赖 | 组件文案全部来自自有字典 |
| 字典完备 | `zh-CN` / `en-US` key 同构，无漏 key |
| 存储隔离 | 持久化 key 带 `remote_plugins_` 前缀，不碰 Host 的 key |
| 跟随 Host | MF 模式必须调用 `useHostLocale(api)` |
| 类型安全 | `t()` 的 key 有 TS 类型（`TranslationKey`） |
| 独立预览可切语言 | URL `?lang=` 或本地切语言控件生效 |
| iframe 模式 | `init.locale` + `locale` 消息两处都 `applyHostLocale` |
| registry 标题文案 | `title` / `description` 配 locale map（第 13 章），与内部字典是两套 |
