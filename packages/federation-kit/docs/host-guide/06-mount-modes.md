# 06 · 页面挂载：三种模式 + 组件与 slots 详解

> **本章目标**：讲清「子应用最终是怎么出现在页面里的」。覆盖：kit 底层的 `FederationPlugin`/`Plugin`、本仓皮肤化的 `PluginHostPage`/`PluginHostSurface`、slots（loading/error/shell）、hooks（usePluginEnabled/useHostSurfacePlugins），以及三种接入模式分别用什么。
>
> 对应源码：`packages/federation-kit/src/react/**`、`apps/frontend/src/federation/host/**`。

---

## 1. 三种挂载模式一览

| 模式 | 宿主侧代码 | registry 配置 | 典型场景 |
|------|-----------|---------------|----------|
| **自动路由注入** | 什么都不用写（kit 自动注入路由壳） | `injectRoute: true` + `routePath` | 插件有独立页面 |
| **业务内嵌挂载** | 业务页 `<PluginHostPage pluginId="xxx" />` | `injectRoute: false` | 插件是现有页面的一部分 |
| **iframe 隔离** | 同内嵌挂载（kit 自动切 iframe 渲染） | `trust: "untrusted"` + `iframeUrl` | 不可信第三方 |

> 三种模式共用同一份生命周期：`ensurePlugin → verifyPlugin → registerRemote → loadRemoteApp → createHostBridge → 渲染`。区别只在最后「渲染成什么」。

---

## 2. 底层组件：`FederationPlugin` / `Plugin`

`FederationPlugin` 是 kit 提供的**声明式挂载组件**（≈ `<micro-app name="xxx" />`），`Plugin` 是它的短别名。

```tsx
// 用法
import { FederationPlugin } from '@dnhyxc-ai/federation-kit/react';
// 或短别名
import { Plugin } from '@dnhyxc-ai/federation-kit/react';

// 挂载一个插件：name = registry 里的 id
<FederationPlugin name="learningNotes" />

// 自定义 loading/error UI 用 slots
<Plugin name="learningNotes" slots={{ loading: () => <Spin /> }} />
```

### 2.1 props 详解（`FederationPluginProps`）

```tsx
export type FederationPluginProps = {
  // 插件 id（与 registry 一致）；也可用 pluginId（两者等价，取其一）
  name?: string;
  pluginId?: string;
  // 挂到插件根节点的额外 className
  className?: string;
  // 是否为独立路由页（套统一外壳；自动路由注入时由路由工厂传 true）
  pageShell?: boolean;
  // 视图变体：'default' | 'toolbar'（toolbar 为顶栏紧凑态）
  variant?: 'default' | 'toolbar';
  // 兼容旧 part 写法：toolbar / drawer-triggers / drawer（影响 variant）
  part?: 'toolbar' | 'drawer-triggers' | 'drawer';
  // UI 插槽：loading / error / shell / missingIframeUrl / rootClassName
  slots?: PluginHostViewSlots;
  // 强制 locale（缺省跟随宿主）
  locale?: HostLocale;
  // 错误边界组件（插件 render 抛错时接住，不拖垮宿主）
  ErrorBoundary?: ComponentType<{ pluginId: string; children: ReactNode }>;
  // 覆盖默认 host（多实例/跨包双份时用）
  host?: FederationPluginHost;
};
```

### 2.2 核心实现逻辑（`packages/federation-kit/src/react/FederationPlugin.tsx`）

```tsx
export function FederationPlugin({
  name, pluginId, className, pageShell, variant, part, slots, locale: localeProp, ErrorBoundary, host: hostProp,
}: FederationPluginProps) {
  // 从 Context 或全局默认单例取 host（createFederation 默认 asDefault: true）
  const ctxHost = useFederationSafe();
  const host = hostProp ?? ctxHost;
  if (!host) throw new Error('[federation-kit] FederationPlugin 需要 createFederation() 或 FederationProvider');

  // id 归一化：pluginId ?? name
  const id = pluginId ?? name;
  if (!id) throw new Error('[federation-kit] FederationPlugin 需要 name 或 pluginId');

  // variant 归一化：显式 variant 优先；否则 part==='toolbar' 时用 toolbar
  const resolvedVariant: PluginHostViewVariant = variant ?? (part === 'toolbar' ? 'toolbar' : 'default');

  // locale 状态：优先 prop，否则跟随宿主（监听 onLocaleChange 热更新）
  const [locale, setLocale] = useState<HostLocale>(() => localeProp ?? host.config.capabilities.getLocale());

  useEffect(() => {
    if (localeProp) { setLocale(localeProp); return; }
    setLocale(host.config.capabilities.getLocale());
    // 订阅宿主语言变化：插件语言随宿主热切换
    return host.config.capabilities.onLocaleChange?.((next) => { setLocale(next); });
  }, [host, localeProp]);

  // iframe bridge 选项（untrusted 插件用）
  const iframeBridge: AttachIframeBridgeOptions = useMemo(() => host.getIframeBridgeOptions(), [host]);

  // 真正干活的是 PluginHostView（见下节）
  return createElement(PluginHostView, {
    pluginId: id,
    manager: host.manager,
    locale,
    iframeBridge,
    pageShell,
    variant: resolvedVariant,
    className,
    slots,
    ErrorBoundary,
  });
}
```

> **语义**：`FederationPlugin` 是个**薄包装**，负责「找 host、归一并 locale、算 variant」，最终把活交给 `PluginHostView`。真正的加载/状态机/渲染在 `PluginHostView`。

---

## 3. 核心视图：`PluginHostView`

`PluginHostView` 是挂载的心脏：**按需 ensure、管理 loading/error 状态、渲染 MF 组件或 iframe、做样式隔离**。

`packages/federation-kit/src/react/PluginHostView.tsx` 关键路径（逐行注释）：

```tsx
export function PluginHostView({
  pluginId, manager, locale, iframeBridge, pageShell, variant = 'default', className, slots, ErrorBoundary,
}: PluginHostViewProps) {
  // retryKey：用户点重试时 +1，触发重新 ensurePlugin（force）
  const [retryKey, setRetryKey] = useState(0);
  // busy：加载中标记。初始依据当前状态：未 activated 且未 failed → 认为是 busy（防首屏闪"不可用"）
  const [busy, setBusy] = useState(() => {
    const s = manager.get(pluginId)?.status;
    return s !== 'activated' && s !== 'failed';
  });
  // error：错误信息；初始取已 failed 插件存的 error
  const [error, setError] = useState<string | null>(() => {
    const cur = manager.get(pluginId);
    return cur?.status === 'failed' ? (cur.error ?? null) : null;
  });
  const [, bump] = useState(0);

  // 主 effect：确保插件加载
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cur = manager.get(pluginId);
      // 已激活：直接进入渲染态
      if (cur?.status === 'activated') {
        setBusy(false); setError(null); bump((n) => n + 1); return;
      }
      // 已失败且是首次（未重试过）：展示错误，不重复加载
      if (cur?.status === 'failed' && retryKey === 0) {
        setError(cur.error ?? null); setBusy(false); return;
      }

      // 其余情况（未加载 / 重试）：先标记 busy，再 ensurePlugin
      setBusy(true);
      setError(null);
      try {
        // retryKey > 0 表示是"重试"，强制重新加载（force）
        await manager.ensurePlugin(pluginId, { force: retryKey > 0 });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) { setBusy(false); bump((n) => n + 1); }
      }
    })();
    return () => { cancelled = true; };
  }, [pluginId, retryKey, manager]);

  // 取当前加载状态
  const loaded: LoadedPlugin | undefined = manager.get(pluginId);
  const entry = loaded?.meta.entry;
  const trust = loaded?.meta.trust;
  const status = loaded?.status;

  // 激活后：挂样式隔离（把插件样式限制在 data-mf-style-realm 子树内）
  useLayoutEffect(() => {
    if (status !== 'activated' || trust === 'untrusted' || !entry) return;
    return attachPluginStyleIsolation(pluginId, entry, loaded?.meta.remoteName);
  }, [pluginId, status, entry, trust, loaded?.meta.remoteName]);

  // 激活后：把当前 locale 广播给插件（插件用 eventBus 订阅）
  useEffect(() => {
    if (status !== 'activated') return;
    eventBus.emit(pluginId, 'locale', locale);
  }, [pluginId, status, locale]);

  // 实时 bridge：把最新 locale 覆写到 bridge（withLiveLocale）
  const liveBridge = useMemo(
    () => (loaded?.bridge ? withLiveLocale(loaded.bridge, locale) : null),
    [loaded?.bridge, locale],
  );

  // 渲染分支
  if (loaded?.status === 'activated') {
    // ── 分支 A：untrusted → 渲染 iframe + postMessage bridge ──
    if (loaded.meta.trust === 'untrusted') {
      const src = loaded.meta.iframeUrl?.trim();
      if (!src) {
        return wrap(slots?.missingIframeUrl?.({ pluginId }) ?? <div>missing iframeUrl: {pluginId}</div>);
      }
      const body = <UntrustedIframe pluginId={pluginId} src={src} bridge={loaded.bridge} iframeBridge={iframeBridge} />;
      return wrap(Bound ? <Bound pluginId={pluginId}>{body}</Bound> : body);
    }

    // ── 分支 B：MF（React/Vue）→ 渲染插件组件 ──
    if (!liveBridge) return null;
    const Comp = loaded.mod.default;
    const realm = styleRealmKey(loaded.meta.entry, loaded.meta.remoteName, pluginId);
    const body = (
      <div
        className={[slots?.rootClassName, className, `plugin-${pluginId}`, 'h-full w-full min-h-0'].filter(Boolean).join(' ')}
        data-mf-plugin={pluginId}          // 标记插件根
        data-mf-style-realm={realm}        // 样式隔离域标记
        data-plugin-root
      >
        {/* 把 bridge 作为 props 传给插件组件 */}
        <Comp {...liveBridge} />
      </div>
    );
    return wrap(Bound ? <Bound pluginId={pluginId}>{body}</Bound> : body);
  }

  // ── 加载中 / 失败 ──
  const failed = Boolean(error) || loaded?.status === 'failed';
  if (busy || loaded?.status === 'loading' || !failed) {
    return wrap(slots?.loading?.({ pluginId, variant }) ?? <div>loading {pluginId}…</div>);
  }
  const detail = error || loaded?.error || 'failed';
  return wrap(
    slots?.error?.({ pluginId, error: detail, busy, retry: () => setRetryKey((n) => n + 1), variant }) ??
    (<div>unavailable {pluginId}: {detail} <button onClick={() => setRetryKey((n) => n + 1)}>retry</button></div>),
  );
}
```

### 3.1 三个渲染分支的语义

| 分支 | 触发条件 | 语义 |
|------|----------|------|
| **untrusted iframe** | `loaded.meta.trust === 'untrusted'` | 插件代码不可信，不跑 MF；渲染 `iframe` + `attachIframeBridge`（postMessage） |
| **MF 组件** | 其余 activated | 渲染 `loaded.mod.default`（React 组件或 Vue 桥），props 传 bridge，套样式隔离 realm |
| **loading/error** | 未加载 / 失败 | 用 slots 展示加载中 / 失败 + 重试 |

---

## 4. 本仓皮肤化：`PluginHostPage`

`PluginHostPage` 是 `FederationPlugin` 的**设计皮肤包装**：把本仓的 Loading、错误文案、错误边界、路由外壳全部默认化，业务页一行搞定。

`apps/frontend/src/federation/host/PluginHostPage.tsx`（核心结构，逐行注释）：

```tsx
import {
  FederationPlugin,
  type PluginHostViewSlots,
} from '@dnhyxc-ai/federation-kit/react';
import Loading from '@/components/design/Loading';
import { Button, Spinner } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { mf, registerPluginHostPage } from '../runtime';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import { PluginPageShell } from './PluginPageShell';

type Props = {
  pluginId: string;
  className?: string;
  part?: 'toolbar' | 'drawer-triggers' | 'drawer';
  pageShell?: boolean;
  slots?: PluginHostViewSlots;
};

export function PluginHostPage({ pluginId, className, part, pageShell, slots: slotsOverride }: Props) {
  const { locale, t } = useI18n();

  // 默认 slots：loading / error / shell / missingIframeUrl / rootClassName
  const defaultSlots: PluginHostViewSlots = {
    // 根节点类名：业务传入的 className
    rootClassName: cn(className),
    // shell：pageShell=true 时套统一路由外壳（边距 + 圆角）
    shell: (node) => <PluginPageShell>{node}</PluginPageShell>,
    // iframe 缺地址的兜底
    missingIframeUrl: ({ pluginId: id }) => (
      <div className="text-muted-foreground p-6 text-sm">{t('plugins.host.missingIframeUrl', { id })}</div>
    ),
    // loading：toolbar 紧凑态 vs 全页卡
    loading: ({ pluginId: id, variant: v }) => {
      if (v === 'toolbar') {
        return (
          <div className="text-textcolor h-full w-full flex items-center justify-center">
            <div className="flex items-center gap-2 px-2">
              <Spinner className="text-muted-foreground size-4" />
              loading...
            </div>
          </div>
        );
      }
      const card = (
        <div className="bg-theme-background h-full p-4.5 rounded-md">
          <Loading text={t('plugins.host.loadingNamed', { id })} className="flex items-center h-full" />
        </div>
      );
      if (!pageShell) return card;
      return <div className="mx-auto text-textcolor h-full flex flex-col gap-3 p-5.5 pt-0">{card}</div>;
    },
    // error：显示错误 + 重试按钮（toolbar 用 Tooltip 收纳）
    error: ({ pluginId: id, error, retry, busy, variant: v }) => {
      // ...（与 loading 类似的分支，含 Button 重试）
    },
  };

  // 合并：业务 slotsOverride 覆盖默认；shell 特殊处理（内嵌时默认不透传 shell）
  const slots: PluginHostViewSlots = {
    ...defaultSlots,
    ...slotsOverride,
    shell: slotsOverride?.shell ?? (pageShell ? defaultSlots.shell : (node) => node),
  };

  return (
    <FederationPlugin
      host={mf}                    // 显式传本仓的 mf 实例
      name={pluginId}
      className={className}
      pageShell={pageShell}
      part={part}
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      slots={slots}
      ErrorBoundary={PluginErrorBoundary} // 插件崩溃不拖垮宿主
    />
  );
}

// 模块加载时自注册：路由工厂 createPluginRoute 需要它
registerPluginHostPage(PluginHostPage);
```

### 4.1 用法

```tsx
// 业务内嵌（英语笔记页示例）：pageShell 缺省 false，不套路由外壳
import { PluginHostPage, usePluginEnabled } from '@/federation';

function LearningNotesPage() {
  // 检查插件是否上架（订阅偏好）
  const enabled = usePluginEnabled('learningNotes');
  return (
    <div>
      {enabled ? (
        // 已上架：挂载插件
        <PluginHostPage pluginId="learningNotes" />
      ) : (
        // 未上架：显示降级文案
        <p>{t('plugins.host.delisted')}</p>
      )}
    </div>
  );
}
```

> **语义**：`usePluginEnabled` 返回**上架布尔值**（订阅偏好变化自动刷新）。未上架的插件不渲染挂载点——既省请求又符合「下架即消失」。

---

## 5. 业务槽位：`PluginHostSurface`

`PluginHostSurface` 解决「一个业务区要挂多个插件，且不想手写 Drawer/触发器」的问题。它按 `surface` 从 registry 过滤出插件，再按 `part` 渲染成工具栏 / 抽屉触发器 / 抽屉内容。

`host.icon` 推荐存 **SVG 图片 URL**，由 `PluginIcon` 动态内联（**不必**再维护 Lucide 白名单）。完整实现见 [implements-guide/09-plugin-host-icons.md](../implements-guide/09-plugin-host-icons.md)。

`apps/frontend/src/federation/host/PluginHostSurface.tsx` 核心（逐行注释；图标已切到 `PluginIcon`）：

```tsx
import {
  claimPluginPortalTarget, clearPluginPortalClaim,
  type PluginDescriptor, pickPluginLocaleText, styleRealmKey,
} from '@dnhyxc-ai/federation-kit';
import { useHostSurfacePlugins } from '@dnhyxc-ai/federation-kit/react';
import { Button } from '@ui/index';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { PluginHostPage } from './PluginHostPage';
// 动态插件图标：registry host.icon 为 SVG URL 时 fetch 内联
import { PluginIcon } from './PluginIcon';

export type PluginHostSurfacePart = 'toolbar' | 'drawer-triggers' | 'drawer';

export function PluginHostSurface({
  surface, part, openPluginId = null, onOpenPluginIdChange, chromeStyle,
  filterPlugins, className, triggerClassName, drawerBodyClassName = 'py-2 pl-0',
}: PluginHostSurfaceProps) {
  const { locale } = useI18n();
  // 订阅：列出该 surface 下所有已上架插件（按 order 排序）
  const listed = useHostSurfacePlugins(surface);
  const all = filterPlugins ? filterPlugins(listed) : listed;
  // 按 slot 分流：抽屉类 vs 顶栏类
  const drawerPlugins = all.filter((p) => p.host?.slot === 'drawer');
  const toolbarPlugins = all.filter((p) => p.host?.slot === 'toolbar');

  // 渲染顶栏插件（part === 'toolbar'）
  if (part === 'toolbar') {
    if (toolbarPlugins.length === 0) return null;
    return (
      <div className={cn('contents', className)}>
        {toolbarPlugins.map((p) => (
          <div key={p.id} className="flex min-w-0 shrink items-center"
               data-plugin-host-slot="toolbar" data-plugin-host-surface={surface} data-plugin-id={p.id}>
            <PluginHostPage pluginId={p.id} className="h-auto! min-h-0 w-full max-w-full" part="toolbar" />
          </div>
        ))}
      </div>
    );
  }

  // 渲染抽屉触发器（part === 'drawer-triggers'）
  if (part === 'drawer-triggers') {
    if (drawerPlugins.length === 0) return null;
    return (
      <div className={cn('contents', className)}>
        {drawerPlugins.map((p) => {
          const label = pickPluginLocaleText(p.title, locale) || p.id;
          const open = openPluginId === p.id;
          return (
            <Tooltip key={p.id} side="bottom" content={label}>
              <Button
                type="button" variant="ghost" size="icon-sm"
                className={cn(
                  'lucide-stroke-draw-hover [&_svg]:overflow-visible',
                  open ? 'bg-theme/15 text-teal-500' : 'text-textcolor/80 hover:text-teal-500',
                  triggerClassName,
                )}
                aria-pressed={open} aria-label={label}
                data-plugin-host-slot="drawer-trigger" data-plugin-host-surface={surface} data-plugin-id={p.id}
                onClick={() => {
                  if (!open) {
                    // 打开前认领 portal 目标：插件内部 createPortal 到 body 的弹层会被重定向进插件样式域
                    claimPluginPortalTarget(p.id, styleRealmKey(p.entry, p.remoteName, p.id));
                  } else {
                    // 关闭时释放
                    clearPluginPortalClaim(p.id);
                  }
                  onOpenPluginIdChange?.(open ? null : p.id);
                }}
              >
                {/* 不再 resolveIcon(白名单)；URL → 内联 SVG，失败 Puzzle */}
                <PluginIcon name={p.host?.icon} className="size-4" />
              </Button>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  // 渲染抽屉本体（part === 'drawer'）
  const openMeta = drawerPlugins.find((p) => p.id === openPluginId);
  if (!openMeta) return null;
  // 抽屉打开期间保持 claim
  claimPluginPortalTarget(openMeta.id, styleRealmKey(openMeta.entry, openMeta.remoteName, openMeta.id));

  return (
    <Drawer
      title={pickPluginLocaleText(openMeta.title, locale) || openMeta.id}
      open={!!openPluginId}
      onOpenChange={(open) => {
        if (!open) { clearPluginPortalClaim(openPluginId); onOpenPluginIdChange?.(null); }
      }}
      bodyClassName={drawerBodyClassName}
      contentStyle={chromeStyle}
    >
      <div className={cn('relative flex h-full min-h-0 flex-col', className)}
           data-plugin-host-slot="drawer" data-plugin-host-surface={surface} data-plugin-id={openMeta.id}>
        {openPluginId ? <PluginHostPage pluginId={openPluginId} part="drawer" /> : null}
      </div>
    </Drawer>
  );
}
```

### 5.1 业务页调用（本仓电子书阅读页真实用法）

```tsx
// apps/frontend/src/views/ebook/read.tsx（调用点摘录）
import { PluginHostSurface } from '@/federation';

// 阅读页状态：当前打开的插件 id
const [openPluginId, setOpenPluginId] = useState<string | null>(null);

// 1) 顶栏区域：内联 toolbar 插件（如翻译助手）
<PluginHostSurface surface="ebook.read" part="toolbar" />

// 2) 抽屉触发器：渲染该 surface 下 slot=drawer 的插件图标按钮
<PluginHostSurface
  surface="ebook.read"
  part="drawer-triggers"
  openPluginId={openPluginId}
  onOpenPluginIdChange={setOpenPluginId}
/>

// 3) 抽屉内容：当前打开的插件正文
<PluginHostSurface surface="ebook.read" part="drawer" openPluginId={openPluginId} onOpenPluginIdChange={setOpenPluginId} />
```

> **语义**：新增一个「电子书阅读页」插件，只需在 registry 里写 `host: { surface: 'ebook.read', slot: 'drawer', icon: '<SVG URL>' }` 并部署——阅读页代码**一行都不用改**。这就是「槽位」模式的价值：**插件自动出现在对应业务区**。

---

## 6. Hooks 速查

| Hook | 返回 | 语义 |
|------|------|------|
| `usePluginEnabled(id)` | `boolean` | 某插件是否上架（订阅偏好，变化自动重渲染） |
| `usePluginEnabledState(id)` | `{ enabled, ready }` | 上架 + 偏好是否就绪（`ready=false` 时别把 false 当已下架） |
| `useHostSurfacePlugins(surface)` | `PluginDescriptor[]` | 某 surface 下已上架插件列表（按 order） |
| `useFederation()` | `FederationHost` | 取默认/Context 的 mf 实例（无则抛错） |
| `useFederationSafe()` | `FederationHost \| null` | 同上的安全版（无则返回 null） |

### 6.1 `usePluginEnabledState` 实现

```ts
// packages/federation-kit/src/react/usePluginEnabled.ts
export function usePluginEnabledState(pluginId: string): PluginEnabledState {
  // 初始状态：同步读当前上架值与偏好就绪标记
  const [state, setState] = useState<PluginEnabledState>(() => ({
    enabled: isPluginEnabled(pluginId),
    ready: isEnabledPrefsReady(),
  }));

  useEffect(() => {
    // sync：重新读取并 setState
    const sync = () => setState({
      enabled: isPluginEnabled(pluginId),
      ready: isEnabledPrefsReady(),
    });
    sync();
    // 订阅偏好变化：上架/下架/登录后自动刷新
    return subscribePluginEnabled(sync);
  }, [pluginId]);

  return state;
}
```

> **ready 的意义**：账号偏好是异步拉取的。在拉完之前 `get` 会返回 false，但 `ready=false` 提示调用方「这不是真的下架，只是还没拉回来」，避免 UI 把「未加载」闪成「已下架」。

---

## 7. slots 自定义示例（换皮不用改 kit）

```tsx
// 自定义 loading / error / shell
<FederationPlugin
  name="videoPlayer"
  slots={{
    // 自定义加载态
    loading: () => <div className="animate-pulse">视频加载中…</div>,
    // 自定义失败态（可带重试）
    error: ({ error, retry }) => (
      <div>
        <p>加载失败：{error}</p>
        <button onClick={retry}>重试</button>
      </div>
    ),
    // 自定义外壳
    shell: (node) => <div className="p-4">{node}</div>,
  }}
/>
```

---

## 8. 本章小结

| 需求 | 用什么 |
|------|--------|
| 独立页面插件 | 自动路由注入（kit 自动渲染 `PluginHostPage` + pageShell） |
| 嵌入业务页 | `<PluginHostPage pluginId="xxx" />` + `usePluginEnabled` |
| 业务区多个插件 | `<PluginHostSurface surface="..." part="..." />` |
| 换 Loading/错误 UI | `FederationPlugin` 的 `slots` |
| 判断上架 | `usePluginEnabled` / `usePluginEnabledState` |
| 崩溃保护 | `ErrorBoundary` prop（本仓用 `PluginErrorBoundary`） |

> 下一步：[07-bridge-permissions.md](./07-bridge-permissions.md) 插件能拿到什么（HostBridge + permissions + capabilities）。
