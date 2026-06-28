# 电子书（书架与阅读）

本域收录 EPUB / PDF 书架、双端导入、阅读进度同步与阅读页交互相关实现说明。

| 专题                                                                             | 说明                                                                                                                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| [ebook-reader-shelf.md](./ebook-reader-shelf.md)                                 | **主文档**：本轮书架 + 阅读页全链路（后端 API、MobX Store、Tauri/Web 分流、顶栏面包屑修复）                                                     |
| [shelf-reader-polish.md](./shelf-reader-polish.md)                               | **增量**：书架卡片 UI、导入不自动阅读、PDF 目录与顶栏翻页、EPUB 主题文字与渲染稳定性                                                            |
| [shelf-cover-title.md](./shelf-cover-title.md)                                   | **增量**：自定义封面（文件落盘）、书名编辑、卡片 hover 操作层、桌面端「选择本地文件」文案                                                       |
| [epub-reader-settings-scroll.md](./epub-reader-settings-scroll.md)               | **增量**：EPUB 阅读设置（字号/行距/颜色/背景/翻页方式）、连续滚动章节衔接                                                                       |
| [ebook-cos-local-shelf.md](./ebook-cos-local-shelf.md)                           | **增量**：COS 云端备份、桌面本地优先、书架分页、阅读设置 12 色块、PDF/EPUB 滚动条统一                                                           |
| [pdf-reader-fit-scroll.md](./pdf-reader-fit-scroll.md)                           | **增量**：PDF 适应宽度、顶栏缩放、滚动换页（停稳后翻页）                                                                                        |
| [epub-assistant-context-menu.md](./epub-assistant-context-menu.md)               | **增量**：EPUB 右键菜单、智能助手分栏（对齐知识库助手 UI 与流式贴底）                                                                           |
| [ebook-moke-assistant.md](./ebook-moke-assistant.md)                             | **主文档（本轮）**：MOKE 独立后端与会话、公共 Assistant 层、PDF 接入 / 右键菜单、分享保存、分栏与顶栏体验                                       |
| [ebook-local-path-dedup.md](./ebook-local-path-dedup.md)                         | **增量**：按 `local_path` 查库，重复选同一路径不再 COS 上传                                                                                     |
| [ebook-membership-upload.md](./ebook-membership-upload.md)                       | **增量**：会员专属云端上传；Web 非会员拦截；COS-only 存储                                                                                       |
| [ebook-toc-active-highlight.md](./ebook-toc-active-highlight.md)                 | **增量**：目录抽屉当前章节高亮（EPUB/PDF 共用 `EbookTocDrawer`）                                                                                |
| [ebook-shelf-category.md](./ebook-shelf-category.md)                             | **增量**：书架分类（面包屑、Tab Rail、Model 管理弹窗、书名行移动 Popover、删分类归入未分类）                                                    |
| [ebook-cos-stream-io.md](./ebook-cos-stream-io.md)                               | **增量**：COS 流式上传/下载，避免大文件整包进内存                                                                                               |
| [epub-reading-thoughts.md](./epub-reading-thoughts.md)                           | **数据层**：服务端存储、虚线下划线、重叠去重、选区防误触                                                                                        |
| [developer/README.md](./developer/README.md)                                       | **开发者手册索引**（听读 + 想法 + 用户划线）                                                                                                    |
| [developer/epub-mark-layers-shared.md](./developer/epub-mark-layers-shared.md) | **开发者**：用户划线 / 想法虚线 / 播放背景 — 共用方法表与流程图 |
| [developer/epub-listen-dev.md](./developer/epub-listen-dev.md)                   | **唯一主文档（听当前 + 听书）**：含连续滚动多 iframe 续播、调用链、M1–M5、源码摘录                                                                       |
| [developer/epub-thought-add-underline-dev.md](./developer/epub-thought-add-underline-dev.md) | **唯一主文档（想法）**：§0 从何下手 + §2 白话思路 + §3–§19                                                                                      |
| [developer/epub-user-highlight-dev.md](./developer/epub-user-highlight-dev.md)   | **唯一主文档（用户划线）**：§0–§18 白话思路 + 重叠合并 + PopBar + 与想法共存                                                                    |
| [epub-thought-side-panel.md](./epub-thought-side-panel.md)                       | **当前 UI**：读书想法右侧分栏（与 MK 问书互斥）、footer 固定输入                                                                                |
| [epub-selection-popbar-visual.md](./epub-selection-popbar-visual.md)             | **增量**：选区浮动 PopBar 毛玻璃/箭头/主题定向阴影与 `--shadow-drop-*` 令牌                                                                     |
| [epub-user-highlight-impl.md](./epub-user-highlight-impl.md)                     | **已归档索引** → [developer/epub-user-highlight-dev.md](./developer/epub-user-highlight-dev.md)                                                 |
| [epub-highlight-dom-match.md](./epub-highlight-dom-match.md)                     | **增量**：划线按 CFI/DOM 命中，避免 quote 同名跨位置误删/误合并；PopBar 划线/删除划线覆盖度规则                                                 |
| [epub-popbar-perf-ux.md](./epub-popbar-perf-ux.md)                               | **增量**：PopBar 防闪烁、划线 sync 增量 apply、highlightToggle 单槽位、重复 sync 去除                                                           |
| [epub-annotation-sync-perf.md](./epub-annotation-sync-perf.md)                   | **增量**：划线/想法 sync 主线程优化（patch 快路径、CFI 缓存、想法 DOM restack、即时 patch）；**选区落空行卡死**修复（`forEachTextNodeInRange`） |
| [epub-thought-underline-impl.md](./epub-thought-underline-impl.md)               | **主文档（想法虚线）**：分组、嵌套去重、选区防误触、与用户划线叠加（逐步拆解 + 逐行注释代码）                                                   |
| [epub-thought-partial-overlap.md](./epub-thought-partial-overlap.md)             | **增量**：部分相交的想法选区 patch 层 blocker 去重，避免重叠段双线叠加                                                                          |
| [epub-thought-user-highlight-overlap.md](./epub-thought-user-highlight-overlap.md) | **增量**：想法虚线与用户划线叠加修复（句内虚线、下划线误扣、restack + patch blocker）                                                         |
| [epub-thought-cluster-bridging.md](./epub-thought-cluster-bridging.md)           | **主文档（想法桥接）**：点击聚合规则（A/B/标点/换行何时合并）、连通图 v5、逐行注释代码                                                          |
| [epub-thought-list-ui.md](./epub-thought-list-ui.md)                               | **增量**：想法列表单击进详情、分组摘录展开、引用 clamp 泛化；移除列表内选中与引用点击回书                                                       |
| [epub-thought-underline-empty-gap.md](./epub-thought-underline-empty-gap.md)       | **增量**：跨段落写想法时空行不再画虚线（空白文本片段过滤 + mark 校正快路径）                                                                  |
| [epub-thought-list-delete-close.md](./epub-thought-list-delete-close.md)           | **增量**：删列表最后一条收起侧栏；详情正文与列表行高对齐                                                                                      |
| [epub-quote-share.md](./epub-quote-share.md)                                       | **增量**：书摘分享图片（Canvas 日历卡、复制/下载、多样式居中、PopBar/想法入口）                                                               |
| [epub-read-split-panel.md](./epub-read-split-panel.md)                             | **主文档（当前）**：MK 问书与读书想法右侧分栏 state + 布局收起（条件卸载右栏、删最后一条、热更新全宽）                                      |
| [epub-context-menu-popbar.md](./epub-context-menu-popbar.md)                       | **增量**：右键菜单与选区 PopBar（关菜单不闪、无选区不自动点词）                                                                               |
| [epub-quote-listen.md](./epub-quote-listen.md)                                     | **增量**：引用「听当前」朗读（PopBar/想法三入口、英语学习 TTS、本机中英分句与音色修复）                                                       |
| [epub-listen-sentence-bg.md](./epub-listen-sentence-bg.md)                         | **增量**：听当前逐句播放背景（plain 偏移、选区缓存；**绘制层见 host 浮层专题**）                                                               |
| [epub-listen-host-overlay.md](./epub-listen-host-overlay.md)                       | **增量**：听当前 host 浮层绘制与跨段句间清除（替代 iframe 三层 mark）                                                                          |
| [epub-listen-auto-follow-fab.md](./epub-listen-auto-follow-fab.md)                   | **增量**：听当前播放自动滚入视口、手动滚动打断与右下角回位 FAB                                                                                 |
| [epub-chapter-listen.md](./epub-chapter-listen.md)                                   | **增量**：EPUB 边听边读 MVP（innerText 播放、TreeWalker 句 Range、`epubListenMarkHighlight` 背景、顶栏听书与底部播放条） |
| [epub-scroll-listen-section-advance.md](./epub-scroll-listen-section-advance.md)     | **增量**：连续滚动听书逐 iframe 节间衔接（`runScrollSectionLoop` / `advanceScrollListenSection`） |
| [epub-listen-player-bar.md](./epub-listen-player-bar.md)                             | **增量**：听书播放条分句菜单、倍速 0.75×～3×、跳转居中滚动与 TTS 即时倍速                                              |
| [epub-quote-listen-player-bar.md](./epub-quote-listen-player-bar.md)                   | **增量**：听当前共用底部播放条（暂停/切句/倍速，与听书同一组件）                                                      |
| [epub-listen-bg-resize-relayout.md](./epub-listen-bg-resize-relayout.md)               | **增量**：听读播放背景随分栏/侧栏 resize 重绘（`repaintActive` 重挂 group、ResizeObserver、`EpubPane` 接线）            |
| [epub-listen-sentence-leading-punct.md](./epub-listen-sentence-leading-punct.md)         | **增量**：听读分句句首中文标点（`……`、`——`、开引号与句界算法对称处理）                                                  |
| [epub-listen-cloud-prefetch.md](./epub-listen-cloud-prefetch.md)                           | **增量**：听书/听当前句间云端 TTS 预取（`prefetchCloudEnglishTts` 缩短连播句间等待）                                  |
| [epub-mark-shared-extraction.md](./epub-mark-shared-extraction.md)                       | **增量（纯重构）**：mark 层公共 utils 抽取至 `epubMarkShared.ts` + geometry export，行为不变                          |
| [ebook-folder-archive.md](./ebook-folder-archive.md)                                       | **增量（纯重构）**：`utils/`、`components/` 按功能域分子目录归档 + import 路径对照表，行为不变                        |
| [epub-listen-user-highlight-reconcile.md](./epub-listen-user-highlight-reconcile.md) | **增量**：听当前与用户划线 DOM 协调（reconcile 孤儿 mark、apply 存在性校验、播完 sync）                                                       |
| [../Influence-point/epub-listen-bg-vs-annotations.md](../Influence-point/epub-listen-bg-vs-annotations.md) | **影响点**：播放背景色 vs 用户划线 / 想法划线（现行隔离与历史风险）                                                                           |
| [../Influence-point/epub-listen-resize-relayout.md](../Influence-point/epub-listen-resize-relayout.md) | **影响点**：阅读区 resize 重绘对原有功能的影响面                                                                                              |
| [../Influence-point/epub-listen-utils-consolidation.md](../Influence-point/epub-listen-utils-consolidation.md) | **影响点**：听读 utils 7→3 文件合并、路径对照与回归清单                                                                                       |
| [epub-thought-quote-viewport.md](./epub-thought-quote-viewport.md)                 | **增量**：想法侧栏开合后左侧引用段落保持视口可见（CFI 锚点 + 分栏 resize 后 scroll 校正）                                                    |
| [epub-thought-quote-highlight-toggle.md](./epub-thought-quote-highlight-toggle.md) | **增量**：侧栏引用区划线/删除划线与 PopBar 对齐的 full 覆盖度判定                                                                               |
| [epub-split-soft-resize.md](./epub-split-soft-resize.md)                           | **增量**：EPUB 分栏拖拽 soft resize（rAF 合并、即时 patch 划线、松手 full sync，避免白屏）                                                      |
| [epub-reader-surface-bg.md](./epub-reader-surface-bg.md)                           | **增量**：阅读背景 CSS 变量同步顶栏、右栏、MOKE/想法侧栏与设置 Popover                                                                          |
| [epub-reader-settings-dismiss.md](./epub-reader-settings-dismiss.md)               | **增量**：阅读设置打开时点击左侧正文（含 iframe）关闭面板                                                                                       |
| [epub-thought-underlines-sync.md](./epub-thought-underlines-sync.md)             | **增量**：下划线批注与监听拆分，修复保存/切章偶发白屏                                                                                           |
| [epub-thought-drawer.md](./epub-thought-drawer.md)                               | **已废弃归档**：全屏底部 Sheet 抽屉（组件已删，勿作实现依据）                                                                                   |
| [../chat/assistant-share-bar.md](../chat/assistant-share-bar.md)                 | **关联**：助手分享底栏与 `useAssistantShare`（知识库 / 英语 / 电子书三端统一）                                                                  |
| [../knowledge/assistant-insert-focus.md](../knowledge/assistant-insert-focus.md) | **关联**：选区写入助手后聚焦与 IME 修复（知识库 + 电子书 MOKE 问书）                                                                            |

**延伸阅读**：上传目录与 `uploads/ebooks` 落盘见 [ops/upload-storage-paths.md](../ops/upload-storage-paths.md)；路由鉴权与公开路径见 [app/route-auth.md](../app/route-auth.md)。EPUB 右键见 [epub-assistant-context-menu.md](./epub-assistant-context-menu.md)；MOKE / PDF 见 [ebook-moke-assistant.md](./ebook-moke-assistant.md)。**读书想法 UI 以 [epub-thought-side-panel.md](./epub-thought-side-panel.md) 为准**（全屏抽屉已废弃，见 [epub-thought-drawer.md](./epub-thought-drawer.md) 归档）。**点击聚合与桥接规则**见 [epub-thought-cluster-bridging.md](./epub-thought-cluster-bridging.md)。**用户划线与想法虚线的开发者手册**见 [developer/epub-user-highlight-dev.md](./developer/epub-user-highlight-dev.md) 与 [developer/epub-thought-add-underline-dev.md](./developer/epub-thought-add-underline-dev.md)。
