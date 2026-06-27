# 影响点分析（Influence-point）

本目录收录 **跨功能改动的影响面分析**：某能力的新增/重构是否会波及已有模块的数据、DOM、同步逻辑或交互。

| 文档 | 范围 |
|------|------|
| [epub-listen-bg-vs-annotations.md](./epub-listen-bg-vs-annotations.md) | 听当前/听书 **播放背景色** 对用户划线、想法虚线的影响点 |
| [epub-listen-resize-relayout.md](./epub-listen-resize-relayout.md) | 阅读区 **resize 重绘**（`repaintActive` / ResizeObserver / `EpubPane` 接线）对原有功能的影响点 |
| [epub-listen-utils-consolidation.md](./epub-listen-utils-consolidation.md) | 听读 **utils 7→3 文件合并**：路径对照、API 不变项、文档滞后、回归清单 |
| [epub-mark-shared-extraction.md](./epub-mark-shared-extraction.md) | **mark 层公共 utils 抽取**（`epubMarkShared` + geometry export）：CFI/Range/SVG 去重、对各层影响 |

**阅读约定**：结论以仓库 **当前源码** 为准；「历史风险」指旧实现曾出现的问题，不代表现行代码仍会触发。
