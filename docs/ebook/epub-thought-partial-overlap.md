# EPUB 想法虚线：部分重叠选区去重

> **已归档**：根因、patch 两阶段与关键代码已并入 **[epub-thought-add-underline-dev.md](./developer/epub-thought-add-underline-dev.md) §17**。请勿在此维护细节。

| 原章节 | 主文档对应 |
|--------|------------|
| 用户可见问题 / 目标 | **§17.1** |
| patch 两阶段 | **§17.2** |
| 与用户划线关系 | **§17.3** |
| 严格嵌套 vs 部分相交 | **§17.4** |
| `patchThoughtUnderlineMarks` 摘录 | **§17.5** |

**延伸阅读**：[epub-thought-user-highlight-overlap.md](./epub-thought-user-highlight-overlap.md)（与用户划线叠加）、[epub-user-highlight-impl.md](./epub-user-highlight-impl.md)（用户 blocker 机制）。

**实现文件**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`

若与仓库最新源码不一致，以源码为准。
