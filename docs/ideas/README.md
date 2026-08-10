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
| [knowledge-scroll-jank-fix-steps.md](./knowledge-scroll-jank-fix-steps.md) | **知识库预览/助手滚动卡顿详细解决步骤**（已上线）：S0–S7 逐步问题→代码→意图→为何有效；**归档见** [knowledge/knowledge-preview-scroll-jank.md](../knowledge/knowledge-preview-scroll-jank.md)、[knowledge/knowledge-preview-code-toolbar-scroll.md](../knowledge/knowledge-preview-code-toolbar-scroll.md) |
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
| [learning-notes-editor-preview-jank.md](./learning-notes-editor-preview-jank.md) | **学习笔记编辑/预览卡顿**（已上线）：根因拆解、S1–S8（卸 TipTap、列表隔离、长文窗口化编辑/预览、延迟挂载等）、否决虚拟列表/iframe、带注释代码与原理 |
| [third-party-mf-plugin-onboarding.md](./third-party-mf-plugin-onboarding.md) | **第三方 MF 插件接入配置**（核心加载已上线）：对方 CORS 契约、`tauri://localhost`、registry 上架、capabilities 不加第三方域、双端验收与 `/mf-proxy` 兜底 |
| [mf-css-isolation.md](./mf-css-isolation.md) | **MF 主/子样式互不影响**（已落地）：构建期 scoped CSS vs 半套 Shadow 否决、`untrusted` iframe、验收清单 |
| [learning-notes-list-export.md](./learning-notes-list-export.md) | **学习笔记列表导出 Word**（规划）：后端拉全量笔记合成单个 .docx、复用单篇 HTML→DOCX 管线、200 篇上限 + 图片预算共享、M1–M2 分阶段 |
| [learning-notes-export-and-editor-polish.md](./learning-notes-export-and-editor-polish.md) | **DOCX 插图导出可靠化 + 长文编辑打磨**（核心已落地）：sharp@0.33.5 懒加载、foreign/webp→JPEG、长文自然高度/末窗落点、GapCursor/空段删除；含 C1–C13 改动点对照 |
| [learning-notes-docx-export-handbook.md](./learning-notes-docx-export-handbook.md) | **学习笔记富文本导出 Word（DOCX）端到端实现手册**（已上线）：从零复刻教学手册；M1–M14 全链路（DB→builder→Service→Controller→拦截器短路→Host downloadBlob→HostBridge→iframe RPC→插件 API→MobX action→按钮 UI→TipTap 富文本→长文性能优化），含完整源码 + 逐行注释 + 验收清单 + 常见坑排查 |
| [ebook-plugin-dynamic-integration.md](./ebook-plugin-dynamic-integration.md) | **主项目 Ebook 插件动态接入**（核心已上线）：从零复刻端到端实现手册；Host Surface 发现机制、模块级单例 handlers 冻结代理、MF runtime + 共享 React 单例、PluginManager 生命周期、createHostBridge 按权限装配、Iframe RPC + 同步 getter 预取改写、`@scope` 样式隔离、i18n 双轨同步；M1–M8 分阶段 + 23 章节 + 完整源码逐行注释 + 验收清单 + 排查手册 |
| [tauri-clipboard-rich-paste.md](./tauri-clipboard-rich-paste.md) | **Tauri 桌面端剪贴板（文本/图文混合/图片/文件列表）**（已上线）：全局 keydown 接管 C/V/X/A、Rust arboard 读 HTML/位图/文件列表、四种 flavor 并行读 + 四级降级插入、TipTap parseSlice、React 受控输入同步、Web 端 ImageUpload handlePaste；含架构/流程/时序三图 + 完整源码逐行注释 + 验收清单 |
| [tauri-window-zoom-unveil.md](./tauri-window-zoom-unveil.md) | **macOS 窗口缩放零露白**（已落地）：swizzle `NSWindow.zoom:`、目标尺寸预布局 + 顶对齐 cover + 窗口揭开、dispatch2 帧循环、注入 JS 钉 `#root`/body 尺寸、首帧立刻 tick、移除 `background-attachment:fixed`；含架构/主流程/时序三图 + 完整源码逐行注释 + 几何数学 + 验收/排查清单 |
| [tauri-system-menu-shortcuts.md](./tauri-system-menu-shortcuts.md) | **系统菜单 + 全局/页面快捷键体系**（已上线）：store 为唯一真相源串起菜单加速键/全局热键/页面快捷键三类；IconMenuItem 运行时 `set_accelerator` 可改键、失焦反注册（显隐应用例外）、改键前 `clear_all_shortcuts` + `SHORTCUT_HANDLING_ENABLED` 双保险防误触、前端 `chordStringsSemanticallyEqual` 写法归一化冲突检测、页面键 `registerGlobally=false` 仅 store+DOM、macOS 编辑菜单系统项三延迟点中文化；含架构/改键流程/触发时序/失焦时序四图 + 完整源码逐行注释 + 键 ID 编排表 + 验收/排查清单 |
| [vue-plugin-hmr-bridge.md](./vue-plugin-hmr-bridge.md) | **Vue 插件桥接与 HMR 保障**（规划→已落地）：React Host 加载 Vue Remote 插件，Host 零 Vue 依赖，Remote 自管 `createApp` 生命周期；解决 MF 下 `optimizeDeps` 预打包冲突、双实例、React 重渲染劫持三大 HMR 根因；含架构图 + 主流程图 + HMR 时序图 + 分阶段落地与验收清单 |
| [mf-style-isolation-implementation.md](./mf-style-isolation-implementation.md) | **微前端样式隔离实现思路**（核心已落地）：Host 侧「选择器前缀 + CSSOM insertRule patch + Portal body 收编」三层架构，覆盖静态 CSS / CSS-in-JS / body 弹层 / HMR / 同 Remote 多插件共享 realm / 嵌套插件引用计数 / Host 关键样式保护 / untrusted iframe 兜底；含架构图 + 主流程图 + 时序图 + 完整 TS 代码逐行中文注释 + 分阶段落地 + 验收清单 + 读者 5 步复用方案 |

**生成 Skill**：[`feature-implementation-idea`](../../.cursor/skills/feature-implementation-idea/SKILL.md)

**与正式文档边界**：

- 实现归档、改动前后对比 → `docs/ebook/` 等（Skill：`implementation-doc-from-diff`）
- 开发者符号手册 → `docs/ebook/developer/`
- 改动影响面 → `docs/Influence-point/`
