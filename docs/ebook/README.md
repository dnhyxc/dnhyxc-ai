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
| [epub-thought-side-panel.md](./epub-thought-side-panel.md)                       | **当前 UI**：读书想法右侧分栏（与 MK 问书互斥）、footer 固定输入                                                                                |
| [epub-selection-popbar-visual.md](./epub-selection-popbar-visual.md)             | **增量**：选区浮动 PopBar 毛玻璃/箭头/主题定向阴影与 `--shadow-drop-*` 令牌                                                                     |
| [epub-user-highlight-impl.md](./epub-user-highlight-impl.md)                     | **主文档（用户划线）**：彩色高亮/下划线/波浪线、重叠合并、PopBar、与想法协同（逐步拆解 + 逐行注释代码）                                         |
| [epub-highlight-dom-match.md](./epub-highlight-dom-match.md)                     | **增量**：划线按 CFI/DOM 命中，避免 quote 同名跨位置误删/误合并；PopBar 划线/删除划线覆盖度规则                                                 |
| [epub-popbar-perf-ux.md](./epub-popbar-perf-ux.md)                               | **增量**：PopBar 防闪烁、划线 sync 增量 apply、highlightToggle 单槽位、重复 sync 去除                                                           |
| [epub-annotation-sync-perf.md](./epub-annotation-sync-perf.md)                   | **增量**：划线/想法 sync 主线程优化（patch 快路径、CFI 缓存、想法 DOM restack、即时 patch）；**选区落空行卡死**修复（`forEachTextNodeInRange`） |
| [epub-thought-underline-impl.md](./epub-thought-underline-impl.md)               | **主文档（想法虚线）**：分组、嵌套去重、选区防误触、与用户划线叠加（逐步拆解 + 逐行注释代码）                                                   |
| [epub-thought-partial-overlap.md](./epub-thought-partial-overlap.md)             | **增量**：部分相交的想法选区 patch 层 blocker 去重，避免重叠段双线叠加                                                                          |
| [epub-thought-cluster-bridging.md](./epub-thought-cluster-bridging.md)           | **主文档（想法桥接）**：点击聚合规则（A/B/标点/换行何时合并）、连通图 v5、逐行注释代码                                                          |
| [epub-thought-list-ui.md](./epub-thought-list-ui.md)                               | **增量**：想法列表单击进详情、分组摘录展开、引用 clamp 泛化；移除列表内选中与引用点击回书                                                       |
| [epub-thought-underline-empty-gap.md](./epub-thought-underline-empty-gap.md)       | **增量**：跨段落写想法时空行不再画虚线（空白文本片段过滤 + mark 校正快路径）                                                                  |
| [epub-thought-list-delete-close.md](./epub-thought-list-delete-close.md)           | **增量**：删列表最后一条收起侧栏；详情正文与列表行高对齐                                                                                      |
| [epub-quote-share.md](./epub-quote-share.md)                                       | **增量**：书摘分享图片（Canvas 日历卡、复制/下载、多样式居中、PopBar/想法入口）                                                               |
| [epub-side-panel-moke.md](./epub-side-panel-moke.md)                               | **增量**：MK 问书与右侧分栏统一开启/关闭（无闪烁、列表关闭无留白、划线不误关助手）                                                            |
| [epub-split-panel-collapse.md](./epub-split-panel-collapse.md)                     | **增量**：关闭侧栏后左侧立即全宽（去 hidden、单帧 collapse、layout 兜底）                                                                   |
| [epub-context-menu-popbar.md](./epub-context-menu-popbar.md)                       | **增量**：右键菜单与选区 PopBar（关菜单不闪、无选区不自动点词）                                                                               |
| [epub-quote-listen.md](./epub-quote-listen.md)                                     | **增量**：引用「听当前」朗读（PopBar/想法三入口、英语学习 TTS、本机中英分句与音色修复）                                                       |
| [epub-thought-quote-viewport.md](./epub-thought-quote-viewport.md)                 | **增量**：想法侧栏开合后左侧引用段落保持视口可见（CFI 锚点 + 分栏 resize 后 scroll 校正）                                                    |
| [epub-thought-quote-highlight-toggle.md](./epub-thought-quote-highlight-toggle.md) | **增量**：侧栏引用区划线/删除划线与 PopBar 对齐的 full 覆盖度判定                                                                               |
| [epub-split-soft-resize.md](./epub-split-soft-resize.md)                           | **增量**：EPUB 分栏拖拽 soft resize（rAF 合并、即时 patch 划线、松手 full sync，避免白屏）                                                      |
| [epub-reader-surface-bg.md](./epub-reader-surface-bg.md)                           | **增量**：阅读背景 CSS 变量同步顶栏、右栏、MOKE/想法侧栏与设置 Popover                                                                          |
| [epub-reader-settings-dismiss.md](./epub-reader-settings-dismiss.md)               | **增量**：阅读设置打开时点击左侧正文（含 iframe）关闭面板                                                                                       |
| [epub-thought-underlines-sync.md](./epub-thought-underlines-sync.md)             | **增量**：下划线批注与监听拆分，修复保存/切章偶发白屏                                                                                           |
| [epub-thought-drawer.md](./epub-thought-drawer.md)                               | **已废弃归档**：全屏底部 Sheet 抽屉（组件已删，勿作实现依据）                                                                                   |
| [../chat/assistant-share-bar.md](../chat/assistant-share-bar.md)                 | **关联**：助手分享底栏与 `useAssistantShare`（知识库 / 英语 / 电子书三端统一）                                                                  |
| [../knowledge/assistant-insert-focus.md](../knowledge/assistant-insert-focus.md) | **关联**：选区写入助手后聚焦与 IME 修复（知识库 + 电子书 MOKE 问书）                                                                            |

**延伸阅读**：上传目录与 `uploads/ebooks` 落盘见 [ops/upload-storage-paths.md](../ops/upload-storage-paths.md)；路由鉴权与公开路径见 [app/route-auth.md](../app/route-auth.md)。EPUB 右键见 [epub-assistant-context-menu.md](./epub-assistant-context-menu.md)；MOKE / PDF 见 [ebook-moke-assistant.md](./ebook-moke-assistant.md)。**读书想法 UI 以 [epub-thought-side-panel.md](./epub-thought-side-panel.md) 为准**（全屏抽屉已废弃，见 [epub-thought-drawer.md](./epub-thought-drawer.md) 归档）。**点击聚合与桥接规则**见 [epub-thought-cluster-bridging.md](./epub-thought-cluster-bridging.md)。**用户划线与想法虚线的完整实现说明**见 [epub-user-highlight-impl.md](./epub-user-highlight-impl.md) 与 [epub-thought-underline-impl.md](./epub-thought-underline-impl.md)。
