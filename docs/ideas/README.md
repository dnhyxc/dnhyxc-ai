# 规划态实现思路（ideas）

本目录收录 **尚未写进 `docs/<功能域>/` 正式专题**、或 **面向从零复刻 / onboarding** 的架构与流程设计文档。正文以 Mermaid 图 + 分阶段步骤为主，**默认描述仓库已有实现** 时会在文首标明「核心能力已上线」。

| 文档 | 范围 |
|------|------|
| [epub-mark-layers.md](./epub-mark-layers.md) | EPUB **用户划线 / 想法虚线 / 播放背景** 三层架构、sync 编排、分阶段验收 |
| [epub-mark-epubjs-primitives.md](./epub-mark-epubjs-primitives.md) | 同上三层的 **epub.js 原语详解**：选区、文本提取、CFI、annotations、marks-pane |
| [xfyun-cloud-tts.md](./xfyun-cloud-tts.md) | **讯飞在线云端 TTS**（已上线）：三选一选路、Nest `ws` 代理、前后端架构/时序/分阶段 |
| [epub-scroll-multi-iframe-listen.md](./epub-scroll-multi-iframe-listen.md) | **EPUB 连续滚动多 iframe 听书续播**（已上线）：问题根因、逐点改动清单、架构/时序/复现步骤、类似问题通用套路 |
| [knowledge-preview-assistant-perf.md](./knowledge-preview-assistant-perf.md) | **知识库预览+助手同开卡顿**（已上线）：规划态思路；**归档见** [knowledge/knowledge-preview-assistant-perf.md](../knowledge/knowledge-preview-assistant-perf.md) |

**生成 Skill**：[`feature-implementation-idea`](../../.cursor/skills/feature-implementation-idea/SKILL.md)

**与正式文档边界**：

- 实现归档、改动前后对比 → `docs/ebook/` 等（Skill：`implementation-doc-from-diff`）
- 开发者符号手册 → `docs/ebook/developer/`
- 改动影响面 → `docs/Influence-point/`
