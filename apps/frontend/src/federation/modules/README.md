# modules/

各插件专属的 `api.modules.*` 实现；在 [`runtime/index.ts`](../runtime/index.ts) 的 `buildModules` 中按 permission 装配。

## 子目录

| 插件 | 目录 | README |
|------|------|--------|
| learningNotes | `learningNotes/` | [README](./learningNotes/README.md) |

## 新增插件 checklist

挂到**已经登记的扩展点**上时，只改插件 registry（`host.surface`、`host.slot`）和远端实现。主项目不用再加 `modules/<pluginId>`。

**新的挂载位置**要先在 `points/catalog.ts` 登记，并在对应页面放上 `HostPoint`。权限用 `modules:point`，运行时得到 `api.modules.point`。

阅读页 `ebook.read` 已是扩展点：上下文是 `bookId`、`bookTitle`，命令是 `navigateToCfi`、`openThought`、`closeIdeasList`。按钮和抽屉仍由阅读页自己挂。笔记还没有扩展点，仍走下面的专属模块：

1. 建 `modules/<pluginId>/hostApi.ts`，export `createXxxModulesApi()`
2. 在 `runtime/index.ts` → `buildModules` 注册（permission 如 `modules:<pluginId>`）
3. 需跨窗 sync 时，同目录加 `syncBus.ts`（基于 [`../sync/hostSyncBus`](../sync/hostSyncBus.ts)）
4. registry 声明对应 `permissions`
5. **页面内嵌插件的逐步操作**：[`../access.md`](../access.md)。上面 1–4 步只用于还没有扩展点的专属模块（目前是学习笔记）。

## 与 capabilities 的区别

| | `capabilities/` | `modules/` |
|--|-----------------|------------|
| bridge | `api.ui.*` 等通用能力 | `api.modules.<pluginId>.*` |
| 范围 | 所有插件共享 | 单插件专属 |
| 示例 | 全屏、选文件 | ebook 导航、笔记 sync |
