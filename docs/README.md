# 开发文档索引

本目录按**功能域**组织实现说明与排查文档。面向最终用户的产品说明见 [`project-guide.md`](./project-guide.md)、[`project-update-info.md`](./project-update-info.md)。

**约定**：以仓库**当前源码**为准。换 COS 桶时同步前后端 `.env`、Tauri allowlist 与 Nginx（见 [cos/cos-object-storage.md](./cos/cos-object-storage.md) §5、[cos/cos-dev-http-proxy.md](./cos/cos-dev-http-proxy.md)）。

---

## 功能域目录（简短命名）

| 目录                         | 说明                                    | 入口                                                                                                                                     |
| ---------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [`chat/`](./chat/)           | 主站对话、分享、联网、附件              | [chat/README.md](./chat/README.md)                                                                                                       |
| [`knowledge/`](./knowledge/) | 知识库、RAG、文档助手                   | [knowledge/README.md](./knowledge/README.md)                                                                                             |
| [`english/`](./english/)     | 英语学习（词包、收藏、TTS、Agent）      | [english/README.md](./english/README.md)                                                                                                 |
| [`cos/`](./cos/)             | 腾讯云 COS 上传与 `/ext-cos/` 展示      | [cos/README.md](./cos/README.md)                                                                                                         |
| [`llm/`](./llm/)             | 大模型接入（硅基、`createLlm`、设置页） | [llm/README.md](./llm/README.md)                                                                                                         |
| [`ops/`](./ops/)             | 部署、Nginx、本地上传目录               | [ops/README.md](./ops/README.md)                                                                                                         |
| [`app/`](./app/)             | 前端壳层：路由鉴权、Tauri、i18n         | [app/README.md](./app/README.md)                                                                                                         |
| [`monaco/`](./monaco/)       | Monaco / Markdown 编辑器                | [monaco/README.md](./monaco/README.md)                                                                                                    |
| [`mermaid/`](./mermaid/)     | Mermaid 围栏与预览                      | [mermaid/markdown-zoom-and-preview.md](./mermaid/markdown-zoom-and-preview.md)                                                           |
| [`tools/`](./tools/)         | `@dnhyxc-ai/markdown-kit`               | [tools/index.md](./tools/index.md)                                                                                                       |
| [`react/`](./react/)         | React Hooks 专题                        | 按文件名检索                                                                                                                             |
| [`setting/`](./setting/)     | 系统快捷键                              | [setting/system-shortcuts-implementation-record.md](./setting/system-shortcuts-implementation-record.md)                                 |
| [`meta/`](./meta/)           | 发布与更新同步                          | [meta/project-features-update.md](./meta/project-features-update.md)                                                                     |
| [`pay/`](./pay/)             | Stripe 会员充值、开通与到期             | [pay/stripe-membership-billing.md](./pay/stripe-membership-billing.md)、[pay/membership-active-hook.md](./pay/membership-active-hook.md) |
| [`ebook/`](./ebook/)         | 电子书书架、EPUB/PDF 阅读与进度         | [ebook/README.md](./ebook/README.md)                                                                                                     |
| [`ideas/`](./ideas/)         | **规划态**功能实现思路（架构/流程图）   | [ideas/README.md](./ideas/README.md)                                                                                                     |
| [`Influence-point/`](./Influence-point/) | 跨功能改动影响面分析              | [Influence-point/README.md](./Influence-point/README.md)                                                                                 |

---

## 常见排查

| 现象                                                              | 优先阅读                                                                                                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| COS 上传 AccessDenied                                             | [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.4、§6                                                                                        |
| COS 能传不能显（403 / ATS）                                       | [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.3 + [cos/cos-dev-http-proxy.md](./cos/cos-dev-http-proxy.md)                                 |
| COS 能预览但下载失败                                              | [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.7                                                                                            |
| 分享页无用户附件                                                  | [chat/share.md](./chat/share.md) §五 + [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.9                                                     |
| 知识分享「更新时间」差 8h（如凌晨变 18 点）                       | [chat/share-knowledge-timezone.md](./chat/share-knowledge-timezone.md)                                                                                   |
| Web HTTPS mixed content                                           | 同上 + [app/route-auth.md](./app/route-auth.md) §12 + [ops/nginx.md](./ops/nginx.md)                                                                     |
| Tauri macOS ATS                                                   | [app/tauri-macos-ats-http.md](./app/tauri-macos-ats-http.md)                                                                                             |
| 知识库助手 Mermaid 流式                                           | [knowledge/knowledge-assistant-mermaid-streaming.md](./knowledge/knowledge-assistant-mermaid-streaming.md)                                               |
| 知识库助手总览                                                    | [knowledge/knowledge-assistant-complete.md](./knowledge/knowledge-assistant-complete.md)                                                                 |
| 对话硅基接入                                                      | [llm/siliconflow-chat-unification.md](./llm/siliconflow-chat-unification.md)                                                                             |
| 聊天附件预览失败                                                  | [chat/chat-upload-preview.md](./chat/chat-upload-preview.md)                                                                                             |
| 生产 `/images/` 400                                               | [chat/chat-upload-access-prod.md](./chat/chat-upload-access-prod.md) + [ops/nginx.md](./ops/nginx.md)                                                    |
| 本地上传落盘 / UPLOAD_ROOT                                        | [ops/upload-storage-paths.md](./ops/upload-storage-paths.md)                                                                                             |
| 插件 registry 跨域 / Vite proxy 不生效 / `/remotes` 404             | [ops/remotes-registry-static.md](./ops/remotes-registry-static.md)                                                                                       |
| Remote `mf-manifest.json` CORS（9002 / `tauri://localhost`）        | [ops/remotes-registry-static.md](./ops/remotes-registry-static.md) §7 + [ideas/third-party-mf-plugin-onboarding.md](./ideas/third-party-mf-plugin-onboarding.md) |
| 第三方任意域名插件怎么接 / 加插件不发桌面版                         | [ideas/third-party-mf-plugin-onboarding.md](./ideas/third-party-mf-plugin-onboarding.md)（§14 接入者 / §15 基座）                                          |
| 桌面插件 RUNTIME-003 / Origin tauri://localhost                     | 对方 CORS 漏配；见上 + [apps/remote-plugins/README.md](../apps/remote-plugins/README.md)                                                   |
| 插件样式污染主站 / 子应用 Button 无样式                             | [app/style-isolation-implementation.md](./app/style-isolation-implementation.md)（实现手册）、[ideas/mf-css-isolation.md](./ideas/mf-css-isolation.md)（思路）                                                                                                 |
| 动态插件加载失败闪烁 / virtual:mf 解析失败                          | [app/mf-plugin-host.md](./app/mf-plugin-host.md)                                                                                                         |
| MF 动态插件系统完整实现（Vite / PluginManager / 路由注入）          | [app/dynamic-plugin-system.md](./app/dynamic-plugin-system.md)（含改动前/后对比与逐行注释）                                                              |
| 插件开发手册（环境 / 组件 / 样式 / HostBridge / 发布）              | [app/plugin-development-guide.md](./app/plugin-development-guide.md)                                                                                      |
| 主项目接入插件方式（自动路由 / 手动挂载 / iframe 隔离）             | [app/host-plugin-integration-guide.md](./app/host-plugin-integration-guide.md)                                                                            |
| 插件上架/下架（setEnabled / 持久化 / Switch / Registry 编辑页）     | [app/plugin-shelf-toggle.md](./app/plugin-shelf-toggle.md)                                                                                                |
| 电子书阅读页插件化接入（PluginHostPage / ebookHostApi）             | [ebook/ebook-plugin-ideas-list.md](./ebook/ebook-plugin-ideas-list.md)                                                                                    |
| 后端 Remote 静态资源服务（serveRemote / uploads/remotes）           | [ops/remote-static-resources.md](./ops/remote-static-resources.md)                                                                                        |
| 英语学习「学习笔记」空白或 CORS                                     | [english/learning-notes-remote.md](./english/learning-notes-remote.md)                                                                                    |
| 学习笔记富文本编辑器（Tiptap 升级 / HTML 存储）                     | [english/learning-notes-rich-editor.md](./english/learning-notes-rich-editor.md)                                                                          |
| `createLlm` / 400                                                 | [llm/create-llm.md](./llm/create-llm.md)                                                                                                                 |
| 图片 OCR / 附件识图                                               | [llm/ocr-create-llm-glm.md](./llm/ocr-create-llm-glm.md)                                                                                                 |
| 知识库向量 404 / 400 入库失败                                     | [knowledge/siliconflow-vector-full-url.md](./knowledge/siliconflow-vector-full-url.md)                                                                   |
| 知识库向量 Key/模型                                               | [knowledge/knowledge-vector-create-llm.md](./knowledge/knowledge-vector-create-llm.md)                                                                   |
| 会员知识库向量双库                                                | [knowledge/knowledge-member-vector-tier.md](./knowledge/knowledge-member-vector-tier.md)                                                                 |
| 用户自定义向量与多库 RAG                                          | [knowledge/user-vector-rag-config.md](./knowledge/user-vector-rag-config.md)                                                                             |
| 全站 BGE / 入库 Bad Request                                       | [knowledge/vector-bge-global-round.md](./knowledge/vector-bge-global-round.md)                                                                           |
| 向量分片 ole.log / 代码截断                                       | [knowledge/knowledge-chunk-boundaries.md](./knowledge/knowledge-chunk-boundaries.md)                                                                     |
| 保存知识库后 `Invalid array length` / Node OOM                    | [knowledge/knowledge-chunk-infinite-loop-oom.md](./knowledge/knowledge-chunk-infinite-loop-oom.md)                                                       |
| 云端保存知识库报「请求体过大」/ PayloadTooLarge                   | [knowledge/knowledge-save-body-limit.md](./knowledge/knowledge-save-body-limit.md)                                                                       |
| 知识库长文编辑卡顿（标题/正文/助手输入）                          | [knowledge/knowledge-editor-long-text-perf.md](./knowledge/knowledge-editor-long-text-perf.md)                                                             |
| 预览+助手同开卡顿（流式输入/滚动/打字机）                         | [knowledge/knowledge-preview-assistant-perf.md](./knowledge/knowledge-preview-assistant-perf.md)                                                             |
| 对话运行久后 Node OOM / 附件重复解析                              | [chat/chat-memory-oom.md](./chat/chat-memory-oom.md)                                                                                                     |
| 流式输出时代码块无法横向滚动                                      | [chat/streaming-code-block-scroll.md](./chat/streaming-code-block-scroll.md)                                                                             |
| 生产 rate-limit `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`              | [ops/trust-proxy-rate-limit.md](./ops/trust-proxy-rate-limit.md)                                                                                         |
| 复制到助手后输入框不聚焦                                          | [knowledge/assistant-insert-focus.md](./knowledge/assistant-insert-focus.md)                                                                             |
| 设置页大模型 Key                                                  | [llm/llm-runtime-settings.md](./llm/llm-runtime-settings.md)                                                                                             |
| 按用户 / 会员默认模型                                             | [llm/membership-per-user-llm.md](./llm/membership-per-user-llm.md)                                                                                       |
| 设置页预设 / Combobox                                             | [llm/llm-setting-ui-presets.md](./llm/llm-setting-ui-presets.md)                                                                                         |
| 英语学习 Agent + LLM                                              | [llm/agent-create-llm-unify.md](./llm/agent-create-llm-unify.md)                                                                                         |
| 今日记词无词可抽 / 时间不对                                       | [english/daily-memorize-implementation.md](./english/daily-memorize-implementation.md) §9                                                                |
| 云端朗读 404 / MiniMax 502 余额不足                               | [english/minimax-cloud-tts.md](./english/minimax-cloud-tts.md) §12                                                                                       |
| 讯飞云端 WebSocket is not defined / File is not defined（Node 18） | [english/xfyun-cloud-tts.md](./english/xfyun-cloud-tts.md) §3.3、§5                                                                                    |
| 设置页云端朗读参数不生效 / 改音色仍播旧音                         | [english/cloud-tts-settings.md](./english/cloud-tts-settings.md) §5–§6                                                                                   |
| 语言增强中文但音色列表仍是英文                                    | [english/minimax-chinese-voices.md](./english/minimax-chinese-voices.md)                                                                                 |
| 换设备后云端朗读参数丢失 / 需账号同步                             | [english/cloud-tts-prefs-db.md](./english/cloud-tts-prefs-db.md)                                                                                         |
| 长文云端朗读首声慢 / 播放中无声卡住                         | [english/cloud-tts-segment-pipeline.md](./english/cloud-tts-segment-pipeline.md) §3、§6；分段预取细节 [cloud-tts-cadence-prefetch.md](./english/cloud-tts-cadence-prefetch.md) |
| Tauri 桌面云端「播放中无声、暂停再播恢复」                    | [english/tts-tauri-cloud-playback.md](./english/tts-tauri-cloud-playback.md)                                                                             |
| Edge 云端不可用 / 非会员选路 / 分模式语速被覆盖               | [english/cloud-tts-edge-voice.md](./english/cloud-tts-edge-voice.md) §5                                                                                  |
| TTS 从点喇叭到出声（前后端全链路）                                | [english/tts-end-to-end-guide.md](./english/tts-end-to-end-guide.md)                                                                                     |
| 支付成功但资料页仍非会员 / 到期仍显示会员                         | [pay/stripe-membership-billing.md](./pay/stripe-membership-billing.md) §6–§7                                                                             |
| 换号后仍看到上一账号的草稿或助手对话                              | [app/user-switch-state-reset.md](./app/user-switch-state-reset.md)                                                                                       |
| 登录成功瞬间又回到登录页 / cloud-tts 401                          | [app/login-cloud-tts-prefetch-401.md](./app/login-cloud-tts-prefetch-401.md)                                                                             |
| Tauri 桌面频繁 Toast「网络异常，请检查网络后重试」                | [app/tauri-http-all-method-retry.md](./app/tauri-http-all-method-retry.md)                                                                              |
| 小程序 EPUB 章节 409 / Processor 无日志 / **已解析换章仍 ~1s** | [ebook/miniprogram-epub-server-parse.md](./ebook/miniprogram-epub-server-parse.md) §3.1、§4.7、[ideas/miniprogram-epub-parse-logic.md](./ideas/miniprogram-epub-parse-logic.md) |
| 强制刷新后 EPUB/PDF 续读位置丢失 / 听书时 progress 请求过频          | [ebook/ebook-progress-remote-debounce.md](./ebook/ebook-progress-remote-debounce.md)                                                                     |
| 阅读页顶栏显示「智能对话」而非书架                                | [ebook/ebook-reader-shelf.md](./ebook/ebook-reader-shelf.md) §3.4、[app/route-auth.md](./app/route-auth.md)                                              |
| PDF 目录跳转报 canvas 并发渲染错误                                | [ebook/shelf-reader-polish.md](./ebook/shelf-reader-polish.md) §3.6                                                                                      |
| EPUB 连续滚动无法自动进入下一章                                   | [ebook/epub-reader-settings-scroll.md](./ebook/epub-reader-settings-scroll.md) §3.2                                                                      |
| 桌面大文件上传中无法阅读 / 超 120MB 打不开                        | [ebook/ebook-cos-local-shelf.md](./ebook/ebook-cos-local-shelf.md) §3.1–§3.2                                                                             |
| 非会员 Web 无法导入 / 会员才云端备份                              | [ebook/ebook-membership-upload.md](./ebook/ebook-membership-upload.md)                                                                                   |
| 重复选同一路径仍上传                                              | [ebook/ebook-local-path-dedup.md](./ebook/ebook-local-path-dedup.md)                                                                                     |
| 刷新报 `getStorage` 未初始化                                      | [app/membership-store-circular-deps.md](./app/membership-store-circular-deps.md)                                                                         |
| 换号后书架仍是上一账号                                            | [app/user-switch-state-reset.md](./app/user-switch-state-reset.md)                                                                                       |
| 阅读背景色不生效                                                  | [ebook/ebook-cos-local-shelf.md](./ebook/ebook-cos-local-shelf.md) §3.4                                                                                  |
| PDF 页面太小 / 猛滚连跳多页                                       | [ebook/pdf-reader-fit-scroll.md](./ebook/pdf-reader-fit-scroll.md) §3.1–§3.3                                                                             |
| EPUB 右键无菜单 / 助手与知识库样式不一致                          | [ebook/epub-assistant-context-menu.md](./ebook/epub-assistant-context-menu.md)、[ebook/ebook-moke-assistant.md](./ebook/ebook-moke-assistant.md)         |
| 目录打开但看不出当前读到哪一章                                    | [ebook/ebook-toc-active-highlight.md](./ebook/ebook-toc-active-highlight.md)                                                                             |
| 长目录 / 分句列表如何快速滚到底、顶、当前                         | [ebook/ebook-list-scroll-cycle.md](./ebook/ebook-list-scroll-cycle.md)                                                                                   |
| 同 HTML 多 `#filepos` 点目录滚到错节/章末                           | [ebook/epub-toc-cfi-navigate.md](./ebook/epub-toc-cfi-navigate.md)                                                                                       |
| 同 HTML 多目录锚点高亮总落在最后一项                              | [ebook/epub-toc-active-cfi.md](./ebook/epub-toc-active-cfi.md)                                                                                           |
| PDF 无 MOKE 助手 / PDF 右键菜单                                   | [ebook/ebook-moke-assistant.md](./ebook/ebook-moke-assistant.md)                                                                                         |
| 保存读书想法后阅读页白屏 / 下划线异常                             | [ebook/epub-thought-underlines-sync.md](./ebook/epub-thought-underlines-sync.md)                                                                         |
| EPUB 用户划线如何实现（**唯一主文档**）                           | [ebook/developer/epub-user-highlight-dev.md](./ebook/developer/epub-user-highlight-dev.md)（**从 §0 读起**） |
| EPUB 想法添加与虚线如何实现（**唯一主文档**）                     | [ebook/developer/epub-thought-add-underline-dev.md](./ebook/developer/epub-thought-add-underline-dev.md)（**从 §0 读起**） |
| EPUB 划线同名句子误删 / PopBar 划线与删除状态不对                 | [ebook/epub-highlight-dom-match.md](./ebook/epub-highlight-dom-match.md)                                                                                 |
| EPUB PopBar 闪烁 / 划线卡顿 / 工具条空档                          | [ebook/epub-popbar-perf-ux.md](./ebook/epub-popbar-perf-ux.md)                                                                                           |
| 划线/写想法后数秒才出现线、同步时页面卡死；反向选到空行后应用卡死 | [ebook/epub-annotation-sync-perf.md](./ebook/epub-annotation-sync-perf.md)                                                                               |
| 两次想法选区相交时虚线叠成双线                                    | [ebook/epub-thought-partial-overlap.md](./ebook/epub-thought-partial-overlap.md)                                                                         |
| 段落内写想法无虚线 / 用户下划线误扣相邻想法虚线                   | [ebook/epub-thought-user-highlight-overlap.md](./ebook/epub-thought-user-highlight-overlap.md)                                                           |
| 点击想法列表引用合并/拆分不对（A、B、标点、换行桥接）             | [ebook/epub-thought-cluster-bridging.md](./ebook/epub-thought-cluster-bridging.md)                                                                       |
| 想法侧栏引用区划线/删除划线状态不对（部分已划仍显示删除）         | [ebook/epub-thought-quote-highlight-toggle.md](./ebook/epub-thought-quote-highlight-toggle.md)                                                           |
| 拖拽分栏 EPUB 白屏 / 拖拽时彩色划线消失                           | [ebook/epub-split-soft-resize.md](./ebook/epub-split-soft-resize.md)                                                                                     |
| 想法列表单击应进详情 / 分组摘录展开                               | [ebook/epub-thought-list-ui.md](./ebook/epub-thought-list-ui.md)                                                                                         |
| 跨段落写想法时空行也出现虚线                                      | [ebook/epub-thought-underline-empty-gap.md](./ebook/epub-thought-underline-empty-gap.md)                                                                 |
| 删想法列表最后一条后侧栏空白不收起 / 详情正文比列表下垂             | [ebook/epub-thought-list-delete-close.md](./ebook/epub-thought-list-delete-close.md)                                                                     |
| 书摘分享图片 / 复制到微信                                         | [ebook/epub-quote-share.md](./ebook/epub-quote-share.md)                                                                                                 |
| EPUB「听当前」无声 / 中文书摘本机不读                             | [ebook/epub-quote-listen.md](./ebook/epub-quote-listen.md)                                                                                               |
| EPUB「听当前」播完即停 / 起播偏下一句                             | [ebook/epub-listen-quote-continue.md](./ebook/epub-listen-quote-continue.md)                                                                             |
| EPUB 听当前后 PopBar/选区未收起                                   | [ebook/epub-listen-popbar-dismiss.md](./ebook/epub-listen-popbar-dismiss.md)                                                                             |
| EPUB 听书划选时仍自动滚回播放句                                   | [ebook/epub-listen-select-pause-follow.md](./ebook/epub-listen-select-pause-follow.md)                                                                   |
| EPUB 滚动后选区高亮残留                                           | [ebook/epub-selection-scroll-clear.md](./ebook/epub-selection-scroll-clear.md)                                                                           |
| EPUB 听书朗读整行星号分隔线                                       | [ebook/epub-tts-separator-filter.md](./ebook/epub-tts-separator-filter.md)                                                                               |
| EPUB 边听边读 / 顶栏听书 / 播放条 / 分句跳转 / 倍速                 | [ebook/epub-chapter-listen.md](./ebook/epub-chapter-listen.md) · [ebook/epub-listen-player-bar.md](./ebook/epub-listen-player-bar.md) · [ebook/epub-scroll-listen-section-advance.md](./ebook/epub-scroll-listen-section-advance.md) |
| EPUB 听读分句段首省略号/破折号/开引号错位或空句                     | [ebook/epub-listen-sentence-leading-punct.md](./ebook/epub-listen-sentence-leading-punct.md) · [Influence-point/epub-listen-sentence-leading-punct.md](./Influence-point/epub-listen-sentence-leading-punct.md) |
| EPUB 听书/听当前云端连播句间停顿过长                               | [ebook/epub-listen-cloud-prefetch.md](./ebook/epub-listen-cloud-prefetch.md) · [Influence-point/epub-listen-cloud-prefetch.md](./Influence-point/epub-listen-cloud-prefetch.md) |
| EPUB 听书/听当前按段合成仍逐句高亮 / 首句慢                       | [ebook/epub-listen-paragraph-tts.md](./ebook/epub-listen-paragraph-tts.md) · [ideas/epub-listen-paragraph-tts.md](./ideas/epub-listen-paragraph-tts.md) |
| EPUB 听书中点目录切章不自动续听 / go trim 抛错                     | [ebook/epub-listen-toc-chapter-restart.md](./ebook/epub-listen-toc-chapter-restart.md)                                                               |
| 听书目录切章起播落在上一节末句或文件第 0 句                        | [ebook/epub-listen-toc-anchor-start.md](./ebook/epub-listen-toc-anchor-start.md)                                                                     |
| EPUB 听书首句出声慢 / 首包与预取抢带宽                             | [ebook/epub-listen-prefetch-after-start.md](./ebook/epub-listen-prefetch-after-start.md)                                                                 |
| EPUB 连续滚动听书远章后 FAB「回到播放位置」无效                    | [ebook/epub-listen-follow-cfi-remount.md](./ebook/epub-listen-follow-cfi-remount.md) · [ebook/epub-listen-auto-follow-fab.md](./ebook/epub-listen-auto-follow-fab.md) |
| EPUB 听书倍速 2× 但听感仍 1×（云端 MP3）                           | [ebook/epub-listen-rate-after-src.md](./ebook/epub-listen-rate-after-src.md)                                                                           |
| EPUB 听书倍速落库 /「设置为本书籍」仍影响其它书                     | [ebook/epub-listen-rate-persist.md](./ebook/epub-listen-rate-persist.md)                                                                               |
| EPUB 听书 loading 时倍速 pop 被关掉 / 右侧按钮灰掉                 | [ebook/epub-listen-bar-loading-controls.md](./ebook/epub-listen-bar-loading-controls.md)                                                               |
| EPUB 听书云端已停但播放条仍「播放中」                              | [ebook/epub-listen-audio-end-ui.md](./ebook/epub-listen-audio-end-ui.md)                                                                               |
| EPUB 听书播放本轮修复总览（含切章 / 软暂停 / loading / 选中色）    | [ebook/epub-listen-playback-fixes-2026-07.md](./ebook/epub-listen-playback-fixes-2026-07.md) · [ideas/epub-listen-playback-optimize.md](./ideas/epub-listen-playback-optimize.md) |
| EPUB 听书连播时播放钮 loading 只在首启出现                          | [ebook/epub-listen-loading-while-await.md](./ebook/epub-listen-loading-while-await.md) · [ebook/epub-listen-play-loading.md](./ebook/epub-listen-play-loading.md) |
| 书架已读进度出现很长小数                                          | [ebook/ebook-shelf-progress-pct.md](./ebook/ebook-shelf-progress-pct.md)                                                                               |
| EPUB 听书底栏切章 / 暂停续播与系统媒体同步                        | [ebook/epub-listen-bar-chapter-nav.md](./ebook/epub-listen-bar-chapter-nav.md) · [ebook/epub-listen-bar-playhead-toc.md](./ebook/epub-listen-bar-playhead-toc.md) · [ebook/epub-listen-soft-pause.md](./ebook/epub-listen-soft-pause.md) |
| 听书底栏上下章切到错误邻节（同 spine 多节）                        | [ebook/epub-listen-bar-playhead-toc.md](./ebook/epub-listen-bar-playhead-toc.md)                                                                     |
| 本机听书/听当前第一句无声、第二句正常                               | [english/tts-local-cancel-settle.md](./english/tts-local-cancel-settle.md) · [Influence-point/tts-local-cancel-settle.md](./Influence-point/tts-local-cancel-settle.md) |
| EPUB 听读播放背景在分栏/侧栏 resize 后错位或消失                    | [ebook/epub-listen-bg-resize-relayout.md](./ebook/epub-listen-bg-resize-relayout.md) · [Influence-point/epub-listen-resize-relayout.md](./Influence-point/epub-listen-resize-relayout.md) |
| 听当前无逐句淡黄底 / Safari 无背景                                | [ebook/epub-listen-sentence-bg.md](./ebook/epub-listen-sentence-bg.md)                                                                                   |
| 听当前跨段多句同时高亮 / 换句背景不消                               | [ebook/epub-listen-host-overlay.md](./ebook/epub-listen-host-overlay.md)                                                                                 |
| 听当前后划线重复 / 无法取消划线                                   | [ebook/epub-listen-user-highlight-reconcile.md](./ebook/epub-listen-user-highlight-reconcile.md)                                                         |
| MK 问书关闭后右侧空白 / 想法列表关后留白 / 开 MK 闪烁 / 删最后一条后未全宽 | [ebook/epub-read-split-panel.md](./ebook/epub-read-split-panel.md)                                                                                       |
| 右键菜单 PopBar 闪烁 / 无选区右键自动点词                         | [ebook/epub-context-menu-popbar.md](./ebook/epub-context-menu-popbar.md)                                                                                 |
| 开/关想法侧栏后左侧引用段滚出屏幕                                 | [ebook/epub-thought-quote-viewport.md](./ebook/epub-thought-quote-viewport.md)                                                                           |
| EPUB 阅读背景与顶栏/侧栏色差                                      | [ebook/epub-reader-surface-bg.md](./ebook/epub-reader-surface-bg.md)                                                                                     |
| EPUB 粉/米背景下按钮、边框或听书菜单看不清                        | [ebook/epub-reader-chrome-contrast.md](./ebook/epub-reader-chrome-contrast.md) · [ebook/epub-chrome-list-active-theme.md](./ebook/epub-chrome-list-active-theme.md) |
| EPUB 放大/全屏后正文贴左、需刷新才居中                            | [ebook/epub-window-resize-relayout.md](./ebook/epub-window-resize-relayout.md)                                                                           |
| EPUB 选区 PopBar 字色/投影不对或顶栏样式条不该出现                | [ebook/epub-selection-popbar-chrome.md](./ebook/epub-selection-popbar-chrome.md)                                                                         |
| 书摘分享弹窗按钮看不清 / 预览区与图片底色不一致                   | [ebook/epub-quote-share-dialog-chrome.md](./ebook/epub-quote-share-dialog-chrome.md)                                                                     |
| EPUB 阅读设置无法点击正文关闭                                     | [ebook/epub-reader-settings-dismiss.md](./ebook/epub-reader-settings-dismiss.md)                                                                         |
| 复制到助手后输入中文乱码                                          | [knowledge/assistant-insert-focus.md](./knowledge/assistant-insert-focus.md) §5.1                                                                        |
| 知识库纯预览右侧空「预览内容为空」/ 双预览占位                    | [monaco/markdown-view-panel-scroll.md](./monaco/markdown-view-panel-scroll.md)                                                                           |
| 预览 ↔ 编辑切换滚动错位 / 开助手后左侧总是编辑器                  | [monaco/markdown-view-panel-scroll.md](./monaco/markdown-view-panel-scroll.md) · [monaco/markdown-split-scroll-sync.md](./monaco/markdown-split-scroll-sync.md) |

---

## 文档类型

- **实现 / 修复**：各域下 `*-implementation*`、`*-complete*` 或专题名 md。
- **规划 / 实现思路**：[`ideas/`](./ideas/) — 需求阶段的架构图、流程图与分阶段步骤（Skill：`feature-implementation-idea`）。
- **运维**：`ops/deploy.md`、`ops/nginx.md`、`ops/server-deployment.md`。
- **用户向**：根目录 `project-guide.md`、`project-update-info.md`（正文不出现仓库路径）。

新增专题时请在对应域 `README.md` 登记一行，并视需要更新本表「常见排查」。
