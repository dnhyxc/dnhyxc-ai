# `useChatCodeFloatingToolbar` 源码逐段说明

本文档对应 **`apps/frontend/src/hooks/useChatCodeFloatingToolbar.tsx`**，说明每一部分代码在做什么、为何这样写，以及与 **`layoutChatCodeToolbars`**、`ChatCodeToolbarFloating`（Portal 吸顶代码栏）的关系。

背景：Markdown 围栏代码块的内联工具栏在 **ScrollArea** 等带 `overflow` 的祖先内无法用普通 `position: fixed` 正确参照视口，故由 **`@/utils/chatCodeToolbar`** 把几何算好后，由 **`ChatCodeToolbarFloating`** 通过 **Portal** 挂到 **`document.body`**。本 Hook 负责在合适的时机调用 **`layoutChatCodeToolbars(viewport)`**，避免各页面重复写 `resize` / `ResizeObserver` / `rAF` 等样板代码。

---

## 第 1–9 行：导入

| 行号 | 代码                                                                                                   | 作用                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–7  | `import { type DependencyList, type RefObject, useCallback, useEffect, useLayoutEffect } from 'react'` | 引入 React 类型与 Hook：`DependencyList` 用于展开依赖数组；`RefObject` 约束 viewport ref；`useCallback` 稳定 `relayout` 引用；`useEffect` 处理副作用（异步/浏览器事件）；`useLayoutEffect` 在浏览器绘制前同步执行，适合与 DOM 几何相关的布局。 |
| 8    | `import ChatCodeToolbarFloating from '@/components/design/ChatCodeToolBar'`                            | 实际渲染浮动工具栏的组件（内部 `useSyncExternalStore` + `createPortal`），由 **`ChatCodeFloatingToolbar`** 再导出，便于与 Hook 同文件消费。                                                                                                    |
| 9    | `import { layoutChatCodeToolbars } from '@/utils/chatCodeToolbar'`                                     | 核心布局函数：根据 viewport 内 `[data-chat-code-block]` 等节点计算是否显示吸顶条、位置与宽度，并更新全局 store 供浮动层订阅。                                                                                                                  |

---

## 第 11 行：空依赖常量

| 行号 | 代码                                   | 作用                                                                                                                                                          |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11   | `const emptyDeps: DependencyList = []` | 模块级**常量空数组**。当调用方未传 `layoutDeps` / `passiveScrollDeps` 时，用同一引用替代每次 `?? []` 新数组，避免依赖数组引用每帧变化导致 effect 无意义重跑。 |

---

## 第 13–26 行：选项类型 `UseChatCodeFloatingToolbarOptions`

| 行号 | 代码                                                      | 作用                                                                                                                                                                                                                                                                           |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13   | `export type UseChatCodeFloatingToolbarOptions = { ... }` | 导出配置类型，供调用方获得类型提示与文档。                                                                                                                                                                                                                                     |
| 18   | `layoutDeps?: DependencyList`                             | **可选**。当这些依赖变化时（例如 `chatData`、`markdown`、`messages` 引用或内容更新），触发「双帧重新 layout」与 **ResizeObserver 重绑**，保证 Markdown 渲染变高、列表变化后吸顶条仍正确。注释要求调用方传**稳定**依赖数组，避免 `render` 里写 `[x]` 字面量导致依赖身份每帧变。 |
| 23   | `passiveScrollLayout?: boolean`                           | **可选**。为 `true` 时在 **viewport DOM** 上额外注册原生 **`scroll`（passive）**，每滚动事件调用布局。用于 **ChatBotView**：与 React **`onScroll`** 并存，减少「只依赖合成事件时偶发跟手不及时」的情况。                                                                       |
| 25   | `passiveScrollDeps?: DependencyList`                      | **可选**。当 `passiveScrollLayout` 为 `true` 时，这些依赖变化会**拆掉再挂上** scroll 监听，用于 **会话 id / 消息条数** 变化后 viewport 仍正确绑定（同一 ref 指向新会话内容时重新订阅）。                                                                                       |

---

## 第 28–36 行：`useChatCodeFloatingToolbar` 的 JSDoc

概括 Hook 负责的四类触发源（resize、ResizeObserver、layoutDeps、可选 passive scroll），并说明返回的 **`relayout`** 可在业务 **`onScroll`** 里再调，且对 **`layoutChatCodeToolbars`** 而言**幂等**（多次调用仅重复计算同一份几何）。

---

## 第 37–47 行：函数签名与选项归一化、`relayout`

| 行号  | 代码                                                                                                  | 作用                                                                                                                                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 37–40 | `export function useChatCodeFloatingToolbar(viewportRef, options?): { relayout }`                     | 对外 API：传入指向**滚动视口**的 ref（一般为 **Radix ScrollArea** 转发到 **viewport** 的那个 DOM）；`options` 可选。                                                                                                                                |
| 41    | `const layoutDeps = options?.layoutDeps ?? emptyDeps`                                                 | 未传时用模块级 `emptyDeps`，保证引用稳定。                                                                                                                                                                                                          |
| 42    | `const passiveScrollDeps = options?.passiveScrollDeps ?? emptyDeps`                                   | 同上，用于 passive scroll 的 effect 依赖。                                                                                                                                                                                                          |
| 43    | `const passiveScrollLayout = options?.passiveScrollLayout ?? false`                                   | 默认**不**挂原生 scroll，由调用方用 `onScroll` + `relayout` 即可的场景（如分享页、Monaco 预览）更简。                                                                                                                                               |
| 45–47 | `const relayout = useCallback(() => { layoutChatCodeToolbars(viewportRef.current); }, [viewportRef])` | **稳定函数**：读取当前 `viewportRef.current`，交给 **`layoutChatCodeToolbars`**。`viewport` 为 `null` 时工具函数内部会清空浮动状态（隐藏条）。依赖只列 `viewportRef`（ref 对象本身不变，`.current` 变化不触发 `useCallback` 更新，符合 ref 用法）。 |

---

## 第 49–53 行：卸载时清空全局浮动状态

| 行号  | 代码                                                                        | 作用                                                                                                                                                                                                     |
| ----- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 49–53 | `useEffect(() => { return () => { layoutChatCodeToolbars(null); }; }, []);` | **仅挂载一次**，在组件**卸载**时执行清理：`layoutChatCodeToolbars(null)` 将内部 store 置为隐藏，避免离开页面后 Portal 仍显示上一页的吸顶条。空依赖 `[]` 表示不随 props 重跑，只在挂载/卸载生命周期生效。 |

---

## 第 55–59 行：窗口尺寸变化

| 行号  | 代码                        | 作用                                                                                                                                                                                                                                                             |
| ----- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 55–59 | `useEffect` + `resize` 监听 | 浏览器窗口或整页缩放导致 **viewport 的 `getBoundingClientRect()`** 变化时，需重算代码块与视口的相对位置。监听 **`window`** 的 **`resize`**，回调里再次 **`layoutChatCodeToolbars(viewportRef.current)`**（与 `relayout` 等价逻辑）。清理函数移除监听，防止泄漏。 |

---

## 第 61–91 行：ResizeObserver + ref 晚就绪时的 rAF 重试

| 行号  | 代码                             | 作用                                                                                                                                                                                                                                                                 |
| ----- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 61–64 | `let ro`, `cancelled`, `raf`     | 在 effect 闭包内保存 **ResizeObserver** 实例、是否已卸载、当前 **requestAnimationFrame** id，供清理时使用。                                                                                                                                                          |
| 66–73 | `attach()`                       | 若 **`viewportRef.current`** 存在且未 `cancelled`：先 **`ro?.disconnect()`** 再新建 **`ResizeObserver`**，回调里调用 **`relayout()`**（viewport 尺寸或内部内容撑开时触发）；然后 **`observe(el)`**。返回 **`true`** 表示挂载成功，**`false`** 表示当前帧还没有 DOM。 |
| 75–82 | `if (!attach()) { ... }`         | 首帧常见 **ScrollArea** 尚未把 ref 写到 viewport，**`attach` 失败**：用 **`requestAnimationFrame`** 轮询重试 **`attach`**，最多 **90 次**（约 1.5s@60Hz），避免 ref 永远不出现时**无限循环**。                                                                       |
| 84–88 | `return () => { ... }`           | effect 清理：`cancelled = true` 阻止 retry 继续；**`cancelAnimationFrame(raf)`**；**`ro?.disconnect()`**。在 **`layoutDeps`** 变化导致 effect 重跑时也会先执行清理再重新 observe。                                                                                   |
| 89–91 | 依赖 `[relayout, ...layoutDeps]` | **故意展开 `layoutDeps`**：内容/Markdown 更新后重新绑定观察目标，并处理「首帧 ref 为空、下一帧才有节点」的 Radix 时序。`eslint-disable` 注释说明：不能完全交给 exhaustive-deps 自动推断展开数组。                                                                    |

---

## 第 93–98 行：layoutDeps 变化后的双帧 `useEffect`

| 行号  | 代码                                                     | 作用                                                                                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 93–98 | `relayout()` + `requestAnimationFrame(() => relayout())` | 依赖变化后**立刻**算一帧布局，再在**下一动画帧**再算一次。原因：子树（Markdown/HTML）刚插入 DOM 时，**布局与字体可能尚未稳定**，单帧 `getBoundingClientRect` 偶发偏差；双帧与历史页面（分享 / Monaco）行为一致。清理时 **`cancelAnimationFrame(id)`** 取消未执行的第二帧。 |

---

## 第 100–107 行：`useLayoutEffect` 中的双帧布局

| 行号    | 代码              | 作用                                                                                                                                                                                                                                                                                                                          |
| ------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100–107 | `useLayoutEffect` | 在 React 提交 DOM 后、**浏览器绘制前**同步执行，减少「用户先看到错误位置再闪一下」的闪烁。若 **`viewportRef.current`** 为空则直接返回。否则连续调用 **`layoutChatCodeToolbars(el)`** 与 **rAF** 再调一次，与上一段 `useEffect` 形成 **layout + paint 前后各补一刀** 的保守策略。依赖同样 **`relayout` + `layoutDeps` 展开**。 |

---

## 第 109–117 行：可选 passive `scroll`

| 行号    | 代码                                                            | 作用                                                                                                                                                                  |
| ------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 109     | `if (!passiveScrollLayout) return`                              | 未开启则不注册，避免与仅使用 React `onScroll` 的页面重复监听（仍会多一次 `layout` 调用，但 ChatBot 需要显式开启）。                                                   |
| 111–112 | 取 `vp`，为空则 return                                          | 同 ResizeObserver，ref 未就绪时不绑监听。                                                                                                                             |
| 113–114 | `addEventListener('scroll', ..., { passive: true })`            | **passive: true** 告知浏览器该监听不会 **`preventDefault`**，有利于滚动性能（尤其移动端）。回调直接 **`layoutChatCodeToolbars(vp)`**（闭包捕获该次 effect 的 `vp`）。 |
| 115     | `removeEventListener`                                           | 卸载或依赖变化时移除，避免重复监听与内存泄漏。                                                                                                                        |
| 116–117 | 依赖 `[passiveScrollLayout, viewportRef, ...passiveScrollDeps]` | `passiveScrollLayout` 开关变化时重绑；**`passiveScrollDeps`**（如 `activeSessionId`、`messages.length`）变化时重绑，确保会话切换后监听仍挂在当前 viewport 上。        |

---

## 第 119 行：返回值

| 行号 | 代码                  | 作用                                                                                                 |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| 119  | `return { relayout }` | 供调用方在 **`onScroll`**、**`syncScrollMetrics`**、程序化滚动后等处手动再调，与 Hook 内部监听互补。 |

---

## 第 122–128 行：`ChatCodeFloatingToolbar` 组件

| 行号    | 代码                                                                                | 作用                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 122–125 | JSDoc                                                                               | 说明应放在滚动容器**同级**（便于与页面其它 fixed 元素的层级一致；实际 Portal 到 body，不依赖此 div 的布局）。                         |
| 126–128 | `export function ChatCodeFloatingToolbar() { return <ChatCodeToolbarFloating />; }` | **薄封装**：统一从本文件 import 时同时拿到 Hook 与 Portal 组件，减少路径记忆；行为与直接渲染 **`ChatCodeToolbarFloating`** 完全一致。 |

---

## 与调用方的配合关系（小结）

1. **必须**：页面某处有 **`ChatCodeFloatingToolbar`**（或原 **`ChatCodeToolbarFloating`**），否则 **`layoutChatCodeToolbars`** 更新了 store 也没有 UI 订阅展示。
2. **必须**：**`viewportRef`** 指向包含 **`[data-chat-code-block]`** 的**可滚动 viewport**（与 Markdown 里 **`enableChatCodeFenceToolbar`** 输出的 DOM 一致）。
3. **推荐**：在 **`onScroll`** 里调用 **`relayout()`**，保证用户滚动时与 Hook 内部监听节奏一致（ChatBot 还依赖 **passive scroll** 补一层）。
4. **`layoutDeps`**：与「会改变 Markdown 高度或消息列表」的状态对齐，避免流式/切换文档后吸顶条错位。

---

## 相关文件

| 路径                                                            | 说明                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/frontend/src/utils/chatCodeToolbar.ts`                    | `layoutChatCodeToolbars`、浮动条全局状态、复制/下载辅助函数             |
| `apps/frontend/src/components/design/ChatCodeToolBar/index.tsx` | `ChatCodeToolbarFloating` 实现                                          |
| `docs/tools/index.md` §10                                       | `@dnhyxc-ai/tools` 侧 GFM/代码块工具栏 HTML 契约（与本文 DOM 约定相关） |

_文档与 `useChatCodeFloatingToolbar.tsx` 当前实现对齐。_
