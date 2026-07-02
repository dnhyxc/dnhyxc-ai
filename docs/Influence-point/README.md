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
| [knowledge-editor-long-text-perf.md](./knowledge-editor-long-text-perf.md) | **知识库长文编辑性能**：纯 edit 停喂隐藏预览、Store 派生 boolean、助手输入内化与标题区渲染隔离 |
| [knowledge-preview-assistant-pane-perf.md](./knowledge-preview-assistant-pane-perf.md) | **预览+助手同开性能**：Monaco 预览态卸载/冻结、非受控轻量输入条、`KnowledgeMarkdownPane` 隔离 |
| [tts-local-cancel-settle.md](./tts-local-cancel-settle.md) | **本机 Web Speech cancel 后 50ms settle**：听当前首句修复、全站本机/回退路径起播延迟与云端无影响 |
| [epub-scroll-listen-section-advance.md](./epub-scroll-listen-section-advance.md) | **连续滚动听书逐 iframe 节间衔接**：`runScrollSectionLoop` / `advanceScrollListenSection` 对分页听书、播放条切句、听当前互斥的影响 |
| [epub-window-resize-relayout.md](./epub-window-resize-relayout.md) | **窗口放大/全屏 EPUB 居中**：`relayoutEpubViews` + `window.resize` settle 对分栏 soft resize、划线 sync、听书背景的影响 |
| [epub-listen-follow-fab-layout.md](./epub-listen-follow-fab-layout.md) | **布局变化后 Follow FAB**：`checkEpubListenFollowAfterLayout` 对听书/听当前 autoFollow、FAB 与 resize 链路的影响 |
| [epub-highlight-custom-color-picker.md](./epub-highlight-custom-color-picker.md) | **划线自定义色 ColorPicker**：`#rrggbb(aa)` 持久化、PopBar 嵌套取色、upsert 串行与想法侧栏展示 |
| [cloud-tts-user-credentials-fallback.md](./cloud-tts-user-credentials-fallback.md) | **云端 TTS 用户凭证与失败降级**：MiniMax/讯飞 Key 入库、`xfyunVoiceId` 独立、失败 Toast、移除讯飞→硅基中转、设置页 UI |
| [cloud-tts-minimax-model-settings.md](./cloud-tts-minimax-model-settings.md) | **MiniMax 模型默认 turbo / 白名单 2.8 两项 / Combobox 预设 / 后端 `@IsIn` 与 normalize 不再静默改 model** |
| [cloud-tts-edge-prosody-membership.md](./cloud-tts-edge-prosody-membership.md) | **Edge 免费 TTS / 分模式 prosody / 非会员 Edge 选路 / 设置页 Edge 前置** |
| [tts-tauri-cloud-playback.md](./tts-tauri-cloud-playback.md) | **Tauri 云端 MP3 播放修复**：Audio prime、`canplay` 后 play、Edge 非流式 endpoint、Tauri `arrayBuffer` 读 body |
| [app-tauri-http-retry.md](./app-tauri-http-retry.md) | **Tauri HttpClient 全方法重试**：POST 等写请求默认 2 次、`!response` 门槛、`catch`/`handleErrorResponse` 修复 |
| [ebook-shelf-empty-tab-reset.md](./ebook-shelf-empty-tab-reset.md) | **书架分类空 Tab 隐藏与自动回「全部」**：未分类/0 册分类不展示、移走最后一本切 Tab、卡片 Tooltip 分类 |
| [epub-listen-player-bar-ui.md](./epub-listen-player-bar-ui.md) | **听书播放条 UI**：分句虚拟列表、滚到当前句、刻度尺倍速 0.5–3×、列表选中样式 |
| [ebook-progress-remote-debounce.md](./ebook-progress-remote-debounce.md) | **阅读进度远端防抖 + keepalive flush**：8s PUT 合并、页内 2s debounce、`pagehide` 不丢进度 |
| [tts-edge-unify-stream-endpoint.md](./tts-edge-unify-stream-endpoint.md) | **Edge TTS 统一 `SPEECH_EDGE_TTS_STREAM`**：取消 Tauri/Web endpoint 分流对云端朗读的影响 |

**阅读约定**：结论以仓库 **当前源码** 为准；「历史风险」指旧实现曾出现的问题，不代表现行代码仍会触发。
