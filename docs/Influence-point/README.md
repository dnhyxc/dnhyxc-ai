# 影响点分析（Influence-point）

本目录收录 **跨功能改动的影响面分析**：某能力的新增/重构是否会波及已有模块的数据、DOM、同步逻辑或交互。

| 文档 | 范围 |
|------|------|
| [epub-listen-bg-vs-annotations.md](./epub-listen-bg-vs-annotations.md) | 听当前/听书 **播放背景色** 对用户划线、想法虚线的影响点 |
| [epub-listen-resize-relayout.md](./epub-listen-resize-relayout.md) | 阅读区 **resize 重绘**（`repaintActive` / ResizeObserver / `EpubPane` 接线）对原有功能的影响点 |
| [epub-listen-utils-consolidation.md](./epub-listen-utils-consolidation.md) | 听读 **utils 7→3 文件合并**：路径对照、API 不变项、文档滞后、回归清单 |
| [epub-mark-shared-extraction.md](./epub-mark-shared-extraction.md) | **mark 层公共 utils 抽取**（`epubMarkShared` + geometry export）：CFI/Range/SVG 去重、对各层影响 |
| [epub-quote-listen-player-bar.md](./epub-quote-listen-player-bar.md) | **听当前共用底部播放条**：按句播放重构、与听书互斥、句内 cadence 高亮变化 |
| [epub-listen-sentence-leading-punct.md](./epub-listen-sentence-leading-punct.md) | **句界算法句首中文标点**：`buildSentenceOffsetSpans` 对听书/听当前/TTS 分句与背景对齐的影响 |
| [epub-listen-cloud-prefetch.md](./epub-listen-cloud-prefetch.md) | **句间云端 TTS 预取**：`prefetchCloudEnglishTts` 对听书/听当前连播与其它 `playEnglishPreferred` 调用方的影响 |
| [monaco-markdown-view-panel.md](./monaco-markdown-view-panel.md) | **Markdown 预览/编辑与助手 Panel**：布局 co-mount、开助手不再强制 split、纯预览全宽对 split/Diff/知识库助手的影响 |
| [tts-local-cancel-settle.md](./tts-local-cancel-settle.md) | **本机 Web Speech cancel 后 50ms settle**：听当前首句修复、全站本机/回退路径起播延迟与云端无影响 |
| [epub-scroll-listen-section-advance.md](./epub-scroll-listen-section-advance.md) | **连续滚动听书逐 iframe 节间衔接**：`runScrollSectionLoop` / `advanceScrollListenSection` 对分页听书、播放条切句、听当前互斥的影响 |

**阅读约定**：结论以仓库 **当前源码** 为准；「历史风险」指旧实现曾出现的问题，不代表现行代码仍会触发。
