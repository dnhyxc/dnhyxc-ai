# 03 · Registry：插件清单 JSON 全字段详解

> **本章目标**：registry（`plugins-registry.json`）是「动态接入」的源头——**新增/删除/改权限/改路由都不动主项目代码，只改这份 JSON**。必须把每个字段的语义吃透。
>
> 类型定义见 `packages/federation-kit/src/types/index.ts` 的 `PluginDescriptor`；本仓库真实 registry 见 `apps/frontend/public/remotes/plugins-registry.json`（示例）。

---

## 1. 顶层结构

```jsonc
{
  // 清单最后更新时间：展示用（插件中心会显示"更新于 xxx"）。
  // 语义：仅用于人类可读，不作为缓存破坏依据（缓存破坏用插件自己的构建指纹，见第 9 章）。
  "updatedAt": "2026/08/10 10:32:00",

  // 插件数组：每个元素描述一个子项目/插件。顺序不影响，各字段独立生效。
  "plugins": [
    { "id": "learningNotes", "routePath": "/learning-notes", "...": "..." }
  ]
}
```

> **运行时契约**：`PluginRegistry` 类型要求 `plugins` 必须为数组；`fetchRegistry` 拉取后如果 `plugins` 缺失会直接报错「registry.plugins missing」。

---

## 2. 插件条目字段详解

下面用完整示例 + 逐字段注释。所有字段均以 `packages/federation-kit/src/types/index.ts` 为准。

```jsonc
{
  // ── 唯一标识（必填）────────────────────────────────────────────
  // id：插件在宿主中的唯一身份；挂载（PluginHostPage pluginId）、上架偏好、路由注入、事件域全部用它
  "id": "learningNotes",

  // ── 多语言标题（可选，推荐）────────────────────────────────────
  // title：插件中心卡片标题、自动注入路由的面包屑标题都读它；缺省回退用 id。
  // 语义：宿主不翻译插件标题——插件自己提供 locale map，宿主按当前 locale 取一份。
  "title": {
    "zh-CN": "学习笔记",
    "en-US": "Learning notes"
  },

  // ── 多语言描述（可选）──────────────────────────────────────────
  // description：插件中心卡片上的简介；同样按 locale 取。
  "description": {
    "zh-CN": "在英语学习页记录并回顾你的笔记。",
    "en-US": "Record and review notes in English learning."
  },

  // ── 路由（取决于接入模式）──────────────────────────────────────
  // routePath：插件路由路径。
  // 语义：自动路由注入模式下，它作为新路由的 path；同时是 nav:subtree 权限的跳转白名单前缀。
  "routePath": "/learning-notes",

  // ── 入口地址（必填，trusted 插件）──────────────────────────────
  // entry：指向插件自己的 mf-manifest.json（含构建指纹 + remoteEntry 位置）。
  // 语义：kit 会拉它 → 计算内容指纹 → 解析 remoteEntry 绝对地址 → 注册远端 → 加载子应用。
  // 注意：必须 https（或 dev 下 localhost http），否则校验不通过。
  "entry": "https://plugin.example.com/learning-notes/mf-manifest.json",

  // ── 版本（必填）────────────────────────────────────────────────
  // version：插件语义化版本。用于缓存破坏 token（version@manifestHash）的一部分。
  // 注意：不要把它和 hostApiRange 混为一谈（一个是插件自身版本，一个是宿主 API 兼容范围）。
  "version": "1.2.0",

  // ── 宿主 API 兼容范围（必填，trusted 插件）────────────────────
  // hostApiRange：声明"我兼容宿主第几版能力契约"。
  // 语义：宿主加载前用 satisfiesRange(宿主VITE_HOST_API_VERSION, hostApiRange) 校验；
  // 支持 ^1.0.0（同大版本>=基准）、>=1.2.0、精确 1.0.0。
  // 目的：宿主升级能力契约后，不兼容的旧插件被拦截，避免运行时崩。
  "hostApiRange": "^1.0.0",

  // ── 侧栏菜单（可选；有则注入侧栏，无则只注入路由）──────────────
  "menu": {
    // order：排序权重，越小越靠前
    "order": 90,
    // icon：侧栏图标名（宿主维护 name→组件 的映射表，本仓为 lucide 图标名，如 Puzzle/Sparkle）
    "icon": "Puzzle"
  },

  // ── 是否自动注入路由（可选，默认 true）────────────────────────
  // 语义：true（或缺省）→ kit 自动挂 routePath 路由；false → 不注入路由，由业务页手动
  // <PluginHostPage pluginId="..." /> 挂载（内嵌场景）。内嵌插件务必写 false，避免出现"影子路由"。
  "injectRoute": true,

  // ── 宿主业务槽位（可选；surface 归组）──────────────────────────
  // host：声明插件归到哪个业务 surface 的哪个 slot。
  // 语义：宿主页面用 <PluginHostSurface surface="ebook.read" part="drawer-triggers" />
  // 自动列出所有 host.surface === 'ebook.read' 且已上架的插件，无需逐一手写。
  "host": {
    // surface：宿主业务面标识，如 ebook.read（电子书阅读页）
    "surface": "ebook.read",
    // slot：抽屉(drawer) 或 顶栏(toolbar)
    "slot": "drawer",
    // icon：抽屉触发器图标名
    "icon": "Sparkle",
    // order：同 surface 内排序
    "order": 10
  },

  // ── MF 远端标识（可选；默认用 id）──────────────────────────────
  // remoteName：插件在 MF 世界的 remote name；默认取 id。多插件同仓库时可用相同 remoteName。
  // expose：插件 expose 的模块名，默认 ./App。
  "remoteName": "remotePlugins",
  "expose": "./LearningNotes",

  // ── 框架声明（可选）────────────────────────────────────────────
  // framework：'react' | 'vue'。缺省时 kit 会探测（default 形如 { mount } 视为 vue）。
  // 语义：vue 插件 Host 不装 Vue，只调 mount(el, bridge)。
  "framework": "react",

  // ── 权限声明（必填，推荐明确列出）──────────────────────────────
  // permissions：声明插件需要哪些宿主能力。宿主按权限裁剪 bridge（能力钱包）。
  // 可选项：ui:toast（Toast/全屏/下载）、nav:subtree（受限导航）、
  //         http:plugin-api（宿主 http 客户端）、modules:xxx（业务模块，如 modules:chat / modules:ebook）
  "permissions": ["ui:toast", "nav:subtree", "http:plugin-api", "modules:ebook"],

  // ── 预加载策略（可选）──────────────────────────────────────────
  // preload：'eager'（启动即加载）| 'route'（缺省，访问路由时加载）| 'idle'（空闲加载）。
  // 语义：eager 会让启动变慢，仅对高频核心插件用。
  "preload": "route",

  // ── 上架开关（registry 层面的"全局开关"，可选）─────────────────
  // enabled：registry 里的全局上架开关。注意：宿主的账号偏好 enabledStore 会覆盖它（见第 8 章）。
  "enabled": true,

  // ── 信任等级（必填）────────────────────────────────────────────
  // trust：'first-party'（自有插件，走 MF 加载 + 样式隔离）
  //       | 'partner'（合作方插件，同 first-party）
  //       | 'untrusted'（不可信，渲染 iframe 沙箱 + postMessage 通信，不跑 MF）
  "trust": "first-party",

  // ── untrusted 插件专用（可选）──────────────────────────────────
  // iframeUrl：untrusted 插件被渲染的 iframe src。trust 为 untrusted 时必填，且须 https。
  "iframeUrl": "https://third-party.example.com/embed/plugin"
}
```

---

## 3. 三种接入模式下的最小配置对照

### 3.1 自动路由注入（独立页面插件）

```jsonc
{
  "id": "videoPlayer",
  "title": { "zh-CN": "视频播放器", "en-US": "Video player" },
  // 独立路由：自动注入到 Layout children 末尾
  "routePath": "/video-player",
  "entry": "https://plugin.example.com/video/mf-manifest.json",
  "version": "1.0.0",
  "hostApiRange": "^1.0.0",
  // 有菜单 → 侧栏出现入口
  "menu": { "order": 30, "icon": "Puzzle" },
  "permissions": ["ui:toast", "nav:subtree"],
  "enabled": true,
  "trust": "first-party"
}
```

### 3.2 业务内嵌挂载（嵌入现有页面）

```jsonc
{
  "id": "ebookIdeas",
  "title": { "zh-CN": "全书想法", "en-US": "All ideas" },
  // 业务页内嵌：不注入路由
  "injectRoute": false,
  "routePath": "/ebook/plugins/ebook-ideas",
  "entry": "https://plugin.example.com/ebook/mf-manifest.json",
  "version": "1.0.0",
  "hostApiRange": "^1.0.0",
  // 归组到电子书阅读页的抽屉槽
  "host": { "surface": "ebook.read", "slot": "drawer", "icon": "Sparkle", "order": 10 },
  "permissions": ["ui:toast", "modules:ebook"],
  "enabled": true,
  "trust": "first-party"
}
```

### 3.3 iframe 隔离（不可信第三方）

```jsonc
{
  "id": "thirdParty",
  "title": { "zh-CN": "第三方插件", "en-US": "Third-party" },
  "routePath": "/third-party",
  // untrusted 不走 MF entry，走 iframe
  "entry": "https://third-party.example.com/mf-manifest.json",
  "version": "1.0.0",
  "hostApiRange": "^1.0.0",
  "menu": { "order": 20, "icon": "ExternalLink" },
  "permissions": ["ui:toast", "http:plugin-api"],
  "enabled": true,
  "trust": "untrusted",
  // 必须提供 iframe 地址（https）
  "iframeUrl": "https://third-party.example.com/embed"
}
```

---

## 4. 校验时机（谁消费这些字段）

| 字段 | 消费时机 |
|------|----------|
| `entry` / `iframeUrl` | `verifyPlugin`（origin 校验：https 或 dev localhost）|
| `hostApiRange` | `verifyPlugin`（与宿主 `hostApiVersion` 比对）|
| `integrity` / `signature` | `verifyPlugin`（可选完整性/签名校验）|
| `trust` | 决定走 MF 还是 iframe |
| `injectRoute` / `routePath` / `menu` | `mountShell`（启动时注入路由与侧栏）|
| `preload` | `PluginManager.init`（eager 立即加载）|
| `permissions` | `createHostBridge`（裁剪能力钱包）|
| `framework` / `expose` / `remoteName` | `loadRemoteApp`（MF 加载与模块规范化）|
| `host` | `listHostSurfacePlugins` / `PluginHostSurface`（槽位归组）|

---

## 5. 一份完整的真实示例（含空清单兜底）

```jsonc
// apps/frontend/public/remotes/plugins-registry.json（结构示例）
{
  "updatedAt": "2026/08/10 10:32:00",
  "plugins": [
    {
      "id": "learningNotes",
      "title": { "zh-CN": "学习笔记", "en-US": "Learning notes" },
      "description": {
        "zh-CN": "在英语学习页记录并回顾你的笔记。",
        "en-US": "Record and review notes in English learning."
      },
      "routePath": "/learning-notes",
      "entry": "http://127.0.0.1:9008/mf-manifest.json",
      "version": "1.0.0",
      "hostApiRange": "^1.0.0",
      "injectRoute": false,
      "host": { "surface": "english.learning.notes", "slot": "drawer", "icon": "BookMarked" },
      "permissions": ["ui:toast", "modules:chat"],
      "enabled": true,
      "trust": "first-party"
    }
  ]
}
```

> **宿主侧兜底**：如果插件列表为空（首次接入还没有子项目），`fetchRegistry` 会返回 `{ updatedAt: new Date(0).toISOString(), plugins: [] }`，宿主照常启动，只是没有任何插件路由——不影响主项目自身功能。这保证「先搭宿主、后加插件」的增量开发可行。

> 下一步：[04-create-federation.md](./04-create-federation.md) 搭 `createFederation()` 门面。
