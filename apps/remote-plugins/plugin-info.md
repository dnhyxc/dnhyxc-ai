# remote-plugins

基座专用 MF 插件包（一仓多 expose）。federation name：`remotePlugins`，开发端口 **9008**。

UI 与主站对齐：**Tailwind CSS v4 + shadcn/ui**（`src/components/ui`、`@` / `@ui` 别名、`components.json`）。嵌入 Host 时复用页面 CSS 变量（含 `theme-black`）；独立预览用 `src/styles.css` 兜底。

## 样式契约（上架硬性条件）

等价于 qiankun `experimentalStyleIsolation`：**构建期作用域**，Light DOM 嵌入，主/子互不污染且子应用 Button 等组件样式完整。

| 必须 | 禁止 |
|------|------|
| `styles.css` **不**引入 Preflight（勿 `@import "tailwindcss"` 全家桶） | 完整 Tailwind Preflight（会改 `html` 字体/全局 reset） |
| utilities 挂在 `[data-plugin-root] { @tailwind utilities }` | 往 `document` 注入无作用域的全局 utility（`.flex` 等） |
| 每个 expose 根节点带 `data-plugin-root` | 依赖 Host 运行时劫持 head / Shadow 搬样式 |

不遵守 → **不得**以 `trust: partner` 进主文档 MF；只能 `trust: untrusted` + registry `iframeUrl`（整页 iframe，见 `docs/ideas/mf-css-isolation.md`）。

## 启动

```bash
pnpm dev:remote-plugins
# 或
pnpm -C apps/remote-plugins dev
```

浏览器打开 `http://127.0.0.1:9008/`：

| 路径 | 页面 |
|------|------|
| `/` | 插件目录（带预览壳） |
| `/english-learning/notes` | 学习笔记（预览壳） |
| `/ebook/plugins/ideas-list` | EPUB 想法列表（预览壳，mock Host） |
| `/embed/ebook/plugins/ideas-list` | **Host `iframeUrl` 用这个**：无壳，postMessage 接真 Host |
| `/embed/english-learning/notes` | 同上，学习笔记 embed |

`trust: untrusted` 时 registry 示例：

```json
"trust": "untrusted",
"iframeUrl": "http://127.0.0.1:9008/embed/ebook/plugins/ideas-list"
```

生产改为对应 https 落地页。勿把带导航栏的 `/ebook/plugins/ideas-list` 填进 `iframeUrl`。

生产构建请设置 `VITE_REMOTE_PUBLIC_ORIGIN`（与 registry `entry` 同源，如 `https://dnhyxc.cn:9008`）。

## 目录（对齐主站 `apps/frontend/src`）

```
src/
  main.tsx                 # 入口 → @/router
  router/                  # 独立预览路由（index + routes）
  layout/                  # 预览壳 Layout
  views/                   # 页面与 MF expose
    home/                  # 插件目录首页
    embed/                 # untrusted iframe 落地页
    ideas-list/            # expose ./IdeasList
    learning-notes/        # expose ./LearningNotes
  utils/                   # mockHost、iframeHostClient
  components/ui/           # shadcn（可扩展 design/）
  lib/utils.ts
  styles.css
```

新增 UI：`pnpm dlx shadcn@latest add <component>`（在本包目录下，读 `components.json`）。

## Expose

| expose | 说明 | registry `id` |
|--------|------|----------------|
| `./IdeasList` | EPUB 全书想法列表（右侧抽屉，滚动分页） | `ebookIdeasList` |
| `./LearningNotes` | 英语学习 · 学习笔记（业务页内嵌） | `learningNotes` |

后续新插件：在 `src/views/<name>/` 加模块，并在 `vite.config.ts` `exposes` 与 `plugins-registry.json` 各加一条（共用 `remoteName: "remotePlugins"` + 同一 `entry`）。

## Registry 示例

```json
{
  "id": "learningNotes",
  "remoteName": "remotePlugins",
  "expose": "./LearningNotes",
  "entry": "http://127.0.0.1:9008/mf-manifest.json",
  "injectRoute": false,
  "permissions": ["ui:toast", "nav:subtree"],
  "enabled": true,
  "trust": "first-party"
}
```

## CORS

生产 Remote 须放行 `https://dnhyxc.cn:9002` 与 `tauri://localhost`（见 `docs/ideas/third-party-mf-plugin-onboarding.md`）。Nginx 示例可参考同目录历史 Remote 配置思路，端口改为 **9008**。
