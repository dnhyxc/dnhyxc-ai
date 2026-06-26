# EPUB 开发者手册（developer）

本目录收录 **端到端开发者实现手册**（白话思路 + 维护表 + 源码对照），与 `docs/ebook/` 下产品向 / 增量专题文档互补。

| 文档 | 范围 |
|------|------|
| [epub-listen-dev.md](./epub-listen-dev.md) | **边听边读总手册**：听当前 + 听书 + TTS/高亮/自动跟随/FAB/互斥（含逐行注释源码） |
| [epub-thought-add-underline-dev.md](./epub-thought-add-underline-dev.md) | 读书想法：添加 + 琥珀虚线 + 侧栏 + 点击聚合 |
| [epub-user-highlight-dev.md](./epub-user-highlight-dev.md) | 用户彩色划线：高亮 / 下划线 / 波浪线 + 重叠合并 + PopBar |

**交叉阅读**：想法与用户划线在 `syncEpubReadingAnnotations` 中共存；任一本手册 §「与 xxx 边界」会指向另一本。EPUB 听读播放背景对用户/想法的影响见 [Influence-point/epub-listen-bg-vs-annotations.md](../Influence-point/epub-listen-bg-vs-annotations.md)。
