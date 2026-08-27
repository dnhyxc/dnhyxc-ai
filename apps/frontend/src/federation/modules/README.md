# modules/

各插件专属的 `api.modules.*` 实现；在 [`runtime/index.ts`](../runtime/index.ts) 的 `buildModules` 中按 permission 装配。

## 子目录

| 插件 | 目录 | README |
|------|------|--------|
| ebook | `ebook/` | [README](./ebook/README.md) |
| learningNotes | `learningNotes/` | [README](./learningNotes/README.md) |

## 新增插件 checklist

1. 建 `modules/<pluginId>/hostApi.ts`，export `createXxxModulesApi()`
2. 在 `runtime/index.ts` → `buildModules` 注册（permission 如 `modules:<pluginId>`）
3. 需跨窗 sync 时，同目录加 `syncBus.ts`（基于 [`../sync/hostSyncBus`](../sync/hostSyncBus.ts)）
4. registry 声明对应 `permissions`
5. **逐步操作说明**：[`../新插件接入指南.md`](../新插件接入指南.md)

## 与 capabilities 的区别

| | `capabilities/` | `modules/` |
|--|-----------------|------------|
| bridge | `api.ui.*` 等通用能力 | `api.modules.<pluginId>.*` |
| 范围 | 所有插件共享 | 单插件专属 |
| 示例 | 全屏、选文件 | ebook 导航、笔记 sync |
