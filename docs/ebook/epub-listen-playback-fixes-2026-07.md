# EPUB 听书播放改动索引（2026-07）

> **角色**：本轮听书 / 听当前相关 **已落地改动** 的索引（只列链接与一句话）；实现细节见各专题。  
> **规划中尚未落地**（装饰符号不读等）：见 [ideas/epub-listen-playback-optimize.md](../ideas/epub-listen-playback-optimize.md) 与 `apps/frontend/specs/demand.md`。

## 问题 → 处理一览

| # | 问题（用户视角） | 处理要点 | 专题文 |
|---|------------------|----------|--------|
| 1 | 逐句 HTTP 多、韵律碎；希望按段合成仍逐句高亮 | kick 首句快出声 + 段内 `cloudSingleUtterance` + 进度估句高亮 | [epub-listen-paragraph-tts.md](./epub-listen-paragraph-tts.md) |
| 2 | 听书中点目录切章不自动续听（或 go 抛错中断） | `trimContinuousViews` try/catch；TOC → `restartFromChapterStart` | [epub-listen-toc-chapter-restart.md](./epub-listen-toc-chapter-restart.md) |
| 3 | UI 倍速 2×，听感仍 1× | 复用 Audio 须在 canplay / 设 src **之后**再设 `playbackRate` | [epub-listen-rate-after-src.md](./epub-listen-rate-after-src.md) |
| 4 | 跨远章后「回到播放位置」FAB 无效 | CFI `display` 重挂载 + `registerChapterListenDomRemount` 重建句 Range | [epub-listen-follow-cfi-remount.md](./epub-listen-follow-cfi-remount.md) |
| 5 | 音频已停，播放条仍显示播放中 | `abortCloudAudioWait`；先挂 `waitCloudAudioEnd` 再 `play` | [epub-listen-audio-end-ui.md](./epub-listen-audio-end-ui.md) |
| 6 | 开听/切句/听当前首包与预取双 HTTP 抢带宽 | `onPlaybackStart` 出声后再 `schedulePrefetch`；kick 仅当前句 | [epub-listen-prefetch-after-start.md](./epub-listen-prefetch-after-start.md) |
| 7 | 底栏 ◀▶ 想切章而非切句 | TOC 邻项 / spine 回退 → `goEpubTocHref` → `restartFromChapterStart` | [epub-listen-bar-chapter-nav.md](./epub-listen-bar-chapter-nav.md) |
| 8 | 暂停后再播从头开始；系统播放与底栏不同步 | 软暂停保留 `currentTime`；Media Session + pause bridge；退出时 `register(null)` 尽力拆除（macOS 控件残留为平台限制） | [epub-listen-soft-pause.md](./epub-listen-soft-pause.md) |
| 9 | 当前 TTS pending 时播放钮无等待反馈 | `onAwaitingCurrentTts` → `status: loading`；钮上 Spinner（预取不触发） | [epub-listen-play-loading.md](./epub-listen-play-loading.md) |
| 10 | 换阅读背景后分句/目录选中项字色不可读 | 列表 active/idle 改跟 `text-textcolor`，勿用 `text-theme` | [epub-chrome-list-active-theme.md](./epub-chrome-list-active-theme.md) |
| 11 | 书架「已读约」出现长小数 | 展示层 `Math.round` + 0–100 夹紧 | [ebook-shelf-progress-pct.md](./ebook-shelf-progress-pct.md) |
| 12 | 同 HTML 多 `#filepos` 点目录滚到错节/章末 | Foliate CFI `display` + iframe 坐标顶对齐；`attachTocCfis` | [epub-toc-cfi-navigate.md](./epub-toc-cfi-navigate.md) |
| 13 | 同 spine 多节目录高亮总在末项/首项 | `tocCfi` vs 阅读 CFI；比较器全 0 防护；DOM 视口回退 | [epub-toc-active-cfi.md](./epub-toc-active-cfi.md) |
| 14 | 目录/底栏切章起播落文件第 0 句或上一节末句 | `restartFromChapterStart` + `resolveListenStartSentence` `mode: 'after'` | [epub-listen-toc-anchor-start.md](./epub-listen-toc-anchor-start.md) |
| 15 | 听书底栏上下章切到错误邻节 | `getPlayheadCfi` 进 `findActiveTocItemIndex`，勿只用阅读 CFI | [epub-listen-bar-playhead-toc.md](./epub-listen-bar-playhead-toc.md) |

## 规划稿

| 文档 | 说明 |
|------|------|
| [ideas/epub-listen-paragraph-tts.md](../ideas/epub-listen-paragraph-tts.md) | 按段 TTS 规划（实现已归档到本域 `epub-listen-paragraph-tts.md`） |
| [ideas/epub-listen-playback-optimize.md](../ideas/epub-listen-playback-optimize.md) | 播放体验优化需求（含尚未编码项） |

## 相关基线专题

- [epub-chapter-listen.md](./epub-chapter-listen.md) · [epub-listen-player-bar.md](./epub-listen-player-bar.md)
- [epub-listen-cloud-prefetch.md](./epub-listen-cloud-prefetch.md) · [epub-listen-auto-follow-fab.md](./epub-listen-auto-follow-fab.md)
- [developer/epub-listen-dev.md](./developer/epub-listen-dev.md)

---

（索引不重复粘贴源码；细节以各专题与仓库源码为准）
