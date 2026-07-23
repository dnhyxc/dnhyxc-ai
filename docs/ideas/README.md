# 规划态实现思路（ideas）

本目录收录 **尚未写进 `docs/<功能域>/` 正式专题**、或 **面向从零复刻 / onboarding** 的架构与流程设计文档。正文以 Mermaid 图 + 分阶段步骤为主，**默认描述仓库已有实现** 时会在文首标明「核心能力已上线」。

| 文档                                                                         | 范围                                                                                                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [epub-mark-layers.md](./epub-mark-layers.md)                                 | EPUB **用户划线 / 想法虚线 / 播放背景** 三层架构、sync 编排、分阶段验收                                                                                         |
| [epub-mark-epubjs-primitives.md](./epub-mark-epubjs-primitives.md)           | 同上三层的 **epub.js 原语详解**：选区、文本提取、CFI、annotations、marks-pane                                                                                   |
| [xfyun-cloud-tts.md](./xfyun-cloud-tts.md)                                   | **讯飞在线云端 TTS**（已上线）：三选一选路、Nest `ws` 代理、前后端架构/时序/分阶段                                                                              |
| [epub-scroll-multi-iframe-listen.md](./epub-scroll-multi-iframe-listen.md)   | **EPUB 连续滚动多 iframe 听书续播**（已上线）：问题根因、逐点改动清单、架构/时序/复现步骤、类似问题通用套路                                                     |
| [ebook-reading-progress-save.md](./ebook-reading-progress-save.md)           | **阅读进度保存**（已上线）：EPUB CFI / PDF 页码、三层防抖、keepalive flush、端到端架构与时序                                                                   |
| [knowledge-preview-assistant-perf.md](./knowledge-preview-assistant-perf.md) | **知识库预览+助手同开卡顿**（已上线）：规划态思路；**归档见** [knowledge/knowledge-preview-assistant-perf.md](../knowledge/knowledge-preview-assistant-perf.md) |
| [epub-public-thought-underline-overlay-fix.md](./epub-public-thought-underline-overlay-fix.md) | **公开书多人想法虚线叠层 bug**（已落地）：断续/双线根因、CFI 投影扣减、rank 叠层、排查手册 |
| [epub-scroll-stutter-perf.md](./epub-scroll-stutter-perf.md) | **EPUB 连续滚动卡顿**（已上线）：双轨 patch 调度、rect 快路径、relocated 80ms 合并、叠层投影缓存、复杂度对比与调试手册 |
| [ebook-public-thought-live-sync.md](./ebook-public-thought-live-sync.md) | **公开书想法实时同步**（核心已上线）：/sync 增量、双轨触发、点击列表聚类 → **归档** [epub-public-thought-live-sync.md](../ebook/epub-public-thought-live-sync.md) |
| [ebook-thought-sync-perf-optimization.md](./ebook-thought-sync-perf-optimization.md) | **Sync 性能优化**（已上线）：P0 私有 gate、M8 SQL 增量、M6 deletedIds 软删、改前改后对照 |
| [ebook-multi-user-thought-viewport-perf.md](./ebook-multi-user-thought-viewport-perf.md) | **多人想法划线 + 视口性能**（已上线）→ **归档** [epub-thought-viewport-perf.md](../ebook/epub-thought-viewport-perf.md) |
| [epub-toc-chapter-top-align.md](./epub-toc-chapter-top-align.md) | **EPUB 点击目录章首对齐**（规划）：连续滚动升级为 ResizeObserver 稳定性循环、分页新增章首 CFI 重排 + `break-before:column` 注入 |
| [wechat-miniprogram-epub-reader.md](./wechat-miniprogram-epub-reader.md) | **微信小程序 EPUB 电子书阅读器**（规划）：书架/EPUB 阅读/听书/想法/划线五大模块、web-view+epub.js 渲染方案、M1–M6 分阶段落地、与 Web 端数据互通 |
| [miniprogram-epub-parse-logic.md](./miniprogram-epub-parse-logic.md) | **小程序 EPUB 解析逻辑**（部分已落地）：后端 `parseEpubBuffer` 懒解析、COS 键兼容、章节 API、`mp-html` 消费与 409 轮询；M1–M2 已上线 → **归档** [miniprogram-epub-server-parse.md](../ebook/miniprogram-epub-server-parse.md) |
| [epub-listen-paragraph-tts.md](./epub-listen-paragraph-tts.md) | **Web/桌面听书·听当前按段 TTS + 逐句高亮**（核心已落地）：规划脉络 → **归档** [ebook/epub-listen-paragraph-tts.md](../ebook/epub-listen-paragraph-tts.md) |
| [epub-listen-playback-optimize.md](./epub-listen-playback-optimize.md) | **听书播放优化**（主项已落地）：loading / 分句选中色 / 进度取整见 ebook 专题；总索引 [ebook/epub-listen-playback-fixes-2026-07.md](../ebook/epub-listen-playback-fixes-2026-07.md) |
| [learning-notes-rich-editor.md](./learning-notes-rich-editor.md) | **学习笔记富文本编辑器**（核心已上线）：Tiptap 3.x 封装、自定义 Title 节点、工具栏+气泡菜单、左右分栏布局、M1–M5 分阶段落地 → **归档** [english/learning-notes-rich-editor.md](../english/learning-notes-rich-editor.md) |
| [third-party-mf-plugin-onboarding.md](./third-party-mf-plugin-onboarding.md) | **第三方 MF 插件接入配置**（核心加载已上线）：对方 CORS 契约、`tauri://localhost`、registry 上架、capabilities 不加第三方域、双端验收与 `/mf-proxy` 兜底 |
| [mf-css-isolation.md](./mf-css-isolation.md) | **MF 主/子样式互不影响**（已落地）：构建期 scoped CSS vs 半套 Shadow 否决、`untrusted` iframe、验收清单 |

**生成 Skill**：[`feature-implementation-idea`](../../.cursor/skills/feature-implementation-idea/SKILL.md)

**与正式文档边界**：

- 实现归档、改动前后对比 → `docs/ebook/` 等（Skill：`implementation-doc-from-diff`）
- 开发者符号手册 → `docs/ebook/developer/`
- 改动影响面 → `docs/Influence-point/`
