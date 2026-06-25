# EPUB 用户划线：完整实现说明（逐步拆解版）

> **已归档**：开发者端到端内容已并入 **[developer/epub-user-highlight-dev.md](./developer/epub-user-highlight-dev.md)**。请勿在此维护实现细节。

| 原章节 | 主文档对应 |
|--------|------------|
| 一句话理解 / 5 个词 | **§2.0**、**§2.10.5** |
| 文件地图 | **§1.3**、**§2.10.1** |
| 用户操作步骤 | **§2.9**、**§4** |
| 数据模型 / API | **§3** |
| apply + patch | **§5** |
| 重叠合并 | **§13** |
| 与想法协同 | **§9**、**§16** |
| 回归清单 | **§10**、**§18** |

**仍须另读**：[developer/epub-thought-add-underline-dev.md](./developer/epub-thought-add-underline-dev.md)（想法虚线）、[epub-listen-user-highlight-reconcile.md](./epub-listen-user-highlight-reconcile.md)（听 current）。

---

## 0. 用一句话理解「用户划线」

你在 EPUB 正文里**拖选一段字**，点浮动条上的**划线**，选颜色和样式（背景色 / 直线下划线 / 波浪），程序把 **CFI** 和**原文**存进数据库；下次打开书，在同样位置**画 SVG 彩色标记**。再点这条线，可以改样式或删除。

**与想法的区别**：想法是琥珀虚线 + 写感想；用户划线是实色标记重点。两者可叠在同一段，程序协调叠放与虚线扣减。

若与仓库最新源码不一致，以源码为准。
